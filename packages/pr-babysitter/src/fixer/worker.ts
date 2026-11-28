/**
 * El bucle del *fixer* (change pr-fixer, decisión 4): un trabajo a la vez, en orden de llegada. La
 * máquina de casa no da para dos agentes con `pnpm install` y tests a la vez.
 */
import type { FixJob, FixStatus } from '../core/fix.ts';

import type { JobStore } from './store.ts';

export interface Worker {
  /** Que mire la cola: llama el servidor al encolar, y `main` al arrancar. */
  wake(): void;
  /** Se resuelve cuando la cola está vacía y no hay ningún trabajo en marcha. */
  idle(): Promise<void>;
}

export function createWorker(
  store: JobStore,
  run: (job: FixJob) => Promise<FixStatus>,
  log: (message: string) => void = () => {},
): Worker {
  let draining: Promise<void> | undefined;
  // Un aviso que llega mientras el bucle acaba: vuelve a mirar la cola antes de pararse.
  let pending = false;

  async function drain(): Promise<void> {
    for (let job = store.next(); job; job = store.next()) {
      store.start(job.number, job.sha);
      let status: FixStatus;
      try {
        status = await run(job);
      } catch (error) {
        log(`El arreglo de la PR #${job.number} (${job.sha}) ha fallado: ${String(error)}`);
        status = { state: 'failed', reason: 'error', unfixed: [] };
      }
      store.finish(job.number, job.sha, status);
    }
  }

  return {
    wake() {
      pending = true;
      draining ??= (async () => {
        while (pending) {
          pending = false;
          await drain();
        }
      })().finally(() => {
        draining = undefined;
      });
    },
    async idle() {
      while (draining) await draining;
    },
  };
}
