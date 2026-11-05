import { describe, expect, it } from 'vitest';

import { type AudioFeatures, createAudioAnalyzer } from '../audio/analysis.ts';
import { defaultParams, type FrameContext } from './effect.ts';
import { scroll } from './scroll.ts';

const RATE = 44_100;
const FPS = 60;
const BANDS = 24;

function strip(ledCount: number) {
  return {
    id: 'demo',
    name: 'Tira de prueba',
    output: { type: 'virtual' as const },
    ledCount,
    effect: 'scroll' as const,
  };
}

/** Unas bandas de audio con el mismo valor en todas, sin pasar por el análisis. */
function bands(value: number, silent = false): AudioFeatures {
  return { bands: new Float32Array(BANDS).fill(value), silent };
}

/** Bandas bajas, sin llegar a silencio: el color que entra por el centro es 0. */
const QUIET = bands(1e-3);
/** Un golpe: diez veces más fuerte que la ganancia inicial al cuadrado, en todas las bandas. */
const HIT = bands(0.1);

/**
 * Pinta un frame por cada audio de la lista, uno por pulso a `fps`, y devuelve una copia de cada
 * uno.
 */
function framesOf(ledCount: number, audios: (AudioFeatures | null)[], fps = FPS): Uint8Array[] {
  const memory = scroll.createMemory(strip(ledCount));
  const out = new Uint8Array(ledCount * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / fps, audio: null };
  return audios.map((audio, pulse) => {
    ctx.time = (pulse + 1) / fps;
    ctx.audio = audio;
    scroll.render(ctx, defaultParams(scroll), memory, out);
    return out.slice();
  });
}

/**
 * El último frame de *scroll* tras `seconds` segundos de un tono continuo de `frequency` Hz. Dos
 * segundos bastan para que el destello del arranque (la ganancia empieza en 0,01) salga de la tira.
 */
function frameAfterTone(frequency: number, ledCount: number, seconds = 2): Uint8Array {
  const analyzer = createAudioAnalyzer(RATE);
  const memory = scroll.createMemory(strip(ledCount));
  const out = new Uint8Array(ledCount * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / FPS, audio: null };
  for (let pulse = 1; pulse <= seconds * FPS; pulse++) {
    ctx.time = pulse / FPS;
    const start = ctx.time * RATE - analyzer.window.length;
    for (let index = 0; index < analyzer.window.length; index++) {
      analyzer.window[index] = Math.sin((2 * Math.PI * frequency * (start + index)) / RATE);
    }
    ctx.audio = analyzer.update(ctx.dt);
    scroll.render(ctx, defaultParams(scroll), memory, out);
  }
  return out;
}

/** Los valores de un canal (0 rojo, 1 verde, 2 azul) en cada LED. */
function channel(frame: Uint8Array, offset: number): number[] {
  return Array.from({ length: frame.length / 3 }, (_, led) => frame[led * 3 + offset] ?? 0);
}

/** Igual por los dos lados, encendido en el centro y, del centro hacia fuera, nunca sube. */
function fadesFromCenter(values: number[]): boolean {
  const symmetric = values.every((value, led) => value === values[values.length - 1 - led]);
  const center = Math.floor((values.length - 1) / 2);
  const outwards = values.slice(0, center + 1).reverse();
  const fading = outwards.every((value, step) => step === 0 || value <= (outwards[step - 1] ?? 0));
  return symmetric && fading && (values[center] ?? 0) > 0;
}

/** Los LEDs encendidos son del color de `offset`: ese canal brilla más que los otros dos. */
function isTinted(frame: Uint8Array, offset: number): boolean {
  return Array.from({ length: frame.length / 3 }, (_, led) => led).every((led) => {
    const rgb = [frame[led * 3] ?? 0, frame[led * 3 + 1] ?? 0, frame[led * 3 + 2] ?? 0];
    const lit = rgb.some((value) => value > 0);
    return !lit || rgb.every((value, index) => index === offset || value < (rgb[offset] ?? 0));
  });
}

