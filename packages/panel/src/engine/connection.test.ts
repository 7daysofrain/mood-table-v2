import {
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  encodeSourceStatus,
  encodeStrips,
  type StripsMessage,
} from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  EngineConnection,
  type PositionListener,
  type SocketLike,
  viewerUrl,
} from './connection.ts';

/** Un WebSocket falso: el test decide cuándo se abre, se cierra o llega un mensaje. */
class FakeSocket implements SocketLike {
  binaryType: BinaryType = 'blob';
  readyState: SocketLike['readyState'] = WebSocket.CONNECTING;
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onmessage: SocketLike['onmessage'] = null;
  closed = false;

  close(): void {
    this.closed = true;
    this.readyState = WebSocket.CLOSED;
  }

  open(): void {
    this.readyState = WebSocket.OPEN;
    this.onopen?.call(this as unknown as WebSocket, new Event('open'));
  }

  drop(): void {
    this.onclose?.call(this as unknown as WebSocket, new CloseEvent('close'));
  }

  receive(message: Uint8Array): void {
    const data = message.buffer.slice(message.byteOffset, message.byteOffset + message.byteLength);
    this.onmessage?.call(this as unknown as WebSocket, new MessageEvent('message', { data }));
  }
}

let sockets: FakeSocket[];
let connection: EngineConnection;

beforeEach(() => {
  vi.useFakeTimers();
  sockets = [];
  connection = new EngineConnection('ws://motor/ws', () => {
    const socket = new FakeSocket();
    sockets.push(socket);
    return socket;
  });
});

afterEach(() => {
  connection.stop();
  vi.useRealTimers();
});

function lastSocket(): FakeSocket {
  const socket = sockets.at(-1);
  if (!socket) throw new Error('No hay ninguna conexión');
  return socket;
}

