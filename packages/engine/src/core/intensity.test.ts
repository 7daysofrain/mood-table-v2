import { describe, expect, it } from 'vitest';

import { applyIntensity } from './intensity.ts';

describe('applyIntensity', () => {
  it('a 1 deja el frame tal cual', () => {
    const frame = Uint8Array.of(255, 169, 87, 1, 2, 3);

    applyIntensity(frame, 1);

    expect(Array.from(frame)).toEqual([255, 169, 87, 1, 2, 3]);
  });

  it('a 0,5 multiplica cada canal y redondea, no trunca', () => {
    const frame = Uint8Array.of(255, 169, 87);

    applyIntensity(frame, 0.5);

    // 127,5 → 128 · 84,5 → 85 · 43,5 → 44: truncando saldría 127, 84, 43.
    expect(Array.from(frame)).toEqual([128, 85, 44]);
  });

  it('a 0 apaga todos los canales', () => {
    const frame = Uint8Array.of(255, 169, 87, 12, 0, 200);

    applyIntensity(frame, 0);

    expect(Array.from(frame)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('con varios LEDs, escala cada canal por separado', () => {
    const frame = Uint8Array.of(255, 0, 100, 10, 20, 30, 1, 3, 255);

    applyIntensity(frame, 0.25);

    expect(Array.from(frame)).toEqual([64, 0, 25, 3, 5, 8, 0, 1, 64]);
  });

  it('escala el frame en su sitio', () => {
    const frame = Uint8Array.of(200, 100, 50);

    applyIntensity(frame, 0.5);

    expect(Array.from(frame)).toEqual([100, 50, 25]);
  });
});
