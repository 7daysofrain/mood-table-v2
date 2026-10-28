import type { EffectId, StripConfig } from '@moodtable/shared';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import type { AudioFeatures } from './audio/analysis.ts';
import type { AudioSource } from './audio/audio-source.ts';
import { createControl } from './control.ts';
import { breathing } from './effects/breathing.ts';
import { defaultParams, type Effect } from './effects/effect.ts';
import { energy } from './effects/energy.ts';
import type { AnyEffect } from './effects/registry.ts';
import {
  createFrameLoop,
  type FrameLoopOptions,
  type LevelOutput,
  type LightOutput,
  type LoopStrip,
  type PositionOutput,
  type Tick,
} from './frame-loop.ts';

interface LoopOptions extends FrameLoopOptions {
  /** Los efectos del búfer de control. Por defecto, el registro del motor. */
  effects?: readonly AnyEffect[];
}

/**
 * El bucle con su búfer de control, creado con las mismas tiras, como lo monta la raíz de
 * composición. Devuelve también el búfer, para cambiar el efecto de una tira entre pulsos.
 */
function createLoop(strips: readonly LoopStrip[], fps: number, options: LoopOptions = {}) {
  const { effects, ...loopOptions } = options;
  const control = createControl({
    strips: strips.map((each) => each.config),
    ...(effects ? { effects } : {}),
    hasAudioSource: loopOptions.audioSource !== undefined,
  });
  return { ...createFrameLoop(strips, control, fps, loopOptions), control };
}

function strip(id: string, ledCount: number): StripConfig {
  return { id, name: id, output: { type: 'virtual' }, ledCount, effect: 'breathing' };
}

/** Una salida de prueba que copia lo que recibe (el frame solo vale durante `write`). */
function recorder() {
  const frames: { seq: number; time: number; colors: Uint8Array }[] = [];
  const output: LightOutput = {
    write(frame: Uint8Array, tick: Tick) {
      frames.push({ seq: tick.seq, time: tick.time, colors: frame.slice() });
    },
  };
  return { output, frames };
}

/** Lo que pinta la respiración por defecto en el instante `time` (segundos). */
function breathingAt(time: number, ledCount: number): Uint8Array {
  const out = new Uint8Array(ledCount * 3);
  const memory = breathing.createMemory(strip('referencia', ledCount));
  breathing.render({ time, dt: 0, audio: null }, defaultParams(breathing), memory, out);
  return out;
}

const FRAME_MS = 1000 / 60;

/** Un efecto de prueba, que no está en el catálogo: pinta todos los LEDs de un color fijo. */
const solid: Effect<Record<string, never>, null> = {
  id: 'solid',
  usesAudio: false,
  paramsSchema: Type.Object({}),
  createMemory: () => null,
  render(_ctx, _params, _memory, out) {
    for (let index = 0; index < out.length; index += 3) {
      out[index] = 10;
      out[index + 1] = 20;
      out[index + 2] = 30;
    }
  },
};

/** Una tira con el efecto de prueba: su id no es del catálogo, así que el tipo no lo admite. */
function solidStrip(id: string, ledCount: number): StripConfig {
  return { ...strip(id, ledCount), effect: solid.id as EffectId };
}

