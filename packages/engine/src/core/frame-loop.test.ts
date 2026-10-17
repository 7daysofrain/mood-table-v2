import type { EffectId, StripConfig } from '@moodtable/shared';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import type { AudioFeatures } from './audio/analysis.ts';
import type { AudioSource } from './audio/audio-source.ts';
import { breathing } from './effects/breathing.ts';
import { defaultParams, type Effect } from './effects/effect.ts';
import { createFrameLoop, type LevelOutput, type LightOutput, type Tick } from './frame-loop.ts';

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
    const loop = createFrameLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    for (let pulse = 0; pulse < 60; pulse++) loop.tick(5000 + pulse * FRAME_MS);

    expect(frames.map((frame) => frame.seq)).toEqual(Array.from({ length: 60 }, (_, seq) => seq));
  });

  it('pinta cada tira con la respiración, en el instante de su pulso', () => {
    const { output, frames } = recorder();
    const loop = createFrameLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    loop.tick(0);
    loop.tick(120 * FRAME_MS);

    expect(frames[1]?.seq).toBe(120);
    expect(frames[1]?.time).toBe(2);
    expect(frames[1]?.colors).toEqual(breathingAt(2, 60));
  });

  it('con dos tiras, cada una da un frame con sus LEDs y los dos llevan el mismo seq', () => {
    const first = recorder();
    const second = recorder();
    const loop = createFrameLoop(
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
    const loop = createFrameLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    for (let pulse = 0; pulse <= 10; pulse++) loop.tick(pulse * FRAME_MS);
    loop.tick(14 * FRAME_MS);

    expect(frames.map((frame) => frame.seq).slice(-2)).toEqual([10, 14]);
    expect(frames.at(-1)?.colors).toEqual(breathingAt(14 / 60, 60));
  });

  it('no calcula dos veces el mismo pulso si el temporizador se adelanta', () => {
    const { output, frames } = recorder();
    const loop = createFrameLoop([{ config: strip('demo', 60), outputs: [output] }], 60);

    loop.tick(0);
    loop.tick(FRAME_MS / 3);

    expect(frames.map((frame) => frame.seq)).toEqual([0]);
  });

  it('entrega el frame de cada tira a todas sus salidas y a ninguna otra', () => {
    const viewer = recorder();
    const serial = recorder();
    const other = recorder();
    const loop = createFrameLoop(
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
    const loop = createFrameLoop(
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

  it('con un efecto que no está en el registro, no se crea y dice cuál es', () => {
    expect(() =>
      createFrameLoop([{ config: solidStrip('fija', 2), outputs: [] }], 60, {
        effects: [breathing],
      }),
    ).toThrow('la tira «fija» declara el efecto «solid», que el motor no tiene');
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
  it('con solo la respiración, mide el nivel en cada pulso pero no calcula las bandas', () => {
    const ambient = audioSpy('ambiente', false);
    const { source, reads } = toneSource();
    const level = levelRecorder();
    const loop = createFrameLoop([{ config: spyStrip('a', ambient.effect), outputs: [] }], 60, {
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
    expect(ambient.seen).toEqual([null, null, null]);
  });

  it('con una tira reactiva, calcula las bandas una vez por pulso y las da a todas las tiras', () => {
    const first = audioSpy('reactivo', true);
    const second = audioSpy('otro-reactivo', true);
    const ambient = audioSpy('ambiente', false);
    const { source, reads } = toneSource();
    const loop = createFrameLoop(
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
    const loop = createFrameLoop([{ config: strip('demo', 1), outputs: [] }], 60, {
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
    const loop = createFrameLoop([{ config: spyStrip('a', reactive.effect), outputs: [] }], 60, {
      effects: [reactive.effect],
      levelOutputs: [level.output],
    });

    loop.tick(0);
    loop.tick(FRAME_MS);

    expect(reactive.seen).toEqual([null, null]);
    expect(level.levels).toEqual([]);
  });
});
