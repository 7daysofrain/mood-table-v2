/**
 * Piezas de tratamiento de señal comunes al análisis y a los efectos reactivos, portadas de la v1
 * (dancyPi, `naztronaut/dancyPi-audio-reactive-led`, commit `0906e77`: `python/dsp.py` y el
 * `gaussian_filter1d` de SciPy que usa `python/visualization.py`). Ninguna crea objetos al llamarla.
 */

/** Los fps a los que la v1 calibró sus suavizados (`config.FPS`). */
const V1_FPS = 50;

/**
 * El factor de suavizado `alpha` de la v1, que era por frame a 50 fps, convertido para un pulso de
 * `dt` segundos (decisión 2): `1 − (1 − alpha)^(dt × 50)`. A 50 fps da el de la v1, y a cualquier
 * otro ritmo la señal sube y baja igual de deprisa en segundos.
 */
export function smoothingFactor(alpha: number, dt: number): number {
  return 1 - (1 - alpha) ** (dt * V1_FPS);
}

/**
 * Un paso del `ExpFilter` de la v1: se acerca a `target` con `rise` si sube y con `decay` si baja
 * (factores por frame a 50 fps).
 */
export function follow(
  current: number,
  target: number,
  rise: number,
  decay: number,
  dt: number,
): number {
  const alpha = smoothingFactor(target > current ? rise : decay, dt);
  return alpha * target + (1 - alpha) * current;
}

/** Pesos del `gaussian_filter1d` de SciPy: radio `int(4 × sigma + 0,5)`, normalizados a 1. */
export function gaussianKernel(sigma: number): Float64Array {
  const radius = Math.trunc(4 * sigma + 0.5);
  const kernel = new Float64Array(2 * radius + 1);
  let sum = 0;
  for (let offset = -radius; offset <= radius; offset++) {
    const weight = Math.exp((-0.5 * offset * offset) / (sigma * sigma));
    kernel[offset + radius] = weight;
    sum += weight;
  }
  for (let index = 0; index < kernel.length; index++) kernel[index] = (kernel[index] ?? 0) / sum;
  return kernel;
}

/**
 * Desenfoque gaussiano con los bordes en modo `reflect` de SciPy (`d c b a | a b c d | d c b a`):
 * escribe en `out` los primeros `out.length` valores de `input` desenfocados.
 */
export function blur(input: ArrayLike<number>, out: Float32Array | Float64Array, kernel: Float64Array) {
  const length = out.length;
  const radius = (kernel.length - 1) / 2;
  for (let index = 0; index < length; index++) {
    let sum = 0;
    for (let offset = -radius; offset <= radius; offset++) {
      sum += (kernel[offset + radius] ?? 0) * (input[reflect(index + offset, length)] ?? 0);
    }
    out[index] = sum;
  }
}

/** Posición dentro de `[0, length)` de un índice reflejado en los bordes, en modo `reflect`. */
function reflect(index: number, length: number): number {
  const period = 2 * length;
  const inPeriod = ((index % period) + period) % period;
  return inPeriod < length ? inPeriod : period - 1 - inPeriod;
}
