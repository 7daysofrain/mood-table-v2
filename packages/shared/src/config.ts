/**
 * Fichero de configuración del instrumento (specs/engine-config): las tiras declaradas y los ajustes
 * de cada instalación. El esquema vive aquí porque lo usarán también el panel y la API; la lectura
 * del disco es cosa del motor. Crece con H3 y H4 añadiendo campos opcionales y tipos de `output`.
 */
import Type, { type Static } from 'typebox';
import Value from 'typebox/value';

import { EffectIdSchema, needsAudioSource } from './effects.ts';
import { findJsonError } from './json-error.ts';
import { MAX_STRIPS } from './viewer-protocol.ts';

/**
 * Ningún objeto del fichero admite campos que el esquema no declare: así una errata en un campo
 * opcional (`"fsp"` en lugar de `"fps"`) impide arrancar en lugar de ignorarse sin avisar.
 */
const CLOSED = { additionalProperties: false } as const;

/**
 * Las velocidades estándar de Linux (`termios`) hasta 2.000.000, el máximo del CH340 del Arduino de
 * la mesa. Con una lista y no cualquier entero, una errata (`11520`) no deja arrancar (decisión 6 del
 * change adalight-strip-output).
 */
const BAUD_RATES = [
  9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600, 1000000, 1500000,
  2000000,
] as const;

/** `Unsafe` le da su tipo, que el `map` pierde (quedaría `never`); el esquema es el mismo. */
const BaudRateSchema = Type.Unsafe<(typeof BAUD_RATES)[number]>(
  Type.Union(BAUD_RATES.map((rate) => Type.Literal(rate))),
);

/**
 * Salida de una tira, discriminada por `type`: `virtual`, solo el visor, o `adalight`, la tira física
 * en un puerto serie (`port`, mejor la ruta de `/dev/serial/by-id/`) a unos baudios.
 */
const OutputSchema = Type.Union([
  Type.Object({ type: Type.Literal('virtual') }, CLOSED),
  Type.Object(
    {
      type: Type.Literal('adalight'),
      port: Type.String({ minLength: 1 }),
      baudRate: BaudRateSchema,
    },
    CLOSED,
  ),
]);

export const StripConfigSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    output: OutputSchema,
    ledCount: Type.Integer({ minimum: 1 }),
    // El efecto con el que arranca la tira: uno de los ids del catálogo (decisión 10).
    effect: EffectIdSchema,
  },
  CLOSED,
);

/**
 * Fuente de audio, discriminada por `type` como `output` (decisión 12). `file` es un WAV con ruta
 * absoluta o relativa a la raíz del repositorio. `soundcard` es una tarjeta de ALSA: `name` es lo que
 * muestra el panel y `device`, la cadena que recibe `arecord -D`, sin comprobar aquí si existe
 * (decisión 3 del change soundcard-audio-source). Su `silenceThreshold` (dBFS) es el nivel por debajo
 * del cual el ruido de fondo cuenta como silencio (decisión 7): −120 ya es menos que el ruido de 16
 * bits, y por encima de 0 no hay señal.
 */
export const AudioSourceConfigSchema = Type.Union([
  Type.Object({ type: Type.Literal('file'), path: Type.String({ minLength: 1 }) }, CLOSED),
  Type.Object(
    {
      type: Type.Literal('soundcard'),
      name: Type.String({ minLength: 1 }),
      device: Type.String({ minLength: 1 }),
      silenceThreshold: Type.Optional(Type.Number({ minimum: -120, maximum: 0, default: -60 })),
    },
    CLOSED,
  ),
]);

/**
 * Dónde se guarda el estado del instrumento (H5), discriminado por `type` como `audioSource`:
 * `sqlite` en el fichero de `path`, absoluta o relativa a la raíz del repositorio, o `memory`, que no
 * guarda nada (la demo pública y los E2E). Sin el campo, SQLite en `data/`, que git ignora: así la
 * mesa y el simulador recuerdan sin declarar nada (decisión 7 del change instrument-state-restore).
 */
