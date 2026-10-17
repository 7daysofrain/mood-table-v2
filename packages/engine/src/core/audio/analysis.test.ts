import { describe, expect, it } from 'vitest';

import { type AudioAnalyzer, createAudioAnalyzer } from './analysis.ts';

const RATE = 44_100;
const PULSE = 1 / 50;

/** Rellena la ventana con un seno continuo de `frequency` Hz, la que acaba en el instante `time`. */
function fillTone(analyzer: AudioAnalyzer, frequency: number, time: number, amplitude = 1): void {
  const { window } = analyzer;
  const start = time * RATE - window.length;
  for (let index = 0; index < window.length; index++) {
    window[index] = amplitude * Math.sin((2 * Math.PI * frequency * (start + index)) / RATE);
  }
}

/** Las bandas tras dos segundos de un tono a 50 pulsos por segundo. */
function bandsAfterTone(frequency: number): number[] {
  const analyzer = createAudioAnalyzer(RATE);
  let bands: number[] = [];
  for (let pulse = 1; pulse <= 100; pulse++) {
    fillTone(analyzer, frequency, pulse * PULSE);
    bands = Array.from(analyzer.update(PULSE).bands);
  }
  return bands;
}

/** Las posiciones de las `count` bandas con más energía. */
function strongest(bands: number[], count: number): number[] {
  return bands
    .map((energy, index) => ({ energy, index }))
    .sort((a, b) => b.energy - a.energy)
    .slice(0, count)
    .map(({ index }) => index);
}

describe('el análisis del audio', () => {
  it.each([
    [44_100, 1764],
    [48_000, 1920],
  ])('a %i Hz, la ventana dura 40 ms (%i muestras) y la FFT es de 2048', (rate, samples) => {
    const analyzer = createAudioAnalyzer(rate);

    expect(analyzer.window).toHaveLength(samples);
    expect(analyzer.fftSize).toBe(2048);
  });

  it('el nivel de un silencio es 0', () => {
    expect(createAudioAnalyzer(RATE).level()).toBe(0);
  });

  it('el nivel de un seno de amplitud 1 ronda 0,707, y el de amplitud 0,5, la mitad', () => {
    const analyzer = createAudioAnalyzer(RATE);

    fillTone(analyzer, 1000, 1);
    expect(analyzer.level()).toBeCloseTo(Math.SQRT1_2, 3);
    fillTone(analyzer, 1000, 1, 0.5);
    expect(analyzer.level()).toBeCloseTo(Math.SQRT1_2 / 2, 3);
  });

  it('da 24 bandas', () => {
    expect(bandsAfterTone(1000)).toHaveLength(24);
  });

  it('con un tono de 400 Hz, las bandas con más energía están en el tercio inferior', () => {
    expect(strongest(bandsAfterTone(400), 3).every((band) => band < 8)).toBe(true);
  });

  it('con un tono de 8 kHz, las bandas con más energía están en el tercio superior', () => {
    expect(strongest(bandsAfterTone(8000), 3).every((band) => band >= 16)).toBe(true);
  });

  it('marca el silencio digital como silencio, y una señal mínima, no', () => {
    const analyzer = createAudioAnalyzer(RATE);

    expect(analyzer.update(PULSE).silent).toBe(true);
    analyzer.window[100] = 1 / 32_768;
    expect(analyzer.update(PULSE).silent).toBe(false);
  });

  it('en silencio, las bandas no cambian', () => {
    const analyzer = createAudioAnalyzer(RATE);
    fillTone(analyzer, 400, 1);
    const before = Array.from(analyzer.update(PULSE).bands);

    analyzer.window.fill(0);

    expect(Array.from(analyzer.update(PULSE).bands)).toEqual(before);
  });

  it('entrega siempre el mismo objeto: no crea objetos en cada pulso', () => {
    const analyzer = createAudioAnalyzer(RATE);
    const first = analyzer.update(PULSE);
    fillTone(analyzer, 400, 1);

    expect(analyzer.update(PULSE)).toBe(first);
  });
});
