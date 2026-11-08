/**
 * Búfer de control (README §2.1, *Plano de control*; decisión 1 del change strip-effect-switch): la
 * frontera entre los mandos y el bucle. Guarda la ranura de efecto de cada tira y los valores de
 * cada efecto de cada tira, también de los no activos, para devolverlos al volver a él (change
 * strip-effect-recall); cualquier mando escribe en él por el puerto `Commands`, y el bucle lee la
 * ranura de cada tira al empezar cada pulso. Lo crea la raíz de composición antes que el servidor y
 * el bucle, que dependen de él.
 *
 * Todo lo que crea objetos (la memoria y los valores del efecto) pasa en `setEffect` y en
 * `setValues`, fuera del bucle, que solo lee referencias: el cambio entra entero en el pulso
 * siguiente, nunca a medias.
 *
 * También guarda la intensidad del instrumento (decisión 8 del change instrument-intensity), que no
 * es de ninguna tira: un número que se sustituye fuera del bucle y que el bucle lee al empezar cada
 * pulso. Vive en memoria y no se guarda (H5).
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

/**
 * Qué ha pasado con un cambio de intensidad (decisión 4 del change instrument-intensity). No lanza,
 * como `setValues`.
 */
export type SetIntensityResult =
  /** Todas las tiras pintan con la intensidad nueva desde el pulso siguiente. */
  | 'changed'
  /** Ya era la intensidad: no se avisa a nadie. */
  | 'unchanged'
  /** No es un número finito de 0 a 1, y la intensidad no cambia. */
  | 'invalid';

/** Puerto de los mandos (README §2.1): la API HTTP hoy, la F1 y la pantalla táctil después. */
export interface Commands {
  setEffect(stripId: string, effect: EffectId): SetEffectResult;
  /** Todos los valores del efecto activo de la tira, que se validan con su esquema. */
  setValues(stripId: string, values: unknown): SetValuesResult;
  /**
   * La intensidad de todas las tiras, de 0 a 1. Se valida aquí también, no solo en la API: un mando
   * futuro, como la F1, entra por este puerto sin pasar por ella.
   */
  setIntensity(intensity: unknown): SetIntensityResult;
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
  /** La intensidad con que pintan todas las tiras, de 0 a 1. El bucle la lee en cada pulso. */
  intensity(): number;
  /**
   * Avisa a `listener` cada vez que cambia la intensidad, venga de donde venga. Es un aviso aparte
   * del de las tiras, para que un cambio de intensidad no rehaga el estado de todas. Devuelve cómo
   * dejar de escuchar.
   */
  watchIntensity(listener: () => void): () => void;
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

/** Una ranura con la memoria recién creada y `values`, que ya cumplen el esquema del efecto. */
function createSlot<P, M>(strip: StripConfig, effect: Effect<P, M>, values: unknown): Slot {
  const memory = effect.createMemory(strip);
  const slot: Slot = {
    effect: effect.id as EffectId,
    paramsSchema: effect.paramsSchema,
    values,
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
  // Los valores de cada efecto de cada tira, en el orden del fichero, también los de los efectos no
  // activos: los mismos que `strip_effects` (README §3.2). Siempre tiene los del efecto activo.
  const saved = strips.map(() => new Map<EffectId, unknown>());

  // El fichero ya valida el id contra el catálogo, y un test comprueba que el registro tiene los
  // mismos: un efecto que falta es un fallo del motor, no del que manda.
  function slotFor(index: number, strip: StripConfig, id: EffectId): Slot {
    const effect = effects.find((each) => each.id === id);
    if (!effect) {
      throw new Error(`la tira «${strip.id}» declara el efecto «${id}», que el motor no tiene`);
    }
    // Con los valores con que la tira dejó el efecto o, la primera vez, con los de por defecto.
    const values = saved[index]?.get(id) ?? defaultParams(effect);
    saved[index]?.set(id, values);
    return createSlot(strip, effect, values);
  }

  const slots = strips.map((strip, index) => slotFor(index, strip, strip.effect));
  const listeners = new Set<() => void>();
  // Al arrancar, al máximo: cada tira pinta su efecto tal cual (specs/intensity).
  let intensity = 1;
  const intensityListeners = new Set<() => void>();

  return {
    setEffect(stripId, effect) {
      const index = strips.findIndex((strip) => strip.id === stripId);
      const strip = strips[index];
      if (!strip) return 'unknown-strip';
      if (slots[index]?.effect === effect) return 'unchanged';
      if (!hasAudioSource && needsAudioSource(effect)) return 'needs-audio-source';
      // Una ranura nueva cada vez, ya entera con los valores guardados antes de dejarla en su sitio:
      // el primer frame los lleva, y el efecto empieza con la memoria nueva (decisiones 1 y 2 del
      // change strip-effect-recall). Si llegan dos cambios antes del pulso, el bucle solo ve el último.
      slots[index] = slotFor(index, strip, effect);
      for (const listener of listeners) listener();
      return 'changed';
    },
    setValues(stripId, values) {
      const index = strips.findIndex((strip) => strip.id === stripId);
      const slot = slots[index];
      if (!slot) return 'unknown-strip';
      // Unos valores atrasados de otro efecto no cumplen el esquema del activo (decisión 3), y
      // tampoco se guardan para ese otro (decisión 3 del change strip-effect-recall).
      const invalid = invalidReason(slot.paramsSchema, values);
      if (invalid !== undefined) return { invalid };
      if (Value.Equal(slot.values, values)) return 'unchanged';
      // Una copia: lo que haga después quien llama no cambia lo que pinta la tira.
      slot.values = Value.Clone(values);
      saved[index]?.set(slot.effect, slot.values);
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
    setIntensity(value) {
      if (typeof value !== 'number' || !(value >= 0 && value <= 1)) return 'invalid';
      if (value === intensity) return 'unchanged';
      intensity = value;
      for (const listener of intensityListeners) listener();
      return 'changed';
    },
    intensity: () => intensity,
    watchIntensity(listener) {
      intensityListeners.add(listener);
      return () => intensityListeners.delete(listener);
    },
  };
}
