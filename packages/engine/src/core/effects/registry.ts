/**
 * Registro de efectos del motor (decisión 10 del change virtual-strip-audio-file): el render de cada
 * efecto del catálogo de `@moodtable/shared`, con el mismo id, el mismo `usesAudio` y su mismo
 * esquema de parámetros, sin copiarlo. El búfer de control busca aquí el efecto de cada tira, al
 * arrancar y en cada cambio.
 */
import { breathing } from './breathing.ts';
import type { Effect } from './effect.ts';
import { energy } from './energy.ts';

/**
 * Un efecto cualquiera, sin importar el tipo de sus parámetros ni de su memoria: el bucle solo los
 * pasa de `defaultParams` y `createMemory` a `render`.
 */
export type AnyEffect = Effect<unknown, unknown>;

export const EFFECTS: readonly AnyEffect[] = [breathing, energy];
