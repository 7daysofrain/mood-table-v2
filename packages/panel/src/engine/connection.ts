/**
 * Conexión del panel con el motor (specs/viewer): una única conexión WebSocket con el motor, que se
 * reintenta cada segundo mientras no hay conexión (decisión 15) y guarda el último frame de cada
 * tira, decodificado con el protocolo de `@moodtable/shared`. No sabe nada de React: el visor lee los
 * frames cuando dibuja, y la cabecera se suscribe a los cambios de estado.
 */
import { decodeFrame } from '@moodtable/shared';

export type ConnectionStatus = 'connected' | 'disconnected';

/** Lo que el panel usa de un WebSocket del navegador: así los tests pueden darle uno falso. */
export type SocketLike = Pick<WebSocket, 'binaryType' | 'onopen' | 'onclose' | 'onmessage' | 'close'>;

/** La dirección del WebSocket del visor, en el mismo sitio que sirve el panel. */
export function viewerUrl(location: { protocol: string; host: string }): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

export class EngineConnection {
  private readonly url: string;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly retryMs: number;
  private readonly listeners = new Set<() => void>();
  private readonly lastFrames = new Map<number, Uint8Array>();
  private socket: SocketLike | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private current: ConnectionStatus = 'disconnected';

  constructor(
    url: string,
    createSocket: (url: string) => SocketLike = (address) => new WebSocket(address),
    retryMs = 1000,
  ) {
    this.url = url;
    this.createSocket = createSocket;
    this.retryMs = retryMs;
  }

  get status(): ConnectionStatus {
    return this.current;
  }

  /** El último frame recibido de cada tira, por su índice. Sin conexión, vacío. */
  get frames(): ReadonlyMap<number, Uint8Array> {
    return this.lastFrames;
  }

  /** Avisa de cada cambio de estado. Devuelve la función para darse de baja. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  start(): void {
    if (!this.socket && this.retry === undefined) this.connect();
  }

  stop(): void {
    clearTimeout(this.retry);
    this.retry = undefined;
    const socket = this.socket;
    this.socket = undefined;
    if (socket) {
      socket.onopen = socket.onclose = socket.onmessage = null;
      socket.close();
    }
    this.lastFrames.clear();
    this.current = 'disconnected';
  }

  private connect(): void {
    this.retry = undefined;
    const socket = this.createSocket(this.url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      this.setStatus('connected');
    };
    socket.onmessage = ({ data }) => {
      if (!(data instanceof ArrayBuffer)) return;
      const frame = decodeFrame(new Uint8Array(data));
      // Cada mensaje es un búfer nuevo: los colores se guardan sin copiarlos.
      if (frame) this.lastFrames.set(frame.stripIndex, frame.colors);
    };
    // Un fallo al conectar también acaba en `close`: es el único sitio donde se reintenta.
    socket.onclose = () => {
      this.socket = undefined;
      this.lastFrames.clear();
      this.setStatus('disconnected');
      this.retry = setTimeout(() => {
        this.connect();
      }, this.retryMs);
    };
    this.socket = socket;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.current) return;
    this.current = status;
    for (const listener of this.listeners) listener();
  }
}
