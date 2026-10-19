/**
 * Bucle de frames (specs/frame-loop, README §2.2): en cada pulso calcula el frame de cada tira con
 * su efecto y lo entrega a sus salidas. Es una función pura del instante: no lee el reloj ni
 * programa temporizadores (decisión 7), así que los tests pasan el instante a mano.
 *
 * Con fuente de audio, pide en cada pulso la ventana que acaba en su instante (la fuente es *pull*,
 * D50), mide el nivel y, solo si alguna tira tiene un efecto que usa audio, calcula las bandas, una
 * vez para todas (decisiones 4 y 11 del change virtual-strip-audio-file).
 */
import type { StripConfig } from '@moodtable/shared';

import { createAudioAnalyzer } from './audio/analysis.ts';
import type { AudioSource } from './audio/audio-source.ts';
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

/**
 * Puerto de salida del **nivel de la fuente de audio** (decisión 5 del change
 * virtual-strip-audio-file): un número por pulso, de 0 a 1, con el pulso al que pertenece. Síncrono
 * y sin bloquear, como `LightOutput`.
 */
export interface LevelOutput {
  write(level: number, tick: Tick): void;
}

/**
 * Puerto de salida de la **posición del fichero de audio** (decisión 9 del change
 * panel-audio-playback): en cada pulso, el punto del fichero en segundos con el pulso al que
 * pertenece. Síncrono y sin bloquear, como `LevelOutput`.
 */
export interface PositionOutput {
  write(position: number, tick: Tick): void;
}

export interface FrameLoopOptions {
  /** Los efectos entre los que elige cada tira. Por defecto, el registro del motor. */
  effects?: readonly AnyEffect[];
  /** La fuente de audio, si el instrumento tiene. Sin ella, ni nivel ni análisis. */
  audioSource?: AudioSource;
  /** Quién recibe el nivel de la fuente en cada pulso: el visor, los tests… */
  levelOutputs?: readonly LevelOutput[];
  /** Quién recibe la posición del fichero en cada pulso, si la fuente la sabe. */
  positionOutputs?: readonly PositionOutput[];
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
  /** Su efecto es reactivo: hace falta analizar el audio. */
  usesAudio: boolean;
  render(ctx: FrameContext, out: Uint8Array): void;
}

function createSlot<P, M>(strip: LoopStrip, effect: Effect<P, M>): StripSlot {
  const params = defaultParams(effect);
  const memory = effect.createMemory(strip.config);
  return {
    frame: new Uint8Array(strip.config.ledCount * 3),
    outputs: strip.outputs,
    usesAudio: effect.usesAudio,
    render: (ctx, out) => {
      effect.render(ctx, params, memory, out);
    },
  };
}

export function createFrameLoop(
  strips: readonly LoopStrip[],
  fps: number,
  { effects = EFFECTS, audioSource, levelOutputs = [] }: FrameLoopOptions = {},
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
  // El nivel se mide siempre que hay fuente; las bandas, solo si alguna tira las usa (decisión 4).
  const analyzer = audioSource && createAudioAnalyzer(audioSource.sampleRate);
  const needsBands = slots.some((slot) => slot.usesAudio);
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

      if (audioSource && analyzer) {
        audioSource.read(time, analyzer.window);
        const level = analyzer.level();
        ctx.audio = needsBands ? analyzer.update(ctx.dt) : null;
        for (const output of levelOutputs) output.write(level, tick);
      }

      for (const slot of slots) {
        slot.render(ctx, slot.frame);
        for (const output of slot.outputs) output.write(slot.frame, tick);
      }
    },
  };
}
