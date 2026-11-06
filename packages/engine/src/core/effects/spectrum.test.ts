import { describe, expect, it } from 'vitest';

import { type AudioFeatures, createAudioAnalyzer } from '../audio/analysis.ts';
import { defaultParams, type FrameContext } from './effect.ts';
import { spectrum } from './spectrum.ts';

const RATE = 44_100;
const FPS = 60;
const BANDS = 24;
const RED = 0;
const GREEN = 1;
const BLUE = 2;

function strip(ledCount: number) {
  return {
    id: 'demo',
    name: 'Tira de prueba',
    output: { type: 'virtual' as const },
    ledCount,
    effect: 'spectrum' as const,
  };
}

/** Unas bandas de audio con el mismo valor en todas, sin pasar por el análisis. */
function bands(value: number, silent = false): AudioFeatures {
  return { bands: new Float32Array(BANDS).fill(value), silent };
}

/**
 * Pinta un frame por cada audio de la lista, uno por pulso a `fps`, y devuelve una copia de cada
 * uno.
 */
function framesOf(ledCount: number, audios: (AudioFeatures | null)[], fps = FPS): Uint8Array[] {
  const memory = spectrum.createMemory(strip(ledCount));
  const out = new Uint8Array(ledCount * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / fps, audio: null };
  return audios.map((audio, pulse) => {
    ctx.time = (pulse + 1) / fps;
    ctx.audio = audio;
    spectrum.render(ctx, defaultParams(spectrum), memory, out);
    return out.slice();
  });
}

/**
 * Los frames del *espectro* durante `seconds` segundos de un tono continuo, que en cada pulso suena
 * a `frequencyAt(pulse)` Hz. Pasa por el análisis común, como en el motor.
 */
function toneFrames(
  frequencyAt: (pulse: number) => number,
  seconds: number,
  ledCount = 60,
): Uint8Array[] {
  const analyzer = createAudioAnalyzer(RATE);
  const memory = spectrum.createMemory(strip(ledCount));
  const out = new Uint8Array(ledCount * 3);
  const ctx: FrameContext = { time: 0, dt: 1 / FPS, audio: null };
  const frames: Uint8Array[] = [];
  for (let pulse = 1; pulse <= seconds * FPS; pulse++) {
    ctx.time = pulse / FPS;
    const frequency = frequencyAt(pulse);
    const start = ctx.time * RATE - analyzer.window.length;
    for (let index = 0; index < analyzer.window.length; index++) {
      analyzer.window[index] = Math.sin((2 * Math.PI * frequency * (start + index)) / RATE);
    }
    ctx.audio = analyzer.update(ctx.dt);
    spectrum.render(ctx, defaultParams(spectrum), memory, out);
    frames.push(out.slice());
  }
  return frames;
}

/** Los valores de un canal en cada LED. */
function channel(frame: Uint8Array, offset: number): number[] {
  return Array.from({ length: frame.length / 3 }, (_, led) => frame[led * 3 + offset] ?? 0);
}

/** Los LEDs con algún canal encendido. */
function litLeds(frame: Uint8Array): number[] {
  return Array.from({ length: frame.length / 3 }, (_, led) => led).filter((led) =>
    [RED, GREEN, BLUE].some((offset) => (frame[led * 3 + offset] ?? 0) > 0),
  );
}

/** El frame se ve igual desde los dos extremos. */
function isSymmetric(frame: Uint8Array): boolean {
  const ledCount = frame.length / 3;
  return Array.from({ length: ledCount }, (_, led) => led).every((led) =>
    [RED, GREEN, BLUE].every(
      (offset) => frame[led * 3 + offset] === frame[(ledCount - 1 - led) * 3 + offset],
    ),
  );
}

/** En cada LED encendido, el azul brilla más que el rojo y que el verde. */
function isMostlyBlue(frame: Uint8Array): boolean {
  return litLeds(frame).every((led) => {
    const [red, green, blue] = [RED, GREEN, BLUE].map((offset) => frame[led * 3 + offset] ?? 0);
    return (blue ?? 0) > (red ?? 0) && (blue ?? 0) > (green ?? 0);
  });
}

/** El LED más brillante del frame (la suma de sus tres canales). */
function brightestLed(frame: Uint8Array): number {
  const sums = Array.from(
    { length: frame.length / 3 },
    (_, led) => (frame[led * 3] ?? 0) + (frame[led * 3 + 1] ?? 0) + (frame[led * 3 + 2] ?? 0),
  );
  return sums.indexOf(Math.max(...sums));
}

