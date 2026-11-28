import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FixJob } from '../core/fix.ts';
import type { Fixer } from '../core/ports.ts';

import { createFixerClient } from './fixer-client.ts';

const job: FixJob = {
  number: 12,
  sha: 'abc123',
  pr: { title: 'feat: algo', description: '' },
  findings: [
    { source: 'check', name: 'lint', conclusion: 'failure', context: { state: 'notProvided' } },
  ],
  budgetUsd: 2,
};

interface Received {
  method: string;
  url: string;
  body: string;
}

describe('el cliente HTTP del fixer (design.md decisión 4)', () => {
  let routes: Record<string, { status: number; body: unknown }>;
  let received: Received[];
  let client: Fixer;
  let close: () => Promise<void>;

  // Un fixer falso: responde a cada `MÉTODO ruta` con su estado y su cuerpo.
  beforeEach(async () => {
    routes = {};
    received = [];
    const server = createServer((request: IncomingMessage, response: ServerResponse) => {
      let body = '';
      request.on('data', (chunk: Buffer) => (body += chunk.toString()));
      request.on('end', () => {
        received.push({ method: request.method ?? '', url: request.url ?? '', body });
        const route = routes[`${request.method} ${request.url}`] ?? { status: 404, body: {} };
        response.writeHead(route.status, { 'content-type': 'application/json' });
        response.end(JSON.stringify(route.body));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    client = createFixerClient({ baseUrl: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    close = () => new Promise((resolve) => server.close(() => resolve()));
  });

  afterEach(async () => {
    await close();
  });

  it('pide el arreglo con un POST /jobs con el trabajo', async () => {
    routes['POST /jobs'] = { status: 202, body: { created: true } };

    await client.request(job);

    expect(received).toEqual([{ method: 'POST', url: '/jobs', body: JSON.stringify(job) }]);
  });

  it('pedir un trabajo que ya existe no es un error', async () => {
    routes['POST /jobs'] = { status: 200, body: { created: false } };

    await expect(client.request(job)).resolves.toBeUndefined();
  });

  it('si el fixer rechaza el trabajo, lanza', async () => {
    routes['POST /jobs'] = { status: 400, body: { error: 'el cuerpo no es un trabajo' } };

    await expect(client.request(job)).rejects.toThrow(/400/);
  });

  it('da en qué está el trabajo de un push', async () => {
    routes['GET /jobs/12/abc123'] = { status: 200, body: { state: 'pushed', sha: 'def456', unfixed: [] } };

    expect(await client.status(12, 'abc123')).toEqual({ state: 'pushed', sha: 'def456', unfixed: [] });
  });

  it('un estado que no se entiende lanza', async () => {
    routes['GET /jobs/12/abc123'] = { status: 200, body: { state: 'arreglando' } };

    await expect(client.status(12, 'abc123')).rejects.toThrow();
  });

  it('da lo gastado por la PR', async () => {
    routes['GET /pulls/12/spent'] = { status: 200, body: { usd: 0.75 } };

    expect(await client.spent(12)).toBe(0.75);
  });

  it('si el fixer no contesta bien, lanza', async () => {
    await expect(client.spent(12)).rejects.toThrow(/404/);
  });
});
