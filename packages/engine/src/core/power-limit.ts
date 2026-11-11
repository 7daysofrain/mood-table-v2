/**
 * El límite de potencia de una tira física (specs/power-limit; decisiones 1 a 3 del change
 * power-limit, D108): el último paso del plano de tiempo real, después de la intensidad, porque
 * protege la fuente (D14).
 *
 * Un LED consume en proporción a su ciclo de PWM, que es el valor de pantalla tras la gamma 2,0 de
 * la respuesta del LED: un canal a `v` pide `mA_canal · (v/255)²`. Así que el consumo de un frame va
 * con `S = Σ v²`, y bajar su corriente a `k` es multiplicar cada valor de pantalla por `√k`.
 */
import type { Chip } from '@moodtable/shared';

/** La parte de los amperios de la fuente que usa el motor como mucho (E8). */
export const POWER_MARGIN = 0.8;

/** El valor más bajo que la respuesta del LED no apaga: un canal que lo alcanzaba no baja de aquí. */
export const LIT_FLOOR = 12;

const FULL_SQUARED = 255 * 255;

/** El límite de una tira, calculado una vez al arrancar desde su fuente, su chip y sus LEDs. */
export interface PowerLimit {
  /** Lo que usará como mucho, en amperios: el 80 % de la fuente. */
  readonly maxAmps: number;
  /** El mismo límite en las unidades de `S = Σ v²`, para que el bucle solo sume y compare. */
  readonly budget: number;
  /** El suelo de los canales que se veían: 12, o 0 si la fuente no lo aguanta. */
  readonly floor: number;
}

/** Lo que pide un canal del chip a todo brillo, en amperios. */
function channelAmps(chip: Chip): number {
  return chip.channelMilliamps / 1000;
}

/**
 * El límite de una tira de `ledCount` LEDs de `chip` con una fuente de `supplyAmps` amperios.
 *
 * El suelo de 12 añade como mucho 12² por canal a la suma del frame ya bajado. Si el 80 % más todos
 * los canales a 12 no cabe en la fuente, la tira baja sin suelo: proteger la fuente va antes (D14).
 * En la mesa, eso es con menos de unos 0,115 A.
 */
export function createPowerLimit(supplyAmps: number, chip: Chip, ledCount: number): PowerLimit {
  const maxAmps = POWER_MARGIN * supplyAmps;
  const budget = (maxAmps / channelAmps(chip)) * FULL_SQUARED;
  const supply = (supplyAmps / channelAmps(chip)) * FULL_SQUARED;
  const floorFits = budget + ledCount * 3 * LIT_FLOOR * LIT_FLOOR <= supply;
  return { maxAmps, budget, floor: floorFits ? LIT_FLOOR : 0 };
}

/** Los amperios que pide un frame (RGB, 3 bytes por LED) de una tira de LEDs de `chip`. */
export function estimateAmps(frame: Uint8Array, chip: Chip): number {
  return (channelAmps(chip) * squaredSum(frame)) / FULL_SQUARED;
}

/**
 * Si `frame` pide más que el límite, baja todos sus canales con un mismo factor `√k`, hacia abajo
 * para no pasarse, sin dejar por debajo del suelo un canal que lo alcanzaba (decisión 2). Si cabe,
 * no lo toca.
 *
 * Escala el frame en su sitio y no crea nada, porque se llama en cada pulso, como `applyIntensity`.
 */
export function applyPowerLimit(frame: Uint8Array, { budget, floor }: PowerLimit): void {
  const sum = squaredSum(frame);
  if (sum <= budget) return;
  const factor = Math.sqrt(budget / sum);
  for (let index = 0; index < frame.length; index++) {
    const value = frame[index] ?? 0;
    const scaled = Math.floor(value * factor);
    frame[index] = value >= floor && scaled < floor ? floor : scaled;
  }
}

function squaredSum(frame: Uint8Array): number {
  let sum = 0;
  for (let index = 0; index < frame.length; index++) {
    const value = frame[index] ?? 0;
    sum += value * value;
  }
  return sum;
}
