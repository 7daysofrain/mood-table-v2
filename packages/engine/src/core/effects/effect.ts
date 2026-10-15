/**
 * Contrato común de los efectos (README §2.2, decisión 1 del change virtual-strip-breathing): el
 * mismo para los de ambiente y los reactivos. Sin implementar todavía: sus tests están en rojo.
 */
import type { StripConfig } from '@moodtable/shared';
import type { TSchema } from 'typebox';

export interface FrameContext {
  time: number;
  dt: number;
  audio: null;
}

export interface Effect<P, M> {
  id: string;
  usesAudio: boolean;
  paramsSchema: TSchema;
  createMemory(strip: StripConfig): M;
  render(ctx: FrameContext, params: P, memory: M, out: Uint8Array): void;
}

export function defaultParams<P>(effect: Effect<P, unknown>): P {
  throw new Error(`Sin implementar (${effect.id})`);
}
