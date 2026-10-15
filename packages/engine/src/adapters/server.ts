/**
 * Servidor del motor (decisiones 10, 12 y 13). Sin implementar todavía: sus tests están en rojo.
 */
import type { LightOutput } from '../core/frame-loop.ts';

export interface ServerOptions {
  host: string;
  port: number;
  panelDir: string;
}

export interface EngineServer {
  url: string;
  viewerOutput(stripIndex: number): LightOutput;
  close(): Promise<void>;
}

export function startServer(options: ServerOptions): Promise<EngineServer> {
  return Promise.reject(new Error(`Sin implementar (${options.host}:${options.port})`));
}
