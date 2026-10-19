/**
 * Escala del vúmetro de la cabecera (decisión 14 del change virtual-strip-audio-file): en
 * decibelios, que es como se lee un nivel, de −60 dB (vacío) a 0 dB (lleno). El −60 es una elección
 * visual, no una cifra de las specs.
 */

/** Por debajo, el vúmetro ya está vacío. */
const FLOOR_DB = -60;

/**
 * Decibelios del nivel (de 0 a 1), recortados al rango del vúmetro. El silencio, y un nivel que no es
 * un número, son el mínimo.
 */
export function levelToDecibels(level: number): number {
  if (Number.isNaN(level) || level <= 0) return FLOOR_DB;
  return Math.min(0, Math.max(FLOOR_DB, 20 * Math.log10(level)));
}

/** Cuánto se llena el vúmetro, de 0 a 1, en proporción a los decibelios. */
export function levelToFill(level: number): number {
  return (levelToDecibels(level) - FLOOR_DB) / -FLOOR_DB;
}

export const METER_MIN_DB = FLOOR_DB;
