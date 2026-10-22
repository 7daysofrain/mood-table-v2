/**
 * Conexión del panel con el motor (specs/viewer): una única conexión WebSocket con el motor, que se
 * reintenta cada segundo mientras no hay conexión (decisión 15) y guarda el último frame de cada
 * tira, decodificado con el protocolo de `@moodtable/shared`, además de la fuente de audio y su último
 * nivel (decisión 5 del change virtual-strip-audio-file) y si la tarjeta de sonido está perdida
 * (decisión 5 del change soundcard-reconnect). No sabe nada de React: el visor lee los frames y el
 * vúmetro el nivel cuando dibujan, y la cabecera se suscribe a los cambios de estado, de fuente y de
 * la tarjeta. La posición del fichero de audio no se guarda: se avisa de cada una con su instante de
 * llegada, porque la sincronía del reproductor necesita la serie (decisión 8 del change
 * panel-audio-playback).
 */
import {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  decodeSourceStatus,
  type PositionMessage,
  type SourceMessage,
} from '@moodtable/shared';

export type ConnectionStatus = 'connected' | 'disconnected';

/** Lo que el panel usa de un WebSocket del navegador: así los tests pueden darle uno falso. */
export type SocketLike = Pick<
  WebSocket,
  'binaryType' | 'readyState' | 'onopen' | 'onclose' | 'onmessage' | 'close'
>;

/**
 * Quien escucha la posición del fichero de audio: cada mensaje, con el instante en que llegó
 * (milisegundos del reloj de la conexión, `performance.now()` por defecto).
 */
export type PositionListener = (message: PositionMessage, arrivedAt: number) => void;

/** `WebSocket.CONNECTING`, sin depender de que exista `WebSocket` (en los tests no hay). */
const CONNECTING = 0;

/** La dirección del WebSocket del visor, en el mismo sitio que sirve el panel. */
export function viewerUrl(location: { protocol: string; host: string }): string {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws`;
}

export class EngineConnection {
  private readonly url: string;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly retryMs: number;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private readonly positionListeners = new Set<PositionListener>();
  private readonly lastFrames = new Map<number, Uint8Array>();
  private socket: SocketLike | undefined;
  private retry: ReturnType<typeof setTimeout> | undefined;
  private current: ConnectionStatus = 'disconnected';
  private currentSource: SourceMessage | undefined;
  private lastLevel: number | undefined;
  private lost = false;

  constructor(
    url: string,
    createSocket: (url: string) => SocketLike = (address) => new WebSocket(address),
    retryMs = 1000,
    now: () => number = () => performance.now(),
  ) {
    this.url = url;
    this.createSocket = createSocket;
    this.retryMs = retryMs;
    this.now = now;
  }

  get status(): ConnectionStatus {
    return this.current;
  }

  /** El último frame recibido de cada tira, por su índice. Sin conexión, vacío. */
  get frames(): ReadonlyMap<number, Uint8Array> {
    return this.lastFrames;
  }

  /** La fuente de audio que anunció el motor al conectarse. Sin conexión, `undefined`. */
  get source(): SourceMessage | undefined {
    return this.currentSource;
  }

  /** El último nivel de la fuente de audio, de 0 a 1. Sin conexión o sin fuente, `undefined`. */
  get level(): number | undefined {
    return this.lastLevel;
  }

  /**
   * Si la tarjeta de sonido está perdida, según el último mensaje de estado del motor. Sin ese
   * mensaje (otra fuente, o sin conexión), no lo está: el panel nunca lo deduce del nivel.
   */
  get sourceLost(): boolean {
    return this.lost;
  }

  /** Avisa de cada cambio de estado. Devuelve la función para darse de baja. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Avisa de cada posición del fichero de audio que llega. Devuelve la función para darse de baja. */
  subscribePositions(listener: PositionListener): () => void {
    this.positionListeners.add(listener);
    return () => this.positionListeners.delete(listener);
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
      socket.onclose = socket.onmessage = null;
      // Cerrar una conexión que aún se está abriendo hace que el navegador escriba un error en la
      // consola (pasa en cada carga en desarrollo, con el doble efecto de StrictMode): se cierra al
      // abrirse.
      if (socket.readyState === CONNECTING) {
        socket.onopen = () => {
          socket.close();
        };
      } else {
        socket.onopen = null;
        socket.close();
      }
    }
    this.forget();
    this.setStatus('disconnected');
  }

  private connect(): void {
    this.retry = undefined;
    const socket = this.createSocket(this.url);
    socket.binaryType = 'arraybuffer';
    socket.onopen = () => {
      this.setStatus('connected');
    };
    socket.onmessage = ({ data }) => {
      // Lo que llegue por una conexión ya cerrada no cuenta: el motor de ahora puede ser otro.
      if (this.socket !== socket || !(data instanceof ArrayBuffer)) return;
      const message = new Uint8Array(data);
      const frame = decodeFrame(message);
      // Cada mensaje es un búfer nuevo: los colores se guardan sin copiarlos.
      if (frame) {
        this.lastFrames.set(frame.stripIndex, frame.colors);
        return;
      }
      const level = decodeLevel(message);
      if (level) {
        this.lastLevel = level.level;
        return;
      }
      const position = decodePosition(message);
      if (position) {
        const arrivedAt = this.now();
        for (const listener of this.positionListeners) listener(position, arrivedAt);
        return;
      }
      const source = decodeSource(message);
      if (source) {
        this.currentSource = source;
        this.notify();
        return;
      }
      const sourceStatus = decodeSourceStatus(message);
      if (sourceStatus) {
        this.lost = sourceStatus === 'lost';
        this.notify();
      }
    };
    // Un fallo al conectar también acaba en `close`: es el único sitio donde se reintenta.
    socket.onclose = () => {
      this.socket = undefined;
      this.forget();
      this.setStatus('disconnected');
      this.retry = setTimeout(() => {
        this.connect();
      }, this.retryMs);
    };
    this.socket = socket;
  }

  /**
   * Sin conexión no se sabe qué hay en el motor: ni frames, ni fuente, ni nivel, ni si la tarjeta
   * está perdida. No avisa: la fuente y su estado solo llegan con la conexión abierta, así que
   * siempre se olvidan a la vez que se pierde, y ese cambio de estado ya avisa.
   */
  private forget(): void {
    this.lastFrames.clear();
    this.currentSource = undefined;
    this.lastLevel = undefined;
    this.lost = false;
  }

  private setStatus(status: ConnectionStatus): void {
    if (status === this.current) return;
    this.current = status;
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) listener();
  }
}
