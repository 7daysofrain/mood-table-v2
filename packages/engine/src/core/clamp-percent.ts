/**
 * Recorta un porcentaje al rango [0, 100], para los faders del panel.
 */
export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
