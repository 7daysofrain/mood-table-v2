/**
 * Protocolo del visor (decisión 10 del change virtual-strip-breathing). Sin implementar todavía: sus
 * tests están en rojo.
 */

export interface FrameMessage {
  seq: number;
  stripIndex: number;
  colors: Uint8Array;
}

export function encodeFrame(seq: number, stripIndex: number, colors: Uint8Array): Uint8Array {
  throw new Error(`Sin implementar (${seq}, ${stripIndex}, ${colors.length} bytes)`);
}

export function decodeFrame(message: Uint8Array): FrameMessage | undefined {
  throw new Error(`Sin implementar (${message.length} bytes)`);
}
