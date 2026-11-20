/** PR de prueba de MOO-167: una incidencia de SonarQube a propósito (ternario anidado). */
export function signo(n: number): string {
  return n > 0 ? 'positivo' : n < 0 ? 'negativo' : 'cero';
}
