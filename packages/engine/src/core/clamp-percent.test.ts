import { describe, expect, it } from 'vitest';

import { clampPercent } from './clamp-percent.ts';

describe('el recorte de un porcentaje', () => {
  it('deja en 100 lo que pasa de 100', () => {
    expect(clampPercent(150)).toBe(100);
  });
});
