/**
 * Salida Adalight (specs/physical-strip): la tira física por el puerto serie de su controlador. Esta
 * es la parte pura, con tests: la codificación. Abrir el puerto de verdad es cosa de
 * `adalight.hardware.ts`.
 *
 * Un frame Adalight es una cabecera de 6 bytes, `A` `d` `a`, el nº de LEDs menos uno en dos bytes
 * (el alto primero) y su checksum (los dos en XOR con `0x55`), seguida de 3 bytes por LED (rojo,
 * verde y azul), en el orden de la tira. El orden de color lo pone el sketch del controlador (D46).
 */

/** Los bytes de la cabecera Adalight. */
const HEADER_LENGTH = 6;

/** Un búfer de 6 + 3 × LEDs bytes con la cabecera Adalight ya escrita: uno por salida. */
export function adalightBuffer(ledCount: number): Uint8Array {
  const buffer = new Uint8Array(HEADER_LENGTH + ledCount * 3);
  const high = ((ledCount - 1) >> 8) & 0xff;
  const low = (ledCount - 1) & 0xff;
  buffer.set([0x41, 0x64, 0x61, high, low, high ^ low ^ 0x55]);
  return buffer;
}

/** Copia los colores de `frame` (RGB, 3 bytes por LED) detrás de la cabecera y devuelve `buffer`. */
export function encodeAdalight(buffer: Uint8Array, frame: Uint8Array): Uint8Array {
  buffer.set(frame, HEADER_LENGTH);
  return buffer;
}
