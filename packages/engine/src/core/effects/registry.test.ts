import { EFFECT_CATALOG } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { EFFECTS } from './registry.ts';

describe('el registro de efectos del motor', () => {
  it('tiene los mismos efectos que el catálogo de shared, con el mismo usesAudio', () => {
    const registered = EFFECTS.map(({ id, usesAudio, paramsSchema }) => ({
      id,
      usesAudio,
      paramsSchema,
    }));

    expect(registered).toEqual(EFFECT_CATALOG);
  });

  it.each(EFFECT_CATALOG.map((effect) => [effect.id, effect] as const))(
    '%s valida con el esquema de parámetros del catálogo, no con una copia',
    (id, { paramsSchema }) => {
      expect(EFFECTS.find((effect) => effect.id === id)?.paramsSchema).toBe(paramsSchema);
    },
  );
});
