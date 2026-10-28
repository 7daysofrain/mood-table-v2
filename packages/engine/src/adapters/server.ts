/**
 * Servidor del motor: sirve el build del panel (decisión 12) y abre el WebSocket del visor, una
 * conexión por navegador (decisión 10), en la dirección y el puerto de la configuración (decisión
 * 13). Cada tira tiene su salida del visor, que codifica cada frame con el protocolo de
 * `@moodtable/shared` y lo envía a todos los navegadores conectados. Por la misma conexión, cada
 * navegador recibe la fuente de audio al conectarse y su nivel y la posición del fichero en cada
 * pulso. Con la tarjeta de sonido, también su estado: al conectarse y cada vez que cambia
 * (decisión 3 del change soundcard-reconnect). Y las tiras con su efecto activo, también al
 * conectarse y cada vez que cambia el de una (decisión 3 del change strip-effect-switch). Con un fichero como fuente, lo sirve en `/audio`
 * para que el panel lo oiga (decisión 6 del change panel-audio-playback).
 *
 * Es también el adaptador *API HTTP* (decisiones 2 y 6 del change strip-effect-switch): por HTTP
 * llegan los mandos, validados con los esquemas de `@moodtable/shared`, y el OpenAPI se genera de
 * esos mismos esquemas. `buildServer` monta todo sin escuchar, para los tests y `pnpm openapi`.
 *
 * Sin contramedida para un navegador que no recibe (riesgo aceptado en el design): sus mensajes se
 * acumulan en su conexión hasta que se da por muerta.
 */
import { existsSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';

import fastifyStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import {
  type TypeBoxTypeProvider,
  TypeBoxValidatorCompiler,
} from '@fastify/type-provider-typebox';
import fastifyWebsocket from '@fastify/websocket';
import {
  ApiErrorSchema,
  EFFECT_CATALOG,
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  encodeSourceStatus,
  encodeStrips,
  SetEffectBodySchema,
  SetEffectResponseSchema,
  type SourceMessage,
  type SourceStatus,
  type StripsMessage,
} from '@moodtable/shared';
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import Type from 'typebox';

import type { Commands } from '../core/control.ts';
import type { LevelOutput, LightOutput, PositionOutput } from '../core/frame-loop.ts';

/** Las tiras del instrumento: la API cambia su efecto, y cada panel recibe la foto. */
export interface PanelStrips extends Commands {
  /** Las tiras, en el orden del fichero, con el efecto que pinta cada una. */
  snapshot(): StripsMessage;
  /** Avisa cada vez que cambia el efecto de una tira. Devuelve cómo dejar de escuchar. */
  watch(listener: () => void): () => void;
}

/** Lo que necesita la app del motor, sin la dirección en la que escucha. */
export interface AppOptions {
  /** Carpeta del build del panel (`packages/panel/dist`). */
  panelDir: string;
  /** La fuente de audio que se anuncia a cada panel al conectarse. Por defecto, ninguna. */
  source?: SourceMessage;
  /**
   * Los bytes del fichero de audio que leyó el motor al arrancar, que se sirven en `/audio`. Sin
   * ellos, `/audio` no existe.
   */
  audioBytes?: Uint8Array;
  /**
   * Cómo enterarse del estado de la tarjeta de sonido: da el actual al momento y después cada
   * cambio, y devuelve cómo dejar de escucharlo, que se llama al cerrar. Sin él, como con un
   * fichero o sin fuente, no se envía ningún mensaje de estado.
   */
  watchSourceStatus?: (listener: (status: SourceStatus) => void) => () => void;
  /** Las tiras, con sus mandos. Sin ellas, la API no conoce ninguna tira. */
  strips?: PanelStrips;
}

export interface ServerOptions extends AppOptions {
  host: string;
  port: number;
}

/** El motor sin escuchar: la app de Fastify, con sus rutas, y las salidas del visor. */
export interface EngineApp {
  app: FastifyInstance;
  /** La salida del visor de la tira que ocupa `stripIndex` en el fichero de configuración. */
  viewerOutput(stripIndex: number): LightOutput;
  /** La salida del nivel de la fuente de audio: lo envía a todos los navegadores conectados. */
  levelOutput: LevelOutput;
  /** La salida de la posición del fichero de audio: la envía a todos los navegadores conectados. */
  positionOutput: PositionOutput;
  close(): Promise<void>;
}

export interface EngineServer extends Omit<EngineApp, 'app'> {
  /** Dirección del panel, por ejemplo `http://127.0.0.1:8080`. */
  url: string;
}

/** Ruta del WebSocket del visor (`docs/instructions/viewer-protocol.md`). */
export const VIEWER_PATH = '/ws';

/** Ruta del fichero de audio. Fija y sin el nombre: la ruta en disco no sale del motor (D51). */
export const AUDIO_PATH = '/audio';

/** Ruta del OpenAPI de la API, generado de los esquemas de sus rutas. */
export const OPENAPI_PATH = '/api/openapi.json';

/** Lo que se dice de un efecto reactivo sin fuente de audio, como en el fichero (decisión 5). */
const NEEDS_AUDIO_SOURCE = 'necesita una fuente de audio';

/** Lo que se dice de un cuerpo que no es `{ "effect": "<id>" }`. */
const BAD_BODY = 'el cuerpo debe ser un objeto JSON con el campo `effect` y ninguno más';

/**
 * El mensaje de un `400`: si el cuerpo tiene la forma buena, lo que falla es el efecto, y se dicen
 * los que hay, como en el fichero de configuración.
 */
function describeBadRequest(body: unknown): string {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return BAD_BODY;
  const fields = Object.entries(body);
  const [field] = fields;
  if (fields.length !== 1 || field?.[0] !== 'effect' || typeof field[1] !== 'string') {
    return BAD_BODY;
  }
  const allowed = EFFECT_CATALOG.map((effect) => `\`${effect.id}\``).join(', ');
  return `«${field[1]}» no es un efecto (hay: ${allowed})`;
}

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

/**
 * La API: hoy, cambiar el efecto de una tira (decisión 6). Va en su propio plugin, así que su
 * validador y su forma de responder los errores no tocan las demás rutas. Valida con TypeBox, como
 * `Value.Check`: el AJV de Fastify quitaría en silencio los campos de más (`removeAdditional`), y
 * el esquema los rechaza.
 */
function apiPlugin(strips: PanelStrips | undefined) {
  return (plugin: FastifyInstance, _options: unknown, done: () => void): void => {
    const api = plugin
      .setValidatorCompiler(TypeBoxValidatorCompiler)
      .withTypeProvider<TypeBoxTypeProvider>();
    // Los 400 (un JSON roto o que no cumple el esquema) responden `{ message }`, como los demás.
    api.setErrorHandler((error: FastifyError, request, reply) => {
      if (error.statusCode !== 400) throw error;
      void reply.code(400).send({ message: describeBadRequest(request.body) });
    });
    api.put(
      '/api/strips/:stripId/effect',
      {
        schema: {
          summary: 'Cambia el efecto de una tira',
          description:
            'La tira pasa a pintarse con el efecto desde el pulso siguiente, con un corte ' +
            'seco, y todos los paneles reciben las tiras por el WebSocket del visor. Elegir el ' +
            'efecto que ya tiene no lo reinicia.',
          tags: ['tiras'],
          params: Type.Object({ stripId: Type.String({ description: 'El `id` de la tira' }) }),
          body: SetEffectBodySchema,
          response: {
            200: { description: 'La tira, con su efecto activo y sus valores', ...SetEffectResponseSchema },
            400: { description: 'El cuerpo no es válido o el efecto no existe', ...ApiErrorSchema },
            404: { description: 'La tira no existe', ...ApiErrorSchema },
            409: { description: 'El efecto necesita fuente de audio y no hay', ...ApiErrorSchema },
          },
        },
      },
      (request, reply) => {
        const { stripId } = request.params;
        const { effect } = request.body;
        const result = strips?.setEffect(stripId, effect) ?? 'unknown-strip';
        if (result === 'unknown-strip') {
          void reply.code(404).send({ message: `la tira «${stripId}» no existe` });
          return;
        }
        if (result === 'needs-audio-source') {
          const message = `la tira «${stripId}», efecto \`${effect}\`: ${NEEDS_AUDIO_SOURCE}`;
          void reply.code(409).send({ message });
          return;
        }
        const strip = strips?.snapshot().strips.find((each) => each.id === stripId);
        if (!strip) throw new Error(`La tira «${stripId}» no está en la foto de las tiras`);
        void reply.send(strip);
      },
    );
    done();
  };
}

export async function buildServer({
  panelDir,
  source = { kind: 'none' },
  audioBytes,
  watchSourceStatus,
  strips,
}: AppOptions): Promise<EngineApp> {
  const app = Fastify();
  // El OpenAPI solo describe las rutas con etiqueta: la API, no el panel, el visor ni el audio.
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.1.0',
      info: {
        title: 'Mood Table · API del motor',
        description:
          'Los mandos del instrumento. El estado (las tiras, su efecto activo, los frames) llega ' +
          'por el WebSocket del visor: docs/instructions/viewer-protocol.md.',
        version: '1.0.0',
      },
    },
    hideUntagged: true,
  });
  await app.register(fastifyWebsocket);
  if (existsSync(join(panelDir, 'index.html'))) {
    await app.register(fastifyStatic, { root: panelDir });
  } else {
    app.get('/', (_request, reply) => reply.code(503).type('text/plain').send(PANEL_NOT_BUILT));
  }
  // El navegador solo recibe. Al conectarse, la fuente de audio, que no cambia mientras el motor
  // corre (decisión 5 del change virtual-strip-audio-file), el último estado de la tarjeta, si lo
  // hay, y las tiras con el efecto que pinta cada una; los frames y el nivel, en cada pulso.
  const sourceMessage = encodeSource(source);
  let statusMessage: Uint8Array | undefined;
  let stripsMessage = strips && encodeStrips(strips.snapshot());
  app.get(VIEWER_PATH, { websocket: true }, (socket) => {
    socket.send(sourceMessage);
    if (statusMessage) socket.send(statusMessage);
    if (stripsMessage) socket.send(stripsMessage);
  });
  // El fichero entero, tal cual: el panel lo pide una vez por conexión. Son los bytes que el motor
  // leyó al arrancar, no el disco de ahora, así que se oye lo mismo que se analiza aunque el
  // fichero cambie (decisión 6). La respuesta no lleva la ruta en disco.
  app.get(AUDIO_PATH, (_request, reply) => {
    if (!audioBytes) return reply.code(404).type('text/plain').send('Sin fichero de audio');
    const body = Buffer.from(audioBytes.buffer, audioBytes.byteOffset, audioBytes.byteLength);
    return reply.type('audio/wav').send(body);
  });
  await app.register(apiPlugin(strips));
  app.get(OPENAPI_PATH, () => app.swagger());

  const browsers = app.websocketServer.clients;

  /** Envía `message` a todos los navegadores conectados. */
  function broadcast(message: Uint8Array): void {
    for (const browser of browsers) {
      if (browser.readyState === browser.OPEN) browser.send(message);
    }
  }

  const unwatchSourceStatus = watchSourceStatus?.((status) => {
    statusMessage = encodeSourceStatus(status);
    broadcast(statusMessage);
  });
  // Siempre la foto completa, venga el cambio del mando que venga (decisión 2).
  const unwatchStrips = strips?.watch(() => {
    stripsMessage = encodeStrips(strips.snapshot());
    broadcast(stripsMessage);
  });

  return {
    app,
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
    close() {
      unwatchSourceStatus?.();
      unwatchStrips?.();
      return app.close();
    },
  };
}

export async function startServer({
  host,
  port,
  ...options
}: ServerOptions): Promise<EngineServer> {
  const { app, ...engine } = await buildServer(options);
  try {
    await app.listen({ host, port });
  } catch (error) {
    await engine.close();
    throw error;
  }
  const address = app.server.address() as AddressInfo;
  return { url: `http://${panelHost(address)}:${address.port}`, ...engine };
}
