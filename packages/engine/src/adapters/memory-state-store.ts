/**
 * `StateStore` en memoria: no escribe nada en disco, y cada arranque es como el primero. Para la
 * demo pública y los E2E (`instrumentState: { type: 'memory' }`) y para los tests del núcleo.
 */
import type { InstrumentState, SavedStrip, StateStore } from '../core/state-store.ts';

export function createMemoryStateStore(initial: InstrumentState = {}): StateStore {
  // Copias al entrar y al salir: lo que haga después quien llama no cambia lo guardado.
  const strips = new Map<string, SavedStrip>(Object.entries(structuredClone(initial)));

  return {
    load() {
      return structuredClone(Object.fromEntries(strips));
    },
    save(state) {
      for (const [stripId, saved] of Object.entries(structuredClone(state))) {
        const values = { ...strips.get(stripId)?.values, ...saved.values };
        strips.set(stripId, { activeEffect: saved.activeEffect, values });
      }
    },
  };
}
