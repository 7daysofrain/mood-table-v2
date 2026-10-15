/**
 * Bucle de frames (specs/frame-loop). Sin implementar todavía: sus tests están en rojo.
 */
import type { StripConfig } from '@moodtable/shared';

export interface Tick {
  seq: number;
  time: number;
}

export interface LightOutput {
  write(frame: Uint8Array, tick: Tick): void;
}

export interface LoopStrip {
  config: StripConfig;
  outputs: LightOutput[];
}

export interface FrameLoop {
  tick(now: number): void;
}

export function createFrameLoop(strips: LoopStrip[], fps: number): FrameLoop {
  throw new Error(`Sin implementar (${strips.length} tiras a ${fps} fps)`);
}
