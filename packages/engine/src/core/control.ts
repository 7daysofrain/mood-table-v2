/**
 * Búfer de control (README §2.1, *Plano de control*; decisión 1 del change strip-effect-switch): la
 * frontera entre los mandos y el bucle. Guarda la ranura de efecto de cada tira; cualquier mando
 * escribe en él por el puerto `Commands`, y el bucle lee la ranura de cada tira al empezar cada
 * pulso. Lo crea la raíz de composición antes que el servidor y el bucle, que dependen de él.
 *
 * Todo lo que crea objetos (la memoria y los valores del efecto) pasa en `setEffect` y en
 * `setValues`, fuera del bucle, que solo lee referencias: el cambio entra entero en el pulso
 * siguiente, nunca a medias.
 */
import { type EffectId, needsAudioSource, type StripConfig } from '@moodtable/shared';
import type { TSchema } from 'typebox';
import Value from 'typebox/value';

import { defaultParams, type Effect, type FrameContext } from './effects/effect.ts';
import { type AnyEffect, EFFECTS } from './effects/registry.ts';

/**
 * Qué ha pasado con un cambio de efecto. No lanza: cada mando lo traduce a lo suyo (la API, a un
 * código HTTP).
 */
export type SetEffectResult =
  /** La tira pinta el efecto nuevo desde el pulso siguiente. */
  | 'changed'
  /** Ya era su efecto: la tira sigue por donde iba. */
  | 'unchanged'
  | 'unknown-strip'
  /** Es reactivo y el instrumento no tiene fuente de audio: la tira no cambia. */
  | 'needs-audio-source';

/**
 * Qué ha pasado con un cambio de valores (decisión 8 del change strip-effect-values). No lanza, como
 * `setEffect`.
 */
export type SetValuesResult =
  /** La tira pinta con los valores nuevos desde el pulso siguiente, sin reiniciar su memoria. */
  | 'changed'
  /** Ya eran sus valores: no se avisa a nadie. */
  | 'unchanged'
  | 'unknown-strip'
  /** No cumplen el esquema del efecto activo, y la tira no cambia. Dice por qué, en castellano. */
  | { invalid: string };

/** Puerto de los mandos (README §2.1): la API HTTP hoy, la F1 y la pantalla táctil después. */
export interface Commands {
  setEffect(stripId: string, effect: EffectId): SetEffectResult;
  /** Todos los valores del efecto activo de la tira, que se validan con su esquema. */
  setValues(stripId: string, values: unknown): SetValuesResult;
}

/** El efecto que pinta una tira, con sus valores y su memoria ya creados. */
export interface EffectSlot {
  readonly effect: EffectId;
  /** Los valores con que pinta. Se sustituyen enteros, nunca se modifican. */
  readonly values: unknown;
  /** Escribe el frame en `out`. No crea objetos: se llama en cada pulso. */
  render(ctx: FrameContext, out: Uint8Array): void;
}

export interface ControlBuffer extends Commands {
  /** La ranura de la tira que ocupa `stripIndex` en el fichero. El bucle la lee en cada pulso. */
  slot(stripIndex: number): EffectSlot;
  /**
   * Avisa a `listener` cada vez que cambia el efecto o los valores de una tira, venga de donde
   * venga. Devuelve cómo dejar de escuchar.
   */
  watch(listener: () => void): () => void;
}

export interface ControlOptions {
  /** Las tiras del fichero, en su orden. Cada una empieza con su efecto (specs/effects). */
  strips: readonly StripConfig[];
  /** Los efectos entre los que elige cada tira. Por defecto, el registro del motor. */
  effects?: readonly AnyEffect[];
  /** Si el instrumento tiene fuente de audio: sin ella, una tira no puede pasar a un reactivo. */
  hasAudioSource: boolean;
}

/** La ranura por dentro: el búfer sustituye sus valores y conoce su esquema. */
interface Slot extends EffectSlot {
  values: unknown;
  readonly paramsSchema: TSchema;
}

