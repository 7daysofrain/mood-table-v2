/**
 * Escala del vúmetro de la cabecera (decisión 14 del change virtual-strip-audio-file). Sin
 * implementar todavía: sus tests están en rojo.
 */

/** Decibelios del nivel, recortados al rango del vúmetro. */
export function levelToDecibels(level: number): number {
  throw new Error(`Sin implementar (${level})`);
}

/** Cuánto se llena el vúmetro, de 0 a 1. */
export function levelToFill(level: number): number {
  throw new Error(`Sin implementar (${level})`);
}
