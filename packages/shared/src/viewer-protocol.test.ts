import { describe, expect, it } from 'vitest';

import {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
} from './viewer-protocol.ts';

/** Los colores de una tira de `ledCount` LEDs, distintos en cada byte. */
function colorsOf(ledCount: number): Uint8Array {
  return Uint8Array.from({ length: ledCount * 3 }, (_, byte) => byte % 256);
}

describe('el mensaje de un frame', () => {
  it('lleva el tipo, el seq, el índice de la tira y los colores, en ese orden', () => {
    const message = encodeFrame(0x01020304, 2, Uint8Array.of(10, 20, 30));

    expect(Array.from(message)).toEqual([1, 0x01, 0x02, 0x03, 0x04, 2, 10, 20, 30]);
  });

  it('da los bytes del ejemplo de docs/instructions/viewer-protocol.md', () => {
    const message = encodeFrame(260, 0, Uint8Array.of(0xff, 0, 0, 0, 0, 0xff));
    const hex = Array.from(message, (byte) => byte.toString(16).padStart(2, '0')).join(' ');

    expect(hex).toBe('01 00 00 01 04 00 ff 00 00 00 00 ff');
  });

  it('con una tira de 60 LEDs, lleva 180 bytes de color tras la cabecera de 6', () => {
    expect(encodeFrame(7, 0, colorsOf(60))).toHaveLength(6 + 180);
  });

  it('se decodifica igual que se codificó', () => {
    const colors = colorsOf(60);

    expect(decodeFrame(encodeFrame(123_456, 1, colors))).toEqual({
      seq: 123_456,
      stripIndex: 1,
      colors,
    });
  });

  it('el seq vuelve a 0 al pasar de 2³² − 1', () => {
    expect(decodeFrame(encodeFrame(2 ** 32 + 5, 0, colorsOf(1)))?.seq).toBe(5);
  });

  it('no admite un índice de tira que no cabe en un byte', () => {
    expect(() => encodeFrame(0, 256, colorsOf(1))).toThrow(RangeError);
  });

  it('decodifica un mensaje que es una vista sobre un búfer más grande', () => {
    const buffer = new Uint8Array(20);
    buffer.set(encodeFrame(9, 3, Uint8Array.of(1, 2, 3)), 5);

    expect(decodeFrame(buffer.subarray(5, 5 + 9))).toEqual({
      seq: 9,
      stripIndex: 3,
      colors: Uint8Array.of(1, 2, 3),
    });
  });
});

describe('un mensaje que no es un frame', () => {
  it.each([
    ['de otro tipo', Uint8Array.of(2, 0, 0, 0, 1, 0, 10, 20, 30)],
    ['más corto que la cabecera', Uint8Array.of(1, 0, 0)],
    ['sin colores', Uint8Array.of(1, 0, 0, 0, 1, 0)],
    ['con colores que no son de LEDs enteros', Uint8Array.of(1, 0, 0, 0, 1, 0, 10, 20)],
  ])('se rechaza si es %s', (_, message) => {
    expect(decodeFrame(message)).toBeUndefined();
  });
});