function createSlot<P, M>(strip: StripConfig, effect: Effect<P, M>): Slot {
  const memory = effect.createMemory(strip);
  const slot: Slot = {
    effect: effect.id as EffectId,
    paramsSchema: effect.paramsSchema,
    values: defaultParams(effect),
    render: (ctx, out) => {
      // Lee la referencia en cada pulso: unos valores nuevos entran enteros en el siguiente. Solo
      // llegan los que cumplen `paramsSchema`, que son los `P` del efecto.
      effect.render(ctx, slot.values as P, memory, out);
    },
  };
  return slot;
}

/** Los nombres de unos campos, para un mensaje: `` `color`, `period` ``. */
function fieldNames(names: unknown): string {
  return Array.isArray(names) ? names.map((name) => `\`${String(name)}\``).join(', ') : '';
}

/** Un error de TypeBox, en castellano y sin la jerga de JSON Schema. */
function describeError(error: { keyword: string; instancePath: string; params: object }): string {
  const params = error.params as Record<string, unknown>;
  const field = `\`${error.instancePath.slice(1)}\``;
  switch (error.keyword) {
    case 'required':
      return `falta ${fieldNames(params.requiredProperties)}`;
    case 'additionalProperties':
      return `no declara ${fieldNames(params.additionalProperties)}`;
    case 'minimum':
    case 'maximum':
    case 'exclusiveMinimum':
    case 'exclusiveMaximum':
      return `${field} debe ser ${String(params.comparison)} ${String(params.limit)}`;
    case 'pattern':
      return `${field} no tiene el formato \`${String(params.pattern)}\``;
    default:
      return `${field} no es válido`;
  }
}

/**
 * Por qué `values` no cumple `schema`, o `undefined` si lo cumple. Con un campo de más, TypeBox da
 * también un error `boolean` por cada uno, que no dice nada nuevo.
 */
function invalidReason(schema: TSchema, values: unknown): string | undefined {
  if (Value.Check(schema, values)) return undefined;
  if (typeof values !== 'object' || values === null || Array.isArray(values)) {
    return 'los valores deben ser un objeto';
  }
  return Value.Errors(schema, values)
    .filter((error) => error.keyword !== 'boolean')
    .map(describeError)
    .join('; ');
}

export function createControl({
  strips,
  effects = EFFECTS,
  hasAudioSource,
}: ControlOptions): ControlBuffer {
  // El fichero ya valida el id contra el catálogo, y un test comprueba que el registro tiene los
  // mismos: un efecto que falta es un fallo del motor, no del que manda.
  function slotFor(strip: StripConfig, id: EffectId): Slot {
    const effect = effects.find((each) => each.id === id);
    if (!effect) {
      throw new Error(`la tira «${strip.id}» declara el efecto «${id}», que el motor no tiene`);
    }
    return createSlot(strip, effect);
  }

  const slots = strips.map((strip) => slotFor(strip, strip.effect));
  const listeners = new Set<() => void>();

  return {
    setEffect(stripId, effect) {
      const index = strips.findIndex((strip) => strip.id === stripId);
      const strip = strips[index];
      if (!strip) return 'unknown-strip';
      if (slots[index]?.effect === effect) return 'unchanged';
      if (!hasAudioSource && needsAudioSource(effect)) return 'needs-audio-source';
      // Una ranura nueva cada vez: volver a un efecto lo devuelve con sus valores por defecto
      // (MOO-96). Si llegan dos cambios antes del pulso, el bucle solo ve el último.
      slots[index] = slotFor(strip, effect);
      for (const listener of listeners) listener();
      return 'changed';
    },
    setValues(stripId, values) {
      const slot = slots[strips.findIndex((strip) => strip.id === stripId)];
      if (!slot) return 'unknown-strip';
      // Unos valores atrasados de otro efecto no cumplen el esquema del activo (decisión 3).
      const invalid = invalidReason(slot.paramsSchema, values);
      if (invalid !== undefined) return { invalid };
      if (Value.Equal(slot.values, values)) return 'unchanged';
      // Una copia: lo que haga después quien llama no cambia lo que pinta la tira.
      slot.values = Value.Clone(values);
      for (const listener of listeners) listener();
      return 'changed';
    },
    slot(stripIndex) {
      const slot = slots[stripIndex];
      if (!slot) throw new RangeError(`No hay ninguna tira en la posición ${stripIndex}`);
      return slot;
    },
    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
