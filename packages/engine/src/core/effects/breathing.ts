/**
 * Efecto *respiración* (specs/effects): toda la tira de un color que sube y baja de brillo, de
 * casi apagado al máximo, como una respiración. Es de ambiente y el efecto con el que arranca toda
 * tira. El esquema de sus parámetros (color y periodo) está en `@moodtable/shared`.
 */
import { type BreathingParams, BreathingParamsSchema } from '@moodtable/shared';

import type { Effect } from './effect.ts';

/** Brillo del punto más bajo: casi apagado, pero sin llegar a apagarse. */
const MIN_LEVEL = 0.05;

/** El color ya convertido a RGB: solo se vuelve a convertir si cambia. */
export interface BreathingMemory {
  color: string;
  red: number;
  green: number;
  blue: number;
}

export const breathing: Effect<BreathingParams, BreathingMemory> = {
  id: 'breathing',
  usesAudio: false,
  paramsSchema: BreathingParamsSchema,

  createMemory: () => ({ color: '', red: 0, green: 0, blue: 0 }),

  render(ctx, params, memory, out) {
    if (memory.color !== params.color) {
      memory.red = Number.parseInt(params.color.slice(1, 3), 16);
      memory.green = Number.parseInt(params.color.slice(3, 5), 16);
      memory.blue = Number.parseInt(params.color.slice(5, 7), 16);
      memory.color = params.color;
    }

    // Una onda suave: en 0 y en `period` está en el mínimo; en la mitad, en el máximo.
    const wave = (1 - Math.cos((2 * Math.PI * ctx.time) / params.period)) / 2;
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
