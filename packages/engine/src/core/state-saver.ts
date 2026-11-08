/**
 * El guardador del estado del instrumento (design.md, decisiones 2 y 3 del change
 * instrument-state-restore). Pendiente de implementar.
 */
import type { InstrumentState, StateStore } from './state-store.ts';

/** Un temporizador de un disparo, inyectado para probar el guardador con un reloj falso. */
export interface SaverTimer {
  set(callback: () => void, ms: number): unknown;
  clear(handle: unknown): void;
}

export interface StateSaverOptions {
  control: { watch(listener: () => void): () => void; instrumentState(): InstrumentState };
  store: StateStore;
  timer: SaverTimer;
  clock: () => number;
  log: (line: string) => void;
}

export interface StateSaver {
  stop(): void;
}

export function startStateSaver(options: StateSaverOptions): StateSaver {
  throw new Error(`pendiente: ${typeof options.log}`);
}
