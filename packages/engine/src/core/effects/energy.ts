/**
 * Efecto *energía* (specs/effects, decisiones 1 y 2 del change virtual-strip-audio-file): el
 * `visualize_energy` de la v1 portado (dancyPi, `naztronaut/dancyPi-audio-reactive-led`, commit
 * `0906e77`, `python/visualization.py`). La tira se enciende desde el centro hacia los dos extremos:
 * el rojo llega tan lejos como la energía de los graves, el verde como la de los medios y el azul
 * como la de los agudos, cada banda medida frente a su nivel reciente.
 *
 *   bandas --> ganancia automática por banda --> x (mitad de la tira - 1)
 *     --> tercio inferior, central y superior: media de (banda ^ 0,9) --> LEDs de rojo, verde, azul
 *     --> suavizado de los LEDs --> redondeo --> desenfoque gaussiano (sigma 4 LEDs) --> espejo
 *
 * En silencio (o sin fuente de audio), todos los LEDs a 0, y su memoria no cambia: como en la v1,
 * que en silencio ni llamaba al efecto. Sin parámetros: la v1 no tenía ninguno.
 */
import { type EnergyParams, EnergyParamsSchema, type StripConfig } from '@moodtable/shared';

import { blur, follow, gaussianKernel } from '../audio/dsp.ts';
import type { Effect } from './effect.ts';

/** `gain` de la v1 para *energía*: valor inicial y factores de subida y bajada a 50 fps. */
const BAND_GAIN = { initial: 0.01, rise: 0.99, decay: 0.001 };
/** `p_filt` de la v1: el suavizado de los LEDs. */
const LED_SMOOTHING = { initial: 1, rise: 0.99, decay: 0.1 };
/** El exponente con el que la v1 comprime la energía de cada tercio. */
const SCALE = 0.9;
/** El desenfoque va en LEDs, no en proporción a la tira: la densidad de LEDs es física. */
const BLUR_KERNEL = gaussianKernel(4);
const CHANNELS = 3;

/** Lo que *energía* recuerda de cada tira entre frames, y sus búferes de trabajo. */
export interface EnergyMemory {
  /** La ganancia de cada banda: sube al instante y baja muy despacio. */
  gain: Float64Array;
  /** Los LEDs de media tira, por canal (`canal × mitad + LED`), ya suavizados. */
  leds: Float64Array;
  /** Los LEDs suavizados de un canal, redondeados y desenfocados. */
  rounded: Float64Array;
  blurred: Float64Array;
  /** De cada LED de la tira, a qué LED de la mitad calculada corresponde (el espejo). */
  mirror: Int32Array;
}

export const energy: Effect<EnergyParams, EnergyMemory> = {
  id: 'energy',
  usesAudio: true,
  paramsSchema: EnergyParamsSchema,

  createMemory: (strip) => createEnergyMemory(strip),

  render(ctx, _params, memory, out) {
    const audio = ctx.audio;
    if (!audio || audio.silent) {
      out.fill(0);
      return;
    }

    const { bands } = audio;
    const half = memory.rounded.length;
    const third = Math.floor(bands.length / 3);
    for (let channel = 0; channel < CHANNELS; channel++) {
      // El tercio de las bandas de este canal: graves, medios o agudos.
      let sum = 0;
      for (let band = channel * third; band < (channel + 1) * third; band++) {
        const value = bands[band] ?? 0;
        const gain = follow(memory.gain[band] ?? 0, value, BAND_GAIN.rise, BAND_GAIN.decay, ctx.dt);
        memory.gain[band] = gain;
        sum += ((value / gain) * (half - 1)) ** SCALE;
      }
      // Cuántos LEDs desde el centro, truncado como el `int()` de la v1.
      const lit = Math.trunc(sum / third);

      const row = channel * half;
      for (let led = 0; led < half; led++) {
        const target = led < lit ? 255 : 0;
        const current = memory.leds[row + led] ?? 0;
        memory.leds[row + led] = follow(
          current,
          target,
          LED_SMOOTHING.rise,
          LED_SMOOTHING.decay,
          ctx.dt,
        );
        memory.rounded[led] = Math.round(memory.leds[row + led] ?? 0);
      }
      blur(memory.rounded, memory.blurred, BLUR_KERNEL);

      for (let led = 0; led < memory.mirror.length; led++) {
        const value = memory.blurred[memory.mirror[led] ?? 0] ?? 0;
        // Recortado a un byte y truncado, como el `astype(int)` de la salida de la v1.
        out[led * CHANNELS + channel] = Math.trunc(Math.min(255, Math.max(0, value)));
      }
    }
  },
};

function createEnergyMemory(strip: StripConfig): EnergyMemory {
  // La mitad calculada; con un número impar de LEDs, el del centro es el primero de la mitad.
  const half = Math.ceil(strip.ledCount / 2);
  const center = (strip.ledCount - 1) / 2;
  return {
    gain: new Float64Array(24).fill(BAND_GAIN.initial),
    leds: new Float64Array(CHANNELS * half).fill(LED_SMOOTHING.initial),
    rounded: new Float64Array(half),
    blurred: new Float64Array(half),
    mirror: Int32Array.from({ length: strip.ledCount }, (_, led) =>
      Math.floor(Math.abs(led - center)),
    ),
  };
}
