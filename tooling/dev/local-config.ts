/**
 * El simulador arranca sin preparar nada (specs/engine-config, decisiones 3 y 6): si no existe
 * `config/local.json`, se crea copiando `config/demo.json`. Si existe, no se toca: es el fichero de
 * la instalación de cada uno, y git lo ignora.
 */
import { constants } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DEMO_CONFIG = join('config', 'demo.json');
export const LOCAL_CONFIG = join('config', 'local.json');

/** Crea `config/local.json` en `root` a partir de la demo si no existe. Dice si lo ha creado. */
export async function ensureLocalConfig(root: string): Promise<'created' | 'kept'> {
  try {
    // COPYFILE_EXCL: falla si el destino existe, sin carrera entre comprobar y copiar.
    await copyFile(join(root, DEMO_CONFIG), join(root, LOCAL_CONFIG), constants.COPYFILE_EXCL);
    return 'created';
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return 'kept';
    throw error;
  }
}
