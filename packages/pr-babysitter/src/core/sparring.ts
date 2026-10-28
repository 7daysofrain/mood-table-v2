/** PR de prueba del triaje: un fallo de lint a propósito. Se cierra sin integrar. */
export function greeting(name: string): string {
  const unused = 'nunca se usa';
  return `Hola, ${name}`;
}
