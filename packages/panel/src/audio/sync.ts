/**
 * Sincronía del reproductor con el visor (decisiones 1, 4 y 5 del change panel-audio-playback).
 */

/** El reloj de audio en un momento, como lo da el `AudioContext`. */
export interface AudioClock {
  /** `AudioContext.currentTime`, en segundos. */
  contextTime: number;
  /** `performance.now()` al leerlo, en milisegundos. */
  now: number;
  /** `outputLatency` + `baseLatency` del contexto, en segundos, si el navegador los da. */
  outputLatency?: number;
  /** `getOutputTimestamp()`, si el navegador lo da. */
  timestamp?: { contextTime: number; performanceTime: number };
}

export interface SyncOptions {
  /** La ventana de posiciones que entra en la mediana, en milisegundos. */
  windowMs?: number;
}

export interface Sync {
  add(position: number, arrivedAt: number): void;
  pointAt(at: number): number | undefined;
  reset(): void;
}

export const JUMP_THRESHOLD = 0.02;

export function circularDifference(a: number, b: number, duration: number): number {
  throw new Error(`Sin implementar (${a}, ${b}, ${duration})`);
}

export function audibleAt(clock: AudioClock, contextTime: number): number {
  throw new Error(`Sin implementar (${clock.now}, ${contextTime})`);
}

export function shouldJump(error: number): boolean {
  throw new Error(`Sin implementar (${error})`);
}

export function createSync(duration: number, options: SyncOptions = {}): Sync {
  throw new Error(`Sin implementar (${duration}, ${String(options.windowMs)})`);
}
