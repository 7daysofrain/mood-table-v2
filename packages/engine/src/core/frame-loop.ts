/**
 * Bucle de frames (specs/frame-loop, README §2.2): en cada pulso calcula el frame de cada tira con
 * su efecto y lo entrega a sus salidas. Es una función pura del instante: no lee el reloj ni
 * programa temporizadores (decisión 7), así que los tests pasan el instante a mano.
 */
import type { StripConfig } from '@moodtable/shared';

import { defaultParams, type Effect, type FrameContext } from './effects/effect.ts';
import { type AnyEffect, EFFECTS } from './effects/registry.ts';

/** El pulso al que pertenece un frame. Es el mismo objeto en todos los frames. */
export interface Tick {
  /** Número del pulso desde el arranque. Un hueco en la numeración son pulsos saltados. */
  seq: number;
  /** Segundos desde el arranque que corresponden a ese pulso. */
  time: number;
}

/** Puerto de salida de **una tira** (decisión 2): el visor, Adalight, la memoria de los tests… */
export interface LightOutput {
  /**
   * Síncrono y sin bloquear. `frame` (RGB, 3 bytes por LED) es del bucle y se reutiliza en el
   * pulso siguiente: solo vale durante la llamada, y quien lo guarde tiene que copiarlo.
   */
  write(frame: Uint8Array, tick: Tick): void;
}

/** Una tira declarada y sus salidas. Quién recibe qué lo decide la raíz de composición. */
export interface LoopStrip {
  config: StripConfig;
  outputs: LightOutput[];
}

export interface FrameLoopOptions {
  /** Los efectos entre los que elige cada tira. Por defecto, el registro del motor. */
  effects?: readonly AnyEffect[];
}

export interface FrameLoop {
  /**
   * Calcula y entrega los frames del pulso que corresponde a `now` (milisegundos de un reloj
   * monótono; el primer pulso marca el arranque). Si ese pulso ya se calculó, no hace nada.
   */
  tick(now: number): void;
}

/** Lo que el bucle guarda de cada tira: su búfer preasignado, sus salidas y su efecto. */
interface StripSlot {
  frame: Uint8Array;
  outputs: LightOutput[];
  render(ctx: FrameContext, out: Uint8Array): void;
}

function createSlot<P, M>(strip: LoopStrip, effect: Effect<P, M>): StripSlot {
  const params = defaultParams(effect);
  const memory = effect.createMemory(strip.config);
  return {
    frame: new Uint8Array(strip.config.ledCount * 3),
    outputs: strip.outputs,
    render: (ctx, out) => {
      effect.render(ctx, params, memory, out);
    },
  };
}

export function createFrameLoop(
  strips: readonly LoopStrip[],
  fps: number,
  { effects = EFFECTS }: FrameLoopOptions = {},
): FrameLoop {
  // Cada tira arranca con el efecto que declara el fichero (specs/effects). El fichero ya valida el
  // id contra el catálogo, y un test comprueba que el registro tiene los mismos.
  const slots = strips.map((strip) => {
    const effect = effects.find((each) => each.id === strip.config.effect);
    if (!effect) {
      throw new Error(
        `la tira «${strip.config.id}» declara el efecto «${strip.config.effect}», que el motor no tiene`,
      );
    }
    return createSlot(strip, effect);
  });
  // Se reutilizan en cada pulso: dentro del bucle no se crean objetos (README §2.2).
  const tick: Tick = { seq: -1, time: 0 };
  const ctx: FrameContext = { time: 0, dt: 0, audio: null };
  let startedAt: number | undefined;

  return {
    tick(now) {
      startedAt ??= now;
      // El pulso más cercano a `now`: si se llega tarde, se salta a él sin calcular los de en medio.
      const seq = Math.round(((now - startedAt) * fps) / 1000);
      if (seq <= tick.seq) return;

      const time = seq / fps;
      ctx.dt = tick.seq < 0 ? 0 : time - ctx.time;
      ctx.time = time;
      tick.seq = seq;
      tick.time = time;

      for (const slot of slots) {
        slot.render(ctx, slot.frame);
        for (const output of slot.outputs) output.write(slot.frame, tick);
      }
    },
  };
}
