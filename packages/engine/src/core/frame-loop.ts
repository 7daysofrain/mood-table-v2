/**
 * Bucle de frames (specs/frame-loop, README §2.2): en cada pulso calcula el frame de cada tira con
 * su efecto y lo entrega a sus salidas. Es una función pura del instante: no lee el reloj ni
 * programa temporizadores (decisión 7), así que los tests pasan el instante a mano.
 *
 * El efecto de cada tira lo lee del búfer de control al empezar cada pulso (decisión 1 del change
 * strip-effect-switch): no sabe qué mando lo ha cambiado, ni crea la ranura.
 *
 * Con fuente de audio, pide en cada pulso la ventana que acaba en su instante (la fuente es *pull*,
 * D50), mide el nivel y calcula las bandas, una vez para todas las tiras (decisión 11 del change
 * virtual-strip-audio-file), aunque ninguna tenga un efecto reactivo: así una tira puede pasar a
 * uno en cualquier momento (decisión 4 del change strip-effect-switch). Si la fuente sabe en qué
 * punto está, entrega esa posición en cada pulso (decisión 9 del change panel-audio-playback).
 */
import type { StripConfig } from '@moodtable/shared';

import { type AudioAnalyzer, createAudioAnalyzer } from './audio/analysis.ts';
import type { AudioSource } from './audio/audio-source.ts';
import type { ControlBuffer } from './control.ts';
import type { FrameContext } from './effects/effect.ts';

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

/** Lo que el bucle guarda de cada tira: su búfer preasignado y sus salidas. */
interface StripFrame {
  frame: Uint8Array;
  outputs: LightOutput[];
}

/** Lo que el bucle necesita para escuchar la fuente de audio en cada pulso. */
interface Listener {
  source: AudioSource;
  analyzer: AudioAnalyzer;
  levelOutputs: readonly LevelOutput[];
  positionOutputs: readonly PositionOutput[];
}

/**
 * Lee la ventana del pulso, mide el nivel, deja en `ctx.audio` las bandas y entrega el nivel y, si
 * la fuente la sabe, la posición del fichero. No crea objetos.
 */
function listen(
  { source, analyzer, levelOutputs, positionOutputs }: Listener,
  tick: Tick,
  ctx: FrameContext,
): void {
  source.read(tick.time, analyzer.window);
  const level = analyzer.level();
  ctx.audio = analyzer.update(ctx.dt);
  for (const output of levelOutputs) output.write(level, tick);
  if (!source.positionAt) return;
  const position = source.positionAt(tick.time);
  for (const output of positionOutputs) output.write(position, tick);
}

/**
 * `strips` son las tiras del fichero, en su orden: la posición de cada una es la de su ranura en
 * `control`, que se crea con las mismas tiras.
 */
export function createFrameLoop(
  strips: readonly LoopStrip[],
  control: ControlBuffer,
  fps: number,
  { audioSource, levelOutputs = [], positionOutputs = [] }: FrameLoopOptions = {},
): FrameLoop {
  const frames: StripFrame[] = strips.map((strip) => ({
    frame: new Uint8Array(strip.config.ledCount * 3),
    outputs: strip.outputs,
  }));
  // Sin fuente, ni nivel ni bandas: `ctx.audio` se queda en `null`.
  const listener: Listener | undefined = audioSource && {
    source: audioSource,
    analyzer: createAudioAnalyzer(audioSource.sampleRate, audioSource.silenceThreshold),
    levelOutputs,
    positionOutputs,
  };
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

      if (listener) listen(listener, tick, ctx);

      // La ranura que hay al empezar el pulso: un cambio posterior entra en el siguiente.
      let index = 0;
      for (const { frame, outputs } of frames) {
        control.slot(index++).render(ctx, frame);
        for (const output of outputs) output.write(frame, tick);
      }
    },
  };
}
