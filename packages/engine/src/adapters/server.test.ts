import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  decodeSourceStatus,
  type FrameMessage,
  type LevelMessage,
  type PositionMessage,
  type SourceMessage,
  type SourceStatus,
} from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createControl } from '../core/control.ts';
import { createFrameLoop, type FrameLoopOptions, type LoopStrip } from '../core/frame-loop.ts';
import { MemoryAudioSource } from './memory-audio-source.ts';
import { type EngineServer, startServer } from './server.ts';

const GOLPES = fileURLToPath(new URL('../../test/fixtures/golpes.wav', import.meta.url));

/** Los bytes del fichero de golpes, como los lee el motor al arrancar. */
async function golpes(): Promise<Uint8Array> {
  return new Uint8Array(await readFile(GOLPES));
}

const strip = {
  id: 'demo',
  name: 'demo',
  output: { type: 'virtual' as const },
  ledCount: 60,
  effect: 'breathing' as const,
};

/** El bucle a 60 fps con su búfer de control, como lo monta la raíz de composición. */
function loopOf(strips: LoopStrip[], options: FrameLoopOptions = {}) {
  const control = createControl({
    strips: strips.map((each) => each.config),
    hasAudioSource: options.audioSource !== undefined,
  });
  return createFrameLoop(strips, control, 60, options);
}

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

/** Lo que recibe un navegador, por tipo de mensaje. */
interface Received {
  frames: FrameMessage[];
  sources: SourceMessage[];
  levels: LevelMessage[];
  positions: PositionMessage[];
  statuses: SourceStatus[];
  /** El tipo de cada mensaje (su primer byte), en el orden en que llega. */
  types: number[];
}

/** Un navegador conectado al WebSocket del motor, que guarda los mensajes que recibe. */
async function connectAll(url: string): Promise<Received> {
  const received: Received = {
    frames: [],
    sources: [],
    levels: [],
    positions: [],
    statuses: [],
    types: [],
  };
  const client = new WebSocket(`${url.replace('http', 'ws')}/ws`);
  client.binaryType = 'arraybuffer';
  client.addEventListener('message', (event) => {
    const message = new Uint8Array(event.data as ArrayBuffer);
    received.types.push(message[0] ?? -1);
    const frame = decodeFrame(message);
    if (frame) received.frames.push({ ...frame, colors: frame.colors.slice() });
    const source = decodeSource(message);
    if (source) received.sources.push(source);
    const level = decodeLevel(message);
    if (level) received.levels.push(level);
    const position = decodePosition(message);
    if (position) received.positions.push(position);
    const status = decodeSourceStatus(message);
    if (status) received.statuses.push(status);
  });
  clients.push(client);
  await new Promise((resolve, reject) => {
    client.addEventListener('open', resolve);
    client.addEventListener('error', reject);
  });
  return received;
}

