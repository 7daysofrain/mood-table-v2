/**
 * Fichero de configuración del instrumento (specs/engine-config): las tiras declaradas y los ajustes
 * de cada instalación. El esquema vive aquí porque lo usarán también el panel y la API; la lectura
 * del disco es cosa del motor. Crece con H3 y H4 añadiendo campos opcionales y tipos de `output`.
 */
import Type, { type Static } from 'typebox';
import Value from 'typebox/value';

import { findJsonError } from './json-error.ts';

/**
 * Ningún objeto del fichero admite campos que el esquema no declare: así una errata en un campo
 * opcional (`"fsp"` en lugar de `"fps"`) impide arrancar en lugar de ignorarse sin avisar.
 */
const CLOSED = { additionalProperties: false } as const;

/** Salida de una tira, discriminada por `type`. En H1 solo existe `virtual`, sin más campos. */
const OutputSchema = Type.Union([Type.Object({ type: Type.Literal('virtual') }, CLOSED)]);

export const StripConfigSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    name: Type.String({ minLength: 1 }),
    output: OutputSchema,
    ledCount: Type.Integer({ minimum: 1 }),
  },
  CLOSED,
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
    strips: Type.Array(StripConfigSchema, { minItems: 1 }),
  },
  CLOSED,
);

export type StripConfig = Static<typeof StripConfigSchema>;

/** La configuración ya validada, con los valores por defecto aplicados. */
export interface Config {
  fps: number;
  server: { host: string; port: number };
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
  const errors = Value.Errors(ConfigFileSchema, withDefaults);
  // Un campo mal escrito da dos errores (el que no existe y el que falta): se nombra el que no existe.
  const error = errors.find((each) => isUnknownField(each)) ?? errors[0];
  if (error) return fail(describeError(error, data));

  const config = withDefaults as Config;
  const repeated = config.strips.find(
    (strip, index) => config.strips.findIndex((other) => other.id === strip.id) !== index,
  );
  if (repeated) return fail(`el id «${repeated.id}» está repetido en más de una tira`);

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
 * TypeBox avisa de un campo no declarado de dos formas: en el propio campo (`boolean`: su esquema es
 * `false`) y en el objeto que lo contiene (`additionalProperties`, con el nombre en sus parámetros).
 */
function isUnknownField(error: SchemaError): boolean {
  return error.keyword === 'boolean' || error.keyword === 'additionalProperties';
}

/** `/strips/0/output/type` → «la tira «demo», campo `output.type`: …». */
function describeError(error: SchemaError, data: Record<string, unknown>): string {
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
  const problem = `${subject}: ${describeProblem(error, received)}`;

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

function describeProblem(error: SchemaError, received: unknown): string {
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
    case 'minLength':
      return 'no puede estar vacío';
    case 'const':
      return `«${String(received)}» no es un valor válido (se admite «${String(params.allowedValue)}»)`;
    default:
      return error.message;
  }
}
