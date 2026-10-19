/**
 * Raíz de composición (README §2.1): el único módulo que conoce a la vez el núcleo y los
 * adaptadores. Carga la configuración y la fuente de audio, si la declara, arranca el servidor del
 * panel (que anuncia la fuente y envía su nivel) y el motor, y da a cada tira sus salidas: el visor
 * siempre (D43); la salida Adalight de las tiras físicas llega con H3. Si la configuración no sirve,
 * el fichero de audio no se puede leer o su formato no vale, o el servidor no puede escuchar, el
 * motor no arranca: dice qué falla y termina con código 1.
 */
import { join } from 'node:path';

import { loadAudioFile } from './adapters/audio-file.ts';
import { loadConfig, REPO_ROOT } from './adapters/config-file.ts';
import { startServer } from './adapters/server.ts';
import { sourceMessage, startEngine, startupMessage } from './engine.ts';

/** El build del panel, que sirve el motor (decisión 12). */
const PANEL_DIR = join(REPO_ROOT, 'packages', 'panel', 'dist');

async function main(): Promise<string | undefined> {
  const loaded = await loadConfig();
  if (!loaded.ok) return loaded.error;

  // La fuente se lee antes de abrir el servidor, para no arrancar a medias.
  const { audioSource } = loaded.config;
  const audio = audioSource ? await loadAudioFile(audioSource.path) : undefined;
  if (audio && !audio.ok) return audio.error;

  const { host, port } = loaded.config.server;
  let server;
  try {
    server = await startServer({
      host,
      port,
      panelDir: PANEL_DIR,
      source: sourceMessage(loaded.config),
    });
  } catch (error) {
    return `No puede escuchar en ${host}:${port} (${(error as Error).message})`;
  }

  console.log(startupMessage(loaded.file, loaded.config, server.url));
  startEngine({
    config: loaded.config,
    createOutputs: (_strip, index) => [server.viewerOutput(index)],
    audioSource: audio?.ok ? audio.source : undefined,
    levelOutputs: [server.levelOutput],
  });
  return undefined;
}

const problem = await main();
if (problem) {
  console.error(`El motor no arranca. ${problem}`);
  process.exitCode = 1;
}
