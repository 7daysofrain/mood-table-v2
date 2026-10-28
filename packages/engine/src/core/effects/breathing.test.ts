import { describe, expect, it } from 'vitest';

import { breathing } from './breathing.ts';
import { defaultParams } from './effect.ts';

const strip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' as const },
  ledCount: 60,
  effect: 'breathing' as const,
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
    // El máximo, en la mitad (segundo 2). Con el redondeo, el brillo alcanza 255 un poco antes.
    const peak = steps / 2;

    expect(Math.min(...levels)).toBeLessThanOrEqual(0.1 * 255);
    expect(levels[peak]).toBe(255);
    expect(isSorted(levels.slice(0, peak + 1), 'up')).toBe(true);
    expect(isSorted(levels.slice(peak), 'down')).toBe(true);
  });

  it('pinta el color de sus parámetros, también si cambia entre un frame y el siguiente', () => {
    const out = new Uint8Array(3);
    const memory = breathing.createMemory(strip);
    const ctx = { time: 2, dt: 0, audio: null };

    breathing.render(ctx, { color: '#FFA957', period: 4 }, memory, out);
    breathing.render(ctx, { color: '#FFA957', period: 4 }, memory, out);
    expect(colorsOf(out)).toEqual(['ffa957']);

    breathing.render(ctx, { color: '#2040ff', period: 4 }, memory, out);
    expect(colorsOf(out)).toEqual(['2040ff']);
  });

  it('el frame del segundo 4 es igual al del segundo 0', () => {
    expect(frameAt(4)).toEqual(frameAt(0));
  });

  describe('al cambiar el periodo en marcha', () => {
    const PULSE = 1 / 60;
    const color = '#FFA957';

    /** La respiración pintando con una sola memoria, frame a frame, como en el bucle. */
    function running() {
      const out = new Uint8Array(3);
      const memory = breathing.createMemory(strip);
      return (time: number, period: number) => {
        breathing.render({ time, dt: PULSE, audio: null }, { color, period }, memory, out);
        return out.slice();
      };
    }

    it('a media subida, el brillo del frame siguiente no salta: cambia lo que en un pulso', () => {
      // Con 4 s, el segundo 1 es la mitad de la subida: el brillo cambia allí más deprisa.
      const withChange = running();
      const without = running();
      const before = brightness(withChange(1, 4));
      without(1, 4);

      const jump = Math.abs(brightness(withChange(1 + PULSE, 6)) - before);
      const step = Math.abs(brightness(without(1 + PULSE, 4)) - before);

      expect(jump).toBeLessThanOrEqual(step);
    });

    it('sigue con el ritmo nuevo: de 4 a 8 s en el segundo 1, el frame del segundo 9 es el del 1', () => {
      const paint = running();
      paint(0.5, 4);
      const atOne = paint(1, 4);
      paint(1, 8);

      expect(paint(9, 8)).toEqual(atOne);
    });
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
