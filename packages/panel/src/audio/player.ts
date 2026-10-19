/**
 * Reproductor del fichero de audio en el panel (decisión 3 del change panel-audio-playback).
 */
import type { EngineConnection } from '../engine/connection.ts';

/** Callado, preparando el audio (descarga y decodificación) o sonando. */
export type PlayerState = 'silent' | 'preparing' | 'playing';

/** Lo que el reproductor usa de la conexión con el motor. */
export type PlayerConnection = Pick<
  EngineConnection,
  'status' | 'subscribe' | 'subscribePositions'
>;

/** Lo que el reproductor usa de un `AudioContext`: así los tests pueden darle uno falso. */
export type AudioContextLike = Pick<
  AudioContext,
  'currentTime' | 'destination' | 'resume' | 'decodeAudioData' | 'createBufferSource'
> &
  Partial<Pick<AudioContext, 'outputLatency' | 'baseLatency' | 'getOutputTimestamp'>>;

export interface PlayerOptions {
  /** Descarga el fichero. Por defecto, `GET /audio`. */
  fetchAudio?: () => Promise<ArrayBuffer>;
  /** Crea el contexto de audio. Por defecto, un `AudioContext` del navegador. */
  createContext?: () => AudioContextLike;
  /** Reloj en milisegundos. Por defecto, `performance.now()`. */
  now?: () => number;
}

export class AudioPlayer {
  constructor(connection: PlayerConnection, options: PlayerOptions = {}) {
    void connection;
    void options;
  }

  get state(): PlayerState {
    throw new Error('Sin implementar');
  }

  get error(): number | undefined {
    throw new Error('Sin implementar');
  }

  subscribe(listener: () => void): () => void {
    throw new Error(`Sin implementar (${typeof listener})`);
  }

  play(): void {
    throw new Error('Sin implementar');
  }

  stop(): void {
    throw new Error('Sin implementar');
  }

  dispose(): void {
    throw new Error('Sin implementar');
  }
}