describe('la conexión del panel con el motor', () => {
  it('empieza sin conexión y abre una conexión binaria al arrancar', () => {
    expect(connection.status).toBe('disconnected');

    connection.start();

    expect(sockets).toHaveLength(1);
    expect(lastSocket().binaryType).toBe('arraybuffer');
    expect(connection.status).toBe('disconnected');
  });

  it('al abrirse, pasa a «conectado» y avisa', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();

    lastSocket().open();

    expect(connection.status).toBe('connected');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('al cerrarse, vuelve a «sin conexión», olvida los frames y reintenta al cabo de un segundo', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeFrame(1, 0, Uint8Array.of(10, 20, 30)));

    lastSocket().drop();

    expect(connection.status).toBe('disconnected');
    expect(connection.frames.size).toBe(0);
    vi.advanceTimersByTime(999);
    expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(sockets).toHaveLength(2);
  });

  it('mientras el motor no está, reintenta cada segundo', () => {
    connection.start();

    for (let attempt = 1; attempt <= 3; attempt++) {
      lastSocket().drop();
      vi.advanceTimersByTime(1000);
    }

    expect(sockets).toHaveLength(4);
  });

  it('al reconectar, vuelve a «conectado»', () => {
    connection.start();
    lastSocket().open();
    lastSocket().drop();
    vi.advanceTimersByTime(1000);

    lastSocket().open();

    expect(connection.status).toBe('connected');
  });

  it('guarda el último frame de cada tira e ignora los mensajes que no son frames', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(encodeFrame(1, 0, Uint8Array.of(1, 1, 1)));
    lastSocket().receive(encodeFrame(1, 1, Uint8Array.of(2, 2, 2, 2, 2, 2)));
    lastSocket().receive(encodeFrame(2, 0, Uint8Array.of(3, 3, 3)));
    lastSocket().receive(Uint8Array.of(9, 9, 9));

    expect(connection.frames).toEqual(
      new Map([
        [0, Uint8Array.of(3, 3, 3)],
        [1, Uint8Array.of(2, 2, 2, 2, 2, 2)],
      ]),
    );
  });

  it('ignora los mensajes de texto', () => {
    connection.start();
    lastSocket().open();

    lastSocket().onmessage?.call(
      lastSocket() as unknown as WebSocket,
      new MessageEvent('message', { data: 'hola' }),
    );

    expect(connection.frames.size).toBe(0);
  });

  it('sin un WebSocket propio, usa el del navegador', () => {
    const created: string[] = [];
    vi.stubGlobal(
      'WebSocket',
      class extends FakeSocket {
        constructor(url: string) {
          super();
          created.push(url);
        }
      },
    );
    const real = new EngineConnection('ws://motor/ws');

    real.start();
    real.stop();
    vi.unstubAllGlobals();

    expect(created).toEqual(['ws://motor/ws']);
  });

  it('mantiene una sola conexión aunque se arranque dos veces', () => {
    connection.start();
    connection.start();

    expect(sockets).toHaveLength(1);
  });

  it('al pararla, cierra la conexión, deja de avisar y no reintenta', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    listener.mockClear();

    connection.stop();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(connection.status).toBe('disconnected');
    listener.mockClear();
    lastSocket().drop();
    vi.advanceTimersByTime(5000);

    expect(lastSocket().closed).toBe(true);
    expect(sockets).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
  });

  it('si se para mientras aún se está abriendo, la cierra cuando se abre y sigue sin conexión', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();

    connection.stop();
    expect(lastSocket().closed).toBe(false);
    lastSocket().open();

    expect(lastSocket().closed).toBe(true);
    expect(connection.status).toBe('disconnected');
    expect(listener).not.toHaveBeenCalled();
  });

  it('se puede volver a arrancar después de pararla', () => {
    connection.start();
    connection.stop();

    connection.start();
    lastSocket().open();

    expect(sockets).toHaveLength(2);
    expect(connection.status).toBe('connected');
  });

  it('al darse de baja, un oyente deja de recibir avisos', () => {
    const listener = vi.fn();
    const unsubscribe = connection.subscribe(listener);
    unsubscribe();
    connection.start();

    lastSocket().open();

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('la dirección del WebSocket del visor', () => {
  it.each([
    [{ protocol: 'http:', host: '127.0.0.1:8080' }, 'ws://127.0.0.1:8080/ws'],
    [{ protocol: 'https:', host: 'moodtable.example' }, 'wss://moodtable.example/ws'],
  ])('desde %j es %s', (location, url) => {
    expect(viewerUrl(location)).toBe(url);
  });
});

describe('la fuente de audio y su nivel', () => {
  it('guarda la fuente que anuncia el motor al conectarse y avisa', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    listener.mockClear();

    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));

    expect(connection.source).toEqual({ kind: 'file', name: 'golpes.wav' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sabe también que no hay fuente de audio', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(encodeSource({ kind: 'none' }));

    expect(connection.source).toEqual({ kind: 'none' });
  });

  it('guarda el último nivel, sin avisar en cada pulso', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    listener.mockClear();

    lastSocket().receive(encodeLevel(1, 0.25));
    lastSocket().receive(encodeLevel(2, 0.5));

    expect(connection.level).toBe(0.5);
    expect(listener).not.toHaveBeenCalled();
  });

  it('al cerrarse la conexión, olvida la fuente y el nivel', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    lastSocket().receive(encodeLevel(1, 0.5));

    lastSocket().drop();

    expect(connection.source).toBeUndefined();
    expect(connection.level).toBeUndefined();
  });

  it('al pararla, también los olvida', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    lastSocket().receive(encodeLevel(1, 0.5));

    connection.stop();

    expect(connection.source).toBeUndefined();
    expect(connection.level).toBeUndefined();
  });

  it('ignora los mensajes de fuente y de nivel mal formados', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(Uint8Array.of(2, 7));
    lastSocket().receive(Uint8Array.of(3, 0, 0, 0, 1, 0x40, 0, 0, 0));

    expect(connection.source).toBeUndefined();
    expect(connection.level).toBeUndefined();
  });

  it('los frames siguen llegando igual entre los mensajes de fuente y de nivel', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    lastSocket().receive(encodeFrame(1, 0, Uint8Array.of(1, 2, 3)));
    lastSocket().receive(encodeLevel(1, 0.5));

    expect(connection.frames).toEqual(new Map([[0, Uint8Array.of(1, 2, 3)]]));
  });
});