describe('espectro', () => {
  it('es reactivo y no tiene parámetros', () => {
    expect(spectrum.usesAudio).toBe(true);
    expect(defaultParams(spectrum)).toEqual({});
  });

  it.each([
    ['sin rasgos del audio', null],
    ['en silencio', bands(1, true)],
  ])('%s, todos los LEDs a 0', (_case, audio) => {
    const out = new Uint8Array(30).fill(7);

    spectrum.render({ time: 1, dt: 1 / FPS, audio }, {}, spectrum.createMemory(strip(10)), out);

    expect(Array.from(out)).toEqual(Array.from({ length: 30 }, () => 0));
  });

  it('tras el silencio, el siguiente frame sigue donde iba el último con audio', () => {
    const music = Array.from({ length: 20 }, (_, pulse) => bands(0.3 + 0.2 * Math.sin(pulse)));
    const silence = Array.from({ length: 30 }, () => bands(1, true));
    const next = bands(0.4);

    const withoutSilence = framesOf(60, [...music, next]);
    const withSilence = framesOf(60, [...music, ...silence, next]);

    expect(withSilence.slice(music.length, -1).every((frame) => frame.every((v) => v === 0))).toBe(
      true,
    );
    expect(withSilence.at(-1)).toEqual(withoutSilence.at(-1));
  });

  it('un tono de 400 Hz, a los 10 s, enciende el centro, en azul y sin tocar el cuarto exterior', () => {
    const frame = toneFrames(() => 400, 10).at(-1) ?? new Uint8Array();
    const lit = litLeds(frame);

    // Con 60 LEDs, el cuarto exterior de cada lado son los LEDs 0 a 14 y 45 a 59.
    expect(lit).toContain(29);
    expect(lit).toContain(30);
    expect(lit.every((led) => led >= 15 && led <= 44)).toBe(true);
    expect(isSymmetric(frame)).toBe(true);
    expect(isMostlyBlue(frame)).toBe(true);
  });

  it('un tono de 8 kHz, a los 10 s, enciende los extremos, en azul y sin tocar la mitad central', () => {
    const frame = toneFrames(() => 8000, 10).at(-1) ?? new Uint8Array();
    const lit = litLeds(frame);

    // Con 60 LEDs, la mitad central son los LEDs 15 a 44.
    expect(lit.length).toBeGreaterThan(0);
    expect(lit.every((led) => led < 15 || led > 44)).toBe(true);
    expect(isSymmetric(frame)).toBe(true);
    expect(isMostlyBlue(frame)).toBe(true);
  });

  it('con un tono quieto, pasado el primer medio segundo, el verde de ningún LED pasa de 5', () => {
    const frames = toneFrames(() => 400, 10);

    const green = frames.slice(FPS / 2).flatMap((frame) => channel(frame, GREEN));

    expect(Math.max(...green)).toBeLessThanOrEqual(5);
  });

  it('al pasar de golpe de 400 Hz a 8 kHz, en ese frame hay verde en el centro y en los extremos', () => {
    const change = 10 * FPS + 1;
    const frames = toneFrames((pulse) => (pulse < change ? 400 : 8000), 10 + 1 / FPS);
    const green = channel(frames.at(-1) ?? new Uint8Array(), GREEN);

    // El centro (donde baja el grave) y cerca de los extremos (donde sube el agudo), a cada lado.
    const center = Math.max(...green.slice(25, 35));
    const left = Math.max(...green.slice(0, 15));
    const right = Math.max(...green.slice(45));
    expect(center).toBeGreaterThan(5);
    expect(left).toBeGreaterThan(5);
    expect(right).toBeGreaterThan(5);
  });

  it('al elegirlo con un tono de 400 Hz, arranca en rojo y a los 10 s solo queda el azul', () => {
    const frames = toneFrames(() => 400, 10);

    for (const frame of frames.slice(0, FPS / 2)) {
      expect(frame[brightestLed(frame) * 3 + RED]).toBeGreaterThan(128);
    }
    const last = frames.at(-1) ?? new Uint8Array();
    expect(Math.max(...channel(last, RED))).toBeLessThanOrEqual(5);
    expect(Math.max(...channel(last, BLUE).slice(25, 35))).toBeGreaterThan(0);
  });

  it.each([30, 60])('a %s fps, un mismo salto de la banda da el mismo verde', (fps) => {
    const before = Array.from({ length: fps }, () => bands(0.25));
    const frames = framesOf(60, [...before, bands(0.75)], fps);

    // Un salto de 0,5 en todas las bandas: 0,5 × 255 = 127,5, truncado a 127.
    expect(channel(frames.at(-1) ?? new Uint8Array(), GREEN)).toEqual(
      Array.from({ length: 60 }, () => 127),
    );
  });

  it('con un número impar de LEDs, los dos lados son iguales y el del centro es el de la banda más grave', () => {
    // De la banda más grave a la más aguda, cada una un poco menos fuerte que la anterior.
    const ramp: AudioFeatures = {
      bands: Float32Array.from({ length: BANDS }, (_, band) => 0.5 - band / 60),
      silent: false,
    };
    const frame = framesOf(61, Array.from({ length: 2 * FPS }, () => ramp)).at(-1) ?? new Uint8Array();
    const blue = channel(frame, BLUE);

    expect(isSymmetric(frame)).toBe(true);
    expect(blue[30]).toBe(Math.max(...blue));
    expect(blue[30]).toBeGreaterThan(blue[29] ?? 0);
  });
});