/** Los frames que recibe un navegador conectado. */
async function connect(url: string): Promise<FrameMessage[]> {
  return (await connectAll(url)).frames;
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

  it('si escucha en toda la red, da la IP de esta máquina y no 0.0.0.0', async () => {
    server = await startServer({ host: '0.0.0.0', port: 0, panelDir });

    expect(server.url).not.toContain('0.0.0.0');
    expect((await fetch(`${server.url}/`)).status).toBe(200);
  });

  it('sin el build del panel, explica cómo construirlo en lugar de dar un 404', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir: join(panelDir, 'no') });

    const response = await fetch(`${server.url}/`);

    expect(response.status).toBe(503);
    expect(await response.text()).toContain('pnpm --filter @moodtable/panel build');
  });

  it('sin navegadores conectados, la salida del visor no envía nada ni falla', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    expect(() => {
      server?.viewerOutput(0).write(new Uint8Array(180), { seq: 0, time: 0 });
    }).not.toThrow();
  });

  it('sin navegadores conectados, la salida de nivel no envía nada ni falla', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    expect(() => {
      server?.levelOutput.write(0.5, { seq: 0, time: 0 });
    }).not.toThrow();
  });

  it('sin navegadores conectados, la salida de la posición no envía nada ni falla', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    expect(() => {
      server?.positionOutput.write(1.5, { seq: 0, time: 0 });
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
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }]);

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
    const loop = loopOf(
      [
        { config: strip, outputs: [server.viewerOutput(0)] },
        { config: { ...strip, id: 'corta', ledCount: 10 }, outputs: [server.viewerOutput(1)] },
      ],
    );

    loop.tick(0);
    await until(() => frames.length === 2);

    expect(frames.map((frame) => [frame.seq, frame.stripIndex, frame.colors.length])).toEqual([
      [0, 0, 180],
      [0, 1, 30],
    ]);
  });

  it('al conectarse, cada navegador recibe la fuente de audio: el fichero, con su nombre', async () => {
    const source = { kind: 'file' as const, name: 'golpes.wav' };
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir, source });
    const first = await connectAll(server.url);
    const second = await connectAll(server.url);

    await until(() => first.sources.length === 1 && second.sources.length === 1);

    expect(first.sources).toEqual([source]);
    expect(second.sources).toEqual([source]);
  });

  it('sin fuente de audio, cada navegador recibe que no hay ninguna', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });
    const received = await connectAll(server.url);

    await until(() => received.sources.length === 1);

    expect(received.sources).toEqual([{ kind: 'none' }]);
  });

  it('en cada pulso, los dos navegadores reciben el mismo nivel, con el seq de los frames', async () => {
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      panelDir,
      source: { kind: 'file', name: 'tono.wav' },
    });
    const first = await connectAll(server.url);
    const second = await connectAll(server.url);
    const tone = Float32Array.from({ length: 44_100 }, (_, index) =>
      Math.sin((2 * Math.PI * 1000 * index) / 44_100),
    );
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }], {
      audioSource: new MemoryAudioSource(tone, 44_100),
      levelOutputs: [server.levelOutput],
    });

    for (let pulse = 0; pulse < 3; pulse++) loop.tick((pulse * 1000) / 60);
    // El nivel de un pulso sale antes que sus frames: se esperan los dos.
    await until(
      () => first.levels.length === 3 && second.levels.length === 3 && first.frames.length === 3,
    );

    expect(first.levels.map(({ seq }) => seq)).toEqual(first.frames.map(({ seq }) => seq));
    expect(first.levels.every(({ level }) => Math.abs(level - Math.SQRT1_2) < 0.01)).toBe(true);
    expect(second.levels).toEqual(first.levels);
  });

  it('sin fuente de audio, ningún mensaje de nivel', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });
    const received = await connectAll(server.url);
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }], {
      levelOutputs: [server.levelOutput],
    });

    for (let pulse = 0; pulse < 3; pulse++) loop.tick((pulse * 1000) / 60);
    await until(() => received.frames.length === 3);

    expect(received.levels).toEqual([]);
  });

  it('en cada pulso, los dos navegadores reciben la misma posición, con el seq de los frames', async () => {
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      panelDir,
      source: { kind: 'file', name: 'rampa.wav' },
    });
    const first = await connectAll(server.url);
    const second = await connectAll(server.url);
    // Un fichero de 1 s a 60 Hz: la posición de cada pulso es su instante.
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }], {
      audioSource: new MemoryAudioSource(new Float32Array(60), 60),
      positionOutputs: [server.positionOutput],
    });

    for (let pulse = 0; pulse < 3; pulse++) loop.tick((pulse * 1000) / 60);
    // La posición de un pulso sale antes que sus frames: se esperan los dos.
    await until(
      () =>
        first.positions.length === 3 && second.positions.length === 3 && first.frames.length === 3,
    );

    expect(first.positions.map(({ seq }) => seq)).toEqual(first.frames.map(({ seq }) => seq));
    expect(first.positions.map(({ position }) => position)).toEqual([0, 1 / 60, 2 / 60]);
    expect(second.positions).toEqual(first.positions);
  });

  it('sin fuente de audio, ningún mensaje de posición', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });
    const received = await connectAll(server.url);
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }], {
      positionOutputs: [server.positionOutput],
    });

    for (let pulse = 0; pulse < 3; pulse++) loop.tick((pulse * 1000) / 60);
    await until(() => received.frames.length === 3);

    expect(received.positions).toEqual([]);
  });
});

/** El estado de una tarjeta de sonido falsa: el test decide cuándo cambia. */
class FakeSoundcardStatus {
  private status: SourceStatus;
  private listeners: ((status: SourceStatus) => void)[] = [];

  constructor(status: SourceStatus) {
    this.status = status;
  }

  /** Como `onStatus` del adaptador: el estado actual al momento, después cada cambio, y la baja. */
  watch = (listener: (status: SourceStatus) => void): (() => void) => {
    this.listeners.push(listener);
    listener(this.status);
    return () => {
      this.listeners = this.listeners.filter((each) => each !== listener);
    };
  };

  get watchers(): number {
    return this.listeners.length;
  }

  set(status: SourceStatus): void {
    this.status = status;
    for (const listener of this.listeners) listener(status);
  }
}

const SOUNDCARD = { kind: 'soundcard' as const, name: 'Mixer de la mesa' };

