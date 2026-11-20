/**
 * Prueba del PR Babysitter (`MOO-175`): dos ayudas de listas y porcentajes para el panel. Se cierra
 * sin integrar.
 */

/** El porcentaje entero de `part` sobre `total`: 1 de 4 es 25. */
export function percent(part: number, total: number): number {
  return Math.round((part / total) * 100);
}

/** Los `n` últimos elementos de una lista, en su orden; ninguno si `n` no es positivo. */
export function lastN<T>(items: readonly T[], n: number): T[] {
  return n > 0 ? items.slice(-n) : [];
}
