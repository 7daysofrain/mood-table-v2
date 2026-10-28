/**
 * Arranque del motor: monta el bucle con las tiras de la configuración, sus salidas y el búfer de
 * control, y lo pone en marcha con el temporizador. `main.ts` le pasa las piezas reales; los tests,
 * una salida en memoria.
 */
import { basename } from 'node:path';

import type {
  Config,
  SourceMessage,
  StripConfig,
  StripsMessage,
  StripState,
} from '@moodtable/shared';

import { startTicker, type Ticker } from './adapters/ticker.ts';
import type { AudioSource } from './core/audio/audio-source.ts';
import type { ControlBuffer } from './core/control.ts';
import {
  createFrameLoop,
  type LevelOutput,
  type LightOutput,
  type PositionOutput,
} from './core/frame-loop.ts';

export interface EngineOptions {
  config: Config;
  /** El búfer de control, creado con las tiras de `config`: el bucle lee de él el efecto de cada una. */
  control: ControlBuffer;
  /**
   * Las salidas de cada tira, con su posición en el fichero. Las decide la raíz de composición
   * (decisión 2).
   */
  createOutputs: (strip: StripConfig, index: number) => LightOutput[];
  /** La fuente de audio, si el fichero declara una. */
  audioSource?: AudioSource;
  /** Quién recibe el nivel de la fuente en cada pulso. */
  levelOutputs?: LevelOutput[];
  /** Quién recibe la posición del fichero de audio en cada pulso. */
  positionOutputs?: PositionOutput[];
  /** Reloj monótono en milisegundos. Por defecto, `performance.now()`. */
  clock?: () => number;
}

export function startEngine({
  config,
  control,
  createOutputs,
  audioSource,
  levelOutputs,
  positionOutputs,
  clock,
}: EngineOptions): Ticker {
  const loop = createFrameLoop(
    config.strips.map((strip, index) => ({ config: strip, outputs: createOutputs(strip, index) })),
    control,
    config.fps,
    { audioSource, levelOutputs, positionOutputs },
  );
  return startTicker(
    config.fps,
    (now) => {
      loop.tick(now);
    },
    clock,
  );
}

/**
 * La línea de log del arranque: qué fichero ha cargado, cuántas tiras, a qué fps y dónde se abre el
 * panel.
 */
export function startupMessage(file: string, config: Config, panelUrl: string): string {
  const strips = config.strips.length === 1 ? '1 tira' : `${config.strips.length} tiras`;
  return `Mood Table: cargado ${file} · ${strips} a ${config.fps} fps · panel en ${panelUrl}`;
}

/**
 * La fuente de audio tal como se anuncia a los paneles: si es un fichero, solo su nombre, nunca la
 * ruta, que en la demo pública es la del disco de la instancia (decisión 5 del change
 * virtual-strip-audio-file); si es una tarjeta de sonido, el nombre que le da la configuración, nunca
 * su cadena de ALSA (decisión 9 del change soundcard-audio-source).
 */
export function sourceMessage(config: Config): SourceMessage {
  const { audioSource } = config;
  if (!audioSource) return { kind: 'none' };
  return audioSource.type === 'file'
    ? { kind: 'file', name: basename(audioSource.path) }
    : { kind: 'soundcard', name: audioSource.name };
}

/**
 * Las tiras tal como se anuncian a los paneles (decisión 3 del change strip-effect-switch): las del
 * fichero, en su orden, con el efecto que pinta cada una según el búfer de control y sus valores.
 * Solo lo que muestra el panel: lo que H3 y H4 añadan a la tira no sale sin decidirlo.
 */
export function stripsMessage(config: Config, control: ControlBuffer): StripsMessage {
  return {
    strips: config.strips.map(({ id, name, ledCount, output }, index) => {
      const { effect, values } = control.slot(index);
      // El tipo no ve que los valores son los de `effect`: el búfer solo acepta los que cumplen su
      // esquema.
      return { id, name, ledCount, output, effect, values } as StripState;
    }),
  };
}
