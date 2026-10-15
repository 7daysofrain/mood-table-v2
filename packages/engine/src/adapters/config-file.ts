/**
 * Lectura del fichero de configuración (specs/engine-config, decisiones 3 y 8): el motor carga
 * siempre `config/local.json`, resuelto desde la raíz del repositorio y no desde el directorio de
 * trabajo, para que funcione igual con `pnpm dev` que como servicio en la Pi. La validación es la
 * función pura de `@moodtable/shared`; aquí solo está el disco.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Config, parseConfig } from '@moodtable/shared';

/** Raíz del repositorio, a partir de dónde está este fichero (`packages/engine/src/adapters`). */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Ruta del fichero, relativa a la raíz: es la que se ve en el log. */
export const CONFIG_FILE = join('config', 'local.json');

export type LoadedConfig =
  | { ok: true; config: Config; path: string }
  | { ok: false; error: string };

/** Lee y valida `config/local.json` de `root`. El error nombra el fichero y dice qué falla. */
export async function loadConfig(root: string = REPO_ROOT): Promise<LoadedConfig> {
  const path = join(root, CONFIG_FILE);

  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'no se encuentra el fichero de configuración'
        : `no se puede leer el fichero de configuración (${(error as Error).message})`;
    return { ok: false, error: `${path}: ${reason}` };
  }

  const result = parseConfig(text);
  if (!result.ok) return { ok: false, error: `${path}: ${result.error}` };
  return { ok: true, config: result.config, path };
}