describe('el bucle de frames', () => {
  it('a 60 fps, en un segundo de reloj da 60 frames numerados de forma consecutiva', () => {
    const { output, frames } = recorder();
    const loop = createLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    for (let pulse = 0; pulse < 60; pulse++) loop.tick(5000 + pulse * FRAME_MS);

    expect(frames.map((frame) => frame.seq)).toEqual(Array.from({ length: 60 }, (_, seq) => seq));
  });

  it('pinta cada tira con la respiración, en el instante de su pulso', () => {
    const { output, frames } = recorder();
    const loop = createLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    loop.tick(0);
    loop.tick(120 * FRAME_MS);

    expect(frames[1]?.seq).toBe(120);
    expect(frames[1]?.time).toBe(2);
    expect(frames[1]?.colors).toEqual(breathingAt(2, 60));
  });

  it('con dos tiras, cada una da un frame con sus LEDs y los dos llevan el mismo seq', () => {
    const first = recorder();
    const second = recorder();
    const loop = createLoop(
      [
        { config: strip('larga', 60), outputs: [first.output] },
        { config: strip('corta', 30), outputs: [second.output] },
      ],
      60,
    );

    loop.tick(0);
    loop.tick(FRAME_MS);

    expect(first.frames.map((frame) => frame.colors.length)).toEqual([180, 180]);
    expect(second.frames.map((frame) => frame.colors.length)).toEqual([90, 90]);
    expect(first.frames.map((frame) => frame.seq)).toEqual(second.frames.map((frame) => frame.seq));
  });

  it('si un pulso llega cuatro pulsos tarde, salta al seq del instante actual', () => {
    const { output, frames } = recorder();
    const loop = createLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    for (let pulse = 0; pulse <= 10; pulse++) loop.tick(pulse * FRAME_MS);
    loop.tick(14 * FRAME_MS);

    expect(frames.map((frame) => frame.seq).slice(-2)).toEqual([10, 14]);
    expect(frames.at(-1)?.colors).toEqual(breathingAt(14 / 60, 60));
  });

  it('no calcula dos veces el mismo pulso si el temporizador se adelanta', () => {
    const { output, frames } = recorder();
    const loop = createLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    loop.tick(0);
    loop.tick(FRAME_MS / 3);

    expect(frames.map((frame) => frame.seq)).toEqual([0]);
  });

  it('entrega el frame de cada tira a todas sus salidas y a ninguna otra', () => {
    const viewer = recorder();
    const serial = recorder();
    const other = recorder();
    const loop = createLoop(
      [
        { config: strip('mesa', 60), outputs: [viewer.output, serial.output] },
        { config: strip('otra', 10), outputs: [other.output] },
      ],
      60,
    );

    loop.tick(0);

    expect(viewer.frames).toHaveLength(1);
    expect(serial.frames).toEqual(viewer.frames);
    expect(other.frames.map((frame) => frame.colors.length)).toEqual([30]);
  });

  it('anima cada tira con el efecto que declara', () => {
    const breathes = recorder();
    const fixed = recorder();
    const loop = createLoop(
      [
        { config: strip('respira', 60), outputs: [breathes.output] },
        { config: solidStrip('fija', 2), outputs: [fixed.output] },
      ],
      60,
      { effects: [breathing, solid] },
    );

    loop.tick(0);
    loop.tick(120 * FRAME_MS);

    expect(breathes.frames[1]?.colors).toEqual(breathingAt(2, 60));
    expect(fixed.frames[1]?.colors).toEqual(Uint8Array.from([10, 20, 30, 10, 20, 30]));
  });

});