export const InstrumentStateConfigSchema = Type.Union(
  [
    Type.Object({ type: Type.Literal('sqlite'), path: Type.String({ minLength: 1 }) }, CLOSED),
    Type.Object({ type: Type.Literal('memory') }, CLOSED),
  ],
  { default: { type: 'sqlite', path: 'data/instrument-state.db' } },
);

/** Por defecto, solo local: el panel no tiene contraseña (README §2.5, decisión 13). */
const ServerSchema = Type.Object(
  {
    host: Type.Optional(Type.String({ minLength: 1, default: '127.0.0.1' })),
    port: Type.Optional(Type.Integer({ minimum: 1, maximum: 65535, default: 8080 })),
  },
  { ...CLOSED, default: {} },
);

export const ConfigFileSchema = Type.Object(
  {
    // El pulso del motor: README §2.2 prevé 30-60 fps, y más satura la CPU sin decir por qué.
    fps: Type.Optional(Type.Integer({ minimum: 1, maximum: 60, default: 60 })),
    server: Type.Optional(ServerSchema),
    // Opcional: sin ella, el instrumento no tiene fuente de audio.
    audioSource: Type.Optional(AudioSourceConfigSchema),
    instrumentState: Type.Optional(InstrumentStateConfigSchema),
    strips: Type.Array(StripConfigSchema, { minItems: 1, maxItems: MAX_STRIPS }),
  },
  CLOSED,
);

export type StripConfig = Static<typeof StripConfigSchema>;

export type AudioSourceConfig = Static<typeof AudioSourceConfigSchema>;

export type InstrumentStateConfig = Static<typeof InstrumentStateConfigSchema>;

/** La configuración ya validada, con los valores por defecto aplicados. */
export interface Config {
  fps: number;
  server: { host: string; port: number };
  /** Sin `audioSource`, el instrumento no tiene fuente de audio. */
  audioSource?: AudioSourceConfig;
  instrumentState: InstrumentStateConfig;
  strips: StripConfig[];
}

export type ConfigResult = { ok: true; config: Config } | { ok: false; error: string };

/**
 * Valida el texto del fichero y devuelve la configuración o el primer problema, en una frase que
 * nombra la tira y el campo. No sabe de qué fichero viene: quien lo lee añade la ruta.
 */
export function parseConfig(text: string): ConfigResult {
  // Algunos editores guardan el UTF-8 con BOM, y `JSON.parse` lo rechaza como si fuera un error.
  const json = text.startsWith('\uFEFF') ? text.slice(1) : text;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    const at = findJsonError(json);
    return fail(
      at
        ? `no es JSON válido: falla en la línea ${at.line}, columna ${at.column}`
        : 'no es JSON válido',
    );
  }

  if (!isObject(data)) return fail('debe ser un objeto JSON con la lista `strips`');
  if (data.strips === undefined || (Array.isArray(data.strips) && data.strips.length === 0)) {
    return fail('no declara ninguna tira (la lista `strips` falta o está vacía)');
  }

  const withDefaults = Value.Default(ConfigFileSchema, structuredClone(data));
  const errors = withVariantErrors(Value.Errors(ConfigFileSchema, withDefaults), withDefaults);
  // Un campo mal escrito da dos errores (el que no existe y el que falta): se nombra el que no existe.
  const error = errors.find((each) => isUnknownField(each)) ?? errors[0];
  if (error) return fail(describeError(error, errors, data));

  const config = withDefaults as Config;
  const repeated = config.strips.find(
    (strip, index) => config.strips.findIndex((other) => other.id === strip.id) !== index,
  );
  if (repeated) return fail(`el id «${repeated.id}» está repetido en más de una tira`);

  // Al arrancar, una tira reactiva sin fuente de audio solo puede ser un olvido: se dice, no se
  // esconde con la tira apagada (decisión 6 del change virtual-strip-audio-file).
  const deaf = config.audioSource
    ? undefined
    : config.strips.find((strip) => needsAudioSource(strip.effect));
  if (deaf) {
    return fail(
      `la tira «${deaf.id}», efecto \`${deaf.effect}\`: necesita una fuente de audio (\`audioSource\`)`,
    );
  }

  return { ok: true, config };
}

