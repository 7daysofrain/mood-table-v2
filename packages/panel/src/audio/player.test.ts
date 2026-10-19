import type { PositionMessage } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ConnectionStatus, PositionListener } from '../engine/connection.ts';
import { AudioPlayer, type AudioContextLike, type PlayerConnection } from './player.ts';

/** Un nodo de audio falso: apunta cómo lo arrancan y si lo paran. */
class FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  started: { when: number; offset: number } | undefined;
  stopped = false;
  connected = false;

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  start(when: number, offset: number): void {
    this.started = { when, offset };
  }

  stop(): void {
    this.stopped = true;
  }
}

/** Un `AudioContext` falso: el test mueve su reloj y decide su retraso de salida. */
class FakeContext implements AudioContextLike {
  currentTime = 50;
  outputLatency: number | undefined = 0.03;
  baseLatency: number | undefined = 0.01;
  readonly destination = {} as AudioDestinationNode;
  readonly nodes: FakeNode[] = [];
  resumed = 0;
  decoded: ArrayBuffer[] = [];

  resume(): Promise<void> {
    this.resumed++;
    return Promise.resolve();
  }

  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(data);
    return Promise.resolve({ duration: 4 } as AudioBuffer);
  }

  createBufferSource(): AudioBufferSourceNode {
    const node = new FakeNode();
    this.nodes.push(node);
    return node as unknown as AudioBufferSourceNode;
  }
}

/** La conexión con el motor, falsa: el test cambia su estado y le hace llegar posiciones. */
class FakeConnection implements PlayerConnection {
  status: ConnectionStatus = 'connected';
  private readonly listeners = new Set<() => void>();
  private readonly positionListeners = new Set<PositionListener>();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  subscribePositions(listener: PositionListener): () => void {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
  }

  position(position: number, arrivedAt: number): void {
    const message: PositionMessage = { seq: 0, position };
    for (const listener of this.positionListeners) listener(message, arrivedAt);
  }

  drop(): void {
    this.status = 'disconnected';
    for (const listener of this.listeners) listener();
  }

  reconnect(): void {
    this.status = 'connected';
    for (const listener of this.listeners) listener();
  }
}

let now: number;
let context: FakeContext;
let connection: FakeConnection;
let fetches: number;
let player: AudioPlayer;

/**
 * Pasa `ms` milisegundos: el reloj del panel y el de audio avanzan juntos, y el motor manda una
 * posición por frame, como si el fichero de 4 s fuera por `point` en el instante actual.
 */
function advance(ms: number, point: { value: number }): void {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000 / 60) {
    now += 1000 / 60;
    context.currentTime += 1 / 60;
    point.value = (point.value + 1 / 60) % 4;
    connection.position(point.value, now);
    vi.advanceTimersByTime(1000 / 60);
  }
}

