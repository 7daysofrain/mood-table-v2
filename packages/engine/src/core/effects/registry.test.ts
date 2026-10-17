import { EFFECT_CATALOG } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { EFFECTS } from './registry.ts';

describe('el registro de efectos del motor', () => {
  it('tiene los mismos efectos que el catálogo de shared, con el mismo usesAudio', () => {
    const registered = EFFECTS.map(({ id, usesAudio }) => ({ id, usesAudio }));

    expect(registered).toEqual(EFFECT_CATALOG);
  });
});
