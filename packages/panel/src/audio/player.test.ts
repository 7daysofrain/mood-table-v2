import type { PositionMessage } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeContext, type FakeNode } from '../../test/fake-audio-context.ts';
import type { ConnectionStatus, PositionListener } from '../engine/connection.ts';
import { AudioPlayer, type PlayerConnection } from './player.ts';
import { circularDifference } from './sync.ts';

/** El retraso de salida del contexto falso: `outputLatency` + `baseLatency`. */
const LATENCY = 0.04;
/** Cuánto por delante del reloj de audio se programa un nodo (decisión 4). */
const LEAD = 0.05;

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
 * Pasa `ms` milisegundos: el reloj del panel y el de audio avanzan juntos (o el de audio `rate` veces
 * más deprisa), y el motor manda una posición por frame, como si el fichero de 4 s fuera por `point`
 * en el instante actual.
 */
function advance(ms: number, point: { value: number }, rate = 1): void {
  for (let elapsed = 0; elapsed < ms; elapsed += 1000 / 60) {
    now += 1000 / 60;
    context.currentTime += rate / 60;
    point.value = (point.value + 1 / 60) % 4;
    connection.position(point.value, now);
    vi.advanceTimersByTime(1000 / 60);
  }
}

/**
 * Lo que se oye ahora: lo que el contexto sonó hace el retraso de salida, del último nodo que ya
 * había arrancado entonces. Es el oráculo de la sincronía: no sale de las cuentas del reproductor.
 */
