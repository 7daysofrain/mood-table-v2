import type { AddressInfo } from 'node:net';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fixJob } from './fixtures.ts';
import { createFixerServer } from './server.ts';
import { JobStore } from './store.ts';

describe('las rutas del fixer (design.md decisión 4)', () => {
  let store: JobStore;
  let wakes: number;
  let base: string;
  let close: () => Promise<void>;

  beforeEach(async () => {
    store = new JobStore(':memory:');
    wakes = 0;
    const server = createFixerServer(store, () => {
      wakes += 1;
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    close = () => new Promise((resolve) => server.close(() => resolve()));
  });

  afterEach(async () => {
    await close();
  });

  function post(body: unknown): Promise<Response> {
    return fetch(`${base}/jobs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  it('POST /jobs encola el trabajo y despierta el bucle', async () => {
    const response = await post(fixJob());

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ created: true });
    expect(wakes).toBe(1);
    expect(store.status(12, 'abc123')).toEqual({ state: 'queued' });
  });

  it('repetir el POST con la misma PR y el mismo SHA no crea otro', async () => {
    await post(fixJob());

    const again = await post(fixJob({ budgetUsd: 1 }));

    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ created: false });
    expect(store.next()?.budgetUsd).toBe(2);
  });

  it('un cuerpo que no es un trabajo se rechaza con 400 y no encola nada', async () => {
    const invalid = await post({ ...fixJob(), sha: 7 });
    const notJson = await post('{');

    expect(invalid.status).toBe(400);
    expect(notJson.status).toBe(400);
    expect(store.next()).toBeUndefined();
    expect(wakes).toBe(0);
  });

  it('GET /jobs/:pr/:sha da en qué está el trabajo', async () => {
    await post(fixJob());

    const queued = await fetch(`${base}/jobs/12/abc123`);
    const none = await fetch(`${base}/jobs/12/otro`);

    expect(await queued.json()).toEqual({ state: 'queued' });
    expect(await none.json()).toEqual({ state: 'none' });
  });

  it('GET /pulls/:pr/spent da lo gastado por la PR', async () => {
    await post(fixJob());
    store.addCost(12, 'abc123', 0.4);

    const response = await fetch(`${base}/pulls/12/spent`);

    expect(await response.json()).toEqual({ usd: 0.4 });
  });

  it('otra ruta da 404', async () => {
    expect((await fetch(`${base}/jobs`)).status).toBe(404);
    expect((await fetch(`${base}/jobs/doce/abc`)).status).toBe(404);
  });
});
