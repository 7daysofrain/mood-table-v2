/**
 * Conexión del panel con el motor (specs/viewer). Sin implementar todavía: sus tests están en rojo.
 */

export type ConnectionStatus = 'connected' | 'disconnected';

/** Lo que el panel usa de un WebSocket del navegador: así los tests pueden darle uno falso. */
export type SocketLike = Pick<WebSocket, 'binaryType' | 'onopen' | 'onclose' | 'onmessage' | 'close'>;

export function viewerUrl(location: { protocol: string; host: string }): string {
  throw new Error(`Sin implementar (${location.host})`);
}

export class EngineConnection {
  readonly status: ConnectionStatus = 'disconnected';
  readonly frames: ReadonlyMap<number, Uint8Array> = new Map();

  constructor(url: string, createSocket?: (url: string) => SocketLike, retryMs?: number) {
    void [url, createSocket, retryMs];
  }

  subscribe(listener: () => void): () => void {
    throw new Error(`Sin implementar (${typeof listener})`);
  }

  start(): void {
    throw new Error('Sin implementar');
  }

  stop(): void {
    throw new Error('Sin implementar');
  }
}
