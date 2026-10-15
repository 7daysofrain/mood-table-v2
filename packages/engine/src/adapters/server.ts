/**
 * Servidor del motor: sirve el build del panel (decisión 12) y abre el WebSocket del visor, una
 * conexión por navegador (decisión 10), en la dirección y el puerto de la configuración (decisión
 * 13). Cada tira tiene su salida del visor, que codifica cada frame con el protocolo de
 * `@moodtable/shared` y lo envía a todos los navegadores conectados.
 *
 * Sin contramedida para un navegador que no recibe (riesgo aceptado en el design): sus mensajes se
 * acumulan en su conexión hasta que se da por muerta.
 */
import type { AddressInfo } from 'node:net';

import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { encodeFrame } from '@moodtable/shared';
import Fastify from 'fastify';

import type { LightOutput } from '../core/frame-loop.ts';

export interface ServerOptions {
  host: string;
  port: number;
  /** Carpeta del build del panel (`packages/panel/dist`). */
  panelDir: string;
}

export interface EngineServer {
  /** Dirección del panel, por ejemplo `http://127.0.0.1:8080`. */
  url: string;
  /** La salida del visor de la tira que ocupa `stripIndex` en el fichero de configuración. */
  viewerOutput(stripIndex: number): LightOutput;
  close(): Promise<void>;
}

/** Ruta del WebSocket del visor (`docs/instructions/viewer-protocol.md`). */
export const VIEWER_PATH = '/ws';

export async function startServer({ host, port, panelDir }: ServerOptions): Promise<EngineServer> {
  const app = Fastify();
  await app.register(fastifyWebsocket);
  await app.register(fastifyStatic, { root: panelDir });
  // El navegador solo recibe: los frames los envía la salida del visor de cada tira.
  app.get(VIEWER_PATH, { websocket: true }, () => undefined);
  await app.listen({ host, port });

  const browsers = app.websocketServer.clients;
  const address = app.server.address() as AddressInfo;
  const hostname = address.family === 'IPv6' ? `[${address.address}]` : address.address;

  return {
    url: `http://${hostname}:${address.port}`,
    viewerOutput: (stripIndex) => ({
      write(frame, tick) {
        if (browsers.size === 0) return;
        // Un mensaje nuevo por frame: la conexión puede guardarlo hasta enviarlo, y el frame es
        // del bucle y cambia en el pulso siguiente.
        const message = encodeFrame(tick.seq, stripIndex, frame);
        for (const browser of browsers) {
          if (browser.readyState === browser.OPEN) browser.send(message);
        }
      },
    }),
    close: () => app.close(),
  };
}
