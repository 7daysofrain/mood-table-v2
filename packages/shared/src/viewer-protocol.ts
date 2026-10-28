/**
 * Protocolo del visor (decisión 10 del change virtual-strip-breathing): el formato de los mensajes
 * que el motor envía a cada navegador por su WebSocket. El motor codifica y el panel decodifica con
 * este mismo código. El formato, byte a byte, está en `docs/instructions/viewer-protocol.md`, que es
 * la fuente de verdad: si cambia uno, cambia el otro.
 */
import Type, { type Static, type TObject } from 'typebox';
import Value from 'typebox/value';

import { EFFECT_CATALOG, type EffectId, type EffectValues } from './effects.ts';

/** Tipo del mensaje de un frame: el primer byte. Por la misma conexión viajan otros tipos. */
export const FRAME_MESSAGE_TYPE = 1;

/** Tipo (1 byte) + `seq` (4 bytes, big-endian) + índice de la tira (1 byte). */
export const FRAME_HEADER_BYTES = 6;

/** El índice de la tira ocupa un byte: el fichero de configuración no admite más tiras. */
export const MAX_STRIPS = 256;

export interface FrameMessage {
  /** Número del pulso (módulo 2³²): el mismo en las tiras de un pulso y en todos los navegadores. */
  seq: number;
  /** Posición de la tira en el fichero de configuración (0, 1…). */
  stripIndex: number;
  /** RGB, 3 bytes por LED. El número de LEDs es `colors.length / 3`. */
  colors: Uint8Array;
}

/** El mensaje binario de un frame. Es nuevo en cada llamada: se puede enviar sin copiarlo. */
export function encodeFrame(seq: number, stripIndex: number, colors: Uint8Array): Uint8Array {
  if (!Number.isInteger(stripIndex) || stripIndex < 0 || stripIndex >= MAX_STRIPS) {
    throw new RangeError(`El índice de la tira no cabe en un byte: ${stripIndex}`);
  }
  const message = new Uint8Array(FRAME_HEADER_BYTES + colors.length);
  const view = new DataView(message.buffer);
  view.setUint8(0, FRAME_MESSAGE_TYPE);
  // setUint32 reduce el número módulo 2³²: tras 2³² − 1, el seq vuelve a 0.
  view.setUint32(1, seq, false);
  view.setUint8(5, stripIndex);
  message.set(colors, FRAME_HEADER_BYTES);
  return message;
}

/**
 * El frame que lleva `message`, o `undefined` si no es un frame bien formado. Los colores son una
 * vista sobre el mensaje, sin copiarlo.
 */
export function decodeFrame(message: Uint8Array): FrameMessage | undefined {
  const colorBytes = message.length - FRAME_HEADER_BYTES;
  if (colorBytes < 3 || colorBytes % 3 !== 0) return undefined;

  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  if (view.getUint8(0) !== FRAME_MESSAGE_TYPE) return undefined;

  return {
    seq: view.getUint32(1, false),
    stripIndex: view.getUint8(5),
    colors: message.subarray(FRAME_HEADER_BYTES),
  };
}

/** Tipo del mensaje de la fuente de audio (decisión 5 del change virtual-strip-audio-file). */
export const SOURCE_MESSAGE_TYPE = 2;

/** Tipo del mensaje del nivel de la fuente de audio. */
export const LEVEL_MESSAGE_TYPE = 3;

/**
 * La fuente de audio del instrumento, como la ve el panel: sin la ruta del fichero ni la cadena de
 * ALSA de la tarjeta, solo su nombre (decisión 9 del change soundcard-audio-source).
 */
export type SourceMessage =
  | { kind: 'none' }
  | { kind: 'file'; name: string }
  | { kind: 'soundcard'; name: string };

export interface LevelMessage {
  /** El pulso al que pertenece, como el `seq` de los frames. */
  seq: number;
  /** Nivel de la fuente, de 0 a 1, sin ajustar. */
  level: number;
}

/** Clase de la fuente: el segundo byte del mensaje de fuente. */
const SOURCE_NONE = 0;
const SOURCE_FILE = 1;
const SOURCE_SOUNDCARD = 2;

const SOURCE_CLASS = { none: SOURCE_NONE, file: SOURCE_FILE, soundcard: SOURCE_SOUNDCARD } as const;