function heard(): number | undefined {
  const at = context.currentTime - LATENCY;
  const node = context.nodes.findLast((candidate) => (candidate.started?.when ?? Infinity) <= at);
  if (!node?.started) return undefined;
  return (node.started.offset + (at - node.started.when)) % 4;
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

  it('cuando lo tiene, suena en bucle con el fichero decodificado, programado con margen', async () => {
    const point = { value: 1 };
    connection.position(point.value, now);

    player.play();
    await settle();

    expect(player.state).toBe('playing');
    const node = lastNode();
    expect(node.buffer?.duration).toBe(4);
    expect(node.loop).toBe(true);
    expect(node.connected).toBe(true);
    // Arrancar «ya» empezaría un poco después con el mismo punto: se programa 50 ms por delante.
    expect(node.started?.when).toBeCloseTo(50 + LEAD, 9);
  });

  it('suena por el punto del visor cuando se oiga, no desde el principio', async () => {
    const point = { value: 2.5 };
    connection.position(point.value, now);

    player.play();
    await settle();

    // Arranca dentro de 50 ms y se oirá 40 ms después (outputLatency + baseLatency): para
    // entonces, el visor irá 90 ms más allá.
    expect(lastNode().started?.offset).toBeCloseTo(2.5 + LEAD + LATENCY, 3);
  });

  it('sin retraso declarado, toma 0', async () => {
    context.outputLatency = undefined;
    context.baseLatency = undefined;
    const point = { value: 2.5 };
    connection.position(point.value, now);

    player.play();
    await settle();

    expect(lastNode().started?.offset).toBeCloseTo(2.5 + LEAD, 3);
  });

  it('el primer arranque sale de la mediana de lo llegado mientras preparaba, no de una llegada', async () => {
    const point = { value: 1 };
    player.play();
    // Mientras descarga y decodifica, llega un segundo de posiciones.
    advance(1000, point);
    // Y la primera tras decodificar llega con 30 ms de retraso de la red.
    connection.position(point.value - 0.03, now);
    await settle();
    connection.position(point.value - 0.03, now);

    expect(context.nodes).toHaveLength(1);
    expect(lastNode().started?.offset).toBeCloseTo(point.value + LEAD + LATENCY, 3);
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
    expect(lastNode().started?.offset).toBeCloseTo(point.value + LEAD + LATENCY, 3);
  });

  it('mide el error de sincronía mientras suena, y en sincronía queda en 0 y sin saltos', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(1000, point);

    expect(player.error).toBeCloseTo(0, 3);
    expect(player.jumps).toBe(0);
    expect(context.nodes).toHaveLength(1);
  });

  it('un error por encima del umbral programa otro nodo en el punto bueno y para el viejo a la vez', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);
    const first = lastNode();

    // El reloj de audio se adelanta 25 ms al del motor; frame a frame hasta la comprobación que salta.
    context.currentTime += 0.025;
    for (let frame = 0; frame < 15 && player.jumps === 0; frame++) advance(1, point);

    expect(context.nodes).toHaveLength(2);
    const { when, offset } = lastNode().started ?? { when: 0, offset: 0 };
    // Empalme en la misma muestra: el viejo para justo cuando arranca el nuevo, no antes.
    expect(first.stoppedAt).toBe(when);
    // El nodo nuevo suena por el punto que mostrará el visor cuando se oiga.
    expect(offset + (context.currentTime - when)).toBeCloseTo(point.value + LATENCY, 3);
    // Cuenta el salto y deja ver el error que lo provocó, no el de después de corregir.
    expect(player.jumps).toBe(1);
    expect(player.error).toBeCloseTo(0.025, 3);
  });

  it('un error por debajo del umbral no salta', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);

    context.currentTime += 0.015;
    advance(500, point);

    expect(context.nodes).toHaveLength(1);
    expect(player.jumps).toBe(0);
    expect(player.error).toBeCloseTo(0.015, 3);
  });

  it('cuenta los saltos desde que el maker pide oír: al volver a oír, empieza de 0', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);
    context.currentTime += 0.025;
    advance(250, point);
    expect(player.jumps).toBe(1);

    player.stop();
    player.play();

    expect(player.jumps).toBe(0);
  });

  it('con el contexto de audio parado, no corrige: su reloj no avanza', async () => {
    const point = { value: 1 };
    player.play();
    await settle();
    advance(500, point);

    // Safari lo interrumpe (una llamada, el móvil bloqueado): el visor sigue y el sonido no.
    context.state = 'suspended';
    advance(1000, point, 0);

    expect(context.nodes).toHaveLength(1);
    expect(player.jumps).toBe(0);
  });

  it('si el navegador no deja reanudar el contexto, vuelve a callado', async () => {
    context.resumeFails = true;
    connection.position(1, now);

    player.play();
    await settle();

    expect(player.state).toBe('silent');
    expect(context.nodes).toHaveLength(0);
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
    expect(player.jumps).toBe(0);

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

describe('muchas vueltas del bucle con deriva entre los relojes', () => {
  /**
   * El fichero de golpes (4 s) sonando 10 minutos con el reproductor de verdad: el reloj de audio va
   * 50 partes por millón más deprisa que el del motor (3 ms por minuto). Cada 250 ms se compara lo que
   * se oye con lo que muestra el visor en ese momento.
   */
  it('lo que se oye nunca va 45 ms por delante ni 125 ms por detrás, y salta una sola vez', async () => {
    const point = { value: 0 };
    connection.position(point.value, now);
    player.play();
    await settle();
    advance(1000, point, 1 + 50e-6);

    const errors: number[] = [];
    for (let check = 0; check < 4 * 60 * 10; check++) {
      advance(250, point, 1 + 50e-6);
      const sound = heard();
      if (sound !== undefined) errors.push(circularDifference(sound, point.value, 4));
    }

    expect(errors.length).toBeGreaterThan(2000);
    expect(Math.max(...errors)).toBeLessThanOrEqual(0.045);
    expect(Math.min(...errors)).toBeGreaterThanOrEqual(-0.125);
    // 3 ms por minuto en 10 minutos son 30 ms: salta una vez, al pasar de 20 ms, no en cada vuelta.
    expect(player.jumps).toBe(1);
  });
});
