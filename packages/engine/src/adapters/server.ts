/**
 * Servidor del motor: sirve el build del panel (decisión 12) y abre el WebSocket del visor, una
 * conexión por navegador (decisión 10), en la dirección y el puerto de la configuración (decisión
 * 13). Cada tira tiene su salida del visor, que codifica cada frame con el protocolo de
 * `@moodtable/shared` y lo envía a todos los navegadores conectados. Por la misma conexión, cada
 * navegador recibe la fuente de audio al conectarse y su nivel y la posición del fichero en cada
 * pulso. Con un fichero como fuente, lo sirve en `/audio` para que el panel lo oiga (decisión 6 del
 * change panel-audio-playback).
 *
 * Sin contramedida para un navegador que no recibe (riesgo aceptado en el design): sus mensajes se
 * acumulan en su conexión hasta que se da por muerta.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import fastifyWebsocket from '@fastify/websocket';
import {
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  type SourceMessage,
} from '@moodtable/shared';
import Fastify from 'fastify';

import type { LevelOutput, LightOutput, PositionOutput } from '../core/frame-loop.ts';

export interface ServerOptions {
  host: string;
  port: number;
  /** Carpeta del build del panel (`packages/panel/dist`). */
  panelDir: string;
  /** La fuente de audio que se anuncia a cada panel al conectarse. Por defecto, ninguna. */
  source?: SourceMessage;
  /** Ruta ya resuelta del fichero de audio que se sirve en `/audio`. Sin ella, `/audio` no existe. */
  audioFile?: string;
}

export interface EngineServer {
  /** Dirección del panel, por ejemplo `http://127.0.0.1:8080`. */
  url: string;
  /** La salida del visor de la tira que ocupa `stripIndex` en el fichero de configuración. */
  viewerOutput(stripIndex: number): LightOutput;
  /** La salida del nivel de la fuente de audio: lo envía a todos los navegadores conectados. */
  levelOutput: LevelOutput;
  /** La salida de la posición del fichero de audio: la envía a todos los navegadores conectados. */
  positionOutput: PositionOutput;
  close(): Promise<void>;
}

/** Ruta del WebSocket del visor (`docs/instructions/viewer-protocol.md`). */
export const VIEWER_PATH = '/ws';

/** Ruta del fichero de audio. Fija y sin el nombre: la ruta en disco no sale del motor (D51). */
export const AUDIO_PATH = '/audio';

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

export async function startServer({
  host,
  port,
  panelDir,
  source = { kind: 'none' },
  audioFile,
}: ServerOptions): Promise<EngineServer> {
  const app = Fastify();
  await app.register(fastifyWebsocket);
  if (existsSync(join(panelDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: panelDir });
  } else {
    app.get('/', (_request, reply) => reply.code(503).type('text/plain').send(PANEL_NOT_BUILT));
  }
  // El navegador solo recibe. Al conectarse, la fuente de audio, que no cambia mientras el motor
  // corre (decisión 5 del change virtual-strip-audio-file); los frames y el nivel, en cada pulso.
  const sourceMessage = encodeSource(source);
  app.get(VIEWER_PATH, { websocket: true }, (socket) => {
    socket.send(sourceMessage);
  });
  // El fichero entero, tal cual: el panel lo pide una vez por conexión. Ni las respuestas ni los
  // errores llevan la ruta en disco.
  app.get(AUDIO_PATH, async (_request, reply) => {
    if (!audioFile) return reply.code(404).type('text/plain').send('Sin fichero de audio');
    let bytes: Buffer;
    try {
      bytes = await readFile(audioFile);
    } catch {
      return reply.code(500).type('text/plain').send('No se puede leer el fichero de audio');
    }
    return reply.type('audio/wav').send(bytes);
  });
  await app.listen({ host, port });

  const browsers = app.websocketServer.clients;
  const address = app.server.address() as AddressInfo;

  /** Envía `message` a todos los navegadores conectados. */
  function broadcast(message: Uint8Array): void {
    for (const browser of browsers) {
      if (browser.readyState === browser.OPEN) browser.send(message);
    }
  }

  return {
    url: `http://${panelHost(address)}:${address.port}`,
    viewerOutput: (stripIndex) => ({
      write(frame, tick) {
        if (browsers.size === 0) return;
        // Un mensaje nuevo por frame: la conexión puede guardarlo hasta enviarlo, y el frame es
        // del bucle y cambia en el pulso siguiente.
        broadcast(encodeFrame(tick.seq, stripIndex, frame));
      },
    }),
    levelOutput: {
      write(level, tick) {
        if (browsers.size === 0) return;
        broadcast(encodeLevel(tick.seq, level));
      },
    },
    positionOutput: {
      write(position, tick) {
        if (browsers.size === 0) return;
        broadcast(encodePosition(tick.seq, position));
      },
    },
    close: () => app.close(),
  };
}
