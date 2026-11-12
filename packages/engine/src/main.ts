/**
 * Raíz de composición (README §2.1): el único módulo que conoce a la vez el núcleo y los
 * adaptadores. Carga la configuración y la fuente de audio, si la declara, abre los puertos serie
 * de las tiras físicas, abre y restaura el estado del instrumento, crea desde él el búfer de
 * control, arranca el servidor del panel (que anuncia la fuente, el estado de la tarjeta, las tiras
 * y la intensidad, envía su nivel y la posición del fichero, sirve el fichero y recibe los mandos de
 * la API), el guardador del estado y el motor, y da a cada tira sus salidas: el visor siempre (D43)
 * y, a las tiras físicas, también su salida Adalight. Si la configuración no sirve, el fichero de
 * audio no se puede leer o su formato no vale, la tarjeta de sonido o el puerto de una tira física
 * no se pueden abrir, o el servidor no puede escuchar, el motor no arranca: dice qué falla y termina
 * con código 1. El estado del instrumento, en cambio, nunca impide arrancar.
 */
import { join } from 'node:path';

import type { InstrumentStateConfig } from '@moodtable/shared';

import { openAdalightStrips } from './adapters/adalight.ts';
import { openSerialLink } from './adapters/adalight.hardware.ts';
import { loadAudioFile } from './adapters/audio-file.ts';
import { loadConfig, REPO_ROOT } from './adapters/config-file.ts';
import { createMemoryStateStore } from './adapters/memory-state-store.ts';
import { startServer } from './adapters/server.ts';
import { openSoundcard } from './adapters/soundcard.ts';
import { spawnCapture } from './adapters/soundcard.hardware.ts';
import { type OpenedStateStore, openSqliteStateStore } from './adapters/sqlite-state-store.ts';
import { createControl } from './core/control.ts';
import { restore } from './core/restore.ts';
import { startStateSaver } from './core/state-saver.ts';
import type { InstrumentState } from './core/state-store.ts';
import {
  powerLimitMessages,
  sourceMessage,
  startEngine,
  startupMessage,
  stripOutputs,
  stripsMessage,
} from './engine.ts';

/** El build del panel, que sirve el motor (decisión 12). */
const PANEL_DIR = join(REPO_ROOT, 'packages', 'panel', 'dist');

/**
 * El adaptador del estado del instrumento que declara el fichero (decisión 7 del change
 * instrument-state-restore). Con SQLite, nunca impide arrancar: lo que haya pasado al abrir vuelve
 * como aviso.
 */
function openInstrumentState(config: InstrumentStateConfig): OpenedStateStore {
  if (config.type === 'memory') {
    return { store: createMemoryStateStore(), close: () => undefined };
  }
  return openSqliteStateStore(config.path, { log: (line) => console.error(line) });
}

/**
 * El estado guardado. Si no se puede leer, el motor arranca como la primera vez y lo dice al log:
 * el estado del instrumento nunca impide arrancar (decisión 4).
 */
function loadSaved({ store }: OpenedStateStore): InstrumentState {
  try {
    return store.load();
  } catch (error) {
    console.error(
      `No se ha podido leer el estado guardado del instrumento (${(error as Error).message}); ` +
        'el motor arranca como la primera vez.',
    );
    return {};
  }
}

async function main(): Promise<string | undefined> {
  const loaded = await loadConfig();
  if (!loaded.ok) return loaded.error;

  // La fuente se abre antes que el servidor, para no arrancar a medias. Con la tarjeta, su pérdida
  // y su recuperación en plena sesión van al log de errores y el motor sigue (decisión 5 del
  // change soundcard-audio-source, D60); su estado va a los paneles; no hay fichero que servir en
  // `/audio`.
  const { audioSource } = loaded.config;
  const audio = audioSource?.type === 'file' ? await loadAudioFile(audioSource.path) : undefined;
  if (audio && !audio.ok) return audio.error;
  const soundcard =
    audioSource?.type === 'soundcard'
      ? await openSoundcard(audioSource, spawnCapture, (line) => console.error(line))
      : undefined;
  if (soundcard && !soundcard.ok) return soundcard.error;

  // Los puertos de las tiras físicas, después de la fuente y antes del servidor, también para no
  // arrancar a medias: si uno no se abre, el motor no arranca (decisión 4 del change
  // adalight-strip-output). La medida de cada tira y su pérdida en plena sesión van al log, y el
  // motor sigue (decisiones 3 y 5).
  const physical = await openAdalightStrips(loaded.config.strips, openSerialLink, {
    log: (line) => console.log(line),
    now: () => performance.now(),
  });
  if (!physical.ok) {
    soundcard?.stop();
    return physical.error;
  }

  // El estado del instrumento, antes que el búfer de control (design.md, decisión 8 del change
  // instrument-state-restore). Si no se ha podido recuperar o no se puede guardar, el motor arranca
  // igual y lo dice al log (decisión 4).
  const instrumentState = openInstrumentState(loaded.config.instrumentState);
  if (instrumentState.notice) console.error(instrumentState.notice);

  // Lo guardado, conciliado con las tiras del fichero (decisión 6): cada tira con su efecto y sus
  // valores, o con los del fichero. Los avisos van al log.
  const restored = restore({
    strips: loaded.config.strips,
    hasAudioSource: audioSource !== undefined,
    saved: loadSaved(instrumentState),
  });
  for (const notice of restored.notices) console.error(notice);

  // El búfer de control, antes que el servidor y el bucle, que dependen de él (decisión 1 del
  // change strip-effect-switch), desde el estado restaurado.
  const control = createControl({
    strips: loaded.config.strips,
    hasAudioSource: audioSource !== undefined,
    initial: restored.state,
  });

  const { host, port } = loaded.config.server;
  let server;
  try {
    server = await startServer({
      host,
      port,
      panelDir: PANEL_DIR,
      source: sourceMessage(loaded.config),
      audioBytes: audio?.ok ? audio.bytes : undefined,
      watchSourceStatus: soundcard?.onStatus,
      strips: { ...control, snapshot: () => stripsMessage(loaded.config, control) },
      intensity: control,
    });
  } catch (error) {
    // Un `arecord` vivo, un intento pendiente o un puerto serie abierto mantendrían el proceso en
    // marcha, y el motor no terminaría.
    soundcard?.stop();
    for (const output of physical.outputs.values()) output.close();
    instrumentState.close();
    return `No puede escuchar en ${host}:${port} (${(error as Error).message})`;
  }

  // El guardador, sobre los avisos del búfer: guarda el estado entero 500 ms después del último
  // cambio, venga del mando que venga (decisión 2, D103). El adaptador SQLite lo escribe en un
  // *worker*, así que la luz no espera a la tarjeta (D105). Después del servidor: antes no llega
  // ningún cambio.
  startStateSaver({
    control,
    store: instrumentState.store,
    timer: {
      set: (callback, ms) => setTimeout(callback, ms),
      clear: (handle) => clearTimeout(handle as NodeJS.Timeout),
    },
    log: (line) => console.error(line),
  });

  console.log(
    [
      startupMessage(loaded.file, loaded.config, server.url),
      ...powerLimitMessages(loaded.config),
    ].join('\n'),
  );
  startEngine({
    config: loaded.config,
    control,
    createOutputs: stripOutputs((index) => server.viewerOutput(index), physical.outputs),
    audioSource: audio?.source ?? soundcard?.source,
    levelOutputs: [server.levelOutput],
    positionOutputs: [server.positionOutput],
  });
  return undefined;
}

const problem = await main();
if (problem) {
  console.error(`El motor no arranca. ${problem}`);
  process.exitCode = 1;
}
