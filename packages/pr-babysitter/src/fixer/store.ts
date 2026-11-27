/**
 * La cola del *fixer* (change pr-fixer, decisiones 4 y 8): los trabajos, uno por push, y el coste de
 * cada `query()`, en un SQLite propio (`node:sqlite`, como el motor, D103) que vive en un volumen. Así,
 * si el babysitter se reinicia, el trabajo sigue y su estado se puede consultar; y lo gastado por una
 * PR sobrevive a los reinicios de los dos.
 */
import { DatabaseSync } from 'node:sqlite';

import { type FixJob, fixJobSchema, type FixStatus, fixStatusSchema } from '../core/fix.ts';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS jobs (
    seq INTEGER PRIMARY KEY AUTOINCREMENT,
    pr INTEGER NOT NULL,
    sha TEXT NOT NULL,
    job TEXT NOT NULL,
    state TEXT NOT NULL,
    result TEXT,
    attempts INTEGER NOT NULL DEFAULT 0,
    UNIQUE (pr, sha)
  );
  CREATE TABLE IF NOT EXISTS costs (
    pr INTEGER NOT NULL,
    sha TEXT NOT NULL,
    usd REAL NOT NULL
  );
`;

interface JobRow {
  job: string;
  state: string;
  result: string | null;
}

export class JobStore {
  readonly #db: DatabaseSync;

  /** `path` es el fichero de la base de datos; `:memory:` en los tests. */
  constructor(path: string) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(SCHEMA);
  }

  /** Encola el trabajo. Si ya hay uno de esa PR y ese SHA, no crea otro y devuelve `false`. */
  enqueue(job: FixJob): boolean {
    const { changes } = this.#db
      .prepare("INSERT OR IGNORE INTO jobs (pr, sha, job, state) VALUES (?, ?, ?, 'queued')")
      .run(job.number, job.sha, JSON.stringify(job));
    return changes > 0;
  }

  /** En qué está el trabajo de ese push; `none` si no hay. */
  status(pullRequestNumber: number, sha: string): FixStatus {
    const row = this.#db
      .prepare('SELECT job, state, result FROM jobs WHERE pr = ? AND sha = ?')
      .get(pullRequestNumber, sha) as JobRow | undefined;
    if (!row) return { state: 'none' };
    if (row.result === null) return fixStatusSchema.parse({ state: row.state });
    return fixStatusSchema.parse(JSON.parse(row.result));
  }

  /** El trabajo en cola que llegó antes, o nada. */
  next(): FixJob | undefined {
    const row = this.#db.prepare("SELECT job FROM jobs WHERE state = 'queued' ORDER BY seq LIMIT 1").get() as
      | Pick<JobRow, 'job'>
      | undefined;
    return row ? fixJobSchema.parse(JSON.parse(row.job)) : undefined;
  }

  /** Lo pone en marcha y cuenta el intento (decisión 9). */
  start(pullRequestNumber: number, sha: string): void {
    this.#db
      .prepare("UPDATE jobs SET state = 'running', attempts = attempts + 1 WHERE pr = ? AND sha = ?")
      .run(pullRequestNumber, sha);
  }

  /** Guarda cómo ha acabado. */
  finish(pullRequestNumber: number, sha: string, status: FixStatus): void {
    this.#db
      .prepare('UPDATE jobs SET state = ?, result = ? WHERE pr = ? AND sha = ?')
      .run(status.state, JSON.stringify(status), pullRequestNumber, sha);
  }

  /** Suma el coste de una `query()` a lo gastado por la PR. */
  addCost(pullRequestNumber: number, sha: string, usd: number): void {
    this.#db.prepare('INSERT INTO costs (pr, sha, usd) VALUES (?, ?, ?)').run(pullRequestNumber, sha, usd);
  }

  /** Lo gastado en dólares por los arreglos de la PR, entre todos sus push. */
  spent(pullRequestNumber: number): number {
    const row = this.#db.prepare('SELECT COALESCE(SUM(usd), 0) AS usd FROM costs WHERE pr = ?').get(pullRequestNumber) as {
      usd: number;
    };
    return row.usd;
  }

  close(): void {
    this.#db.close();
  }
}
