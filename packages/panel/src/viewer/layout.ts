/**
 * Geometría del visor (decisión 16). Sin implementar todavía: sus tests están en rojo.
 */

export const ROW_HEIGHT = 24;

export interface Dot {
  x: number;
  y: number;
  radius: number;
  color: string;
}

export function layoutStrips(
  frames: ReadonlyMap<number, Uint8Array>,
  width: number,
): { height: number; dots: Dot[] } {
  throw new Error(`Sin implementar (${frames.size} tiras, ${width} px)`);
}