/** Las clases de fuente que llevan nombre, por su byte. */
const NAMED_SOURCE: Partial<Record<number, 'file' | 'soundcard'>> = {
  [SOURCE_FILE]: 'file',
  [SOURCE_SOUNDCARD]: 'soundcard',
};

/** Tipo (1 byte) + `seq` (4 bytes, big-endian) + nivel (`float32`, big-endian). */
const LEVEL_MESSAGE_BYTES = 9;

/** El mensaje de la fuente de audio: lo recibe cada panel al conectarse. */
export function encodeSource(source: SourceMessage): Uint8Array {
  const name = source.kind === 'none' ? new Uint8Array(0) : new TextEncoder().encode(source.name);
  const message = new Uint8Array(2 + name.length);
  message[0] = SOURCE_MESSAGE_TYPE;
  message[1] = SOURCE_CLASS[source.kind];
  message.set(name, 2);
  return message;
}

/** La fuente que lleva `message`, o `undefined` si no es un mensaje de fuente bien formado. */
export function decodeSource(message: Uint8Array): SourceMessage | undefined {
  if (message.length < 2 || message[0] !== SOURCE_MESSAGE_TYPE) return undefined;
  if (message[1] === SOURCE_NONE) return message.length === 2 ? { kind: 'none' } : undefined;
  const kind = NAMED_SOURCE[message[1] ?? SOURCE_NONE];
  if (!kind || message.length === 2) return undefined;
  try {
    const name = new TextDecoder('utf-8', { fatal: true }).decode(message.subarray(2));
    return { kind, name };
  } catch {
    return undefined;
  }
}

/** El mensaje del nivel de un pulso. Es nuevo en cada llamada: se puede enviar sin copiarlo. */
export function encodeLevel(seq: number, level: number): Uint8Array {
  if (!(level >= 0 && level <= 1)) throw new RangeError(`El nivel va de 0 a 1: ${level}`);
  const message = new Uint8Array(LEVEL_MESSAGE_BYTES);
  const view = new DataView(message.buffer);
  view.setUint8(0, LEVEL_MESSAGE_TYPE);
  view.setUint32(1, seq, false);
  view.setFloat32(5, level, false);
  return message;
}

/** El nivel que lleva `message`, o `undefined` si no es un mensaje de nivel bien formado. */
export function decodeLevel(message: Uint8Array): LevelMessage | undefined {
  if (message.length !== LEVEL_MESSAGE_BYTES) return undefined;
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  if (view.getUint8(0) !== LEVEL_MESSAGE_TYPE) return undefined;
  const level = view.getFloat32(5, false);
  if (!(level >= 0 && level <= 1)) return undefined;
  return { seq: view.getUint32(1, false), level };
}

/** Tipo del mensaje de la posición del fichero (decisión 2 del change panel-audio-playback). */
export const POSITION_MESSAGE_TYPE = 4;

export interface PositionMessage {
  /** El pulso al que pertenece, como el `seq` de los frames. */
  seq: number;
  /** Punto del fichero, en segundos desde su principio, en el que acaba la ventana del pulso. */
  position: number;
}

/** Tipo (1 byte) + `seq` (4 bytes, big-endian) + posición (`float64`, big-endian). */
const POSITION_MESSAGE_BYTES = 13;

/** El mensaje de la posición del fichero en un pulso. Es nuevo en cada llamada. */
export function encodePosition(seq: number, position: number): Uint8Array {
  if (!(position >= 0 && Number.isFinite(position))) {
    throw new RangeError(`La posición es un número de segundos desde 0: ${position}`);
  }
  const message = new Uint8Array(POSITION_MESSAGE_BYTES);
  const view = new DataView(message.buffer);
  view.setUint8(0, POSITION_MESSAGE_TYPE);
  view.setUint32(1, seq, false);
  view.setFloat64(5, position, false);
  return message;
}

/** La posición que lleva `message`, o `undefined` si no es un mensaje de posición bien formado. */
export function decodePosition(message: Uint8Array): PositionMessage | undefined {
  if (message.length !== POSITION_MESSAGE_BYTES) return undefined;
  const view = new DataView(message.buffer, message.byteOffset, message.byteLength);
  if (view.getUint8(0) !== POSITION_MESSAGE_TYPE) return undefined;
  const position = view.getFloat64(5, false);
  if (!(position >= 0 && Number.isFinite(position))) return undefined;
  return { seq: view.getUint32(1, false), position };
}

