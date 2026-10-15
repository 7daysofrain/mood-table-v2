/**
 * Efecto *respiración* (specs/effects). Sin implementar todavía: sus tests están en rojo.
 */
import Type, { type Static } from 'typebox';

import type { Effect } from './effect.ts';

export const BreathingParamsSchema = Type.Object({ color: Type.String(), period: Type.Number() });

export type BreathingParams = Static<typeof BreathingParamsSchema>;

export const breathing: Effect<BreathingParams, null> = {
  id: 'breathing',
  usesAudio: false,
  paramsSchema: BreathingParamsSchema,
  createMemory: () => null,
  render() {
    throw new Error('Sin implementar');
  },
};
