import type { Config } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryOutput } from './adapters/memory-output.ts';
import { breathing } from './core/effects/breathing.ts';
import { defaultParams } from './core/effects/effect.ts';
import { startEngine, startupMessage } from './engine.ts';

const demoStrip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' as const },
  ledCount: 60,
};

const config: Config = { fps: 60, server: { host: '127.0.0.1', port: 8080 }, strips: [demoStrip] };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('el motor en marcha', () => {
  it('con una tira y una salida en memoria, le llegan frames de respiración', () => {
    const output = new MemoryOutput();
    const engine = startEngine({ config, createOutputs: () => [output], clock: Date.now });

    vi.advanceTimersByTime(1000);
    engine.stop();

    expect(output.frames.map((frame) => frame.seq)).toEqual(
      Array.from({ length: 61 }, (_, seq) => seq),
    );
    for (const frame of [output.frames[0], output.frames[30], output.frames[60]]) {
      const expected = new Uint8Array(demoStrip.ledCount * 3);
      breathing.render(
        { time: (frame?.seq ?? 0) / 60, dt: 0, audio: null },
        defaultParams(breathing),
        breathing.createMemory(demoStrip),
        expected,
      );
      expect(frame?.colors).toEqual(expected);
    }
  });

  it('pide las salidas de cada tira declarada', () => {
    const second = { ...demoStrip, id: 'segunda', ledCount: 10 };
    const asked: string[] = [];
    const engine = startEngine({
      config: { ...config, strips: [demoStrip, second] },
      createOutputs: (strip) => {
        asked.push(strip.id);
        return [];
      },
      clock: Date.now,
    });
    engine.stop();

    expect(asked).toEqual(['demo', 'segunda']);
  });
});

describe('la línea de log del arranque', () => {
  it('dice qué fichero ha cargado, con 1 tira a 60 fps', () => {
    expect(startupMessage('config/local.json', config)).toBe(
      'Mood Table: cargado config/local.json · 1 tira a 60 fps',
    );
  });

  it('con varias tiras y otros fps', () => {
    const twoStrips = { ...config, fps: 30, strips: [demoStrip, { ...demoStrip, id: 'otra' }] };

    expect(startupMessage('config/local.json', twoStrips)).toBe(
      'Mood Table: cargado config/local.json · 2 tiras a 30 fps',
    );
  });
});
