import { describe, expect, it } from 'vitest';

import { linearRamp } from './ramp.ts';

describe('la rampa lineal', () => {
  it('empieza en `from` y tiene `steps` valores', () => {
    const ramp = linearRamp(0, 10, 5);

    expect(ramp[0]).toBe(0);
    expect(ramp).toHaveLength(5);
  });
});
