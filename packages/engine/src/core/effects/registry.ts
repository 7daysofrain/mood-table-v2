/**
 * Registro de efectos del motor (decisión 10 del change virtual-strip-audio-file): el render de cada
 * efecto del catálogo de `@moodtable/shared`, con el mismo id y el mismo `usesAudio`. El bucle busca
 * aquí el efecto que declara cada tira.
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
