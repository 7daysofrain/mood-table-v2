/**
 * Fuente de audio *fichero* (specs/audio-source). Sin implementar todavía: sus tests están en rojo.
 */
import type { AudioSource } from '../core/audio/audio-source.ts';

export type LoadedAudioFile = { ok: true; source: AudioSource } | { ok: false; error: string };

export function loadAudioFile(path: string): Promise<LoadedAudioFile> {
  return Promise.reject(new Error(`Sin implementar (${path})`));
}
