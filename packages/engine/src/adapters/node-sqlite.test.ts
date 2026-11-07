import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Comprobación del entorno (change `instrument-state-restore`, paso 1.1): `node:sqlite` funciona en
 * Vitest y en el CI sin flags. El adaptador SQLite se construye encima.
 */
let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'moodtable-sqlite-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe('node:sqlite', () => {
  it('abre una base en un fichero, escribe en una transacción y lo vuelve a leer', () => {
    const path = join(dir, 'prueba.db');
    const db = new DatabaseSync(path);
    db.exec('CREATE TABLE tira (id TEXT PRIMARY KEY, efecto TEXT NOT NULL)');
    db.exec('BEGIN');
    db.prepare('INSERT INTO tira (id, efecto) VALUES (?, ?)').run('a', 'breathing');
    db.exec('COMMIT');
    db.close();

    const reopened = new DatabaseSync(path);
    expect(reopened.prepare('SELECT id, efecto FROM tira').all()).toEqual([
      { id: 'a', efecto: 'breathing' },
    ]);
    reopened.close();
  });
});
