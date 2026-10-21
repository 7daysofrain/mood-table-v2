/**
 * Fichero de configuración del instrumento (specs/engine-config): las tiras declaradas y los ajustes
 * de cada instalación. El esquema vive aquí porque lo usarán también el panel y la API; la lectura
 * del disco es cosa del motor. Crece con H3 y H4 añadiendo campos opcionales y tipos de `output`.
 */
import Type, { type Static } from 'typebox';
import Value from 'typebox/value';

import { EFFECT_CATALOG, type EffectId } from './effects.ts';
import { findJsonError } from './json-error.ts';
import { MAX_STRIPS } from './viewer-protocol.ts';

/**
 * Ningún objeto del fichero admite campos que el esquema no declare: así una errata en un campo
 * opcional (`"fsp"` en lugar de `"fps"`) impide arrancar en lugar de ignorarse sin avisar.
 */
const CLOSED = { additionalProperties: false } as const;

/** Salida de una tira, discriminada por `type`. En H1 solo existe `virtual`, sin más campos. */
const OutputSchema = Type.Union([Type.Object({ type: Type.Literal('virtual') }, CLOSED)]);

/**
 * El efecto con el que arranca la tira: uno de los ids del catálogo (decisión 10). La unión se genera
 * del catálogo, y `Unsafe` le da su tipo, que el `map` pierde; el esquema es el mismo.
 */
const EffectIdSchema = Type.Unsafe<EffectId>(
  Type.Union(EFFECT_CATALOG.map((effect) => Type.Literal(effect.id))),
);

export const StripConfigSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    output: OutputSchema,
    ledCount: Type.Integer({ minimum: 1 }),
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
    strips: Type.Array(StripConfigSchema, { minItems: 1, maxItems: MAX_STRIPS }),
  },
  CLOSED,
);

export type StripConfig = Static<typeof StripConfigSchema>;

export type AudioSourceConfig = Static<typeof AudioSourceConfigSchema>;

/** La configuración ya validada, con los valores por defecto aplicados. */
export interface Config {
  fps: number;
  server: { host: string; port: number };
  /** Sin `audioSource`, el instrumento no tiene fuente de audio. */
  audioSource?: AudioSourceConfig;
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
  const errors = withAudioSourceErrors(Value.Errors(ConfigFileSchema, withDefaults), withDefaults);
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
    : config.strips.find((strip) => EFFECT_CATALOG.some((e) => e.id === strip.effect && e.usesAudio));
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
 * Una unión da los errores de todas sus variantes mezclados: con una tarjeta sin `name`, la variante
 * `file` diría que `name` no existe. Así que los errores de `audioSource` se sustituyen, en su sitio,
 * por los de la variante que nombra su `type`; si no nombra ninguna, solo se habla del `type`.
 */
function withAudioSourceErrors(errors: SchemaError[], config: unknown): SchemaError[] {
  const inSource = (error: SchemaError): boolean =>
    error.instancePath === '/audioSource' || error.instancePath.startsWith('/audioSource/');
  const first = errors.findIndex(inSource);
  if (first === -1) return errors;

  const source = isObject(config) ? config.audioSource : undefined;
  const variant = isObject(source)
    ? AudioSourceConfigSchema.anyOf.find((each) => each.properties.type.const === source.type)
    : undefined;
  let replacement: SchemaError[];
  if (variant) {
    replacement = Value.Errors(variant, source).map((error) => ({
      ...error,
      instancePath: `/audioSource${error.instancePath}`,
    }));
  } else {
    const keep = withoutVariant(source);
    replacement = errors.filter((error) => inSource(error) && keep(error));
  }
  const others = errors.filter((error) => !inSource(error));
  return [...others.slice(0, first), ...replacement, ...others.slice(first)];
}

/**
 * Qué errores de `audioSource` se cuentan cuando su `type` no nombra ninguna variante: sin objeto,
 * que lo sea; sin `type`, que falta; con uno que no existe, los valores que se admiten.
 */
function withoutVariant(source: unknown): (error: SchemaError) => boolean {
  if (!isObject(source)) return (error) => error.keyword === 'type';
  if ('type' in source) return (error) => error.instancePath === '/audioSource/type';
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
  const allowed = errors
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
      return `${value} no es un valor válido (se admite ${allowed.map(quoted).join(' o ')})`;
    }
    default:
      return error.message;
  }
}
