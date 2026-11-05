/**
 * Efecto *espectro* (specs/effects, decisiones 1 a 3 del change spectrum-effect): el
 * `visualize_spectrum` de la v1 portado tal cual (dancyPi, `naztronaut/dancyPi-audio-reactive-led`,
 * commit `0906e77`, `python/visualization.py`). Cada zona de la tira es una banda de frecuencia, con
 * los graves en el centro y los agudos en los dos extremos: el azul es el nivel sostenido de la
 * banda, el rojo lo que sobresale de su nivel reciente (su suelo) y el verde cuánto ha cambiado desde
 * el frame anterior.
 *
 *   bandas (24, del análisis común: al cuadrado, con la ganancia común y suavizadas)
 *     --> interpolación lineal a media tira                          = y
 *     --> suelo = follow(suelo, y)          sube 0,01 / baja 0,99
 *         rojo  = follow(rojo, y − suelo)   sube 0,99 / baja 0,2
 *         verde = |y − y del frame anterior|, sin suavizar
 *         azul  = follow(azul, y)           sube 0,5  / baja 0,1
 *     --> espejo (la banda más grave en el centro) --> x 255 --> recorte a 0-255 --> truncado
 *
 * **El verde va por frame, como en la v1:** es la diferencia con el frame anterior, así que un ataque
 * da el mismo verde con cualquier fps. **El suelo, el rojo y el azul van con `dt`**, como las
 * ganancias de *energía* y *scroll* (D49): suben y bajan igual de deprisa en segundos (decisión 3).
 *
 * **El arranque en rojo se conserva a propósito** (decisión 2): la memoria arranca a 0,01, como los
 * `np.tile(0.01, …)` de la v1, así que al elegir el *espectro* el suelo tarda unos segundos de música
 * en subir y, mientras, casi toda la banda sale en rojo.
 *
 * En silencio (o sin fuente de audio), todos los LEDs a 0, y su memoria no cambia: como en la v1, que
 * en silencio ni llamaba al efecto. Sin parámetros: la v1 no tenía ninguno.
 */
import { type SpectrumParams, SpectrumParamsSchema, type StripConfig } from '@moodtable/shared';

import { BAND_COUNT } from '../audio/analysis.ts';
import { follow } from '../audio/dsp.ts';
import type { Effect } from './effect.ts';
import { halfLength, mirrorOf } from './mirror.ts';

/** `common_mode` de la v1: el nivel reciente de cada banda. Factores por frame a 50 fps. */
const FLOOR = { rise: 0.01, decay: 0.99 };
/** `r_filt` de la v1. */
const RED = { rise: 0.99, decay: 0.2 };
/** `b_filt` de la v1. */
const BLUE = { rise: 0.5, decay: 0.1 };
/** El valor con que arranca la memoria: el `np.tile(0.01, …)` de la v1. */
const INITIAL = 0.01;
const CHANNELS = 3;

/** Lo que el *espectro* recuerda de cada tira entre frames, y sus búferes de trabajo. */
export interface SpectrumMemory {
  /** El nivel reciente de cada LED de la mitad: sube muy despacio y baja deprisa. */
  floor: Float64Array;
  /** El rojo de cada LED de la mitad, sin recortar: puede ser negativo, como en la v1. */
  red: Float64Array;
  /** El azul de cada LED de la mitad. */
  blue: Float64Array;
  /** La banda interpolada de cada LED de la mitad en el frame anterior. */
  previous: Float64Array;
  /** El verde de cada LED de la mitad en este frame. */
  green: Float64Array;
  /** De cada LED de la mitad, la banda de la izquierda de su interpolación y su peso. */
  lowerBand: Int32Array;
  weight: Float64Array;
  /** De cada LED de la tira, a qué LED de la mitad calculada corresponde (el espejo). */
  mirror: Int32Array;
}

export const spectrum: Effect<SpectrumParams, SpectrumMemory> = {
  id: 'spectrum',
  usesAudio: true,
  paramsSchema: SpectrumParamsSchema,

  createMemory: (strip) => createSpectrumMemory(strip),

  render(ctx, _params, memory, out) {
    const audio = ctx.audio;
    if (!audio || audio.silent) {
      out.fill(0);
      return;
    }

    const { bands } = audio;
    const { floor, red, blue, previous, green, lowerBand, weight } = memory;
    for (let led = 0; led < floor.length; led++) {
      // La interpolación lineal de la v1 (`np.interp` sobre dos `linspace(0, 1)`).
      const lower = lowerBand[led] ?? 0;
      const upper = Math.min(lower + 1, bands.length - 1);
      const t = weight[led] ?? 0;
      const y = (bands[lower] ?? 0) * (1 - t) + (bands[upper] ?? 0) * t;

      // El suelo se actualiza antes del rojo, como el `common_mode.update(y)` de la v1.
      const level = follow(floor[led] ?? 0, y, FLOOR.rise, FLOOR.decay, ctx.dt);
      floor[led] = level;
      red[led] = follow(red[led] ?? 0, y - level, RED.rise, RED.decay, ctx.dt);
      green[led] = Math.abs(y - (previous[led] ?? 0));
      previous[led] = y;
      blue[led] = follow(blue[led] ?? 0, y, BLUE.rise, BLUE.decay, ctx.dt);
    }

    for (let led = 0; led < memory.mirror.length; led++) {
      const half = memory.mirror[led] ?? 0;
      out[led * CHANNELS] = toByte(red[half] ?? 0);
      out[led * CHANNELS + 1] = toByte(green[half] ?? 0);
      out[led * CHANNELS + 2] = toByte(blue[half] ?? 0);
    }
  },
};

/** ×255, recortado a un byte y truncado, como el `astype(int)` de la salida de la v1. */
function toByte(value: number): number {
  return Math.trunc(Math.min(255, Math.max(0, value * 255)));
}

function createSpectrumMemory(strip: StripConfig): SpectrumMemory {
  const half = halfLength(strip.ledCount);
  const lowerBand = new Int32Array(half);
  const weight = new Float64Array(half);
  for (let led = 0; led < half; led++) {
    // El LED 0 de la mitad es la banda 0 y el último, la 23; con un solo LED, la banda 0.
    const position = half > 1 ? (led / (half - 1)) * (BAND_COUNT - 1) : 0;
    lowerBand[led] = Math.min(Math.floor(position), BAND_COUNT - 1);
    weight[led] = position - (lowerBand[led] ?? 0);
  }
  return {
    floor: new Float64Array(half).fill(INITIAL),
    red: new Float64Array(half).fill(INITIAL),
    blue: new Float64Array(half).fill(INITIAL),
    previous: new Float64Array(half).fill(INITIAL),
    green: new Float64Array(half),
    lowerBand,
    weight,
    mirror: mirrorOf(strip.ledCount),
  };
}
