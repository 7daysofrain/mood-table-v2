import { describe, expect, it } from 'vitest';

import { lastN, percent } from './prueba-hilos.ts';

describe('las ayudas de prueba', () => {
  it('el porcentaje entero', () => {
    expect(percent(1, 4)).toBe(25);
  });

  it('los últimos elementos', () => {
    expect(lastN([1, 2, 3], 2)).toEqual([2, 3]);
  });

  it('ninguno si no se pide ninguno', () => {
    expect(lastN([1, 2, 3], 0)).toEqual([]);
  });
});
