/**
 * Restauración del estado del instrumento al arrancar (design.md, decisiones 5 y 6 del change
 * instrument-state-restore). Pendiente de implementar.
 */
import type { StripConfig } from '@moodtable/shared';

import type { AnyEffect } from './effects/registry.ts';
import type { InstrumentState } from './state-store.ts';

export interface RestoreOptions {
  strips: readonly StripConfig[];
  effects: readonly AnyEffect[];
  hasAudioSource: boolean;
  saved: InstrumentState;
}

export interface Restored {
  state: InstrumentState;
  notices: string[];
}

export function restore(options: RestoreOptions): Restored {
  throw new Error(`pendiente: ${String(options.strips.length)}`);
}
