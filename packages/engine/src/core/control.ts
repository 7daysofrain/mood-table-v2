/**
 * Búfer de control (README §2.1, *Plano de control*; decisión 1 del change strip-effect-switch): la
 * frontera entre los mandos y el bucle. Guarda la ranura de efecto de cada tira; cualquier mando
 * escribe en él por el puerto `Commands`, y el bucle lee la ranura de cada tira al empezar cada
 * pulso. Lo crea la raíz de composición antes que el servidor y el bucle, que dependen de él.
 *
 * Todo lo que crea objetos (la memoria y los parámetros del efecto) pasa en `setEffect`, fuera del
 * bucle, que solo lee una referencia: el cambio entra entero en el pulso siguiente, nunca a medias.
 */
import { type EffectId, needsAudioSource, type StripConfig } from '@moodtable/shared';

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

/** Puerto de los mandos (README §2.1): la API HTTP hoy, la F1 y la pantalla táctil después. */
export interface Commands {
  setEffect(stripId: string, effect: EffectId): SetEffectResult;
}

/** El efecto que pinta una tira, con sus parámetros y su memoria ya creados. */
export interface EffectSlot {
  readonly effect: EffectId;
  /** Escribe el frame en `out`. No crea objetos: se llama en cada pulso. */
  render(ctx: FrameContext, out: Uint8Array): void;
}

export interface ControlBuffer extends Commands {
  /** La ranura de la tira que ocupa `stripIndex` en el fichero. El bucle la lee en cada pulso. */
  slot(stripIndex: number): EffectSlot;
  /**
   * Avisa a `listener` cada vez que cambia el efecto de una tira, venga de donde venga. Devuelve
   * cómo dejar de escuchar.
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

function createSlot<P, M>(strip: StripConfig, effect: Effect<P, M>): EffectSlot {
  const params = defaultParams(effect);
  const memory = effect.createMemory(strip);
  return {
    effect: effect.id as EffectId,
    render: (ctx, out) => {
      effect.render(ctx, params, memory, out);
    },
  };
}

export function createControl({
  strips,
  effects = EFFECTS,
  hasAudioSource,
}: ControlOptions): ControlBuffer {
  // El fichero ya valida el id contra el catálogo, y un test comprueba que el registro tiene los
  // mismos: un efecto que falta es un fallo del motor, no del que manda.
  function slotFor(strip: StripConfig, id: EffectId): EffectSlot {
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
