import { describe, expect, it } from 'vitest';

import { decodeFrame, encodeFrame } from './viewer-protocol.ts';

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
