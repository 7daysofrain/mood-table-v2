import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { decodeWav, type MonoAudio } from './wav.ts';

/** El fichero de golpes aislados de los tests (decisión 15). */
const GOLPES = readFileSync(new URL('../../test/fixtures/golpes.wav', import.meta.url));

const INVALID = 'formato no válido: se acepta WAV PCM de 16 bits, mono o estéreo';

/** Subformato PCM de `WAVE_FORMAT_EXTENSIBLE`: el GUID `00000001-0000-0010-8000-00aa00389b71`. */
const PCM_SUBFORMAT = [1, 0, 0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71];
const FLOAT_SUBFORMAT = [3, ...PCM_SUBFORMAT.slice(1)];

/** Un bloque RIFF: id de 4 letras, tamaño y contenido, con el byte de relleno si es impar. */
function chunk(id: string, body: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(8 + body.length + (body.length % 2));
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < 4; index++) bytes[index] = id.charCodeAt(index);
  view.setUint32(4, body.length, true);
  bytes.set(body, 8);
  return bytes;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const bytes = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

interface Format {
  tag?: number;
  channels?: number;
  sampleRate?: number;
  bits?: number;
  /** Con `tag` 0xFFFE (`WAVE_FORMAT_EXTENSIBLE`), el GUID del subformato. */
  subformat?: number[];
}

function fmt({ tag = 1, channels = 1, sampleRate = 44_100, bits = 16, subformat }: Format) {
  const body = new Uint8Array(subformat ? 40 : 16);
  const view = new DataView(body.buffer);
  const blockAlign = (channels * bits) / 8;
  view.setUint16(0, tag, true);
  view.setUint16(2, channels, true);
  view.setUint32(4, sampleRate, true);
  view.setUint32(8, sampleRate * blockAlign, true);
  view.setUint16(12, blockAlign, true);
  view.setUint16(14, bits, true);
  if (subformat) {
    view.setUint16(16, 22, true);
    view.setUint16(18, bits, true);
    body.set(subformat, 24);
  }
  return chunk('fmt ', body);
}

/** Muestras enteras de 16 bits, intercaladas por canal. */
function data(samples: number[]): Uint8Array {
  const body = new Uint8Array(samples.length * 2);
  const view = new DataView(body.buffer);
  samples.forEach((sample, index) => {
    view.setInt16(index * 2, sample, true);
  });
  return chunk('data', body);
}

function riff(...chunks: Uint8Array[]): Uint8Array {
  const wave = concat([new TextEncoder().encode('WAVE'), ...chunks]);
  return chunk('RIFF', wave);
}

function audioOf(bytes: Uint8Array): MonoAudio {
  const result = decodeWav(bytes);
  if (!result.ok) throw new Error(`Se esperaba audio y da «${result.error}»`);
  return result.audio;
}

describe('el decodificador WAV', () => {
  it('el fichero de golpes da 4 s de muestras mono a 44,1 kHz', () => {
    const audio = audioOf(GOLPES);

    expect(audio.sampleRate).toBe(44_100);
    expect(audio.samples).toHaveLength(4 * 44_100);
  });

  it('el fichero de golpes tiene silencio digital antes del primer golpe y señal en él', () => {
    const { samples } = audioOf(GOLPES);
    const peak = (from: number, to: number) =>
      Math.max(...Array.from(samples.subarray(from, to), Math.abs));

    expect(peak(0, 44_100)).toBe(0);
    expect(peak(44_100, 44_100 + 2205)).toBeGreaterThan(0.5);
    expect(peak(44_100 + 2205, 2 * 44_100)).toBe(0);
  });

  it('da las muestras de -1 a 1', () => {
    const { samples } = audioOf(riff(fmt({}), data([0, 16_384, -32_768, 32_767])));

    expect(Array.from(samples)).toEqual([0, 0.5, -1, 32_767 / 32_768]);
  });

  it('un WAV estéreo a 48 kHz se mezcla a mono con la media de los dos canales', () => {
    const audio = audioOf(
      riff(fmt({ channels: 2, sampleRate: 48_000 }), data([1000, 3000, -2000, -4000])),
    );

    expect(audio.sampleRate).toBe(48_000);
    expect(Array.from(audio.samples)).toEqual([2000 / 32_768, -3000 / 32_768]);
  });

  it('acepta WAVE_FORMAT_EXTENSIBLE con subformato PCM', () => {
    const audio = audioOf(riff(fmt({ tag: 0xfffe, subformat: PCM_SUBFORMAT }), data([16_384])));

    expect(Array.from(audio.samples)).toEqual([0.5]);
  });

  it('se salta los bloques que no son fmt ni data, como LIST, también si su tamaño es impar', () => {
    // 11 bytes: lleva un byte de relleno detrás.
    const list = chunk('LIST', new TextEncoder().encode('INFOISFTLav'));
    const audio = audioOf(riff(list, fmt({}), list, data([16_384, -16_384])));

    expect(Array.from(audio.samples)).toEqual([0.5, -0.5]);
  });

  it.each([
    ['un WAV de 24 bits', riff(fmt({ bits: 24 }), data([0, 0, 0]))],
    ['un WAV en coma flotante', riff(fmt({ tag: 3, bits: 32 }), data([0, 0]))],
    [
      'WAVE_FORMAT_EXTENSIBLE en coma flotante',
      riff(fmt({ tag: 0xfffe, bits: 32, subformat: FLOAT_SUBFORMAT }), data([0, 0])),
    ],
    ['un WAV de tres canales', riff(fmt({ channels: 3 }), data([0, 0, 0]))],
    ['un WAV sin bloque fmt', riff(data([0, 0]))],
    ['un WAV sin bloque data', riff(fmt({}))],
    ['un WAV cortado a mitad de las muestras', riff(fmt({}), data([1, 2, 3, 4])).slice(0, 50)],
    ['unos bytes que no son WAV', new TextEncoder().encode('esto no es un fichero de audio')],
    ['un fichero vacío', new Uint8Array(0)],
  ])('%s da «formato no válido» y lo que acepta', (_name, bytes) => {
    expect(decodeWav(bytes)).toEqual({ ok: false, error: INVALID });
  });
});
