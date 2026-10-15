/**
 * Raíz de composición (README §2.1): el único módulo que conoce a la vez el núcleo y los
 * adaptadores. Carga la configuración, arranca el servidor del panel y el motor, y da a cada tira sus
 * salidas: el visor siempre (D43); la salida Adalight de las tiras físicas llega con H3. Si la
 * configuración no sirve o el servidor no puede escuchar, el motor no arranca: dice qué falla y
 * termina con código 1.
 */
import { join } from 'node:path';

import { loadConfig, REPO_ROOT } from './adapters/config-file.ts';
import { startServer } from './adapters/server.ts';
import { startEngine, startupMessage } from './engine.ts';

/** El build del panel, que sirve el motor (decisión 12). */
const PANEL_DIR = join(REPO_ROOT, 'packages', 'panel', 'dist');

async function main(): Promise<string | undefined> {
  const loaded = await loadConfig();
  if (!loaded.ok) return loaded.error;

  const { host, port } = loaded.config.server;
  let server;
  try {
    server = await startServer({ host, port, panelDir: PANEL_DIR });
  } catch (error) {
    return `No puede escuchar en ${host}:${port} (${(error as Error).message})`;
  }

  console.log(startupMessage(loaded.file, loaded.config, server.url));
  startEngine({
    config: loaded.config,
    createOutputs: (_strip, index) => [server.viewerOutput(index)],
  });
  return undefined;
}

const problem = await main();
if (problem) {
  console.error(`El motor no arranca. ${problem}`);
  process.exitCode = 1;
}
