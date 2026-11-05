/**
 * El espejo de los efectos que nacen en el centro (*energía* y *scroll*): calculan media tira y la
 * reflejan para llenarla entera. La mitad calculada es `ceil(N/2)`: con un número impar de LEDs, el
 * del centro es el primero de la mitad.
 */

/** Cuántos LEDs tiene la mitad calculada de una tira de `ledCount` LEDs. */
export function halfLength(ledCount: number): number {
  return Math.ceil(ledCount / 2);
}

/** De cada LED de la tira, a qué LED de la mitad calculada corresponde. */
export function mirrorOf(ledCount: number): Int32Array {
  const center = (ledCount - 1) / 2;
  return Int32Array.from({ length: ledCount }, (_, led) => Math.floor(Math.abs(led - center)));
}
