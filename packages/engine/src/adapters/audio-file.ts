/**
 * Fuente de audio *fichero* (specs/audio-source, decisiones 3 y 7 del change
 * virtual-strip-audio-file): lee el WAV entero y lo decodifica al arrancar; después suena en bucle
 * desde memoria, sin más E/S. Devuelve también los bytes leídos, para que `/audio` sirva el mismo
 * fichero que se analiza (decisión 6 del change panel-audio-playback). Si el fichero no existe, no se puede leer o su formato no vale, el
 * error nombra el fichero con su ruta ya resuelta, para que se vea dónde lo ha buscado.
 */
import { readFile } from 'node:fs/promises';

import type { AudioSource } from '../core/audio/audio-source.ts';
import { MemoryAudioSource } from './memory-audio-source.ts';
import { decodeWav } from './wav.ts';

export type LoadedAudioFile =
  | { ok: true; source: AudioSource; bytes: Uint8Array }
  | { ok: false; error: string };

/** `path` llega absoluto: la configuración cargada ya lo resuelve desde la raíz (decisión 8). */
export async function loadAudioFile(path: string): Promise<LoadedAudioFile> {
  let bytes: Uint8Array;
  try {
    bytes = await readFile(path);
  } catch (error) {
    const reason =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? 'no se encuentra el fichero de audio'
        : `no se puede leer el fichero de audio (${(error as Error).message})`;
    return { ok: false, error: `${path}: ${reason}` };
  }

  const decoded = decodeWav(bytes);
  if (!decoded.ok) return { ok: false, error: `${path}: ${decoded.error}` };
  const { samples, sampleRate } = decoded.audio;
  return { ok: true, source: new MemoryAudioSource(samples, sampleRate), bytes };
}
