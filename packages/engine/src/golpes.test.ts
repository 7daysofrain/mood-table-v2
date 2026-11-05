/**
 * Los efectos reactivos con el fichero de golpes aislados de los tests (specs/effects, decisión 15
 * del change virtual-strip-audio-file y decisión 4 del change scroll-effect): el bucle real, la
 * fuente de fichero real y el fichero de golpes, con los instantes pasados a mano. Un `describe` por
 * efecto, con el mismo `run()`. Va aquí, en la raíz del motor, porque junta el núcleo y un adaptador.
 *
 * Cada golpe suena unos 80 ms y lo sigue un silencio digital: con *scroll*, la luz avanza unos pocos
 * LEDs y se apaga hasta el golpe siguiente.
 */
import { fileURLToPath } from 'node:url';

import type { EffectId, StripConfig } from '@moodtable/shared';
import { beforeAll, describe, expect, it } from 'vitest';

import { loadAudioFile } from './adapters/audio-file.ts';
import type { AudioSource } from './core/audio/audio-source.ts';
import { createControl } from './core/control.ts';
import { breathing } from './core/effects/breathing.ts';
import { energy } from './core/effects/energy.ts';
import { scroll } from './core/effects/scroll.ts';
import { createFrameLoop, type LightOutput } from './core/frame-loop.ts';

const GOLPES = fileURLToPath(new URL('../test/fixtures/golpes.wav', import.meta.url));

let golpes: AudioSource;

beforeAll(async () => {
  const loaded = await loadAudioFile(GOLPES);
  if (!loaded.ok) throw new Error(loaded.error);
  golpes = loaded.source;
});

function strip(id: string, effect: EffectId, ledCount = 60): StripConfig {
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
  const control = createControl({ strips, effects: [energy, breathing, scroll], hasAudioSource: true });
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
      if (Math.abs(change.at * fps - pulse) > 1e-9) continue;
      control.setEffect(change.stripId, change.effect);
    }
    loop.tick((pulse * 1000) / fps);
  }
  return frames;
}

/**
 * Los frames de referencia: cada uno, en hexadecimal, en los instantes de `instants`. Los mismos para
 * todos los efectos.
 */
const GOLDEN_INSTANTS = [0.5, 1, 1 + 1 / 60, 1.05, 1 + 5 / 60, 1.1, 1.5, 2.05];

function golden(frames: { time: number; colors: Uint8Array }[]): string {
  const hex = (colors: Uint8Array) =>
    Array.from({ length: colors.length / 3 }, (_, led) =>
      Array.from(colors.subarray(led * 3, led * 3 + 3), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join(''),
    ).join(' ');
  const entries = GOLDEN_INSTANTS.map((instant) => {
    const frame = frames.find(({ time }) => Math.abs(time - instant) < 1e-9);
    return [`${instant.toFixed(3)} s`, frame ? hex(frame.colors) : 'sin frame'];
  });
  return `${JSON.stringify(Object.fromEntries(entries), null, 2)}\n`;
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

  it('al pasar de la respiración a energía, a los 2 s se ilumina con cada golpe y se apaga', () => {
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

    await expect(golden(frames)).toMatchFileSnapshot(
      './core/effects/__golden__/energy-60-leds.json',
    );
  });
});

/** Del centro hacia un extremo, el brillo de cada LED: el mayor de sus tres canales. */
function outwards(colors: Uint8Array): number[] {
  const leds = colors.length / 3;
  const center = Math.floor(leds / 2);
  return Array.from({ length: leds - center }, (_, step) =>
    brightest(colors.subarray((center + step) * 3, (center + step + 1) * 3)),
  );
}

/** Hasta dónde llega la luz, en LEDs desde el centro (0 es el centro); -1 si la tira está apagada. */
function reach(colors: Uint8Array): number {
  return outwards(colors).findLastIndex((value) => value > 0);
}

/** Cada LED tiene el mismo color que su simétrico respecto al centro. */
function isMirrored(colors: Uint8Array): boolean {
  const leds = colors.length / 3;
  return Array.from({ length: leds }, (_, led) => led).every((led) =>
    [0, 1, 2].every((offset) => colors[led * 3 + offset] === colors[(leds - 1 - led) * 3 + offset]),
  );
}

describe('scroll con el fichero de golpes', () => {
  it('la luz de cada golpe nace en el centro y se aleja hacia los extremos, igual por los dos lados, apagándose', () => {
    const [frames = []] = run([strip('demo', 'scroll')], 60, 4);

    for (const hit of [1, 2, 3]) {
      const lit = between(frames, hit, hit + 0.1).filter(({ colors }) => !isDark(colors));
      expect(lit.length).toBeGreaterThan(2);
      lit.forEach(({ colors }, index) => {
        expect(isMirrored(colors)).toBe(true);
        expect(outwards(colors)[0]).toBeGreaterThan(0);
        if (index === 0) return;
        const previous = lit[index - 1]?.colors ?? new Uint8Array();
        // Un LED más lejos en cada frame, y lo que va delante, más apagado que en el anterior.
        expect(reach(colors)).toBe(reach(previous) + 1);
        expect(outwards(colors)[reach(colors)]).toBeLessThan(
          outwards(previous)[reach(previous)] ?? 0,
        );
      });
    }
    // El primer golpe entra en una tira apagada: la luz nace solo en el centro.
    const first = frames.find(({ time, colors }) => time >= 1 && !isDark(colors));
    expect(reach(first?.colors ?? new Uint8Array())).toBe(0);
  });

  it('en el silencio entre golpes, la tira se apaga', () => {
    const [frames = []] = run([strip('demo', 'scroll')], 60, 4);

    expect(between(frames, 0, 0.99).every(({ colors }) => isDark(colors))).toBe(true);
    for (const hit of [1, 2, 3]) {
      expect(between(frames, hit + 0.2, hit + 0.95).every(({ colors }) => isDark(colors))).toBe(
        true,
      );
    }
  });

  it('al pasar de energía a scroll, desde el primer frame solo hay luz donde ha llegado desde el centro', () => {
    const at = 1 + 2 / 60;
    const [frames = []] = run([strip('demo', 'energy')], 60, 1.1, [
      { at, stripId: 'demo', effect: 'scroll' },
    ]);
    const before = between(frames, at - 1 / 60, at - 1 / 60)[0]?.colors ?? new Uint8Array();
    const after = between(frames, at, 1.1).filter(({ colors }) => !isDark(colors));

    // Energía estaba encendida lejos del centro…
    expect(reach(before)).toBeGreaterThan(5);
    expect(after.length).toBeGreaterThan(2);
    // …y en el k-ésimo frame de scroll, más allá de k LEDs del centro ninguno pasa de 1.
    after.forEach(({ colors }, frame) => {
      expect(outwards(colors)[0]).toBeGreaterThan(0);
      expect(outwards(colors).slice(frame + 1).every((value) => value <= 1)).toBe(true);
    });
  });

  it('da los frames de referencia en una tira de 60 LEDs a 60 fps', async () => {
    const [frames = []] = run([strip('demo', 'scroll')], 60, 2.1);

    await expect(golden(frames)).toMatchFileSnapshot(
      './core/effects/__golden__/scroll-60-leds.json',
    );
  });
});
