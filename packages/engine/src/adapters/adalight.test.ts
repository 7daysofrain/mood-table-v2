import { describe, expect, it } from 'vitest';

import { adalightBuffer, encodeAdalight } from './adalight.ts';

/** Los bytes en hexadecimal, separados por espacios, para leer las cabeceras como en la spec. */
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

describe('la codificación Adalight', () => {
  it('el frame de 173 LEDs con el primero en rojo puro son 525 bytes con su cabecera', () => {
    const frame = new Uint8Array(173 * 3);
    frame[0] = 0xff;

    const encoded = encodeAdalight(adalightBuffer(173), frame);

    expect(encoded).toHaveLength(525);
    expect(hex(encoded.subarray(0, 9))).toBe('41 64 61 00 AC F9 FF 00 00');
    expect(encoded.subarray(9).every((byte) => byte === 0)).toBe(true);
  });

  it.each([
    [1, '41 64 61 00 00 55'],
    [300, '41 64 61 01 2B 7F'],
  ])('la cabecera de %d LEDs es %s', (ledCount, header) => {
    expect(hex(adalightBuffer(ledCount).subarray(0, 6))).toBe(header);
  });

  it('copia los colores en el orden de la tira, sin reordenarlos', () => {
    const frame = Uint8Array.of(1, 2, 3, 4, 5, 6);

    expect(Array.from(encodeAdalight(adalightBuffer(2), frame).subarray(6))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('escribe en el búfer de la salida, sin crear otro', () => {
    const buffer = adalightBuffer(2);

    expect(encodeAdalight(buffer, new Uint8Array(6))).toBe(buffer);
  });
});
