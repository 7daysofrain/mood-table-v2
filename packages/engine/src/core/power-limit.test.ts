import { chipOf } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { applyPowerLimit, createPowerLimit, estimateAmps } from './power-limit.ts';

/** La tira de la mesa: 173 LEDs `WS2812B`. */
const LEDS = 173;
const WS2812B = chipOf('WS2812B');

/** Un frame de la mesa con todos los LEDs del mismo color. */
function filled(red: number, green: number, blue: number): Uint8Array {
  const frame = new Uint8Array(LEDS * 3);
  for (let led = 0; led < LEDS; led++) frame.set([red, green, blue], led * 3);
  return frame;
}

/** Un generador de números al azar con semilla, para que los frames sean siempre los mismos. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2 ** 31;
    return state / 2 ** 31;
  };
}

describe('la estimación del consumo de un frame', () => {
  it('todo a 255 en la mesa pide 10,38 A', () => {
    expect(estimateAmps(filled(255, 255, 255), WS2812B)).toBeCloseTo(10.38, 6);
  });

  it('todo a 128 pide unos 2,6 A, una cuarta parte del blanco total y no la mitad', () => {
    // El 128 sale a 64 de PWM: 519 · 20 mA · 64/255.
    expect(estimateAmps(filled(128, 128, 128), WS2812B)).toBeCloseTo(2.605, 3);
  });

  it('cuenta el PWM que se envía, ya redondeado: el 12 sale a 1/255', () => {
    const frame = new Uint8Array(3).fill(12);

    expect(estimateAmps(frame, WS2812B)).toBeCloseTo((3 * 0.02) / 255, 9);
  });
});

describe('el límite de potencia', () => {
  it('con 8 A, todo blanco sale a 200 y se queda por debajo del 80 %', () => {
    const frame = filled(255, 255, 255);

    applyPowerLimit(frame, createPowerLimit(8, WS2812B, LEDS));

    expect(frame.every((value) => value === 200)).toBe(true);
    expect(estimateAmps(frame, WS2812B)).toBeCloseTo(6.39, 2);
    expect(estimateAmps(frame, WS2812B)).toBeLessThan(6.4);
  });

  it('con 8 A, el rojo puro (3,46 A) cabe y sale tal cual', () => {
    const frame = filled(255, 0, 0);
    expect(estimateAmps(frame, WS2812B)).toBeCloseTo(3.46, 6);
    frame.set([15, 0, 0], 0);
    const before = Array.from(frame);

    applyPowerLimit(frame, createPowerLimit(8, WS2812B, LEDS));

    expect(Array.from(frame)).toEqual(before);
  });

  it('con 8 A, un LED tenue no se apaga: los blancos a 200 y él a (12, 31, 0)', () => {
    const frame = filled(255, 255, 255);
    frame.set([15, 40, 0], 0);

    applyPowerLimit(frame, createPowerLimit(8, WS2812B, LEDS));

    expect(Array.from(frame.subarray(0, 3))).toEqual([12, 31, 0]);
    expect(frame.subarray(3).every((value) => value === 200)).toBe(true);
  });

  it('un canal por debajo de 12 baja sin suelo: ya estaba apagado en la tira', () => {
    const frame = filled(255, 255, 255);
    frame.set([10, 11, 1], 0);

    applyPowerLimit(frame, createPowerLimit(8, WS2812B, LEDS));

    // 10 · 0,787 = 7,9 → 7 · 11 · 0,787 = 8,7 → 8 · 1 · 0,787 = 0,8 → 0.
    expect(Array.from(frame.subarray(0, 3))).toEqual([7, 8, 0]);
  });

  it('con 18 A, todo blanco cabe y sale tal cual', () => {
    const frame = filled(255, 255, 255);

    applyPowerLimit(frame, createPowerLimit(18, WS2812B, LEDS));

    expect(frame.every((value) => value === 255)).toBe(true);
  });

  it('con frames al azar, el consumo tras el límite nunca pasa de los amperios de la fuente', () => {
    const random = seeded(135);
    for (const supplyAmps of [0.06, 0.08, 0.12, 0.5, 2, 5, 8]) {
      const limit = createPowerLimit(supplyAmps, WS2812B, LEDS);
      for (let run = 0; run < 300; run++) {
        const frame = randomFrame(run % 3, random);

        applyPowerLimit(frame, limit);

        expect(estimateAmps(frame, WS2812B)).toBeLessThanOrEqual(supplyAmps);
      }
    }
  });

  it('con 0,12 A, el redondeo de los valores bajos no hace pasar de la fuente', () => {
    // El caso de la revisión de la #134: estimando sin redondear, enviaba 132 mA.
    const frame = filled(12, 12, 12);
    frame.fill(255, 0, 53);

    applyPowerLimit(frame, createPowerLimit(0.12, WS2812B, LEDS));

    expect(estimateAmps(frame, WS2812B)).toBeLessThanOrEqual(0.12);
  });

  it('con una fuente que no aguanta el suelo, baja sin suelo y no pasa de la fuente', () => {
    // 37 canales a 255 y el resto a 12: con suelo, pediría 68 mA.
    const frame = filled(12, 12, 12);
    frame.fill(255, 0, 37);

    applyPowerLimit(frame, createPowerLimit(0.06, WS2812B, LEDS));

    expect(estimateAmps(frame, WS2812B)).toBeLessThanOrEqual(0.06);
    expect(frame[LEDS * 3 - 1]).toBeLessThan(12);
  });

  it('baja el frame en su sitio', () => {
    const frame = filled(255, 255, 255);
    const same = frame;

    applyPowerLimit(frame, createPowerLimit(8, WS2812B, LEDS));

    expect(frame).toBe(same);
    expect(frame[0]).toBe(200);
  });
});

describe('el límite de una tira', () => {
  it('usa como mucho el 80 % de los amperios de la fuente', () => {
    expect(createPowerLimit(8, WS2812B, LEDS).maxAmps).toBeCloseTo(6.4, 6);
    expect(createPowerLimit(18, WS2812B, LEDS).maxAmps).toBeCloseTo(14.4, 6);
  });

  it('mantiene siempre el suelo si la fuente aguanta el 80 % más una unidad de PWM por canal', () => {
    // En la mesa, hace falta una fuente de unos 0,2035 A.
    expect(createPowerLimit(8, WS2812B, LEDS).floorAlwaysHolds).toBe(true);
    expect(createPowerLimit(0.21, WS2812B, LEDS).floorAlwaysHolds).toBe(true);
    expect(createPowerLimit(0.2, WS2812B, LEDS).floorAlwaysHolds).toBe(false);
    expect(createPowerLimit(0.06, WS2812B, LEDS).floorAlwaysHolds).toBe(false);
  });
});

/**
 * Un frame al azar de la mesa con una de tres formas: valores cualesquiera; valores altos, para que
 * el límite actúe a menudo; o unos canales a 255 y el resto a 12, el peor caso del suelo.
 */
function randomFrame(shape: number, random: () => number): Uint8Array {
  const length = LEDS * 3;
  if (shape === 2) {
    const frame = new Uint8Array(length).fill(12);
    frame.fill(255, 0, Math.floor(random() * 80));
    return frame;
  }
  const low = shape === 0 ? 0 : 180;
  return Uint8Array.from({ length }, () => Math.floor(low + random() * (256 - low)));
}
