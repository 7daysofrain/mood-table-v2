/**
 * Fuente de audio en memoria, en bucle (specs/audio-source, decisión 3 del change
 * virtual-strip-audio-file): unas muestras mono que suenan una y otra vez al ritmo del motor. Es la
 * fuente del fichero, una vez decodificado, y la de los tests (un tono, el fichero de golpes).
 *
 * La posición es `round(time × frecuencia)` en módulo la longitud: el bucle del fichero sale del
 * módulo, y una ventana que cruza el final lee el final y el principio.
 */
import type { AudioSource } from '../core/audio/audio-source.ts';

export class MemoryAudioSource implements AudioSource {
  readonly sampleRate: number;
  private readonly samples: Float32Array;

  constructor(samples: Float32Array, sampleRate: number) {
    this.samples = samples;
    this.sampleRate = sampleRate;
  }

  read(time: number, out: Float32Array): void {
    const { length } = this.samples;
    // Un WAV sin muestras es silencio.
    if (length === 0) {
      out.fill(0);
      return;
    }
    // La ventana son las muestras [fin - out.length, fin), con el fin en el instante del pulso.
    const end = Math.round(time * this.sampleRate);
    let index = (((end - out.length) % length) + length) % length;
    for (let offset = 0; offset < out.length; offset++) {
      out[offset] = this.samples[index] ?? 0;
      index = index + 1 === length ? 0 : index + 1;
    }
  }
}
