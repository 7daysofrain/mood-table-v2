import { existsSync } from 'node:fs';
import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { describeStateStoreContract } from '../../test/state-store-contract.ts';
import type { InstrumentState } from '../core/state-store.ts';
import { openSqliteStateStore, type OpenedStateStore } from './sqlite-state-store.ts';

const azul = { color: '#0000ff', period: 8 };
const mesa: InstrumentState = {
  mesa: { activeEffect: 'breathing', values: { breathing: azul, energy: {} } },
};
/** La fecha de los tests, para el nombre del fichero dañado que se aparta. */
const NOW = new Date('2026-11-07T12:00:00.000Z');

let dir: string;
const opened: OpenedStateStore[] = [];

/** Abre el estado en `path` y lo cierra al acabar el test. */
function open(path: string): OpenedStateStore {
  const result = openSqliteStateStore(path, { now: () => NOW });
  opened.push(result);
  return result;
}

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moodtable-state-'));
});

afterEach(async () => {
  for (const each of opened.splice(0)) each.close();
  await chmod(dir, 0o700);
  await rm(dir, { recursive: true, force: true });
});

let contractFiles = 0;
describeStateStoreContract('el adaptador SQLite', () => {
  contractFiles += 1;
  return open(join(dir, `contrato-${contractFiles}.db`)).store;
});

describe('el adaptador SQLite', () => {
  it('lo guardado sigue ahí al volver a abrir el fichero', () => {
    const path = join(dir, 'estado.db');
    const first = open(path);
    first.store.save(mesa);
    first.close();

    expect(open(path).store.load()).toEqual(mesa);
  });

  it('rechaza un efecto activo sin sus valores, y lo guardado no cambia', () => {
    const { store } = open(join(dir, 'estado.db'));
    store.save(mesa);

    expect(() =>
      store.save({ mesa: { activeEffect: 'scroll', values: { breathing: azul } } }),
    ).toThrow();
    expect(store.load()).toEqual(mesa);
  });

  it('el esquema no deja un efecto activo sin sus valores, aunque se escriba a mano', () => {
    const path = join(dir, 'estado.db');
    open(path).close();
    const db = new DatabaseSync(path);
    db.exec('PRAGMA foreign_keys = ON');

    expect(() =>
      db.exec(
        "INSERT INTO strip_state (strip_id, active_effect_id, updated_at) VALUES ('mesa', 'energy', 'x')",
      ),
    ).toThrow(/FOREIGN KEY/);
    db.close();
  });

  it('las tablas no tienen schema_version (D104)', () => {
    const path = join(dir, 'estado.db');
    open(path).close();
    const db = new DatabaseSync(path);
    const columns = db.prepare("SELECT name FROM pragma_table_info('strip_effects')").all();
    db.close();

    expect(columns.map((column) => column.name)).toEqual([
      'strip_id',
      'effect_id',
      'values_json',
      'updated_at',
    ]);
  });

  it('aplica cada migración una sola vez y la apunta en la tabla de control', () => {
    const path = join(dir, 'estado.db');
    open(path).close();
    open(path).close();
    const db = new DatabaseSync(path);
    const applied = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all();
    db.close();

    expect(applied).toEqual([{ version: 1 }]);
  });

  it('va en modo WAL', () => {
    const path = join(dir, 'estado.db');
    open(path).close();
    const db = new DatabaseSync(path);
    const mode = db.prepare('PRAGMA journal_mode').get();
    db.close();

    expect(mode).toEqual({ journal_mode: 'wal' });
  });
});

describe('al abrir el estado guardado', () => {
  it('sin fichero, lo crea con su carpeta, arranca vacío y no avisa de nada', () => {
    const path = join(dir, 'data', 'estado.db');
    const result = open(path);

    expect(result.notice).toBeUndefined();
    expect(result.store.load()).toEqual({});
    expect(existsSync(path)).toBe(true);
  });

  it('dañado, lo aparta con otro nombre, empieza vacío, avisa y sigue guardando', async () => {
    const path = join(dir, 'estado.db');
    await writeFile(path, 'esto no es una base de datos SQLite, aunque lo parezca por el nombre');
    await writeFile(`${path}-wal`, 'wal');
    const moved = `${path}.dañado-${NOW.toISOString()}`;

    const result = open(path);

    expect(result.notice).toContain('no se ha podido recuperar el estado guardado');
    expect(result.notice).toContain(moved);
    expect(result.store.load()).toEqual({});
    expect(await readFile(moved, 'utf8')).toMatch(/^esto no es/);
    expect(existsSync(`${moved}-wal`)).toBe(true);

    result.store.save(mesa);
    result.close();
    expect(open(path).store.load()).toEqual(mesa);
  });

  it('con páginas dañadas que SQLite detecta al comprobarlo, también lo aparta', async () => {
    const path = join(dir, 'estado.db');
    const first = open(path);
    // Bastantes tiras para que el estado ocupe varias páginas.
    const many = Object.fromEntries(
      Array.from({ length: 200 }, (_, index) => [
        `tira-${index}`,
        { activeEffect: 'breathing', values: { breathing: azul } },
      ]),
    );
    first.store.save(many);
    first.close();
    const bytes = await readFile(path);
    bytes.fill(0xff, 4096 + 100, 4096 * 3);
    await writeFile(path, bytes);

    const result = open(path);

    expect(result.notice).toContain('no se ha podido recuperar el estado guardado');
    expect(result.store.load()).toEqual({});
  });

  it.skipIf(process.getuid?.() === 0)(
    'si no puede crearlo, arranca sin guardar y dice qué fichero no puede usar',
    async () => {
      const readOnly = join(dir, 'solo-lectura');
      await mkdir(readOnly);
      await chmod(readOnly, 0o500);
      const path = join(readOnly, 'estado.db');

      const result = open(path);
      result.store.save(mesa);

      expect(result.notice).toContain(path);
      expect(result.notice).toContain('sin guardar');
      expect(await readdir(readOnly)).toEqual([]);
    },
  );

  it('de una versión más nueva del motor, arranca sin guardar y no toca el fichero', async () => {
    const path = join(dir, 'estado.db');
    const first = open(path);
    first.store.save(mesa);
    first.close();
    const db = new DatabaseSync(path);
    db.exec("INSERT INTO schema_migrations (version, applied_at) VALUES (99, 'x')");
    db.close();
    const before = await readFile(path);

    const result = open(path);
    result.store.save({ mesa: { activeEffect: 'energy', values: { energy: {} } } });
    result.close();

    expect(result.notice).toContain('versión más nueva del motor');
    expect(result.store.load()).toEqual({ mesa: { activeEffect: 'energy', values: { energy: {} } } });
    expect(await readFile(path)).toEqual(before);
  });
});