describe('el estado de la tarjeta de sonido', () => {
  const SOUNDCARD = { kind: 'soundcard' as const, name: 'Mixer de la mesa' };

  it('guarda que la tarjeta se ha perdido y avisa al cambiar', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource(SOUNDCARD));
    lastSocket().receive(encodeSourceStatus('connected'));
    listener.mockClear();

    lastSocket().receive(encodeSourceStatus('lost'));
    expect(connection.sourceLost).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);

    lastSocket().receive(encodeSourceStatus('connected'));
    expect(connection.sourceLost).toBe(false);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('un estado igual al que ya tenía no avisa', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource(SOUNDCARD));
    lastSocket().receive(encodeSourceStatus('lost'));
    listener.mockClear();

    lastSocket().receive(encodeSourceStatus('lost'));

    expect(connection.sourceLost).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('un panel que se conecta con la tarjeta perdida lo sabe al momento', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(encodeSource(SOUNDCARD));
    lastSocket().receive(encodeSourceStatus('lost'));

    expect(connection.sourceLost).toBe(true);
  });

  it('sin mensaje de estado, la fuente no está perdida', () => {
    connection.start();
    expect(connection.sourceLost).toBe(false);

    lastSocket().open();
    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    lastSocket().receive(encodeLevel(1, 0));

    expect(connection.sourceLost).toBe(false);
  });

  it('al perder la conexión con el motor, lo olvida', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource(SOUNDCARD));
    lastSocket().receive(encodeSourceStatus('lost'));

    lastSocket().drop();

    expect(connection.sourceLost).toBe(false);
  });

  it('al pararla, también lo olvida', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeSource(SOUNDCARD));
    lastSocket().receive(encodeSourceStatus('lost'));

    connection.stop();

    expect(connection.sourceLost).toBe(false);
  });

  it('un estado que llega tarde por una conexión ya cerrada no cuenta', () => {
    connection.start();
    const closed = lastSocket();
    closed.open();
    closed.receive(encodeSource(SOUNDCARD));
    closed.drop();
    vi.advanceTimersByTime(1000);
    lastSocket().open();
    const listener = vi.fn();
    connection.subscribe(listener);

    closed.receive(encodeSourceStatus('lost'));

    expect(connection.sourceLost).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });

  it('ignora un mensaje de estado mal formado', () => {
    connection.start();
    lastSocket().open();

    lastSocket().receive(Uint8Array.of(5, 7));

    expect(connection.sourceLost).toBe(false);
  });
});

describe('la posición del fichero de audio', () => {
  /** El reloj de la conexión, en milisegundos: el test lo avanza a mano. */
  let now: number;
  let positions: Parameters<PositionListener>[];

  beforeEach(() => {
    now = 1000;
    positions = [];
    connection.stop();
    connection = new EngineConnection(
      'ws://motor/ws',
      () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket;
      },
      1000,
      () => now,
    );
    connection.subscribePositions((position, arrivedAt) => {
      positions.push([position, arrivedAt]);
    });
    connection.start();
    lastSocket().open();
  });

  it('avisa de cada posición con el instante en que llega, sin guardar solo la última', () => {
    lastSocket().receive(encodePosition(1, 1.5));
    now = 1016.5;
    lastSocket().receive(encodePosition(2, 1.5 + 1 / 60));

    expect(positions).toEqual([
      [{ seq: 1, position: 1.5 }, 1000],
      [{ seq: 2, position: 1.5 + 1 / 60 }, 1016.5],
    ]);
  });

  it('ignora un mensaje de posición mal formado', () => {
    // Una posición negativa (−1,5) y un mensaje corto.
    lastSocket().receive(Uint8Array.of(4, 0, 0, 1, 4, 0xbf, 0xf8, 0, 0, 0, 0, 0, 0));
    lastSocket().receive(Uint8Array.of(4, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0));

    expect(positions).toEqual([]);
  });

  it('al cerrarse la conexión, deja de avisar aunque llegue algo tarde', () => {
    const closed = lastSocket();
    closed.drop();

    closed.receive(encodePosition(1, 1.5));

    expect(positions).toEqual([]);
  });

  it('al reconectar, vuelve a avisar', () => {
    lastSocket().drop();
    vi.advanceTimersByTime(1000);
    lastSocket().open();

    lastSocket().receive(encodePosition(7, 0.25));

    expect(positions).toEqual([[{ seq: 7, position: 0.25 }, 1000]]);
  });

  it('al darse de baja, un oyente deja de recibir posiciones', () => {
    const other: number[] = [];
    const unsubscribe = connection.subscribePositions(({ position }) => other.push(position));
    lastSocket().receive(encodePosition(1, 1));

    unsubscribe();
    lastSocket().receive(encodePosition(2, 2));

    expect(other).toEqual([1]);
  });

  it('no avisa a los oyentes del estado, y frames, fuente y nivel siguen igual', () => {
    const listener = vi.fn();
    connection.subscribe(listener);

    lastSocket().receive(encodeSource({ kind: 'file', name: 'golpes.wav' }));
    listener.mockClear();
    lastSocket().receive(encodePosition(1, 1.5));
    lastSocket().receive(encodeFrame(1, 0, Uint8Array.of(1, 2, 3)));
    lastSocket().receive(encodeLevel(1, 0.5));

    expect(listener).not.toHaveBeenCalled();
    expect(connection.source).toEqual({ kind: 'file', name: 'golpes.wav' });
    expect(connection.frames).toEqual(new Map([[0, Uint8Array.of(1, 2, 3)]]));
    expect(connection.level).toBe(0.5);
  });
});

