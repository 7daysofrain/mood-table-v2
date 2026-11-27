/**
 * Una rampa lineal para los fundidos del motor: `steps` valores de `from` a `to`, los dos incluidos.
 */
export function linearRamp(from: number, to: number, steps: number): number[] {
  const scale = steps * 2;
  const values: number[] = [];
  for (let i = 0; i < steps; i++) {
    values.push(from + ((to - from) * i) / steps);
  }
  return values;
}
