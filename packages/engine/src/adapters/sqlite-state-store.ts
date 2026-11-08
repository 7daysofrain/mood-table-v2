/**
 * `StateStore` sobre SQLite, con `node:sqlite`, que viene con Node: nada nativo que compilar para la
 * Pi (D103). Un único fichero, en modo WAL y con `synchronous = FULL`: un corte de luz a mitad de un
 * guardado deja el estado anterior o el nuevo, nunca uno a medias (README §3).
 *
 * Al abrir hay cuatro casos (design.md, decisión 4 del change instrument-state-restore): sin fichero,
 * se crea; dañado, se aparta y se empieza de cero; sin poder crearlo ni abrirlo, o de una versión más
 * nueva del motor, se arranca sin guardar. Nunca impide arrancar: un instrumento que no arranca es
 * peor que uno que no recuerda. Lo que ha pasado vuelve como un aviso para el log.
 *
 * No es `*.hardware.ts`: se prueba con ficheros temporales.
 */
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import type { InstrumentState, SavedStrip, StateStore } from '../core/state-store.ts';
import { createMemoryStateStore } from './memory-state-store.ts';

export interface OpenedStateStore {
  store: StateStore;
  /** Lo que ha pasado al abrir, para el log; sin nada que contar, no hay aviso. */
  notice?: string;
  /** Cierra el fichero. Cerrarlo dos veces no hace nada. */
  close(): void;
}

export interface SqliteStateStoreOptions {
  /** El reloj de `updated_at` y del nombre del fichero dañado que se aparta. */
  now?: () => Date;
}

