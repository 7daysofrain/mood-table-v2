import { describe, expect, it } from 'vitest';

import { layoutStrips, ROW_HEIGHT } from './layout.ts';

describe('la geometría del visor', () => {
  it('pone una fila por tira, en el orden del índice, y un punto por LED', () => {
    const frames = new Map([
      [1, new Uint8Array(2 * 3)],
      [0, new Uint8Array(4 * 3)],
    ]);

    const { height, dots } = layoutStrips(frames, 400);

    expect(height).toBe(2 * ROW_HEIGHT);
    expect(dots.filter((dot) => dot.y === ROW_HEIGHT / 2)).toHaveLength(4);
    expect(dots.filter((dot) => dot.y === ROW_HEIGHT * 1.5)).toHaveLength(2);
  });

  it('reparte los puntos de cada tira a lo ancho del visor', () => {
    const { dots } = layoutStrips(new Map([[0, new Uint8Array(4 * 3)]]), 400);

    expect(dots.map((dot) => dot.x)).toEqual([50, 150, 250, 350]);
  });

  it('cada punto lleva el color de su LED', () => {
    const { dots } = layoutStrips(new Map([[0, Uint8Array.of(255, 169, 87, 0, 0, 255)]]), 100);

    expect(dots.map((dot) => dot.color)).toEqual(['rgb(255 169 87)', 'rgb(0 0 255)']);
  });

  it('los puntos caben en su fila y no se tocan', () => {
    const { dots } = layoutStrips(new Map([[0, new Uint8Array(300 * 3)]]), 600);

    const radius = dots[0]?.radius ?? 0;
    expect(radius).toBeGreaterThan(0);
    expect(radius * 2).toBeLessThan(600 / 300);
    expect(radius * 2).toBeLessThan(ROW_HEIGHT);
  });

  it('sin tiras, no hay puntos y el visor conserva el alto de una fila', () => {
    expect(layoutStrips(new Map(), 400)).toEqual({ height: ROW_HEIGHT, dots: [] });
  });
});
