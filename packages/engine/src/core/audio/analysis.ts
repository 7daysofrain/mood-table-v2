/**
 * Análisis del audio (README §2.2, decisiones 1, 2, 4 y 11 del change virtual-strip-audio-file): el
 * de la v1 portado (dancyPi, `naztronaut/dancyPi-audio-reactive-led`, commit `0906e77`:
 * `microphone_update` de `python/visualization.py`, `python/dsp.py`, `python/melbank.py` y
 * `python/config.py`). Se calcula una vez por pulso y lo comparten todas las tiras.
 *
 *   ventana (~40 ms) --> Hamming --> ceros hasta potencia de 2 --> FFT --> |espectro|
 *     --> 24 bandas mel de 200 Hz a 12 kHz --> al cuadrado --> ganancia automática común
 *     --> suavizado --> bandas
 *
 * Única desviación de la v1, decidida con el usuario: su banco mel suponía 960 bandas de FFT de 0 a
 * 24 kHz y las aplicaba a las 960 primeras de una FFT de 2048, así que sus frecuencias salían un 6 %
 * más bajas. Aquí cada banda de la FFT tiene su frecuencia real.
 *
 * La ventana, los arrays de la FFT, el banco mel y las bandas se reservan al crearlo: `level` y
 * `update` no crean objetos.
 */
import FFT from 'fft.js';

import { blur, follow, gaussianKernel } from './dsp.ts';

/** Lo que el análisis entrega a los efectos reactivos en `FrameContext.audio`. */
export interface AudioFeatures {
  /** Energía de cada banda mel, de graves a agudos, ya normalizada. */
  readonly bands: Float32Array;
  /** La ventana es silencio digital: un efecto reactivo se apaga. */
  silent: boolean;
}

export interface AudioAnalyzer {
  /** La ventana del pulso (unos 40 ms): la rellena el bucle con la fuente de audio. */
  readonly window: Float32Array;
  /** Tamaño de la FFT: la ventana rellenada con ceros hasta la siguiente potencia de 2. */
  readonly fftSize: number;
  /** Nivel de la ventana: su RMS, de 0 a 1, sin ajustar. */
  level(): number;
  /** Calcula las bandas de la ventana; `dt`, los segundos desde el pulso anterior. */
  update(dt: number): AudioFeatures;
}

/** Dos bloques de 960 muestras a 48 kHz en la v1 (`N_ROLLING_HISTORY` y `MIC_RATE / FPS`). */
const WINDOW_SECONDS = 0.04;
/** `N_FFT_BINS`, `MIN_FREQUENCY` y `MAX_FREQUENCY` de la v1. */
export const BAND_COUNT = 24;
const MIN_FREQUENCY = 200;
const MAX_FREQUENCY = 12_000;
/** `MIN_VOLUME_THRESHOLD`: por debajo, en toda la ventana, es silencio digital. */
const SILENCE_THRESHOLD = 1e-7;
/** `mel_gain` de la v1: valor inicial y factores de subida y bajada (por frame a 50 fps). */
const GAIN = { initial: 0.1, rise: 0.99, decay: 0.01 };
/** `mel_smoothing` de la v1. */
const SMOOTHING = { initial: 0.1, rise: 0.99, decay: 0.5 };
/** La v1 desenfoca las bandas con sigma 1 antes de buscar su máximo para la ganancia. */
const GAIN_BLUR_SIGMA = 1;
/** Para no dividir por 0 si la ganancia llegara a apagarse del todo (no está en la v1). */
const GAIN_FLOOR = 1e-12;

