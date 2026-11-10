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
 * Los guardados se escriben en un *worker thread* (D105): `save()` entrega el estado y vuelve, y el
 * bucle de frames no espera nunca a la tarjeta SD, que a veces tarda segundos en confirmar. Como mucho
 * hay una escritura en curso, y de los estados que llegan mientras tanto solo se escribe el último.
 * El *worker* mide cada escritura, y aquí se escriben en el log las de más de 10 ms y las que fallan.
 * La apertura, las migraciones y la lectura al arrancar se quedan en el hilo del motor.
 *
 * No es `*.hardware.ts`: se prueba con ficheros temporales.
 */
import { existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';

import type { InstrumentState, SavedStrip, StateStore } from '../core/state-store.ts';
import { createMemoryStateStore } from './memory-state-store.ts';

export interface OpenedStateStore {
  store: StateStore;
  /** Lo que ha pasado al abrir, para el log; sin nada que contar, no hay aviso. */
  notice?: string;
  /** Cierra el fichero. Cerrarlo dos veces no hace nada. */
  close(): void;
}

/** Lo que el *worker* cuenta de cada escritura (D105). */
export type WriteReport = { ok: true; tookMs: number } | { ok: false; error: string };

/** Lo que el adaptador manda al *worker*. */
export type WriterMessage = { type: 'write'; state: InstrumentState } | { type: 'close' };

/** El *worker* que escribe, visto desde el adaptador. Uno falso en los tests. */
export interface StateWriter {
  /** Le manda un estado entero para escribirlo. No espera. */
  write(state: InstrumentState): void;
  /** `listener` oye cómo ha ido cada escritura, en el orden en que se mandaron. */
  onReport(listener: (report: WriteReport) => void): void;
  /** Termina lo que tenga en cola, cierra el fichero y acaba. */
  close(): void;
}

export interface SqliteStateStoreOptions {
  /** El reloj de `updated_at` y del nombre del fichero dañado que se aparta. */
  now?: () => Date;
  /**
   * Dónde se escriben los guardados: en un *worker* (por defecto, el de `sqlite-writer.worker.ts`) o,
   * para los tests que leen justo después de guardar, en el hilo que llama (`'thread'`).
   */
  writer?: 'thread' | ((path: string) => StateWriter);
  /** Dónde van las escrituras lentas y las que fallan. Por defecto, la salida de errores. */
  log?: (line: string) => void;
}

/** Una escritura más lenta queda en el log (D103): más de medio frame a 60 fps, con margen. */
const SLOW_WRITE_MS = 10;

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
  {
    now = () => new Date(),
    writer = spawnWriterWorker,
    log = (line) => console.error(line),
  }: SqliteStateStoreOptions = {},
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

  const store = sqliteStore(db, now);
  const closeDb = () => {
    if (db.isOpen) db.close();
  };
  if (writer === 'thread') return { store, notice, close: closeDb };

  const background = writer(path);
  return {
    store: { load: () => store.load(), save: inBackground(background, log) },
    notice,
    close: () => {
      background.close();
      closeDb();
    },
  };
}

/**
 * El `save` que manda cada estado al *worker* sin esperar. Como mucho hay una escritura en curso: de
 * los estados que llegan mientras tanto solo se guarda el último, que es el estado entero y deja a los
 * de en medio sin nada que aportar.
 */
function inBackground(writer: StateWriter, log: (line: string) => void): (state: InstrumentState) => void {
  let writing = false;
  let next: InstrumentState | undefined;

  writer.onReport((report) => {
    if (!report.ok) {
      log(
        `No se ha podido guardar el estado del instrumento (${report.error}); ` +
          'se vuelve a intentar con el próximo cambio.',
      );
    } else if (report.tookMs > SLOW_WRITE_MS) {
      log(`El guardado del estado del instrumento ha tardado ${Math.round(report.tookMs)} ms.`);
    }
    if (next === undefined) {
      writing = false;
      return;
    }
    const state = next;
    next = undefined;
    writer.write(state);
  });

  return (state) => {
    // Una copia: lo que haga después quien guarda no cambia lo que se escribe.
    const copy = structuredClone(state);
    if (writing) {
      next = copy;
      return;
    }
    writing = true;
    writer.write(copy);
  };
}

/**
 * El *worker* de verdad (`sqlite-writer.worker.ts`), sobre el fichero ya abierto y migrado. Si el
 * *worker* falla o ha terminado, cada escritura vuelve como fallida, con el motivo.
 */
function spawnWriterWorker(path: string): StateWriter {
  const worker = new Worker(new URL('./sqlite-writer.worker.ts', import.meta.url), {
    workerData: { path },
  });
  let listener: ((report: WriteReport) => void) | undefined;
  let alive = true;
  worker.on('message', (report: WriteReport) => listener?.(report));
  worker.on('error', (error: unknown) => listener?.({ ok: false, error: reasonOf(error) }));
  worker.on('exit', () => {
    alive = false;
  });
  return {
    write(state) {
      if (alive) {
        worker.postMessage({ type: 'write', state } satisfies WriterMessage);
        return;
      }
      queueMicrotask(() => listener?.({ ok: false, error: 'el worker que escribe ha terminado' }));
    },
    onReport(each) {
      listener = each;
    },
    close() {
      if (alive) worker.postMessage({ type: 'close' } satisfies WriterMessage);
    },
  };
}

/**
 * Abre para escribir un fichero que la apertura ya ha comprobado y migrado: lo usa el *worker*. El
 * modo WAL ya está guardado en el fichero; `synchronous` y `foreign_keys` son de cada conexión.
 */
export function connectForWriting(path: string): DatabaseSync {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;');
  return db;
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

/** El almacén sobre una conexión abierta: lo usan el hilo del motor (para leer) y el *worker*. */
export function sqliteStore(db: DatabaseSync, now: () => Date): StateStore {
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
