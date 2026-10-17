/**
 * Efecto *energía* (specs/effects). Sin implementar todavía: sus tests están en rojo.
 */
import { type EnergyParams, EnergyParamsSchema } from '@moodtable/shared';

import type { Effect } from './effect.ts';

export type EnergyMemory = null;

export const energy: Effect<EnergyParams, EnergyMemory> = {
  id: 'energy',
  usesAudio: true,
  paramsSchema: EnergyParamsSchema,

  createMemory: () => null,

  render(ctx, _params, _memory, out) {
    throw new Error(`Sin implementar (${ctx.time} s, ${out.length} bytes)`);
  },
};
