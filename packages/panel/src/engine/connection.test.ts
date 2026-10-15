import { encodeFrame } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { EngineConnection, type SocketLike, viewerUrl } from './connection.ts';

/** Un WebSocket falso: el test decide cuándo se abre, se cierra o llega un mensaje. */
class FakeSocket implements SocketLike {
  binaryType: BinaryType = 'blob';
  onopen: SocketLike['onopen'] = null;
  onclose: SocketLike['onclose'] = null;
  onmessage: SocketLike['onmessage'] = null;
  closed = false;

  close(): void {
    this.closed = true;
  }

  open(): void {
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

  it('mantiene una sola conexión aunque se arranque dos veces', () => {
    connection.start();
    connection.start();

    expect(sockets).toHaveLength(1);
  });

  it('al pararla, cierra la conexión, deja de avisar y no reintenta', () => {
    const listener = vi.fn();
    connection.subscribe(listener);
    connection.start();

    connection.stop();
    lastSocket().drop();
    vi.advanceTimersByTime(5000);

    expect(lastSocket().closed).toBe(true);
    expect(sockets).toHaveLength(1);
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
