/**
 * El puerto `Fixer` por HTTP interno (change pr-fixer, decisión 4): habla con el servicio `fixer` del
 * mismo compose. Las respuestas se validan con zod, con el mismo contrato que valida el *fixer*.
 * Lanza si el *fixer* no contesta o contesta algo que no se entiende: el grafo lo trata como un
 * *fixer* que no está.
 */
import * as z from 'zod';

import { type FixJob, type FixStatus, fixStatusSchema } from '../core/fix.ts';
import type { Fixer } from '../core/ports.ts';

const spentSchema = z.object({ usd: z.number().min(0) });

export interface FixerClientOptions {
  /** `http://fixer:8080` en el compose. */
  baseUrl: string;
  fetch?: typeof globalThis.fetch;
}

export function createFixerClient({ baseUrl, fetch = globalThis.fetch }: FixerClientOptions): Fixer {
  const url = (path: string) => new URL(path, baseUrl).toString();

  async function get(path: string): Promise<unknown> {
    const response = await fetch(url(path));
    if (!response.ok) throw new Error(`El fixer responde ${response.status} a GET ${path}`);
    return response.json();
  }

  return {
    async request(job: FixJob) {
      const response = await fetch(url('/jobs'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(job),
      });
      if (!response.ok) throw new Error(`El fixer responde ${response.status} al pedir el arreglo de #${job.number}`);
    },
    async status(pullRequestNumber, sha): Promise<FixStatus> {
      return fixStatusSchema.parse(await get(`/jobs/${pullRequestNumber}/${encodeURIComponent(sha)}`));
    },
    async spent(pullRequestNumber) {
      return spentSchema.parse(await get(`/pulls/${pullRequestNumber}/spent`)).usd;
    },
  };
}
