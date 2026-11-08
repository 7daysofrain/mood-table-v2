/**
 * Restauración del estado del instrumento al arrancar (design.md, decisiones 5 y 6 del change
 * instrument-state-restore): a partir de las tiras del fichero y del estado guardado, el efecto
 * activo y los valores de cada efecto con que arranca cada tira, más los avisos para el log. Función
 * pura: no sabe de dónde viene el estado guardado ni lo cambia.
 *
 * - Una tira se reconoce por su `id`: cambiar su nombre, sus LEDs o su salida no la hace otra.
 * - Sin estado guardado, arranca como la primera vez: el efecto del fichero con sus valores por
 *   defecto, sin avisar de nada.
 * - Con estado, manda lo que dejó el DJ, salvo que su efecto activo ya no exista o necesite una
 *   fuente de audio que el fichero ya no declara (con aviso): entonces, el efecto del fichero, que
 *   siempre se puede pintar porque el fichero no deja declarar un reactivo sin fuente.
 * - Los valores de cada efecto se validan con su esquema actual (D104). Los de un efecto que ya no
 *   existe se ignoran.
 * - Las tiras guardadas que el fichero no declara no salen, y el guardado nunca borra sus filas
 *   (README §3): si vuelven, recuperan lo suyo.
 */
import type { StripConfig } from '@moodtable/shared';
import Value from 'typebox/value';

import { defaultParams } from './effects/effect.ts';
import type { AnyEffect } from './effects/registry.ts';
import type { InstrumentState, SavedStrip } from './state-store.ts';

export interface RestoreOptions {
  /** Las tiras del fichero, en su orden. */
  strips: readonly StripConfig[];
  /** Los efectos que tiene el motor. */
  effects: readonly AnyEffect[];
  /** Si el instrumento tiene fuente de audio: sin ella, una tira no puede arrancar con un reactivo. */
  hasAudioSource: boolean;
  /** Lo que devuelve el puerto `StateStore`; vacío en el primer arranque. */
  saved: InstrumentState;
}

export interface Restored {
  /**
   * Cada tira del fichero, por su `id`, con su efecto activo y los valores de cada efecto, que
   * siempre incluyen los del activo y ya cumplen el esquema de cada uno.
   */
  state: InstrumentState;
  /** Lo que el DJ debería saber, para el log. Vacío si todo ha vuelto como estaba. */
  notices: string[];
}

export function restore({ strips, effects, hasAudioSource, saved }: RestoreOptions): Restored {
  const byId = new Map<string, AnyEffect>(effects.map((effect) => [effect.id, effect]));
  const notices: string[] = [];

  function effectOf(strip: StripConfig): AnyEffect {
    const effect = byId.get(strip.effect);
    // Como en el búfer de control: el fichero ya valida el id contra el catálogo.
    if (!effect) {
      throw new Error(`la tira «${strip.id}» declara el efecto «${strip.effect}», que el motor no tiene`);
    }
    return effect;
  }

  function restoreStrip(strip: StripConfig): SavedStrip {
    const fromFile = effectOf(strip);
    // `Object.hasOwn`: un id como `__proto__` o `constructor` no debe leer las propiedades de Object.
    const kept = Object.hasOwn(saved, strip.id) ? saved[strip.id] : undefined;
    if (!kept) {
      return { activeEffect: fromFile.id, values: { [fromFile.id]: defaultParams(fromFile) } };
    }

    const values = new Map<string, unknown>();
    for (const [id, effectValues] of Object.entries(kept.values)) {
      const effect = byId.get(id);
      if (effect) values.set(id, fitted(effect, effectValues));
    }

    let active = byId.get(kept.activeEffect) ?? fromFile;
    if (active.usesAudio && !hasAudioSource) {
      notices.push(
        `la tira «${strip.id}»: su efecto guardado, \`${active.id}\`, necesita una fuente de audio ` +
          `(\`audioSource\`) y el fichero no declara ninguna; arranca con \`${fromFile.id}\`.`,
      );
      active = fromFile;
    }
    if (!values.has(active.id)) values.set(active.id, defaultParams(active));

    return { activeEffect: active.id, values: Object.fromEntries(values) };
  }

  // Con `Object.fromEntries` y no asignando a un objeto: un id como `__proto__` queda como propiedad
  // propia.
  const state = Object.fromEntries(strips.map((strip) => [strip.id, restoreStrip(strip)]));
  return { state, notices };
}

/**
 * Los valores guardados de un efecto, ajustados a su esquema actual: los campos que faltan toman su
 * valor por defecto y los que sobran se quitan. Si aun así no lo cumplen, los de por defecto.
 */
function fitted(effect: AnyEffect, values: unknown): unknown {
  const schema = effect.paramsSchema;
  const adjusted = Value.Clean(schema, Value.Default(schema, Value.Clone(values)));
  return Value.Check(schema, adjusted) ? adjusted : defaultParams(effect);
}
