/**
 * Efecto *respiración* (specs/effects): toda la tira de un color que sube y baja de brillo, de
 * casi apagado al máximo, como una respiración. Es de ambiente: sigue igual haya audio o no. El
 * esquema de sus parámetros (color y periodo) está en `@moodtable/shared`.
 */
import { type BreathingParams, BreathingParamsSchema } from '@moodtable/shared';

import type { Effect } from './effect.ts';

/** Brillo del punto más bajo: casi apagado, pero sin llegar a apagarse. */
const MIN_LEVEL = 0.05;

/**
 * El color ya convertido a RGB, que solo se vuelve a convertir si cambia, y la fase anclada al
 * último periodo (decisión 7 del change strip-effect-values).
 */
export interface BreathingMemory {
  color: string;
  red: number;
  green: number;
  blue: number;
  /** El periodo con que pintó el último frame: 0 antes del primero. */
  period: number;
  /** Lo que se suma a `time / period` para que la fase no salte cuando cambia el periodo. */
  offset: number;
}

export const breathing: Effect<BreathingParams, BreathingMemory> = {
  id: 'breathing',
  usesAudio: false,
  paramsSchema: BreathingParamsSchema,

  createMemory: () => ({ color: '', red: 0, green: 0, blue: 0, period: 0, offset: 0 }),

  render(ctx, params, memory, out) {
    if (memory.color !== params.color) {
      memory.red = Number.parseInt(params.color.slice(1, 3), 16);
      memory.green = Number.parseInt(params.color.slice(3, 5), 16);
      memory.blue = Number.parseInt(params.color.slice(5, 7), 16);
      memory.color = params.color;
    }

    // Con otro periodo, el desfase se recalcula para que la fase de este instante sea la misma con el
    // periodo nuevo que con el viejo: el brillo sigue donde estaba y respira al ritmo nuevo. Con el
    // periodo fijo, el desfase es 0.
    if (memory.period !== params.period) {
      if (memory.period > 0) {
        memory.offset += ctx.time / memory.period - ctx.time / params.period;
      }
      memory.period = params.period;
    }

    // Una onda suave: con la fase entera está en el mínimo; con media, en el máximo.
    const phase = ctx.time / params.period + memory.offset;
    const wave = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const level = MIN_LEVEL + (1 - MIN_LEVEL) * wave;
    const red = Math.round(memory.red * level);
    const green = Math.round(memory.green * level);
    const blue = Math.round(memory.blue * level);

    for (let index = 0; index < out.length; index += 3) {
      out[index] = red;
      out[index + 1] = green;
      out[index + 2] = blue;
    }
  },
};
