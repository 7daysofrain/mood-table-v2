/**
 * Salida en memoria (`LightOutput`). Sin implementar todavía: sus tests están en rojo.
 */
import type { LightOutput, Tick } from '../core/frame-loop.ts';

export interface RecordedFrame {
  seq: number;
  colors: Uint8Array;
}

export class MemoryOutput implements LightOutput {
  readonly frames: RecordedFrame[] = [];

  write(frame: Uint8Array, tick: Tick): void {
    throw new Error(`Sin implementar (${frame.length} bytes, seq ${tick.seq})`);
  }
}
