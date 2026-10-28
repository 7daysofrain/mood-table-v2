/**
 * El OpenAPI de la API del motor (decisión 6 del change strip-effect-switch), generado de los
 * esquemas de sus rutas. `pnpm openapi` lo escribe en `docs/openapi.yaml`, y un test comprueba que
 * el fichero del repositorio está al día.
 */
import { join } from 'node:path';

import { REPO_ROOT } from './adapters/config-file.ts';
import { buildServer } from './adapters/server.ts';

/** Donde se guarda el OpenAPI en el repositorio. */
export const OPENAPI_FILE = join(REPO_ROOT, 'docs', 'openapi.yaml');

/** El OpenAPI en YAML: monta la app con sus rutas, sin escuchar ni servir el panel. */
export async function openApiYaml(): Promise<string> {
  const engine = await buildServer({ panelDir: join(REPO_ROOT, 'no-hay-panel') });
  try {
    await engine.app.ready();
    return engine.app.swagger({ yaml: true });
  } finally {
    await engine.close();
  }
}
