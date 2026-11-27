/**
 * Las rutas del *fixer* (change pr-fixer, decisión 4), validadas con zod. Escucha solo en la red
 * interna del compose: no publica puertos al *host*.
 *
 * - `POST /jobs`: encola un trabajo (202) o, si ya hay uno de esa PR y ese SHA, no hace nada (200).
 * - `GET /jobs/:pr/:sha`: en qué está el trabajo de ese push.
 * - `GET /pulls/:pr/spent`: lo gastado por los arreglos de la PR.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';

import { fixJobSchema } from '../core/fix.ts';

import type { JobStore } from './store.ts';

const JOB = /^\/jobs\/(\d+)\/([^/]+)$/;
const SPENT = /^\/pulls\/(\d+)\/spent$/;

function send(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function enqueue(request: IncomingMessage, response: ServerResponse, store: JobStore, wake: () => void) {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    send(response, 400, { error: 'el cuerpo no es JSON' });
    return;
  }
  const job = fixJobSchema.safeParse(body);
  if (!job.success) {
    send(response, 400, { error: 'el cuerpo no es un trabajo', issues: job.error.issues });
    return;
  }
  const created = store.enqueue(job.data);
  if (created) wake();
  send(response, created ? 202 : 200, { created });
}

/** El servidor HTTP del *fixer*. `wake` despierta el bucle cuando llega un trabajo nuevo. */
export function createFixerServer(store: JobStore, wake: () => void): Server {
  return createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://fixer').pathname;
    if (request.method === 'POST' && path === '/jobs') {
      void enqueue(request, response, store, wake);
      return;
    }
    const job = request.method === 'GET' ? JOB.exec(path) : null;
    if (job) {
      send(response, 200, store.status(Number(job[1]), decodeURIComponent(job[2] ?? '')));
      return;
    }
    const spent = request.method === 'GET' ? SPENT.exec(path) : null;
    if (spent) {
      send(response, 200, { usd: store.spent(Number(spent[1])) });
      return;
    }
    send(response, 404, { error: 'no hay esa ruta' });
  });
}
