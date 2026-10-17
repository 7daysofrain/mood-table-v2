import type { EffectId, StripConfig } from '@moodtable/shared';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import { breathing } from './effects/breathing.ts';
import { defaultParams, type Effect } from './effects/effect.ts';
import { createFrameLoop, type LightOutput, type Tick } from './frame-loop.ts';

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
