/**
 * Lectura del fichero de configuración (specs/engine-config, decisiones 3 y 8): el motor carga
 * siempre `config/local.json`, resuelto desde la raíz del repositorio y no desde el directorio de
 * trabajo, para que funcione igual con `pnpm dev` que como servicio en la Pi. La validación es la
 * función pura de `@moodtable/shared`; aquí solo está el disco. Solo para los tests, la variable de
 * entorno `MOODTABLE_CONFIG` indica otro fichero (matiz de la decisión 3).
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Config, parseConfig } from '@moodtable/shared';

/** Raíz del repositorio, a partir de dónde está este fichero (`packages/engine/src/adapters`). */
export const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/** Ruta del fichero, relativa a la raíz: es la que se ve en el log, igual en todos los sistemas. */
export const CONFIG_FILE = 'config/local.json';

/** Variable de entorno con la ruta de otro fichero de configuración. Solo para los tests (E2E). */
export const CONFIG_ENV = 'MOODTABLE_CONFIG';

export type LoadedConfig =
  /** `file` es como se nombra el fichero en el log; `path`, su ruta absoluta. */
  | { ok: true; config: Config; path: string; file: string }
  | { ok: false; error: string };

/**
 * Lee y valida `config/local.json` de `root`, o el fichero de `override` si lo hay (relativo al
 * directorio de trabajo). El error nombra el fichero y dice qué falla.
 */
export async function loadConfig(
  root: string = REPO_ROOT,
  override: string | undefined = process.env[CONFIG_ENV],
): Promise<LoadedConfig> {
  const path = override ? resolve(override) : join(root, CONFIG_FILE);

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
  return { ok: true, config: result.config, path, file: override || CONFIG_FILE };
}
