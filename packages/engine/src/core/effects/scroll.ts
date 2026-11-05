/**
 * Efecto *scroll* (specs/effects, decisiones 1 a 3 del change scroll-effect): el `visualize_scroll`
 * de la v1 portado tal cual (dancyPi, `naztronaut/dancyPi-audio-reactive-led`, commit `0906e77`,
 * `python/visualization.py`). En cada frame entra un color nuevo por el centro de la tira, y lo que
 * ya había avanza un LED hacia los dos extremos, apagándose un poco: la música se ve avanzar. El rojo
 * sale de los graves, el verde de los medios y el azul de los agudos, cada banda medida frente a su
 * nivel reciente.
 *
 *   bandas --> al cuadrado --> ganancia automática por banda --> x 255
 *     --> color nuevo: máximo del tercio inferior, central y superior (rojo, verde, azul), truncado
 *   media tira, por canal: desplazar 1 LED hacia fuera --> x 0,98 --> desenfoque gaussiano (sigma 0,2)
 *     --> el color nuevo en el LED del centro --> espejo
 *
 * **El movimiento va por frame, como en la v1:** un LED y ×0,98 en cada pulso con audio, así que la
 * luz avanza tantos LEDs por segundo como fps tenga el motor, y el rastro mide lo mismo en LEDs con
 * cualquier fps. **La ganancia va con `dt`**, como la de *energía* (D49): reacciona igual de deprisa
 * en segundos (decisión 2).
 *
 * En silencio (o sin fuente de audio), todos los LEDs a 0, y su memoria no cambia: como en la v1, que
 * en silencio ni llamaba al efecto. Al volver la música, el rastro sigue donde estaba. Sin
 * parámetros: la v1 no tenía ninguno.
 */
import { type ScrollParams, ScrollParamsSchema, type StripConfig } from '@moodtable/shared';

import { BAND_COUNT } from '../audio/analysis.ts';
import { blur, follow, gaussianKernel } from '../audio/dsp.ts';
import type { Effect } from './effect.ts';
import { halfLength, mirrorOf } from './mirror.ts';

/** `gain` de la v1: valor inicial y factores de subida y bajada a 50 fps. Es el de *energía*. */
const BAND_GAIN = { initial: 0.01, rise: 0.99, decay: 0.001 };
/** Cuánto brillo conserva el rastro en cada paso. */
const FADE = 0.98;
/** El valor con que arranca la memoria: el `p` de la v1 empezaba a 1, no a 0. */
const INITIAL_LED = 1;
/** El desenfoque de la v1, en LEDs: apenas se nota, pero es el suyo. */
const BLUR_KERNEL = gaussianKernel(0.2);
const CHANNELS = 3;

/** Lo que *scroll* recuerda de cada tira entre frames, y sus búferes de trabajo. */
export interface ScrollMemory {
  /** La ganancia de cada banda (de las bandas al cuadrado): sube al instante y baja muy despacio. */
  gain: Float64Array;
  /**
   * La media tira, por canal (`canal × mitad + LED`), del centro hacia fuera y sin recortar a un
   * byte: el `p` de la v1.
   */
  trail: Float64Array;
  /** La media tira de un canal, desplazada y apagada, y después desenfocada. */
  shifted: Float64Array;
  blurred: Float64Array;
  /** De cada LED de la tira, a qué LED de la mitad calculada corresponde (el espejo). */
  mirror: Int32Array;
}

export const scroll: Effect<ScrollParams, ScrollMemory> = {
  id: 'scroll',
  usesAudio: true,
  paramsSchema: ScrollParamsSchema,

  createMemory: (strip) => createScrollMemory(strip),

  render(ctx, _params, memory, out) {
    const audio = ctx.audio;
    if (!audio || audio.silent) {
      out.fill(0);
      return;
    }

    const { bands } = audio;
    const third = Math.floor(bands.length / 3);
    const { trail, shifted, blurred } = memory;
    const half = shifted.length;
    for (let channel = 0; channel < CHANNELS; channel++) {
      // El color nuevo: el máximo del tercio de este canal (el último se queda con el resto de
      // bandas, como el `y[2 * len(y) // 3:]` de la v1).
      const end = channel === CHANNELS - 1 ? bands.length : (channel + 1) * third;
      let color = 0;
      for (let band = channel * third; band < end; band++) {
        const value = (bands[band] ?? 0) ** 2;
        const gain = follow(memory.gain[band] ?? 0, value, BAND_GAIN.rise, BAND_GAIN.decay, ctx.dt);
        memory.gain[band] = gain;
        color = Math.max(color, (value / gain) * 255);
      }

      // Desplazar un LED hacia fuera (el del centro conserva el suyo, como el `p[:, 1:] = p[:, :-1]`
      // de la v1) y apagar; luego desenfocar y poner el color nuevo, truncado como el `int()`.
      const row = channel * half;
      for (let led = 0; led < half; led++) {
        shifted[led] = FADE * (trail[row + Math.max(0, led - 1)] ?? 0);
      }
      blur(shifted, blurred, BLUR_KERNEL);
      trail.set(blurred, row);
      trail[row] = Math.trunc(color);

      for (let led = 0; led < memory.mirror.length; led++) {
        const value = trail[row + (memory.mirror[led] ?? 0)] ?? 0;
        // Recortado a un byte y truncado, como el `astype(int)` de la salida de la v1.
        out[led * CHANNELS + channel] = Math.trunc(Math.min(255, Math.max(0, value)));
      }
    }
  },
};

function createScrollMemory(strip: StripConfig): ScrollMemory {
  const half = halfLength(strip.ledCount);
  return {
    gain: new Float64Array(BAND_COUNT).fill(BAND_GAIN.initial),
    trail: new Float64Array(CHANNELS * half).fill(INITIAL_LED),
    shifted: new Float64Array(half),
    blurred: new Float64Array(half),
    mirror: mirrorOf(strip.ledCount),
  };
}
