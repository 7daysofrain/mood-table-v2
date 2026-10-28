import { EFFECT_CATALOG } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { EFFECTS } from './registry.ts';

describe('el registro de efectos del motor', () => {
  it('tiene los mismos efectos que el catálogo de shared, con el mismo usesAudio', () => {
    const fields = ({ id, usesAudio }: { id: string; usesAudio: boolean }) => ({ id, usesAudio });

    expect(EFFECTS.map(fields)).toEqual(EFFECT_CATALOG.map(fields));
  });
});
