/**
 * *Energía* con el fichero de golpes aislados de los tests (specs/effects, decisión 15 del change
 * virtual-strip-audio-file): el bucle real, la fuente de fichero real y el fichero de golpes, con
 * los instantes pasados a mano. Va aquí, en la raíz del motor, porque junta el núcleo y un
 * adaptador.
 */
import { fileURLToPath } from 'node:url';

import type { EffectId, StripConfig } from '@moodtable/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadAudioFile } from './adapters/audio-file.ts';
import type { AudioSource } from './core/audio/audio-source.ts';
import { createControl } from './core/control.ts';
import { breathing } from './core/effects/breathing.ts';
import { energy } from './core/effects/energy.ts';
import { createFrameLoop, type LightOutput } from './core/frame-loop.ts';

const GOLPES = fileURLToPath(new URL('../test/fixtures/golpes.wav', import.meta.url));

let golpes: AudioSource;

beforeAll(async () => {
  const loaded = await loadAudioFile(GOLPES);
  if (!loaded.ok) throw new Error(loaded.error);
  golpes = loaded.source;
});

function strip(id: string, effect: 'energy' | 'breathing', ledCount = 60): StripConfig {
  return { id, name: id, output: { type: 'virtual' }, ledCount, effect };
}

/** Un cambio de efecto que hace el DJ en el instante `at` (segundos). */
interface Change {
  at: number;
  stripId: string;
  effect: EffectId;
}

/** Los frames de cada tira desde el arranque hasta `seconds`, con su instante. */
function run(strips: StripConfig[], fps: number, seconds: number, changes: Change[] = []) {
  const frames = strips.map(() => [] as { time: number; colors: Uint8Array }[]);
  const control = createControl({ strips, effects: [energy, breathing], hasAudioSource: true });
  const loop = createFrameLoop(
    strips.map((config, index) => {
      const output: LightOutput = {
        write(frame, tick) {
          frames[index]?.push({ time: tick.time, colors: frame.slice() });
        },
      };
      return { config, outputs: [output] };
    }),
    control,
    fps,
    { audioSource: golpes },
  );
  for (let pulse = 0; pulse <= seconds * fps; pulse++) {
    for (const change of changes) {
      if (Math.abs(change.at * fps - pulse) < 1e-9) control.setEffect(change.stripId, change.effect);
    }
    loop.tick((pulse * 1000) / fps);
  }
  return frames;
}

function brightest(colors: Uint8Array): number {
  return Math.max(...colors);
}

function isDark(colors: Uint8Array): boolean {
  return colors.every((value) => value === 0);
}

/** Los frames entre dos instantes, ambos incluidos. */
function between(frames: { time: number; colors: Uint8Array }[], from: number, to: number) {
  return frames.filter(({ time }) => time >= from - 1e-9 && time <= to + 1e-9);
}

describe('energía con el fichero de golpes', () => {
  it('está apagada hasta el primer golpe, se ilumina con cada uno y se apaga antes del siguiente', () => {
    const [frames = []] = run([strip('demo', 'energy')], 60, 4);

    expect(between(frames, 0, 0.99).every(({ colors }) => isDark(colors))).toBe(true);
    for (const hit of [1, 2, 3]) {
      const during = between(frames, hit, hit + 0.1).map(({ colors }) => brightest(colors));
      expect(Math.max(...during)).toBeGreaterThan(100);
      expect(between(frames, hit + 0.5, hit + 0.99).every(({ colors }) => isDark(colors))).toBe(
        true,
      );
    }
  });

  it('al acabarse el fichero, vuelve a empezar y la tira sigue reaccionando', () => {
    const [frames = []] = run([strip('demo', 'energy')], 60, 5.2);
    const after = between(frames, 5, 5.1).map(({ colors }) => brightest(colors));

    expect(Math.max(...after)).toBeGreaterThan(100);
  });

  it('tras un golpe, a 30 y a 60 fps se apaga en el mismo instante, con un pulso de 30 fps de margen', () => {
    const darkAgain = (fps: number) => {
      const [frames = []] = run([strip('demo', 'energy')], fps, 1.9);
      const lit = frames.findIndex(({ time, colors }) => time >= 1 && !isDark(colors));
      return frames.slice(lit).find(({ colors }) => isDark(colors))?.time ?? Number.NaN;
    };

    expect(Math.abs(darkAgain(30) - darkAgain(60))).toBeLessThanOrEqual(1 / 30 + 1e-9);
  });

  it('en silencio, la tira con energía se apaga y la de la respiración sigue animándose', () => {
    const [reactive = [], ambient = []] = run(
      [strip('energia', 'energy'), strip('respira', 'breathing')],
      60,
      1.7,
    );
    const silent = between(reactive, 1.5, 1.7);
    const breathingFrames = between(ambient, 1.5, 1.7);

    expect(silent.every(({ colors }) => isDark(colors))).toBe(true);
    expect(breathingFrames.every(({ colors }) => !isDark(colors))).toBe(true);
    expect(breathingFrames.at(0)?.colors).not.toEqual(breathingFrames.at(-1)?.colors);
  });

  it('una tira que pasa de la respiración a energía, pasados 2 s, se ilumina con cada golpe y se apaga en el silencio', () => {
    const [frames = []] = run([strip('demo', 'breathing')], 60, 6, [
      { at: 0.5, stripId: 'demo', effect: 'energy' },
    ]);

    // 2 s después del cambio. El fichero dura 4 s y vuelve a empezar: el segundo 5 es su golpe 1.
    for (const hit of [3, 5]) {
      const during = between(frames, hit, hit + 0.1).map(({ colors }) => brightest(colors));
      expect(Math.max(...during)).toBeGreaterThan(100);
      expect(between(frames, hit + 0.5, hit + 0.99).every(({ colors }) => isDark(colors))).toBe(
        true,
      );
    }
  });

  it('da los frames de referencia en una tira de 60 LEDs a 60 fps', async () => {
    const [frames = []] = run([strip('demo', 'energy')], 60, 2.1);
    const instants = [0.5, 1, 1 + 1 / 60, 1.05, 1 + 5 / 60, 1.1, 1.5, 2.05];
    const hex = (colors: Uint8Array) =>
      Array.from({ length: colors.length / 3 }, (_, led) =>
        Array.from(colors.subarray(led * 3, led * 3 + 3), (byte) =>
          byte.toString(16).padStart(2, '0'),
        ).join(''),
      ).join(' ');
    const golden = Object.fromEntries(
      instants.map((instant) => {
        const frame = frames.find(({ time }) => Math.abs(time - instant) < 1e-9);
        return [`${instant.toFixed(3)} s`, frame ? hex(frame.colors) : 'sin frame'];
      }),
    );

    await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot(
      './core/effects/__golden__/energy-60-leds.json',
    );
  });
});
