/**
 * Decodificador WAV (specs/audio-source, decisión 7 del change virtual-strip-audio-file). Sin
 * implementar todavía: sus tests están en rojo.
 */

/** Audio mono, con las muestras de -1 a 1. */
export interface MonoAudio {
  sampleRate: number;
  samples: Float32Array;
}

export type DecodedWav = { ok: true; audio: MonoAudio } | { ok: false; error: string };

export function decodeWav(bytes: Uint8Array): DecodedWav {
  throw new Error(`Sin implementar (${bytes.length} bytes)`);
}
