/**
 * Efecto *espectro* (specs/effects, decisiones 1 a 3 del change spectrum-effect): el
 * `visualize_spectrum` de la v1. De momento apaga la tira; el port llega en el paso siguiente.
 */
import { type SpectrumParams, SpectrumParamsSchema } from '@moodtable/shared';

import type { Effect } from './effect.ts';

export const spectrum: Effect<SpectrumParams, null> = {
  id: 'spectrum',
  usesAudio: true,
  paramsSchema: SpectrumParamsSchema,

  createMemory: () => null,

  render(_ctx, _params, _memory, out) {
    out.fill(0);
  },
};
