import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startTicker } from './ticker.ts';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('el temporizador del bucle', () => {
  it('a 60 fps, llama 60 veces por segundo además de la primera, al arrancar', () => {
    const calls: number[] = [];
    const ticker = startTicker(60, (now) => calls.push(now), Date.now);

    vi.advanceTimersByTime(1000);
    ticker.stop();

    expect(calls).toHaveLength(61);
    expect((calls.at(-1) ?? 0) - (calls[0] ?? 0)).toBe(1000);
  });

  it('si una vuelta tarda, no arrastra el retraso: salta al pulso siguiente', () => {
    const calls: number[] = [];
    let slow = true;
    const ticker = startTicker(
      10,
      (now) => {
        calls.push(now);
        // La primera vuelta tarda 250 ms: los pulsos de 100 y 200 ms ya han pasado.
        if (slow) vi.advanceTimersByTime(250);
        slow = false;
      },
      Date.now,
    );
    const startedAt = calls[0] ?? 0;

    vi.advanceTimersByTime(250);
    ticker.stop();

    expect(calls.map((now) => now - startedAt)).toEqual([0, 300, 400, 500]);
  });

  it('si el temporizador llega más de medio pulso tarde, no despierta para el pulso ya calculado', () => {
    const calls: number[] = [];
    const ticker = startTicker(10, (now) => calls.push(now), Date.now);
    const startedAt = calls[0] ?? 0;

    // El reloj salta 55 ms sin disparar temporizadores: la vuelta del pulso de 100 ms llega a los
    // 155 ms, y el bucle, que toma el pulso más cercano, ya calcula el de 200 ms.
    vi.advanceTimersByTime(99);
    vi.setSystemTime(Date.now() + 55);
    vi.advanceTimersByTime(250);
    ticker.stop();

    expect(calls.map((now) => now - startedAt)).toEqual([0, 155, 300, 400]);
  });

  it('al pararlo, deja de llamar', () => {
    const calls: number[] = [];
    const ticker = startTicker(60, (now) => calls.push(now), Date.now);

    ticker.stop();
    vi.advanceTimersByTime(1000);

    expect(calls).toHaveLength(1);
  });

  it('sin reloj, usa performance.now()', () => {
    const calls: number[] = [];
    const ticker = startTicker(60, (now) => calls.push(now));

    vi.advanceTimersByTime(100);
    ticker.stop();

    // Los temporizadores falsos de Vitest también mueven performance.now().
    expect(calls).toHaveLength(7);
    expect((calls.at(-1) ?? 0) - (calls[0] ?? 0)).toBeCloseTo(100, 0);
  });
});
