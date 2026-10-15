import { describe, expect, it } from 'vitest';

import { breathing } from './breathing.ts';
import { defaultParams } from './effect.ts';

const strip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' as const },
  ledCount: 60,
};

/** El frame de la respiración con sus valores por defecto en el instante `time` (segundos). */
function frameAt(time: number): Uint8Array {
  const out = new Uint8Array(strip.ledCount * 3);
  const memory = breathing.createMemory(strip);
  breathing.render({ time, dt: 0, audio: null }, defaultParams(breathing), memory, out);
  return out;
}

/** El color de cada LED en hexadecimal (`ffa957`). */
function colorsOf(frame: Uint8Array): string[] {
  return Array.from({ length: frame.length / 3 }, (_, led) =>
    Array.from(frame.subarray(led * 3, led * 3 + 3), (byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  );
}

/** Brillo del frame: el canal más alto de su primer LED (todos son iguales). */
function brightness(frame: Uint8Array): number {
  return Math.max(frame[0] ?? 0, frame[1] ?? 0, frame[2] ?? 0);
}

function isSorted(levels: number[], order: 'up' | 'down'): boolean {
  return levels.every((level, index) => {
    const previous = levels[index - 1];
    if (previous === undefined) return true;
    return order === 'up' ? level >= previous : level <= previous;
  });
}

describe('la respiración', () => {
  it('es un efecto de ambiente: no usa audio', () => {
    expect(breathing.usesAudio).toBe(false);
  });

  it.each([0, 0.4, 1.3, 2, 3.7])('pinta todos los LEDs del mismo color (t = %s s)', (time) => {
    expect(new Set(colorsOf(frameAt(time))).size).toBe(1);
  });

  it('da una respiración completa en 4 s: sube de casi apagado al máximo y vuelve a bajar', () => {
    const steps = 4 * 60;
    const levels = Array.from({ length: steps + 1 }, (_, step) =>
      brightness(frameAt((step * 4) / steps)),
    );
    const peak = levels.indexOf(Math.max(...levels));

    expect(Math.min(...levels)).toBeLessThanOrEqual(0.1 * 255);
    expect(Math.max(...levels)).toBe(255);
    expect(peak).toBe(steps / 2);
    expect(isSorted(levels.slice(0, peak + 1), 'up')).toBe(true);
    expect(isSorted(levels.slice(peak), 'down')).toBe(true);
  });

  it('el frame del segundo 4 es igual al del segundo 0', () => {
    expect(frameAt(4)).toEqual(frameAt(0));
  });

  it('da los frames de referencia con una tira de 60 LEDs en 0, 1, 2 y 3 s', async () => {
    const golden = Object.fromEntries(
      [0, 1, 2, 3].map((time) => [`${time} s`, colorsOf(frameAt(time)).join(' ')]),
    );

    await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot(
      './__golden__/breathing-60-leds.json',
    );
  });
});
