import { describe, expect, it } from 'vitest';

import { CHIP_CATALOG, chipOf } from './chips.ts';

describe('el catálogo de chips', () => {
  it('da 20 mA por canal a todo brillo a la WS2812B', () => {
    expect(chipOf('WS2812B').channelMilliamps).toBe(20);
  });

  it('de momento solo conoce la WS2812B', () => {
    expect(CHIP_CATALOG.map((chip) => chip.id)).toEqual(['WS2812B']);
  });
});