describe('el estado de la tarjeta de sonido', () => {
  it.each(['connected', 'lost'] as const)(
    'al conectarse, un panel recibe la fuente y después el estado (%s)',
    async (status) => {
      const card = new FakeSoundcardStatus(status);
      server = await startServer({
        host: '127.0.0.1',
        port: 0,
        panelDir,
        source: SOUNDCARD,
        watchSourceStatus: card.watch,
      });
      const received = await connectAll(server.url);

      await until(() => received.statuses.length === 1);

      expect(received.sources).toEqual([SOUNDCARD]);
      expect(received.statuses).toEqual([status]);
      expect(received.types).toEqual([2, 5]);
    },
  );

  it('un panel que se conecta tras perderla recibe que está perdida', async () => {
    const card = new FakeSoundcardStatus('connected');
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      panelDir,
      source: SOUNDCARD,
      watchSourceStatus: card.watch,
    });

    card.set('lost');
    const received = await connectAll(server.url);
    await until(() => received.statuses.length === 1);

    expect(received.statuses).toEqual(['lost']);
  });

  it('cada cambio llega a todos los paneles conectados', async () => {
    const card = new FakeSoundcardStatus('lost');
    server = await startServer({
      host: '127.0.0.1',
      port: 0,
      panelDir,
      source: SOUNDCARD,
      watchSourceStatus: card.watch,
    });
    const first = await connectAll(server.url);
    const second = await connectAll(server.url);
    await until(() => first.statuses.length === 1 && second.statuses.length === 1);

    card.set('connected');
    await until(() => first.statuses.length === 2 && second.statuses.length === 2);

    expect(first.statuses).toEqual(['lost', 'connected']);
    expect(second.statuses).toEqual(['lost', 'connected']);
  });

  it('al cerrar el servidor, deja de escuchar el estado de la tarjeta', async () => {
    const card = new FakeSoundcardStatus('connected');
    const closing = await startServer({
      host: '127.0.0.1',
      port: 0,
      panelDir,
      source: SOUNDCARD,
      watchSourceStatus: card.watch,
    });
    expect(card.watchers).toBe(1);

    await closing.close();

    expect(card.watchers).toBe(0);
  });

  it.each([
    ['con un fichero', { kind: 'file' as const, name: 'golpes.wav' }],
    ['sin fuente', undefined],
  ])('%s, ningún mensaje de estado', async (_name, source) => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir, source });
    const received = await connectAll(server.url);
    const loop = loopOf([{ config: strip, outputs: [server.viewerOutput(0)] }]);

    loop.tick(0);
    await until(() => received.frames.length === 1);

    expect(received.statuses).toEqual([]);
    expect(received.types).toEqual([2, 1]);
  });
});

/** Las cabeceras y el cuerpo de una respuesta, juntos, para buscar en ellos la ruta del fichero. */
async function everythingIn(response: Response): Promise<string> {
  return [...response.headers.entries()].flat().join('\n') + (await response.text());
}

/**
 * Que el cuerpo de `response` sea, byte a byte, `expected`. Con `Buffer.equals` y no con `toEqual`,
 * que recorre los bytes uno a uno: con un WAV de 345 KB tardaba segundos en la CI con cobertura.
 */
async function expectBytes(response: Response, expected: Uint8Array): Promise<void> {
  const received = Buffer.from(await response.arrayBuffer());
  expect(
    received.equals(expected),
    `los bytes no coinciden (${received.length} recibidos, ${expected.length} esperados)`,
  ).toBe(true);
}

describe('el fichero de audio en /audio', () => {
  it('con un fichero como fuente, es el fichero, byte a byte, como audio WAV', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir, audioBytes: await golpes() });

    const response = await fetch(`${server.url}/audio`);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/wav');
    await expectBytes(response, await readFile(GOLPES));
  });

  it('las cabeceras no dicen dónde está el fichero en el disco', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir, audioBytes: await golpes() });

    const response = await fetch(`${server.url}/audio`);
    const headers = [...response.headers.entries()].flat().join('\n');
    await response.arrayBuffer();

    expect(headers).not.toContain('fixtures');
  });

  it('sin fuente de audio, responde que no existe, sin rutas del disco', async () => {
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir });

    const response = await fetch(`${server.url}/audio`);

    expect(response.status).toBe(404);
    expect(await everythingIn(response)).not.toContain(panelDir);
  });

  it('sirve los bytes que recibió al arrancar, aunque el fichero cambie o se borre en el disco', async () => {
    const audioFile = join(panelDir, 'cambia.wav');
    await copyFile(GOLPES, audioFile);
    // Los bytes que leyó el motor al arrancar, los mismos que analiza.
    const audioBytes = new Uint8Array(await readFile(audioFile));
    server = await startServer({ host: '127.0.0.1', port: 0, panelDir, audioBytes });

    await writeFile(audioFile, 'otro fichero');
    const changed = await fetch(`${server.url}/audio`);
    await rm(audioFile);
    const removed = await fetch(`${server.url}/audio`);

    for (const response of [changed, removed]) {
      expect(response.status).toBe(200);
      await expectBytes(response, audioBytes);
    }
  });
});
