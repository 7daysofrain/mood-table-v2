import { describe, expect, it } from 'vitest';

import { levelToDecibels, levelToFill } from './level.ts';

describe('la escala del vúmetro', () => {
  it.each([
    [1, 0],
    [0.1, -20],
    [0.001, -60],
  ])('el nivel %f son %f dB', (level, decibels) => {
    expect(levelToDecibels(level)).toBeCloseTo(decibels, 9);
  });

  it('por debajo de −60 dB, en silencio o con un nivel que no es un número, se queda en −60', () => {
    expect(levelToDecibels(0.0001)).toBe(-60);
    expect(levelToDecibels(0)).toBe(-60);
    expect(levelToDecibels(-1)).toBe(-60);
    expect(levelToDecibels(Number.NaN)).toBe(-60);
  });

  it('por encima de 0 dB, se queda en 0', () => {
    expect(levelToDecibels(2)).toBe(0);
  });

  it('va vacío a −60 dB o menos y lleno a 0 dB', () => {
    expect(levelToFill(0)).toBe(0);
    expect(levelToFill(0.001)).toBeCloseTo(0, 9);
    expect(levelToFill(1)).toBe(1);
  });

  it('entre medias, en proporción a los decibelios', () => {
    expect(levelToFill(0.1)).toBeCloseTo(2 / 3, 9);
  });
});
