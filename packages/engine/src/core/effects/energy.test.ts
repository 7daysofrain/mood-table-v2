import { describe, expect, it } from 'vitest';

import { createAudioAnalyzer } from '../audio/analysis.ts';
import { defaultParams, type FrameContext } from './effect.ts';
import { energy } from './energy.ts';

const RATE = 44_100;
const FPS = 60;

function strip(ledCount: number) {
  return {
    id: 'demo',
    name: 'Tira de prueba',
    output: { type: 'virtual' as const },
    ledCount,
    effect: 'energy' as const,
  };
}

/** El último frame de *energía* tras `seconds` segundos de un tono continuo de `frequency` Hz. */
function frameAfterTone(frequency: number, ledCount: number, seconds = 1): Uint8Array {
  const analyzer = createAudioAnalyzer(RATE);
  const memory = energy.createMemory(strip(ledCount));
  const out = new Uint8Array(ledCount * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / FPS, audio: null };
  for (let pulse = 1; pulse <= seconds * FPS; pulse++) {
    ctx.time = pulse / FPS;
    const start = ctx.time * RATE - analyzer.window.length;
    for (let index = 0; index < analyzer.window.length; index++) {
      analyzer.window[index] = Math.sin((2 * Math.PI * frequency * (start + index)) / RATE);
    }
    ctx.audio = analyzer.update(ctx.dt);
    energy.render(ctx, defaultParams(energy), memory, out);
  }
  return out;
}

/** Los valores de un canal (0 rojo, 1 verde, 2 azul) en cada LED. */
function channel(frame: Uint8Array, offset: number): number[] {
  return Array.from({ length: frame.length / 3 }, (_, led) => frame[led * 3 + offset] ?? 0);
}

/** Lo encendido es un tramo centrado y simétrico: igual por los dos lados y sin huecos. */
function isCenteredSegment(values: number[]): boolean {
  const symmetric = values.every((value, led) => value === values[values.length - 1 - led]);
  const center = Math.floor((values.length - 1) / 2);
  // Del centro hacia fuera, nunca sube.
  const outwards = values.slice(0, center + 1).reverse();
  const fading = outwards.every((value, step) => step === 0 || value <= (outwards[step - 1] ?? 0));
  return symmetric && fading && (values[center] ?? 0) > 0;
}

describe('energía', () => {
  it('es reactiva y no tiene parámetros', () => {
    expect(energy.usesAudio).toBe(true);
    expect(defaultParams(energy)).toEqual({});
  });

  it('sin rasgos del audio, todos los LEDs a 0', () => {
    const out = new Uint8Array(30).fill(7);

    energy.render({ time: 1, dt: 1 / FPS, audio: null }, {}, energy.createMemory(strip(10)), out);

    expect(Array.from(out)).toEqual(Array.from({ length: 30 }, () => 0));
  });

  it('en silencio, todos los LEDs a 0', () => {
    const out = new Uint8Array(30).fill(7);
    const silence = { bands: new Float32Array(24).fill(1), silent: true };

    energy.render({ time: 1, dt: 1 / FPS, audio: silence }, {}, energy.createMemory(strip(10)), out);

    expect(Array.from(out)).toEqual(Array.from({ length: 30 }, () => 0));
  });

  it('un tono de 400 Hz enciende solo el rojo, en un tramo centrado y simétrico', () => {
    const frame = frameAfterTone(400, 60);

    expect(isCenteredSegment(channel(frame, 0))).toBe(true);
    expect(channel(frame, 1).every((value) => value === 0)).toBe(true);
    expect(channel(frame, 2).every((value) => value === 0)).toBe(true);
  });

  it('un tono de 8 kHz enciende solo el azul, en un tramo centrado y simétrico', () => {
    const frame = frameAfterTone(8000, 60);

    expect(isCenteredSegment(channel(frame, 2))).toBe(true);
    expect(channel(frame, 0).every((value) => value === 0)).toBe(true);
    expect(channel(frame, 1).every((value) => value === 0)).toBe(true);
  });

  it('en una tira de LEDs impares, el tramo también queda centrado', () => {
    expect(isCenteredSegment(channel(frameAfterTone(400, 61), 0))).toBe(true);
  });
});
