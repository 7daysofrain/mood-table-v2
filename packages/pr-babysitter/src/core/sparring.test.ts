import { describe, expect, it } from 'vitest';

import { withinWait } from './sparring.ts';

describe('la espera', () => {
  it('sigue a tiempo al empezar', () => {
    expect(withinWait(0, 30)).toBe(true);
  });
});