/** Deja que acaben la descarga y la decodificación, que son promesas. */
async function settle(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

function lastNode(): FakeNode {
  const node = context.nodes.at(-1);
  if (!node) throw new Error('No ha arrancado ningún nodo');
  return node;
}

beforeEach(() => {
  vi.useFakeTimers();
  now = 10_000;
  context = new FakeContext();
  connection = new FakeConnection();
  fetches = 0;
  player = new AudioPlayer(connection, {
    fetchAudio: () => {
      fetches++;
      return Promise.resolve(new ArrayBuffer(8));
    },
    createContext: () => context,
    now: () => now,
  });
});

afterEach(() => {
  player.dispose();
  vi.useRealTimers();
});

describe('el reproductor del fichero de audio', () => {
  it('empieza callado y sin contexto de audio', () => {
    expect(player.state).toBe('silent');
    expect(context.resumed).toBe(0);
  });

  it('al pedir oír, prepara el audio: descarga /audio una vez y lo decodifica', async () => {
    const point = { value: 1 };
    connection.position(point.value, now);

    player.play();

    expect(player.state).toBe('preparing');
    expect(context.resumed).toBe(1);
    await settle();
    expect(fetches).toBe(1);
    expect(context.decoded).toHaveLength(1);
  });

  it('cuando lo tiene, suena en bucle, ya, con el fichero decodificado', async () => {
    const point = { value: 1 };
    connection.position(point.value, now);

    player.play();
    await settle();
    advance(20, point);

    expect(player.state).toBe('playing');
    const node = lastNode();
    expect(node.buffer?.duration).toBe(4);
    expect(node.loop).toBe(true);
    expect(node.connected).toBe(true);
    expect(node.started?.when).toBeCloseTo(50 + 1 / 60, 9);
  });

  it('suena por el punto del visor más el retraso de salida, no desde el principio', async () => {
    const point = { value: 2.5 };
    connection.position(point.value, now);

    player.play();
    await settle();
    advance(20, point);

    // Arranca con la primera posición tras decodificar, 2,5 s + un frame, y se oirá dentro de 40 ms
    // (outputLatency + baseLatency): para entonces, el visor irá 40 ms más allá.
    expect(lastNode().started?.offset).toBeCloseTo(2.5 + 1 / 60 + 0.04, 3);
  });

  it('sin retraso declarado, toma 0', async () => {
    context.outputLatency = undefined;
    context.baseLatency = undefined;
    const point = { value: 2.5 };
    connection.position(point.value, now);

    player.play();
    await settle();
    advance(20, point);

    expect(lastNode().started?.offset).toBeCloseTo(2.5 + 1 / 60, 3);
  });

  it('dejar de oír para el nodo y vuelve a callado', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(100, point);
    const node = lastNode();

    player.stop();

    expect(node.stopped).toBe(true);
    expect(node.connected).toBe(false);
    expect(player.state).toBe('silent');
  });

  it('volver a oír arranca otro nodo en el punto del momento, sin volver a descargar', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(100, point);
    player.stop();
    advance(1500, point);

    player.play();

    expect(player.state).toBe('playing');
    expect(fetches).toBe(1);
    expect(context.nodes).toHaveLength(2);
    expect(lastNode().started?.offset).toBeCloseTo(point.value + 0.04, 3);
  });

  it('mide el error de sincronía mientras suena, y en sincronía queda en 0', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(1000, point);

    expect(player.error).toBeCloseTo(0, 3);
    expect(context.nodes).toHaveLength(1);
  });

  it('un error por encima del umbral para el nodo y arranca otro en el punto bueno', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);
    const first = lastNode();

    // El reloj de audio se adelanta 25 ms al del motor.
    context.currentTime += 0.025;
    advance(500, point);

    expect(first.stopped).toBe(true);
    expect(context.nodes).toHaveLength(2);
    // El nodo nuevo suena ahora por el punto que mostrará el visor cuando se oiga, 40 ms después.
    const { when, offset } = lastNode().started ?? { when: 0, offset: 0 };
    expect(offset + (context.currentTime - when)).toBeCloseTo(point.value + 0.04, 3);
    expect(Math.abs(player.error ?? 1)).toBeLessThan(0.02);
  });

  it('un error por debajo del umbral no salta', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);

    context.currentTime += 0.015;
    advance(500, point);

    expect(context.nodes).toHaveLength(1);
    expect(player.error).toBeCloseTo(0.015, 3);
  });

  it('sin conexión, calla y suelta el buffer: al volver, lo descarga otra vez', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(100, point);
    const node = lastNode();

    connection.drop();

    expect(node.stopped).toBe(true);
    expect(player.state).toBe('silent');
    expect(player.error).toBeUndefined();

    connection.reconnect();
    advance(100, point);
    expect(player.state).toBe('silent');
    player.play();
    await settle();
    expect(fetches).toBe(2);
  });

  it('si deja de oír mientras prepara el audio, no suena al terminar de prepararlo', async () => {
    const point = { value: 1 };
    player.play();
    player.stop();
    await settle();
    advance(100, point);

    expect(player.state).toBe('silent');
    expect(context.nodes).toHaveLength(0);
  });

  it('si la descarga falla, vuelve a callado', async () => {
    const failing = new AudioPlayer(connection, {
      fetchAudio: () => Promise.reject(new Error('404')),
      createContext: () => context,
      now: () => now,
    });

    failing.play();
    await settle();

    expect(failing.state).toBe('silent');
    failing.dispose();
  });

  it('avisa de cada cambio de estado', async () => {
    const states: string[] = [];
    player.subscribe(() => states.push(player.state));
    const point = { value: 1 };

    player.play();
    await settle();
    advance(20, point);
    player.stop();

    expect(states).toEqual(['preparing', 'playing', 'silent']);
  });
});