function hexOf(message: Uint8Array): string {
  return Array.from(message, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

describe('el mensaje de la fuente de audio', () => {
  it('sin fuente, son dos bytes: el tipo 2 y la clase 0', () => {
    expect(hexOf(encodeSource({ kind: 'none' }))).toBe('02 00');
  });

  it('con un fichero, lleva la clase 1 y su nombre en UTF-8, como en el ejemplo del documento', () => {
    expect(hexOf(encodeSource({ kind: 'file', name: 'golpes.wav' }))).toBe(
      '02 01 67 6f 6c 70 65 73 2e 77 61 76',
    );
  });

  it.each([
    [{ kind: 'none' as const }],
    [{ kind: 'file' as const, name: 'Canción del año (versión ñ).wav' }],
  ])('%j se decodifica igual que se codificó', (source) => {
    expect(decodeSource(encodeSource(source))).toEqual(source);
  });

  it.each([
    ['vacío', []],
    ['de otro tipo', [1, 0]],
    ['con una clase que no existe', [2, 7]],
    ['sin fuente pero con nombre', [2, 0, 0x61]],
    ['de un fichero sin nombre', [2, 1]],
    ['con un nombre que no es UTF-8 válido', [2, 1, 0xff, 0xfe]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodeSource(Uint8Array.from(bytes))).toBeUndefined();
  });
});

describe('el mensaje del nivel', () => {
  it('lleva el tipo 3, el seq y el nivel en float32, los dos en big-endian', () => {
    expect(hexOf(encodeLevel(260, 0.5))).toBe('03 00 00 01 04 3f 00 00 00');
  });

  it('se decodifica igual que se codificó', () => {
    expect(decodeLevel(encodeLevel(123_456, 0.25))).toEqual({ seq: 123_456, level: 0.25 });
  });

  it('no admite un nivel fuera de 0 a 1', () => {
    expect(() => encodeLevel(1, 1.5)).toThrow(RangeError);
    expect(() => encodeLevel(1, Number.NaN)).toThrow(RangeError);
  });

  it.each([
    ['corto', [3, 0, 0, 1, 4, 0x3f, 0, 0]],
    ['largo', [3, 0, 0, 1, 4, 0x3f, 0, 0, 0, 0]],
    ['de otro tipo', [1, 0, 0, 1, 4, 0x3f, 0, 0, 0]],
    ['con un nivel por encima de 1 (2,0)', [3, 0, 0, 1, 4, 0x40, 0, 0, 0]],
    ['con un nivel que no es un número', [3, 0, 0, 1, 4, 0x7f, 0xc0, 0, 0]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodeLevel(Uint8Array.from(bytes))).toBeUndefined();
  });
});

describe('los mensajes de fuente y de nivel no son frames', () => {
  it('decodeFrame los rechaza, aunque su longitud cuadre con la de un frame', () => {
    // 9 bytes: la cabecera de un frame y un LED.
    expect(decodeFrame(encodeLevel(1, 0.5))).toBeUndefined();
    expect(decodeFrame(encodeSource({ kind: 'file', name: 'abc.wav' }))).toBeUndefined();
  });
});

describe('el mensaje de la posición del fichero', () => {
  it('lleva el tipo 4, el seq y la posición en float64, los dos en big-endian', () => {
    expect(hexOf(encodePosition(260, 1.5))).toBe('04 00 00 01 04 3f f8 00 00 00 00 00 00');
  });

  it('ocupa 13 bytes', () => {
    expect(encodePosition(1, 93.8)).toHaveLength(13);
  });

  it.each([
    ['al principio del fichero', 7, 0],
    ['en un fichero de una hora, sin perder precisión', 123_456, 3599.987_654_321],
    ['con el seq cerca de 2³²', 2 ** 32 - 1, 2.25],
  ])('%s, se decodifica igual que se codificó', (_name, seq, position) => {
    expect(decodePosition(encodePosition(seq, position))).toEqual({ seq, position });
  });

  it('no admite una posición negativa o que no es un número finito', () => {
    expect(() => encodePosition(1, -0.001)).toThrow(RangeError);
    expect(() => encodePosition(1, Number.NaN)).toThrow(RangeError);
    expect(() => encodePosition(1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('decodifica un mensaje que es una vista sobre un búfer más grande', () => {
    const buffer = new Uint8Array(30);
    buffer.set(encodePosition(9, 3.5), 4);

    expect(decodePosition(buffer.subarray(4, 4 + 13))).toEqual({ seq: 9, position: 3.5 });
  });

  it.each([
    ['corto', [4, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0]],
    ['largo', [4, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0, 0]],
    ['de otro tipo', [3, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0]],
    ['con una posición negativa (−1,5)', [4, 0, 0, 1, 4, 0xbf, 0xf8, 0, 0, 0, 0, 0, 0]],
    ['con una posición infinita', [4, 0, 0, 1, 4, 0x7f, 0xf0, 0, 0, 0, 0, 0, 0]],
    ['con una posición que no es un número', [4, 0, 0, 1, 4, 0x7f, 0xf8, 0, 0, 0, 0, 0, 0]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodePosition(Uint8Array.from(bytes))).toBeUndefined();
  });

  it('no lo decodifican como frame, nivel ni fuente', () => {
    const message = encodePosition(1, 1.5);

    expect(decodeFrame(message)).toBeUndefined();
    expect(decodeLevel(message)).toBeUndefined();
    expect(decodeSource(message)).toBeUndefined();
  });
});