/** Tipo del mensaje del estado de la fuente (decisión 3 del change soundcard-reconnect). */
export const SOURCE_STATUS_MESSAGE_TYPE = 5;

/** Si la tarjeta de sonido entrega audio o se ha perdido. Solo lo tiene la tarjeta de sonido. */
export type SourceStatus = 'connected' | 'lost';

/** El estado, por su byte. */
const SOURCE_STATUS: readonly SourceStatus[] = ['connected', 'lost'];

/** El mensaje del estado de la fuente: al conectarse cada panel y a todos cuando cambia. */
export function encodeSourceStatus(status: SourceStatus): Uint8Array {
  const byte = SOURCE_STATUS.indexOf(status);
  if (byte < 0) throw new RangeError(`El estado de la fuente no existe: ${String(status)}`);
  return Uint8Array.of(SOURCE_STATUS_MESSAGE_TYPE, byte);
}

/** El estado que lleva `message`, o `undefined` si no es un mensaje de estado bien formado. */
export function decodeSourceStatus(message: Uint8Array): SourceStatus | undefined {
  if (message.length !== 2 || message[0] !== SOURCE_STATUS_MESSAGE_TYPE) return undefined;
  return SOURCE_STATUS[message[1] ?? -1];
}

/** Tipo del mensaje de las tiras (decisión 3 del change strip-effect-switch). */
export const STRIPS_MESSAGE_TYPE = 6;

/** El panel no recibe campos que el esquema no declare, como no los admite el fichero. */
const CLOSED = { additionalProperties: false } as const;

/**
 * Lo que muestra el panel de una tira, sea cual sea su efecto. No reutiliza `StripConfigSchema`: lo
 * que H3 y H4 añadan al fichero no sale al panel sin decidirlo. Por eso la salida tiene su propio
 * esquema, aunque hoy coincida con la del fichero: el puerto de una salida Adalight llega con H3.
 */
const STRIP_FIELDS = {
  id: Type.String({ minLength: 1 }),
  name: Type.String({ minLength: 1 }),
  ledCount: Type.Integer({ minimum: 1 }),
  output: Type.Union([Type.Object({ type: Type.Literal('virtual') }, CLOSED)]),
};

/** Una tira como la ve el panel: lo que muestra, su efecto activo y los valores con que lo pinta. */
export type StripState = {
  [E in EffectId]: Static<TObject<typeof STRIP_FIELDS>> & { effect: E; values: EffectValues<E> };
}[EffectId];

/**
 * El esquema de `StripState`: una unión discriminada por `effect`, generada del catálogo, en la que
 * los valores de cada tira cumplen el esquema de su efecto (decisión 6 del change
 * strip-effect-values). `Unsafe` le da su tipo, que el `map` pierde; el esquema es el mismo.
 */
export const StripStateSchema = Type.Unsafe<StripState>(
  Type.Union(
    EFFECT_CATALOG.map(({ id, paramsSchema }) =>
      Type.Object({ ...STRIP_FIELDS, effect: Type.Literal(id), values: paramsSchema }, CLOSED),
    ),
  ),
);

/** Todas las tiras, en el orden del fichero: la posición es el índice de la tira en los frames. */
export const StripsMessageSchema = Type.Object(
  { strips: Type.Array(StripStateSchema, { maxItems: MAX_STRIPS }) },
  CLOSED,
);

export type StripsMessage = Static<typeof StripsMessageSchema>;

/**
 * El mensaje de las tiras: el byte de tipo y el JSON en UTF-8. Lo recibe cada panel al conectarse y
 * todos cada vez que cambia el efecto de una tira. Es nuevo en cada llamada.
 */
export function encodeStrips(message: StripsMessage): Uint8Array {
  const json = new TextEncoder().encode(JSON.stringify(message));
  const encoded = new Uint8Array(1 + json.length);
  encoded[0] = STRIPS_MESSAGE_TYPE;
  encoded.set(json, 1);
  return encoded;
}

/** Las tiras que lleva `message`, o `undefined` si no es un mensaje de tiras que cumpla su esquema. */
export function decodeStrips(message: Uint8Array): StripsMessage | undefined {
  if (message[0] !== STRIPS_MESSAGE_TYPE) return undefined;
  let data: unknown;
  try {
    data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(message.subarray(1)));
  } catch {
    return undefined;
  }
  return Value.Check(StripsMessageSchema, data) ? data : undefined;
}