function fail(error: string): ConfigResult {
  return { ok: false, error };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

interface SchemaError {
  keyword: string;
  instancePath: string;
  params: object;
  message: string;
}

/**
 * Una unión de objetos discriminada por `type`, como `audioSource`, `instrumentState` y la salida de
 * cada tira.
 */
type VariantUnion =
  | typeof AudioSourceConfigSchema
  | typeof InstrumentStateConfigSchema
  | typeof OutputSchema;

/**
 * Las uniones discriminadas del fichero, con la ruta de cada una: la fuente, el estado y cada salida.
 */
function variantUnions(config: unknown): { path: string; schema: VariantUnion }[] {
  const strips = isObject(config) && Array.isArray(config.strips) ? config.strips : [];
  return [
    { path: '/audioSource', schema: AudioSourceConfigSchema },
    { path: '/instrumentState', schema: InstrumentStateConfigSchema },
    ...strips.map((_, index) => ({ path: `/strips/${index}/output`, schema: OutputSchema })),
  ];
}

/**
 * Una unión da los errores de todas sus variantes mezclados: con una tarjeta sin `name`, la variante
 * `file` diría que `name` no existe. Así que los errores de cada unión discriminada se sustituyen, en
 * su sitio, por los de la variante que nombra su `type`; si no nombra ninguna, solo se habla del
 * `type`.
 */
function withVariantErrors(errors: SchemaError[], config: unknown): SchemaError[] {
  return variantUnions(config).reduce(
    (current, { path, schema }) => withErrorsOfVariant(current, config, path, schema),
    errors,
  );
}

function withErrorsOfVariant(
  errors: SchemaError[],
  config: unknown,
  path: string,
  schema: VariantUnion,
): SchemaError[] {
  const inUnion = (error: SchemaError): boolean =>
    error.instancePath === path || error.instancePath.startsWith(`${path}/`);
  const first = errors.findIndex(inUnion);
  if (first === -1) return errors;

  const value = valueAt(config, path.split('/').slice(1));
  const variant = isObject(value)
    ? schema.anyOf.find((each) => each.properties.type.const === value.type)
    : undefined;
  let replacement: SchemaError[];
  if (variant) {
    replacement = Value.Errors(variant, value).map((error) => ({
      ...error,
      instancePath: `${path}${error.instancePath}`,
    }));
  } else {
    const keep = withoutVariant(value, path);
    replacement = errors.filter((error) => inUnion(error) && keep(error));
  }
  const others = errors.filter((error) => !inUnion(error));
  return [...others.slice(0, first), ...replacement, ...others.slice(first)];
}

/**
 * Qué errores de una unión se cuentan cuando su `type` no nombra ninguna variante: sin objeto, que lo
 * sea; sin `type`, que falta; con uno que no existe, los valores que se admiten.
 */
function withoutVariant(value: unknown, path: string): (error: SchemaError) => boolean {
  if (!isObject(value)) return (error) => error.keyword === 'type';
  if ('type' in value) return (error) => error.instancePath === `${path}/type`;
  return (error) => error.keyword === 'required';
}

/**
 * TypeBox avisa de un campo no declarado de dos formas: en el propio campo (`boolean`: su esquema es
 * `false`) y en el objeto que lo contiene (`additionalProperties`, con el nombre en sus parámetros).
 */
function isUnknownField(error: SchemaError): boolean {
  return error.keyword === 'boolean' || error.keyword === 'additionalProperties';
}

/**
 * `/strips/0/output/type` → «la tira «demo», campo `output.type`: …». `errors` son todos los del
 * fichero: un valor que no está en una unión de literales da uno por cada literal admitido.
 */
function describeError(
  error: SchemaError,
  errors: readonly SchemaError[],
  data: Record<string, unknown>,
): string {
  const segments = error.instancePath.split('/').slice(1);
  const received = valueAt(data, segments);
  const params = error.params as Record<string, unknown>;
  // `required` y `additionalProperties` señalan al objeto padre; el campo va en sus parámetros.
  const missing = ((params.requiredProperties ?? params.additionalProperties) as
    | string[]
    | undefined)?.[0];
  const where = segments[0] === 'strips' && segments[1] !== undefined ? 2 : 0;
  const field = [...segments.slice(where), ...(missing ? [missing] : [])].join('.');
  // Sin campo, el problema es la propia tira (por ejemplo, no es un objeto).
  const subject = field ? `campo \`${field}\`` : 'la entrada';
  const allowed =
    LISTED_VALUES[field]?.map(String) ??
    errors
      .filter((each) => each.keyword === 'const' && each.instancePath === error.instancePath)
      .map((each) => String((each.params as Record<string, unknown>).allowedValue));
  const problem = `${subject}: ${describeProblem(error, received, field, allowed)}`;

  if (where === 0) return problem;
  const index = Number(segments[1]);
  const strip = valueAt(data, ['strips', String(index)]);
  const id = isObject(strip) && typeof strip.id === 'string' && strip.id ? strip.id : undefined;
  const name = id ? `la tira «${id}»` : `la tira ${index + 1}`;
  return `${name}, ${problem}`;
}

/**
 * Los valores admitidos salen de los errores, uno por literal, pero TypeBox da como mucho 8 errores
 * (`maxErrors`, un ajuste global que comparte con Fastify): las listas más largas se toman del esquema.
 */
const LISTED_VALUES: Partial<Record<string, readonly unknown[]>> = { 'output.baudRate': BAUD_RATES };

const TYPE_NAMES: Record<string, string> = {
  array: 'una lista',
  boolean: 'verdadero o falso',
  integer: 'un número entero',
  number: 'un número',
  object: 'un objeto',
  string: 'un texto',
};

/** El valor del fichero en una ruta (`['strips', '0', 'output']`), o `undefined` si no existe. */
function valueAt(data: unknown, segments: string[]): unknown {
  return segments.reduce<unknown>(
    (value, segment) =>
      typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>)[segment]
        : undefined,
    data,
  );
}

