import { describe, expect, it } from 'vitest';

import type { FixJob, FixStatus } from '../core/fix.ts';

import { fixJob } from './fixtures.ts';
import { JobStore } from './store.ts';
import { createWorker } from './worker.ts';

describe('el bucle del fixer: un trabajo a la vez (design.md decisión 4)', () => {
  it('hace los trabajos de uno en uno, en orden de llegada, y guarda cómo acaba cada uno', async () => {
    const store = new JobStore(':memory:');
    const started: number[] = [];
    let running = 0;
    let maxRunning = 0;
    const run = async (job: FixJob): Promise<FixStatus> => {
      started.push(job.number);
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return { state: 'pushed', sha: `fix-${job.number}`, unfixed: [] };
    };
    const worker = createWorker(store, run);

    store.enqueue(fixJob({ number: 20, sha: 'b' }));
    worker.wake();
    store.enqueue(fixJob({ number: 10, sha: 'a' }));
    worker.wake();
    await worker.idle();

    expect(started).toEqual([20, 10]);
    expect(maxRunning).toBe(1);
    expect(store.status(20, 'b')).toEqual({ state: 'pushed', sha: 'fix-20', unfixed: [] });
    expect(store.status(10, 'a')).toEqual({ state: 'pushed', sha: 'fix-10', unfixed: [] });
  });

  it('mientras hace un trabajo, el trabajo está en marcha', async () => {
    const store = new JobStore(':memory:');
    let seen: FixStatus | undefined;
    const worker = createWorker(store, (job) => {
      seen = store.status(job.number, job.sha);
      return Promise.resolve({ state: 'obsolete' });
    });

    store.enqueue(fixJob());
    worker.wake();
    await worker.idle();

    expect(seen).toEqual({ state: 'running' });
  });

  it('un trabajo que lanza acaba como fallido, y el bucle sigue con el siguiente', async () => {
    const store = new JobStore(':memory:');
    const worker = createWorker(store, (job) =>
      job.number === 20 ? Promise.reject(new Error('git clone ha fallado')) : Promise.resolve({ state: 'obsolete' }),
    );

    store.enqueue(fixJob({ number: 20, sha: 'b' }));
    store.enqueue(fixJob({ number: 10, sha: 'a' }));
    worker.wake();
    await worker.idle();

    expect(store.status(20, 'b')).toEqual({ state: 'failed', reason: 'error', unfixed: [] });
    expect(store.status(10, 'a')).toEqual({ state: 'obsolete' });
  });
});
