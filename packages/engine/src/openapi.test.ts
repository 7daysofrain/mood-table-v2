/**
 * El OpenAPI del repositorio, al día (decisión 6 del change strip-effect-switch): quien corrige la
 * entrega lee `docs/openapi.yaml`, no el motor en marcha, así que no puede quedarse viejo.
 */
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { OPENAPI_FILE, openApiYaml } from './openapi.ts';

/** El fichero del repositorio, o nada si no existe. */
async function committed(): Promise<string> {
  try {
    return await readFile(OPENAPI_FILE, 'utf8');
  } catch {
    return '';
  }
}

describe('docs/openapi.yaml', () => {
  it('es el OpenAPI que genera el código', async () => {
    expect(
      await committed(),
      'docs/openapi.yaml no coincide con el OpenAPI de las rutas: regenéralo con `pnpm openapi`',
    ).toBe(await openApiYaml());
  });

  it('describe la ruta del cambio de efecto', async () => {
    expect(await openApiYaml()).toContain('/api/strips/{stripId}/effect:');
  });
});
