import { describe, expect, it } from 'vitest';

import { CHIP_CATALOG, chipOf } from './chips.ts';

describe('el catálogo de chips', () => {
  it('da 20 mA por canal a todo brillo a la WS2812B', () => {
    expect(chipOf('WS2812B').channelMilliamps).toBe(21);
  });

  it('da el orden de color GRB a la WS2812B', () => {
    expect(chipOf('WS2812B').colorOrder).toBe('GRB');
  });

  it.each(CHIP_CATALOG.map((chip) => [chip.id, chip] as const))(
    'da a %s un orden de color: una permutación de rojo, verde y azul',
    (_id, chip) => {
      expect(['RGB', 'RBG', 'GRB', 'GBR', 'BRG', 'BGR']).toContain(chip.colorOrder);
    },
  );

  it('de momento solo conoce la WS2812B', () => {
    expect(CHIP_CATALOG.map((chip) => chip.id)).toEqual(['WS2812B']);
  });
});
