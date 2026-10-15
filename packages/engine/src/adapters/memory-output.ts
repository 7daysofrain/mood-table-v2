/**
 * Salida en memoria (`LightOutput`): guarda una copia de cada frame que recibe. Sirve para los
 * tests y para comprobar el motor sin visor ni hardware.
 */
import type { LightOutput, Tick } from '../core/frame-loop.ts';

export interface RecordedFrame {
  seq: number;
  colors: Uint8Array;
}

export class MemoryOutput implements LightOutput {
  readonly frames: RecordedFrame[] = [];

  write(frame: Uint8Array, tick: Tick): void {
    // El búfer es del bucle y cambia en el pulso siguiente: se guarda una copia.
    this.frames.push({ seq: tick.seq, colors: frame.slice() });
  }
}