export function createAudioAnalyzer(sampleRate: number): AudioAnalyzer {
  const window = new Float32Array(Math.round(WINDOW_SECONDS * sampleRate));
  const fftSize = 2 ** Math.ceil(Math.log2(window.length));
  const hamming = Float64Array.from(
    { length: window.length },
    (_, index) => 0.54 - 0.46 * Math.cos((2 * Math.PI * index) / (window.length - 1)),
  );
  const melBank = createMelBank(sampleRate, fftSize);

  const fft = new FFT(fftSize);
  // Los ceros del relleno no cambian: solo se reescribe la parte de la ventana.
  const input = new Float64Array(fftSize);
  const spectrum = new Float64Array(2 * fftSize);
  const magnitudes = new Float64Array(fftSize / 2 + 1);
  const mel = new Float64Array(BAND_COUNT);
  const blurred = new Float64Array(BAND_COUNT);
  const gainKernel = gaussianKernel(GAIN_BLUR_SIGMA);
  let gain = GAIN.initial;
  const features: AudioFeatures = {
    bands: new Float32Array(BAND_COUNT).fill(SMOOTHING.initial),
    silent: true,
  };

  return {
    window,
    fftSize,

    level() {
      let sum = 0;
      for (let index = 0; index < window.length; index++) sum += (window[index] ?? 0) ** 2;
      return Math.sqrt(sum / window.length);
    },

    update(dt) {
      // Puerta de silencio de la v1: en silencio digital no se actualiza nada.
      features.silent = isSilent(window);
      if (features.silent) return features;

      for (let index = 0; index < window.length; index++) {
        input[index] = (window[index] ?? 0) * (hamming[index] ?? 0);
      }
      fft.realTransform(spectrum, input);
      for (let bin = 0; bin < magnitudes.length; bin++) {
        const real = spectrum[2 * bin] ?? 0;
        const imaginary = spectrum[2 * bin + 1] ?? 0;
        magnitudes[bin] = Math.sqrt(real * real + imaginary * imaginary);
      }

      for (let band = 0; band < BAND_COUNT; band++) {
        let sum = 0;
        const row = band * magnitudes.length;
        for (let bin = melBank.first[band] ?? 0; bin <= (melBank.last[band] ?? -1); bin++) {
          sum += (magnitudes[bin] ?? 0) * (melBank.weights[row + bin] ?? 0);
        }
        mel[band] = sum * sum;
      }

      blur(mel, blurred, gainKernel);
      gain = follow(gain, peak(blurred), GAIN.rise, GAIN.decay, dt);
      const divisor = Math.max(gain, GAIN_FLOOR);
      for (let band = 0; band < BAND_COUNT; band++) {
        const normalized = (mel[band] ?? 0) / divisor;
        features.bands[band] = follow(
          features.bands[band] ?? 0,
          normalized,
          SMOOTHING.rise,
          SMOOTHING.decay,
          dt,
        );
      }
      return features;
    },
  };
}

/** Silencio digital: toda la ventana por debajo del umbral, en valor absoluto. */
function isSilent(window: Float32Array): boolean {
  for (let index = 0; index < window.length; index++) {
    if (Math.abs(window[index] ?? 0) >= SILENCE_THRESHOLD) return false;
  }
  return true;
}

function peak(values: Float64Array): number {
  let max = -Infinity;
  for (let index = 0; index < values.length; index++) max = Math.max(max, values[index] ?? 0);
  return max;
}

/**
 * El banco mel, como una matriz de `BAND_COUNT` filas por banda de la FFT: `weights[banda × bins +
 * bin]`. `first` y `last` son la primera y la última banda de la FFT de cada filtro, para no recorrer
 * los ceros.
 */
interface MelBank {
  first: Int32Array;
  last: Int32Array;
  weights: Float64Array;
}

/**
 * El banco mel de `melbank.py` (`compute_melmat`): `BAND_COUNT` triángulos repartidos por igual en
 * la escala mel entre `MIN_FREQUENCY` y `MAX_FREQUENCY`, cada uno de su borde inferior a su centro
 * (sube) y de su centro a su borde superior (baja). Cada banda de la FFT tiene su frecuencia real,
 * `k × frecuencia / fftSize`.
 */
function createMelBank(sampleRate: number, fftSize: number): MelBank {
  const melMin = hertzToMel(MIN_FREQUENCY);
  const step = (hertzToMel(MAX_FREQUENCY) - melMin) / (BAND_COUNT + 1);
  const binHz = sampleRate / fftSize;
  const bins = fftSize / 2 + 1;
  const bank: MelBank = {
    first: new Int32Array(BAND_COUNT),
    last: new Int32Array(BAND_COUNT),
    weights: new Float64Array(BAND_COUNT * bins),
  };

  for (let band = 0; band < BAND_COUNT; band++) {
    const lower = melToHertz(melMin + step * band);
    const center = melToHertz(melMin + step * (band + 1));
    const upper = melToHertz(melMin + step * (band + 2));
    // Por encima de la frecuencia de Nyquist no hay bandas de la FFT: el filtro queda vacío.
    bank.first[band] = Math.ceil(lower / binHz);
    bank.last[band] = Math.min(bins - 1, Math.floor(upper / binHz));
    for (let bin = bank.first[band] ?? 0; bin <= (bank.last[band] ?? -1); bin++) {
      const frequency = bin * binHz;
      bank.weights[band * bins + bin] =
        frequency <= center
          ? (frequency - lower) / (center - lower)
          : (upper - frequency) / (upper - center);
    }
  }
  return bank;
}

function hertzToMel(frequency: number): number {
  return 2595 * Math.log10(1 + frequency / 700);
}

function melToHertz(mel: number): number {
  return 700 * 10 ** (mel / 2595) - 700;
}
