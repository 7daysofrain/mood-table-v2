/**
 * Raíz de composición (README §2.1): el único módulo que conoce a la vez el núcleo y los
 * adaptadores. Carga la configuración, crea las salidas de cada tira y arranca el motor. Si la
 * configuración no sirve, el motor no arranca: dice qué falla y termina con código 1.
 */
import { CONFIG_FILE, loadConfig } from './adapters/config-file.ts';
import { startEngine, startupMessage } from './engine.ts';

const loaded = await loadConfig();

if (loaded.ok) {
  console.log(startupMessage(CONFIG_FILE, loaded.config));
  startEngine({
    config: loaded.config,
    // Una tira virtual solo tiene el visor, que llega con MOO-17; la salida Adalight, con H3.
    createOutputs: () => [],
  });
} else {
  console.error(`El motor no arranca. ${loaded.error}`);
  process.exitCode = 1;
}