/** «valor», como se cita un valor del fichero en los mensajes. */
function quoted(value: string): string {
  return `«${value}»`;
}

/** «a», «b» o «c»: con trece velocidades, una «o» entre cada dos no se lee. */
function orList(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} o ${items.at(-1)}`;
}

/** `id`, como se cita un identificador en los mensajes. */
function asCode(id: string): string {
  return `\`${id}\``;
}

function describeProblem(
  error: SchemaError,
  received: unknown,
  field: string,
  allowed: readonly string[],
): string {
  const params = error.params as Record<string, unknown>;
  if (isUnknownField(error)) return 'no existe (¿está bien escrito?)';
  switch (error.keyword) {
    case 'required':
      return 'falta y es obligatorio';
    case 'type':
      return `debe ser ${TYPE_NAMES[String(params.type)] ?? String(params.type)}`;
    case 'minimum':
      return `debe ser ${String(params.limit)} o más`;
    case 'maximum':
      return `debe ser ${String(params.limit)} o menos`;
    case 'maxItems':
      return `admite como mucho ${String(params.limit)} tiras`;
    case 'minLength':
      return 'no puede estar vacío';
    case 'const': {
      // El efecto lista los que hay, como pide specs/engine-config; el resto, los valores admitidos.
      const value = quoted(String(received));
      if (field === 'effect') {
        return `${value} no es un efecto (hay: ${allowed.map(asCode).join(', ')})`;
      }
      return `${value} no es un valor válido (se admite ${orList(allowed.map(quoted))})`;
    }
    default:
      return error.message;
  }
}
