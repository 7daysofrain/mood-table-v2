/**
 * `StateStore` sobre SQLite (`node:sqlite`). Pendiente: el paso 1.6 del change
 * instrument-state-restore.
 */
import type { StateStore } from '../core/state-store.ts';

export interface OpenedStateStore {
  store: StateStore;
  /** Lo que ha pasado al abrir, para el log; sin nada que contar, no hay aviso. */
  notice?: string;
  close(): void;
}

export interface SqliteStateStoreOptions {
  now?: () => Date;
}

export function openSqliteStateStore(path: string, options?: SqliteStateStoreOptions): OpenedStateStore {
  throw new Error(`sin implementar: ${path} ${JSON.stringify(options)}`);
}
