import { describe, expect, it } from 'vitest';

import { MemoryAudioSource } from './memory-audio-source.ts';

/** Un «fichero» de 10 s a 10 Hz cuyas muestras dicen su posición: la 37 vale 0,37. */
function ramp(): MemoryAudioSource {
  return new MemoryAudioSource(
    Float32Array.from({ length: 100 }, (_, index) => index / 100),
    10,
  );
}

/** Las posiciones de las muestras que da `read(time)` en una ventana de `length` muestras. */
function positionsAt(source: MemoryAudioSource, time: number, length: number): number[] {
  const out = new Float32Array(length);
  source.read(time, out);
  return Array.from(out, (sample) => Math.round(sample * 100));
}

describe('la fuente de audio en memoria', () => {
  it('dice su frecuencia de muestreo', () => {
    expect(ramp().sampleRate).toBe(10);
  });

  it('da las muestras que acaban en round(time × frecuencia)', () => {
    expect(positionsAt(ramp(), 2, 4)).toEqual([16, 17, 18, 19]);
    expect(positionsAt(ramp(), 2.04, 4)).toEqual([16, 17, 18, 19]);
    expect(positionsAt(ramp(), 2.06, 4)).toEqual([17, 18, 19, 20]);
  });

  it('una ventana que cruza el final lee el final y el principio', () => {
    expect(positionsAt(ramp(), 10.2, 4)).toEqual([98, 99, 0, 1]);
  });

  it('al arrancar, la ventana acaba en el principio: lo de antes es el final del bucle', () => {
    expect(positionsAt(ramp(), 0, 3)).toEqual([97, 98, 99]);
  });

  it('pasado el final, vuelve a empezar', () => {
    const source = ramp();

    expect(positionsAt(source, 12, 4)).toEqual(positionsAt(source, 2, 4));
    expect(positionsAt(source, 1002, 4)).toEqual(positionsAt(source, 2, 4));
  });

  it('con una ventana más larga que el fichero, lo repite', () => {
    const source = new MemoryAudioSource(Float32Array.from([0.01, 0.02, 0.03]), 10);

    expect(positionsAt(source, 0.3, 7)).toEqual([3, 1, 2, 3, 1, 2, 3]);
  });

  it('sin muestras, da silencio', () => {
    const out = new Float32Array([0.5, 0.5]);

    new MemoryAudioSource(new Float32Array(0), 44_100).read(1, out);

    expect(Array.from(out)).toEqual([0, 0]);
  });
});
