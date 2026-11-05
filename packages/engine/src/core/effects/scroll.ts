/**
 * Efecto *scroll* (specs/effects, change scroll-effect): de momento apaga la tira.
 */
import { type ScrollParams, ScrollParamsSchema } from '@moodtable/shared';

import type { Effect } from './effect.ts';

export const scroll: Effect<ScrollParams, null> = {
  id: 'scroll',
  usesAudio: true,
  paramsSchema: ScrollParamsSchema,

  createMemory: () => null,

  render(_ctx, _params, _memory, out) {
    out.fill(0);
  },
};
