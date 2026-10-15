import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { decodeFrame, type FrameMessage } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createFrameLoop } from '../core/frame-loop.ts';
import { type EngineServer, startServer } from './server.ts';

const strip = { id: 'demo', name: 'demo', output: { type: 'virtual' as const }, ledCount: 60 };

let panelDir: string;
let server: EngineServer | undefined;
const clients: WebSocket[] = [];

beforeEach(async () => {
  panelDir = await mkdtemp(join(tmpdir(), 'moodtable-panel-'));
  await writeFile(join(panelDir, 'index.html'), '<!doctype html><title>Mood Table</title>');
});

afterEach(async () => {
  for (const client of clients.splice(0)) client.close();
  await server?.close();
  server = undefined;
  await rm(panelDir, { recursive: true, force: true });
});

/** Un navegador conectado al WebSocket del motor, que guarda los frames que recibe. */
async function connect(url: string): Promise<FrameMessage[]> {
  const frames: FrameMessage[] = [];
  const client = new WebSocket(`${url.replace('http', 'ws')}/ws`);
  client.binaryType = 'arraybuffer';
  client.addEventListener('message', (event) => {
    const frame = decodeFrame(new Uint8Array(event.data as ArrayBuffer));
    if (frame) frames.push({ ...frame, colors: frame.colors.slice() });
  });
  clients.push(client);
  await new Promise((resolve, reject) => {
    client.addEventListener('open', resolve);
    client.addEventListener('error', reject);
  });
  return frames;
}

async function until(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('No ha pasado a tiempo');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe('el servidor del motor', () => {
  it('escucha en la dirección y el puerto de la configuración', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });

  it('con una dirección IPv6, la pone entre corchetes', async () => {
    server = await startServer({ host: '::1', port: 0, panelDir });

    expect(server.url).toMatch(/^http:\/\/\[::1\]:\d+$/);
    expect((await fetch(`${server.url}/`)).status).toBe(200);
  });

  it('sin navegadores conectados, la salida del visor no envía nada ni falla', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    expect(() => {
      server?.viewerOutput(0).write(new Uint8Array(180), { seq: 0, time: 0 });
    }).not.toThrow();
  });

  it('sirve el index.html del build del panel en /', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    const response = await fetch(`${server.url}/`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('<title>Mood Table</title>');
  });

  it('con dos navegadores, los dos reciben los mismos frames: uno por pulso y tira', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });
    const first = await connect(server.url);
    const second = await connect(server.url);
    const loop = createFrameLoop([{ config: strip, outputs: [server.viewerOutput(0)] }], 60);

    for (let pulse = 0; pulse < 5; pulse++) loop.tick((pulse * 1000) / 60);
    await until(() => first.length === 5 && second.length === 5);

    expect(first.map((frame) => frame.seq)).toEqual([0, 1, 2, 3, 4]);
    expect(first.every((frame) => frame.stripIndex === 0 && frame.colors.length === 180)).toBe(
      true,
    );
    expect(second).toEqual(first);
  });

  it('cada tira envía su índice', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });
    const frames = await connect(server.url);
    const loop = createFrameLoop(
      [
        { config: strip, outputs: [server.viewerOutput(0)] },
        { config: { ...strip, id: 'corta', ledCount: 10 }, outputs: [server.viewerOutput(1)] },
      ],
      60,
    );

    loop.tick(0);
    await until(() => frames.length === 2);

    expect(frames.map((frame) => [frame.seq, frame.stripIndex, frame.colors.length])).toEqual([
      [0, 0, 180],
      [0, 1, 30],
    ]);
  });
});
