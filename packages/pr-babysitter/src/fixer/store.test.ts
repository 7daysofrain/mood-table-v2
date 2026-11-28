import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { fixJob, sonar } from './fixtures.ts';
import { JobStore } from './store.ts';

describe('la cola de trabajos (design.md decisión 4)', () => {
  it('encola un trabajo, y repetirlo con la misma PR y el mismo SHA no crea otro', () => {
    const store = new JobStore(':memory:');

    expect(store.enqueue(fixJob())).toBe(true);
    expect(store.enqueue(fixJob({ findings: [sonar] }))).toBe(false);

    expect(store.status(12, 'abc123')).toEqual({ state: 'queued' });
    expect(store.next()).toEqual(fixJob());
    store.start(12, 'abc123');
    expect(store.next()).toBeUndefined();
  });

  it('un push sin trabajo está en `none`', () => {
    const store = new JobStore(':memory:');

    expect(store.status(12, 'abc123')).toEqual({ state: 'none' });
  });

  it('da los trabajos en orden de llegada, y no da el que está en marcha', () => {
    const store = new JobStore(':memory:');
    store.enqueue(fixJob({ number: 20, sha: 'b' }));
    store.enqueue(fixJob({ number: 10, sha: 'a' }));

    expect(store.next()?.number).toBe(20);
    store.start(20, 'b');
    expect(store.status(20, 'b')).toEqual({ state: 'running' });
    expect(store.next()?.number).toBe(10);
  });

  it('guarda cómo ha acabado el trabajo', () => {
    const store = new JobStore(':memory:');
    store.enqueue(fixJob());
    store.start(12, 'abc123');

    store.finish(12, 'abc123', { state: 'pushed', sha: 'def456', unfixed: [{ finding: sonar, reason: 'checksFailed' }] });

    expect(store.status(12, 'abc123')).toEqual({
      state: 'pushed',
      sha: 'def456',
      unfixed: [{ finding: sonar, reason: 'checksFailed' }],
    });
    expect(store.next()).toBeUndefined();
  });

  it('suma el coste de cada query() en lo gastado por la PR, entre todos sus push (decisión 8)', () => {
    const store = new JobStore(':memory:');
    store.enqueue(fixJob({ sha: 'a' }));
    store.enqueue(fixJob({ sha: 'b' }));
    store.enqueue(fixJob({ number: 13, sha: 'c' }));

    store.addCost(12, 'a', 0.25);
    store.addCost(12, 'a', 0.5);
    store.addCost(12, 'b', 0.1);
    store.addCost(13, 'c', 1);

    expect(store.spent(12)).toBeCloseTo(0.85);
    expect(store.spent(13)).toBe(1);
    expect(store.spent(99)).toBe(0);
  });

  it('sobrevive a un reinicio: el estado está en el fichero', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pr-fixer-store-'));
    try {
      const path = join(dir, 'fixer.sqlite');
      const before = new JobStore(path);
      before.enqueue(fixJob());
      before.addCost(12, 'abc123', 0.3);
      before.close();

      const after = new JobStore(path);

      expect(after.status(12, 'abc123')).toEqual({ state: 'queued' });
      expect(after.spent(12)).toBe(0.3);
      after.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('abre una base de datos de antes de guardar lo gastado al encolar, y sus trabajos siguen', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'pr-fixer-store-'));
    try {
      const path = join(dir, 'fixer.sqlite');
      const old = new DatabaseSync(path);
      old.exec(`
        CREATE TABLE jobs (
          seq INTEGER PRIMARY KEY AUTOINCREMENT, pr INTEGER NOT NULL, sha TEXT NOT NULL, job TEXT NOT NULL,
          state TEXT NOT NULL, result TEXT, attempts INTEGER NOT NULL DEFAULT 0, UNIQUE (pr, sha)
        );
        CREATE TABLE costs (pr INTEGER NOT NULL, sha TEXT NOT NULL, usd REAL NOT NULL);
      `);
      old.prepare("INSERT INTO jobs (pr, sha, job, state) VALUES (12, 'abc123', ?, 'queued')").run(JSON.stringify(fixJob()));
      old.close();

      const store = new JobStore(path);

      expect(store.next()).toEqual(fixJob());
      expect(store.enqueue(fixJob({ sha: 'def456' }))).toBe(true);
      store.close();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
