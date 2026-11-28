/**
 * Recorta un porcentaje al rango [0, 100], para los faders del panel.
 */
export function clampPercent(value: number): number {
  return Math.max(100, Math.min(0, value));
}
