import { describe, expect, it } from 'vitest';

import { EFFECT_CATALOG, needsAudioSource } from './effects.ts';

describe('qué efectos necesitan una fuente de audio', () => {
  it('la respiración, que es de ambiente, no la necesita', () => {
    expect(needsAudioSource('breathing')).toBe(false);
  });

  it('energía, que es reactivo, la necesita', () => {
    expect(needsAudioSource('energy')).toBe(true);
  });

  it.each(EFFECT_CATALOG.map((effect) => [effect.id, effect.usesAudio] as const))(
    '%s: lo dice usesAudio del catálogo (%s)',
    (id, usesAudio) => {
      expect(needsAudioSource(id)).toBe(usesAudio);
    },
  );
});
