/**
 * Servidor del motor: sirve el build del panel (decisión 12) y abre el WebSocket del visor, una
 * conexión por navegador (decisión 10), en la dirección y el puerto de la configuración (decisión
 * 13). Cada tira tiene su salida del visor, que codifica cada frame con el protocolo de
 * `@moodtable/shared` y lo envía a todos los navegadores conectados.
 *
 * Sin contramedida para un navegador que no recibe (riesgo aceptado en el design): sus mensajes se
 * acumulan en su conexión hasta que se da por muerta.
 */
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import { encodeFrame, type SourceMessage } from '@moodtable/shared';
import Fastify from 'fastify';

import type { LevelOutput, LightOutput } from '../core/frame-loop.ts';

export interface ServerOptions {
  host: string;
  port: number;
  /** Carpeta del build del panel (`packages/panel/dist`). */
  panelDir: string;
  /** La fuente de audio que se anuncia a cada panel al conectarse. Por defecto, ninguna. */
  source?: SourceMessage;
}

export interface EngineServer {
  /** Dirección del panel, por ejemplo `http://127.0.0.1:8080`. */
  url: string;
  /** La salida del visor de la tira que ocupa `stripIndex` en el fichero de configuración. */
  viewerOutput(stripIndex: number): LightOutput;
  /** La salida del nivel de la fuente de audio: lo envía a todos los navegadores conectados. */
  levelOutput: LevelOutput;
  close(): Promise<void>;
}

/** Ruta del WebSocket del visor (`docs/instructions/viewer-protocol.md`). */
export const VIEWER_PATH = '/ws';

const PANEL_NOT_BUILT =
  'El panel no está construido. Constrúyelo con `pnpm --filter @moodtable/panel build` y recarga, ' +
  'o abre el panel de desarrollo que arranca `pnpm dev` en http://localhost:5173.';

/**
 * La dirección con la que se abre el panel. Si el motor escucha en toda la red (`0.0.0.0` o `::`),
 * esa dirección no se puede abrir: se da la IP de esta máquina en la red local, como en la mesa.
 */
function panelHost({ address, family }: AddressInfo): string {
  if (address === '0.0.0.0' || address === '::') {
    const lan = Object.values(networkInterfaces())
      .flat()
      .find((network) => network?.family === 'IPv4' && !network.internal);
    return lan?.address ?? '127.0.0.1';
  }
  return family === 'IPv6' ? `[${address}]` : address;
}

export async function startServer({ host, port, panelDir }: ServerOptions): Promise<EngineServer> {
  const app = Fastify();
  await app.register(fastifyWebsocket);
  if (existsSync(join(panelDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: panelDir });
  } else {
    app.get('/', (_request, reply) => reply.code(503).type('text/plain').send(PANEL_NOT_BUILT));
  }
  // El navegador solo recibe: los frames los envía la salida del visor de cada tira.
  app.get(VIEWER_PATH, { websocket: true }, () => undefined);
  await app.listen({ host, port });

  const browsers = app.websocketServer.clients;
  const address = app.server.address() as AddressInfo;

  return {
    url: `http://${panelHost(address)}:${address.port}`,
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
    levelOutput: { write: () => undefined },
    close: () => app.close(),
  };
}
