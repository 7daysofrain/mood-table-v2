import { describe, expect, it } from 'vitest';

import { blur, follow, gaussianKernel, smoothingFactor } from './dsp.ts';

describe('el suavizado de la v1 con dt', () => {
  it('a 50 fps es el factor de la v1, y a 25 fps, el de dos frames seguidos', () => {
    expect(smoothingFactor(0.1, 1 / 50)).toBeCloseTo(0.1, 12);
    expect(smoothingFactor(0.1, 1 / 25)).toBeCloseTo(1 - 0.9 ** 2, 12);
  });

  it('con dt 0 no se mueve', () => {
    expect(smoothingFactor(0.99, 0)).toBe(0);
    expect(follow(0.3, 1, 0.99, 0.1, 0)).toBe(0.3);
  });

  it('sube con el factor de subida y baja con el de bajada', () => {
    expect(follow(0, 1, 0.99, 0.1, 1 / 50)).toBeCloseTo(0.99, 12);
    expect(follow(1, 0, 0.99, 0.1, 1 / 50)).toBeCloseTo(0.9, 12);
  });

  it('en un segundo llega igual de lejos a 30 que a 60 fps', () => {
    let at30 = 1;
    let at60 = 1;
    for (let frame = 0; frame < 30; frame++) at30 = follow(at30, 0, 0.99, 0.1, 1 / 30);
    for (let frame = 0; frame < 60; frame++) at60 = follow(at60, 0, 0.99, 0.1, 1 / 60);

    expect(at30).toBeCloseTo(at60, 12);
  });
});

describe('el desenfoque gaussiano de SciPy', () => {
  it('sus pesos suman 1 y tienen radio int(4 × sigma + 0,5)', () => {
    const kernel = gaussianKernel(4);

    expect(kernel).toHaveLength(33);
    expect(kernel.reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(1, 12);
  });

  it('da lo mismo que gaussian_filter1d([1, 2, 3, 4, 5], sigma=1), el ejemplo de SciPy', () => {
    const out = new Float64Array(5);

    blur([1, 2, 3, 4, 5], out, gaussianKernel(1));

    const expected = [1.42704095, 2.06782203, 3, 3.93217797, 4.57295905];
    out.forEach((value, index) => {
      expect(value).toBeCloseTo(expected[index] ?? Number.NaN, 7);
    });
  });

  it('con un radio mayor que la señal, sigue reflejando en los bordes', () => {
    const out = new Float64Array(3);

    blur([2, 2, 2], out, gaussianKernel(4));

    expect(Array.from(out, (value) => Number(value.toFixed(12)))).toEqual([2, 2, 2]);
  });
});
