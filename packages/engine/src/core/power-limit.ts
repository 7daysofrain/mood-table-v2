/**
 * El límite de potencia de una tira física (specs/power-limit; decisiones 1 a 3 del change
 * power-limit, D108): el último paso del plano de tiempo real, después de la intensidad, porque
 * protege la fuente (D14).
 *
 * Un LED consume en proporción a su ciclo de PWM, que es lo que le envía la salida Adalight: la
 * respuesta del LED `R[v]`, la gamma 2,0 ya redondeada. Un canal a `v` pide `mA_canal · R[v]/255`,
 * así que el consumo de un frame va con `D = Σ R[v]`. Como `R[v]` va con `v²`, bajar su corriente a
 * `k` es multiplicar cada valor de pantalla por `√k`.
 */
import type { Chip } from '@moodtable/shared';

import { LED_RESPONSE } from './led-response.ts';

/** La parte de los amperios de la fuente que usa el motor como mucho (E8). */
export const POWER_MARGIN = 0.8;

/** El valor más bajo que la respuesta del LED no apaga: un canal que lo alcanzaba no baja de aquí. */
export const LIT_FLOOR = 12;

const FULL = 255;

/** El límite de una tira, calculado una vez al arrancar desde su fuente, su chip y sus LEDs. */
export interface PowerLimit {
  /** Lo que usará como mucho, en amperios: el 80 % de la fuente. */
  readonly maxAmps: number;
  /** El mismo límite en las unidades de `D = Σ R[v]`, para que el bucle solo sume y compare. */
  readonly budget: number;
  /** Los amperios de la fuente entera, en esas mismas unidades: lo que no se pasa nunca. */
  readonly supply: number;
  /** Si la fuente aguanta siempre el suelo de 12; si no, con algunos frames, se pierde. */
  readonly floorAlwaysHolds: boolean;
}

/** Lo que pide un canal del chip a todo brillo, en amperios. */
function channelAmps(chip: Chip): number {
  return chip.channelMilliamps / 1000;
}

/**
 * El límite de una tira de `ledCount` LEDs de `chip` con una fuente de `supplyAmps` amperios.
 *
 * Al bajar un frame al presupuesto, el redondeo de la tabla y el suelo de 12 suman como mucho una
 * unidad por canal (decisión 2). Si eso cabe en la fuente, el suelo se mantiene siempre; en la mesa,
 * desde unos 0,2 A.
 */
export function createPowerLimit(supplyAmps: number, chip: Chip, ledCount: number): PowerLimit {
  const maxAmps = POWER_MARGIN * supplyAmps;
  const budget = (maxAmps / channelAmps(chip)) * FULL;
  const supply = (supplyAmps / channelAmps(chip)) * FULL;
  return { maxAmps, budget, supply, floorAlwaysHolds: budget + ledCount * 3 <= supply };
}

/** Los amperios que pide un frame (RGB, 3 bytes por LED) de una tira de LEDs de `chip`. */
export function estimateAmps(frame: Uint8Array, chip: Chip): number {
  return (channelAmps(chip) * pwmSum(frame)) / FULL;
}

/**
 * Si `frame` pide más que el límite, baja todos sus canales con un mismo factor `√k`, hacia abajo,
 * sin dejar por debajo del suelo un canal que lo alcanzaba (decisión 2). Si aun así se pasa de la
 * fuente, que solo pasa con fuentes muy pequeñas, lo vuelve a bajar sin suelo hasta que cabe. Si
 * cabe, no lo toca.
 *
 * Escala el frame en su sitio y no crea nada, porque se llama en cada pulso, como `applyIntensity`.
 */
export function applyPowerLimit(frame: Uint8Array, { budget, supply }: PowerLimit): void {
  const sent = pwmSum(frame);
  if (sent <= budget) return;
  scale(frame, Math.sqrt(budget / sent), LIT_FLOOR);
  // Sin suelo, cada vuelta baja todos los canales encendidos, así que termina; casi siempre basta una.
  for (let left = pwmSum(frame); left > supply; left = pwmSum(frame)) {
    scale(frame, Math.sqrt(budget / left), 0);
  }
}

/** Multiplica cada canal por `factor`, hacia abajo, sin dejar bajo `floor` uno que lo alcanzaba. */
function scale(frame: Uint8Array, factor: number, floor: number): void {
  for (let index = 0; index < frame.length; index++) {
    const value = frame[index] ?? 0;
    const scaled = Math.floor(value * factor);
    frame[index] = value >= floor && scaled < floor ? floor : scaled;
  }
}

/** El PWM que se envía por los canales de `frame`, sumado: `D = Σ R[v]`. */
function pwmSum(frame: Uint8Array): number {
  let sum = 0;
  for (const value of frame) sum += LED_RESPONSE[value] ?? 0;
  return sum;
}
