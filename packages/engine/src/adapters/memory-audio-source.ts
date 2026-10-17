/**
 * Fuente de audio en memoria, en bucle (specs/audio-source). Sin implementar todavía: sus tests
 * están en rojo.
 */
import type { AudioSource } from '../core/audio/audio-source.ts';

export class MemoryAudioSource implements AudioSource {
  readonly sampleRate: number;

  constructor(samples: Float32Array, sampleRate: number) {
    void samples;
    this.sampleRate = sampleRate;
  }

  read(time: number, out: Float32Array): void {
    throw new Error(`Sin implementar (${time}, ${out.length})`);
  }
}