describe('las tiras del motor', () => {
  const STRIPS: StripsMessage = {
    strips: [
      { id: 'barra', name: 'Barra', ledCount: 60, output: { type: 'virtual' }, effect: 'energy' },
      { id: 'cabina', name: 'Cabina', ledCount: 30, output: { type: 'virtual' }, effect: 'breathing' },
    ],
  };

  it('guarda las tiras que llegan, con su efecto activo, y avisa', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();
    lastSocket().open();
    listener.mockClear();

    lastSocket().receive(encodeStrips(STRIPS));

    expect(connection.strips).toEqual(STRIPS.strips);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cada mensaje nuevo sustituye al anterior entero y avisa', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeStrips(STRIPS));
    const listener = vi.fn();
    connection.subscribe(listener);
    const [barra, cabina] = STRIPS.strips;
    if (!barra || !cabina) throw new Error('Faltan tiras');

    lastSocket().receive(encodeStrips({ strips: [{ ...barra, effect: 'breathing' }, cabina] }));

    expect(connection.strips?.map((strip) => strip.effect)).toEqual(['breathing', 'breathing']);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('sin mensaje de tiras, no las sabe', () => {
    connection.start();
    lastSocket().open();

    expect(connection.strips).toBeUndefined();
  });

  it('un mensaje de tiras que no cumple su esquema no cambia nada ni avisa', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeStrips(STRIPS));
    const listener = vi.fn();
    connection.subscribe(listener);
    const unknownEffect = new TextEncoder().encode(
      JSON.stringify({ strips: [{ ...STRIPS.strips[0], effect: 'strobe' }] }),
    );

    lastSocket().receive(Uint8Array.of(6, ...unknownEffect));
    lastSocket().receive(Uint8Array.of(6, 0x7b));

    expect(connection.strips).toEqual(STRIPS.strips);
    expect(listener).not.toHaveBeenCalled();
  });

  it('al perder la conexión con el motor, las olvida', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeStrips(STRIPS));

    lastSocket().drop();

    expect(connection.strips).toBeUndefined();
  });

  it('al pararla, también las olvida', () => {
    connection.start();
    lastSocket().open();
    lastSocket().receive(encodeStrips(STRIPS));

    connection.stop();

    expect(connection.strips).toBeUndefined();
  });

  it('unas tiras que llegan tarde por una conexión ya cerrada no cuentan', () => {
    connection.start();
    const closed = lastSocket();
    closed.open();
    closed.drop();
    vi.advanceTimersByTime(1000);
    lastSocket().open();

    closed.receive(encodeStrips(STRIPS));

    expect(connection.strips).toBeUndefined();
  });
});