describe('scroll', () => {
  it('es reactivo y no tiene parámetros', () => {
    expect(scroll.usesAudio).toBe(true);
    expect(defaultParams(scroll)).toEqual({});
  });

  it.each([
    ['sin rasgos del audio', null],
    ['en silencio', bands(1, true)],
  ])('%s, todos los LEDs a 0', (_case, audio) => {
    const out = new Uint8Array(30).fill(7);

    scroll.render({ time: 1, dt: 1 / FPS, audio }, {}, scroll.createMemory(strip(10)), out);

    expect(Array.from(out)).toEqual(Array.from({ length: 30 }, () => 0));
  });

  it('tras el silencio, el siguiente frame sigue donde iba el último con audio', () => {
    const music = Array.from({ length: 20 }, (_, pulse) => bands(0.05 + 0.05 * Math.sin(pulse)));
    const silence = Array.from({ length: 30 }, () => bands(1, true));
    const next = bands(0.08);

    const withoutSilence = framesOf(60, [...music, next]);
    const withSilence = framesOf(60, [...music, ...silence, next]);

    expect(withSilence.slice(music.length, -1).every((frame) => frame.every((v) => v === 0))).toBe(
      true,
    );
    expect(withSilence.at(-1)).toEqual(withoutSilence.at(-1));
  });

  it('un tono de 400 Hz pinta un rastro rojo, simétrico y que se apaga hacia fuera', () => {
    const frame = frameAfterTone(400, 60);

    expect(fadesFromCenter(channel(frame, 0))).toBe(true);
    expect(isTinted(frame, 0)).toBe(true);
  });

  it('un tono de 8 kHz pinta un rastro azul, simétrico y que se apaga hacia fuera', () => {
    const frame = frameAfterTone(8000, 60);

    expect(fadesFromCenter(channel(frame, 2))).toBe(true);
    expect(isTinted(frame, 2)).toBe(true);
  });

  it('10 frames después de entrar por el centro, un color está a 10 LEDs y con 0,98^10 de su brillo', () => {
    // Un segundo bajo, para que se apaguen la memoria inicial y el destello del arranque.
    const before = Array.from({ length: FPS }, () => QUIET);
    const after = Array.from({ length: 10 }, () => QUIET);
    const frames = framesOf(60, [...before, HIT, ...after]);
    const entered = channel(frames[before.length] ?? new Uint8Array(), 0);
    const later = channel(frames.at(-1) ?? new Uint8Array(), 0);

    // Con 60 LEDs, el centro son los LEDs 29 y 30; 10 LEDs más allá, el 19 y el 40.
    const initial = entered[30] ?? 0;
    expect(initial).toBeGreaterThan(200);
    for (const led of [19, 40]) {
      expect(later[led]).toBe(Math.max(...later));
      expect(Math.abs((later[led] ?? 0) - initial * 0.98 ** 10)).toBeLessThanOrEqual(1);
    }
  });

  it.each([
    [30, 6],
    [60, 12],
  ])('a %s fps, 0,2 s después de entrar por el centro, un golpe está a %s LEDs', (fps, leds) => {
    // El fichero de golpes no sirve aquí: a los 80 ms del golpe entra en silencio y la tira se apaga.
    const before = Array.from({ length: fps }, () => QUIET);
    const after = Array.from({ length: 0.2 * fps }, () => QUIET);
    const later = channel(framesOf(60, [...before, HIT, ...after], fps).at(-1) ?? new Uint8Array(), 0);

    // Con 60 LEDs, el centro son los LEDs 29 y 30.
    expect(later[29 - leds]).toBe(Math.max(...later));
    expect(later[30 + leds]).toBe(Math.max(...later));
    expect(Math.max(...later)).toBeGreaterThan(0);
  });

  it('con un número impar de LEDs, los dos lados son iguales y el del centro lleva el color nuevo', () => {
    const before = Array.from({ length: FPS }, () => QUIET);
    const frames = framesOf(61, [...before, HIT, QUIET, QUIET]);
    const entered = channel(frames[before.length] ?? new Uint8Array(), 0);
    const later = channel(frames.at(-1) ?? new Uint8Array(), 0);

    // El LED 30 es el centro: el golpe entra solo por él y dos frames después está en el 28 y el 32.
    expect(entered[30]).toBe(Math.max(...entered));
    expect(entered.filter((value) => value > 0)).toHaveLength(1);
    expect(later[30]).toBe(0);
    expect(later[28]).toBe(Math.max(...later));
    expect(later).toEqual([...later].reverse());
  });
});
