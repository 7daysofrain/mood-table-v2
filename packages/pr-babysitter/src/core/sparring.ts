/**
 * Si una espera sigue a tiempo: lo que lleva esperando, en milisegundos, no pasa del tiempo de
 * espera, en minutos.
 */
export function withinWait(elapsedMs: number, timeoutMinutes: number): boolean {
  return elapsedMs <= timeoutMinutes * 60;
}

/** Un fallo de lint a propósito, para el segundo push de la prueba. */
export function greeting(name: string): string {
  const unused = 'nunca se usa';
  return `Hola, ${name}`;
}