/**
 * Las migraciones, en orden: la de la posición `i` es la versión `i + 1`. La tabla de control
 * `schema_migrations` apunta las aplicadas. La 1 es el modelo de README §3, sin `schema_version`
 * (D104): los valores se validan con el esquema actual del efecto al restaurar.
 */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE strip_effects (
     strip_id TEXT NOT NULL,
     effect_id TEXT NOT NULL,
     values_json TEXT NOT NULL CHECK (json_valid(values_json)),
     updated_at TEXT NOT NULL,
     PRIMARY KEY (strip_id, effect_id)
   );
   CREATE TABLE strip_state (
     strip_id TEXT PRIMARY KEY,
     active_effect_id TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     FOREIGN KEY (strip_id, active_effect_id) REFERENCES strip_effects (strip_id, effect_id)
   );`,
];

/** Códigos de SQLite que dicen que el fichero está dañado o no es una base de datos. */
const SQLITE_CORRUPT = 11;
const SQLITE_NOTADB = 26;

/** `PRAGMA quick_check` ha encontrado páginas dañadas. */
class DamagedError extends Error {}

export function openSqliteStateStore(
  path: string,
  { now = () => new Date() }: SqliteStateStoreOptions = {},
): OpenedStateStore {
  try {
    mkdirSync(dirname(path), { recursive: true });
  } catch (error) {
    return withoutSaving(path, error);
  }

  let opening = tryOpen(path);
  let notice: string | undefined;
  if (!opening.ok) {
    const { error } = opening;
    if (!isDamaged(error)) {
      opening.close();
      return withoutSaving(path, error);
    }
    const moved = `${path}.dañado-${now().toISOString()}`;
    try {
      moveAside(path, moved);
    } catch (error_) {
      opening.close();
      return withoutSaving(path, error_);
    }
    // Se cierra después de apartarlo: al cerrar, SQLite borra el `-wal` y el `-shm` por su nombre
    // de antes, y los apartados se conservan.
    opening.close();
    opening = tryOpen(path);
    if (!opening.ok) {
      opening.close();
      return withoutSaving(path, opening.error);
    }
    notice =
      `${path}: no se ha podido recuperar el estado guardado (${reasonOf(error)}); ` +
      `se ha apartado en ${moved} y el motor arranca como la primera vez.`;
  }
  const { db } = opening;

  try {
    const newer = newerMigration(db);
    if (newer !== undefined) {
      db.close();
      return {
        store: createMemoryStateStore(),
        notice:
          `${path}: el estado guardado es de una versión más nueva del motor (migración ${newer}; ` +
          `este conoce hasta la ${MIGRATIONS.length}). El motor arranca sin guardar el estado y no ` +
          'toca el fichero.',
        close: () => undefined,
      };
    }
    // Hasta aquí no se ha escrito nada en el fichero: el modo WAL queda guardado en él.
    db.exec('PRAGMA journal_mode = WAL');
    migrate(db, now);
  } catch (error) {
    db.close();
    return withoutSaving(path, error);
  }

  return {
    store: sqliteStore(db, now),
    notice,
    close: () => {
      if (db.isOpen) db.close();
    },
  };
}

/** El fichero abierto y comprobado, o por qué no; si no, `close` cierra lo que llegó a abrir. */
type Opening = { ok: true; db: DatabaseSync } | { ok: false; error: unknown; close: () => void };

/**
 * Abre el fichero y comprueba que no está dañado, sin escribir en él: `synchronous` y `foreign_keys`
 * son de la conexión, y el modo WAL, que sí se guarda en el fichero, se pone después de ver que este
 * motor conoce todas sus migraciones.
 */
function tryOpen(path: string): Opening {
  let db: DatabaseSync;
  try {
    db = new DatabaseSync(path);
  } catch (error) {
    return { ok: false, error, close: () => undefined };
  }
  try {
    db.exec('PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
    // `quick_check` es la primera lectura del fichero: si no es una base de datos, falla aquí.
    const check = db.prepare('PRAGMA quick_check').get();
    if (check?.quick_check !== 'ok') {
      throw new DamagedError(`PRAGMA quick_check: ${String(check?.quick_check)}`);
    }
    return { ok: true, db };
  } catch (error) {
    return { ok: false, error, close: () => db.close() };
  }
}

/** La migración aplicada más alta, o 0 si no hay ninguna (o ni siquiera la tabla de control). */
function latestMigration(db: DatabaseSync): number {
  const table = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get();
  if (!table) return 0;
  const row = db.prepare('SELECT MAX(version) AS latest FROM schema_migrations').get();
  return typeof row?.latest === 'number' ? row.latest : 0;
}

/** Si el fichero tiene migraciones que este motor no conoce, la más alta. Solo lee. */
function newerMigration(db: DatabaseSync): number | undefined {
  const latest = latestMigration(db);
  return latest > MIGRATIONS.length ? latest : undefined;
}

/** Aplica las migraciones pendientes, cada una en su transacción. */
function migrate(db: DatabaseSync, now: () => Date): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)',
  );
  const latest = latestMigration(db);
  const record = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
  MIGRATIONS.slice(latest).forEach((sql, index) => {
    inTransaction(db, () => {
      db.exec(sql);
      record.run(latest + index + 1, now().toISOString());
    });
  });
}

function sqliteStore(db: DatabaseSync, now: () => Date): StateStore {
  const strips = db.prepare('SELECT strip_id, active_effect_id FROM strip_state');
  const effects = db.prepare('SELECT strip_id, effect_id, values_json FROM strip_effects');
  const upsertEffect = db.prepare(
    `INSERT INTO strip_effects (strip_id, effect_id, values_json, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT (strip_id, effect_id)
     DO UPDATE SET values_json = excluded.values_json, updated_at = excluded.updated_at`,
  );
  const upsertStrip = db.prepare(
    `INSERT INTO strip_state (strip_id, active_effect_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (strip_id)
     DO UPDATE SET active_effect_id = excluded.active_effect_id, updated_at = excluded.updated_at`,
  );

  return {
    load() {
      // Con `Object.fromEntries` y no asignando a un objeto: un id como `__proto__` queda como
      // propiedad propia, en lugar de pasar por el setter del prototipo y perderse.
      const values = new Map<string, [string, unknown][]>();
      for (const row of effects.all()) {
        const stripId = String(row.strip_id);
        const of = values.get(stripId) ?? [];
        of.push([String(row.effect_id), JSON.parse(String(row.values_json))]);
        values.set(stripId, of);
      }
      return Object.fromEntries(
        strips.all().map((row): [string, SavedStrip] => {
          const stripId = String(row.strip_id);
          return [
            stripId,
            {
              activeEffect: String(row.active_effect_id),
              values: Object.fromEntries(values.get(stripId) ?? []),
            },
          ];
        }),
      );
    },
    save(state: InstrumentState) {
      const at = now().toISOString();
      // Primero los valores y después el efecto activo: la clave foránea exige que ya estén.
      inTransaction(db, () => {
        for (const [stripId, saved] of Object.entries(state)) {
          for (const [effectId, effectValues] of Object.entries(saved.values)) {
            upsertEffect.run(stripId, effectId, JSON.stringify(effectValues), at);
          }
          upsertStrip.run(stripId, saved.activeEffect, at);
        }
      });
    },
  };
}

/** Todo o nada: si `work` falla, se deshace lo que hubiera hecho y se relanza el error. */
function inTransaction(db: DatabaseSync, work: () => void): void {
  db.exec('BEGIN IMMEDIATE');
  try {
    work();
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

/** El fichero dañado, con su `-wal` y su `-shm` si los hay, pasa a `moved`, sin borrar nada. */
function moveAside(path: string, moved: string): void {
  for (const suffix of ['', '-wal', '-shm']) {
    if (existsSync(`${path}${suffix}`)) renameSync(`${path}${suffix}`, `${moved}${suffix}`);
  }
}

function isDamaged(error: unknown): boolean {
  if (error instanceof DamagedError) return true;
  const code = (error as { errcode?: unknown }).errcode;
  // Los códigos extendidos llevan el básico en el byte bajo.
  return typeof code === 'number' && [SQLITE_CORRUPT, SQLITE_NOTADB].includes(code & 0xff);
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Sin poder usar el fichero, el motor arranca igualmente, con el estado en memoria. */
function withoutSaving(path: string, error: unknown): OpenedStateStore {
  return {
    store: createMemoryStateStore(),
    notice:
      `${path}: no se puede usar el fichero del estado del instrumento (${reasonOf(error)}). ` +
      'El motor arranca sin guardar el estado.',
    close: () => undefined,
  };
}