describe('el bucle con el búfer de control', () => {
  it('un cambio de efecto entra entero en el pulso siguiente', () => {
    const changing = recorder();
    const loop = createLoop([{ config: strip('a', 2), outputs: [changing.output] }], 60, {
      effects: [breathing, solid],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);
    loop.control.setEffect('a', solid.id as EffectId);
    loop.tick(2 * FRAME_MS);

    expect(changing.frames[1]?.colors).toEqual(breathingAt(1 / 60, 2));
    expect(changing.frames[2]?.colors).toEqual(Uint8Array.from([10, 20, 30, 10, 20, 30]));
  });

  it('cambiar el efecto de una tira no toca los frames de las demás', () => {
    /** Los frames de B, una tira con energía, con o sin cambiar A a mitad de la ejecución. */
    const framesOfB = (change: boolean) => {
      const other = recorder();
      const loop = createLoop(
        [
          { config: strip('a', 4), outputs: [] },
          { config: { ...strip('b', 4), effect: 'energy' }, outputs: [other.output] },
        ],
        60,
        { effects: [breathing, energy, solid], audioSource: toneSource().source },
      );
      for (let pulse = 0; pulse < 60; pulse++) {
        if (change && pulse === 30) loop.control.setEffect('a', solid.id as EffectId);
        loop.tick(pulse * FRAME_MS);
      }
      return other.frames;
    };

    expect(framesOfB(true)).toEqual(framesOfB(false));
  });

  it('elegir el efecto activo deja los frames como si no se hubiera elegido', () => {
    /** Los frames de una tira con energía, eligiendo energía otra vez a mitad o sin hacerlo. */
    const frames = (choose: boolean) => {
      const reactive = recorder();
      const loop = createLoop(
        [{ config: { ...strip('a', 4), effect: 'energy' }, outputs: [reactive.output] }],
        60,
        { effects: [energy], audioSource: toneSource().source },
      );
      for (let pulse = 0; pulse < 60; pulse++) {
        if (choose && pulse === 30) loop.control.setEffect('a', 'energy');
        loop.tick(pulse * FRAME_MS);
      }
      return reactive.frames;
    };

    expect(frames(true)).toEqual(frames(false));
  });
});

/** Una fuente de prueba: un tono de 1 kHz de amplitud 1 que apunta en qué instantes se lee. */
function toneSource() {
  const reads: number[] = [];
  const source: AudioSource = {
    sampleRate: 44_100,
    read(time, out) {
      reads.push(time);
      const start = time * 44_100 - out.length;
      for (let index = 0; index < out.length; index++) {
        out[index] = Math.sin((2 * Math.PI * 1000 * (start + index)) / 44_100);
      }
    },
  };
  return { source, reads };
}

/** Un efecto de prueba que apunta el `FrameContext.audio` que recibe en cada frame. */
function audioSpy(id: string, usesAudio: boolean) {
  const seen: (AudioFeatures | null)[] = [];
  const effect: Effect<Record<string, never>, null> = {
    id,
    usesAudio,
    paramsSchema: Type.Object({}),
    createMemory: () => null,
    render(ctx) {
      seen.push(ctx.audio);
    },
  };
  return { effect, seen };
}

function spyStrip(id: string, effect: { id: string }): StripConfig {
  return { ...strip(id, 1), effect: effect.id as EffectId };
}

function levelRecorder() {
  const levels: { seq: number; level: number }[] = [];
  const output: LevelOutput = {
    write(level, tick) {
      levels.push({ seq: tick.seq, level });
    },
  };
  return { output, levels };
}

describe('el bucle con fuente de audio', () => {
  it('con solo efectos de ambiente, mide el nivel y calcula las bandas en cada pulso', () => {
    const ambient = audioSpy('ambiente', false);
    const { source, reads } = toneSource();
    const level = levelRecorder();
    const loop = createLoop([{ config: spyStrip('a', ambient.effect), outputs: [] }], 60, {
      effects: [ambient.effect],
      audioSource: source,
      levelOutputs: [level.output],
    });

    for (let pulse = 0; pulse < 3; pulse++) loop.tick(pulse * FRAME_MS);

    expect(reads).toEqual([0, 1 / 60, 2 / 60]);
    expect(level.levels.map(({ level: value }) => value)).toEqual([
      expect.closeTo(Math.SQRT1_2, 2),
      expect.closeTo(Math.SQRT1_2, 2),
      expect.closeTo(Math.SQRT1_2, 2),
    ]);
    // Así una tira puede pasar a un efecto reactivo en cualquier momento (decisión 4 del change
    // strip-effect-switch).
    expect(ambient.seen.map((audio) => audio?.bands.length)).toEqual([24, 24, 24]);
  });

  it('con una tira reactiva, calcula las bandas una vez por pulso y las da a todas las tiras', () => {
    const first = audioSpy('reactivo', true);
    const second = audioSpy('otro-reactivo', true);
    const ambient = audioSpy('ambiente', false);
    const { source, reads } = toneSource();
    const loop = createLoop(
      [
        { config: spyStrip('a', first.effect), outputs: [] },
        { config: spyStrip('b', second.effect), outputs: [] },
        { config: spyStrip('c', ambient.effect), outputs: [] },
      ],
      60,
      { effects: [first.effect, second.effect, ambient.effect], audioSource: source },
    );

    loop.tick(0);
    loop.tick(FRAME_MS);

    // Una lectura por pulso: la misma ventana para todas las tiras.
    expect(reads).toHaveLength(2);
    expect(first.seen[1]?.bands).toHaveLength(24);
    expect(second.seen[1]).toBe(first.seen[1]);
    // Una tira de ambiente recibe los mismos rasgos aunque no los mire.
    expect(ambient.seen[1]).toBe(first.seen[1]);
  });

  it('el nivel llega a sus salidas con el seq de su pulso, también si se saltan pulsos', () => {
    const { source } = toneSource();
    const level = levelRecorder();
    const loop = createLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
      audioSource: source,
      levelOutputs: [level.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);
    loop.tick(5 * FRAME_MS);

    expect(level.levels.map(({ seq }) => seq)).toEqual([0, 1, 5]);
  });

  it('sin fuente de audio, ni nivel ni bandas, aunque la tira sea reactiva', () => {
    const reactive = audioSpy('reactivo', true);
    const level = levelRecorder();
    const loop = createLoop([{ config: spyStrip('a', reactive.effect), outputs: [] }], 60, {
      effects: [reactive.effect],
      levelOutputs: [level.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);

    expect(reactive.seen).toEqual([null, null]);
    expect(level.levels).toEqual([]);
  });
});

/** Una fuente de prueba que sabe en qué punto está: su posición es el instante en un fichero de 4 s. */
function sourceWithPosition(): AudioSource {
  return {
    sampleRate: 44_100,
    read(_time, out) {
      out.fill(0);
    },
    positionAt: (time) => time % 4,
  };
}

function positionRecorder() {
  const positions: { seq: number; position: number }[] = [];
  const output: PositionOutput = {
    write(position, tick) {
      positions.push({ seq: tick.seq, position });
    },
  };
  return { output, positions };
}

describe('el bucle con una fuente que sabe su posición', () => {
  it('entrega en cada pulso la posición del fichero con el seq del pulso', () => {
    const position = positionRecorder();
    const loop = createLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
      audioSource: sourceWithPosition(),
      positionOutputs: [position.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);
    loop.tick(5 * FRAME_MS);

    expect(position.positions).toEqual([
      { seq: 0, position: 0 },
      { seq: 1, position: 1 / 60 },
      { seq: 5, position: 5 / 60 },
    ]);
  });

  it('la posición vuelve a casi 0 cuando el bucle pasa del final del fichero', () => {
    const position = positionRecorder();
    const loop = createLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
      audioSource: sourceWithPosition(),
      positionOutputs: [position.output],
    });

    loop.tick(0);
    loop.tick(239 * FRAME_MS);
    loop.tick(241 * FRAME_MS);

    expect(position.positions.map(({ position: value }) => value)).toEqual([
      0,
      expect.closeTo(239 / 60, 9),
      expect.closeTo(1 / 60, 9),
    ]);
  });

  it('con una fuente que no sabe su posición, no entrega nada', () => {
    const { source } = toneSource();
    const position = positionRecorder();
    const loop = createLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
      audioSource: source,
      positionOutputs: [position.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);

    expect(position.positions).toEqual([]);
  });

  it('sin fuente de audio, no entrega nada', () => {
    const position = positionRecorder();
    const loop = createLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
      positionOutputs: [position.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);

    expect(position.positions).toEqual([]);
  });
});

/**
 * Una fuente de prueba como la tarjeta de sonido: ruido blanco con el nivel `dbfs` y, si se da, su
 * umbral de silencio. El ruido es siempre el mismo (generador congruencial con semilla fija).
 */
function noiseSource(dbfs: number, silenceThreshold?: number): AudioSource {
  // Un ruido uniforme entre -a y a tiene un RMS de a / √3.
  const amplitude = Math.sqrt(3) * 10 ** (dbfs / 20);
  let seed = 1;
  return {
    sampleRate: 48_000,
    ...(silenceThreshold === undefined ? {} : { silenceThreshold }),
    read(_time, out) {
      for (let index = 0; index < out.length; index++) {
        seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31;
        out[index] = amplitude * ((seed / 2 ** 31) * 2 - 1);
      }
    },
  };
}

/** Los frames de una tira de 60 LEDs con *energía* durante dos segundos. */
function energyFrames(source: AudioSource): Uint8Array[] {
  const { output, frames } = recorder();
  const loop = createLoop(
    [{ config: { ...strip('energia', 60), effect: 'energy' }, outputs: [output] }],
    60,
    { effects: [energy], audioSource: source },
  );
  for (let pulse = 0; pulse <= 120; pulse++) loop.tick(pulse * FRAME_MS);
  return frames.map(({ colors }) => colors);
}

const isDark = (colors: Uint8Array): boolean => colors.every((value) => value === 0);

describe('el umbral de silencio de la fuente (specs/effects)', () => {
  it('con un umbral de -60 dBFS, el ruido a -80 es silencio y energía deja la tira a 0', () => {
    expect(energyFrames(noiseSource(-80, -60)).every(isDark)).toBe(true);
  });

  it('con un umbral de -60 dBFS, una señal a -30 no es silencio y la tira reacciona', () => {
    expect(energyFrames(noiseSource(-30, -60)).some((colors) => !isDark(colors))).toBe(true);
  });

  it('sin umbral, el mismo ruido no es silencio: la ganancia automática lo sube hasta verse', () => {
    expect(energyFrames(noiseSource(-80)).some((colors) => !isDark(colors))).toBe(true);
  });
});
