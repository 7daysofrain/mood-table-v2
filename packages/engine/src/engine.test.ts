import type { Config, StripConfig } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryOutput } from './adapters/memory-output.ts';
import { createControl } from './core/control.ts';
import { breathing } from './core/effects/breathing.ts';
import { defaultParams } from './core/effects/effect.ts';
import { sourceMessage, startEngine, startupMessage, stripsMessage } from './engine.ts';

const demoStrip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' as const },
  ledCount: 60,
  effect: 'breathing' as const,
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
    const engine = startEngine({
      config,
      control: createControl({ strips: config.strips, hasAudioSource: false }),
      createOutputs: () => [output],
      clock: Date.now,
    });

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

  it('pide las salidas de cada tira declarada, con su posición en el fichero', () => {
    const second = { ...demoStrip, id: 'segunda', ledCount: 10 };
    const asked: string[] = [];
    const strips = [demoStrip, second];
    const engine = startEngine({
      config: { ...config, strips },
      control: createControl({ strips, hasAudioSource: false }),
      createOutputs: (strip, index) => {
        asked.push(`${index}:${strip.id}`);
        return [];
      },
      clock: Date.now,
    });
    engine.stop();

    expect(asked).toEqual(['0:demo', '1:segunda']);
  });
});

describe('la línea de log del arranque', () => {
  it('dice qué fichero ha cargado, con 1 tira a 60 fps, y dónde se abre el panel', () => {
    expect(startupMessage('config/local.json', config, 'http://127.0.0.1:8080')).toBe(
      'Mood Table: cargado config/local.json · 1 tira a 60 fps · panel en http://127.0.0.1:8080',
    );
  });

  it('con varias tiras y otros fps', () => {
    const twoStrips = { ...config, fps: 30, strips: [demoStrip, { ...demoStrip, id: 'otra' }] };

    expect(startupMessage('config/local.json', twoStrips, 'http://127.0.0.1:8080')).toBe(
      'Mood Table: cargado config/local.json · 2 tiras a 30 fps · panel en http://127.0.0.1:8080',
    );
  });
});

describe('la fuente de audio que se anuncia a los paneles', () => {
  it('de un fichero, da su nombre y nunca la ruta', () => {
    const audioSource = { type: 'file' as const, path: '/srv/mood-table/config/audio/bouncer.wav' };

    expect(sourceMessage({ ...config, audioSource })).toEqual({ kind: 'file', name: 'bouncer.wav' });
  });

  it('de una tarjeta de sonido, da su nombre y nunca la cadena de dispositivo', () => {
    const audioSource = {
      type: 'soundcard' as const,
      name: 'Mixer de la mesa',
      device: 'plughw:CARD=Device,DEV=0',
      silenceThreshold: -60,
    };

    expect(sourceMessage({ ...config, audioSource })).toEqual({
      kind: 'soundcard',
      name: 'Mixer de la mesa',
    });
  });

  it('sin fuente de audio, dice que no hay ninguna', () => {
    expect(sourceMessage(config)).toEqual({ kind: 'none' });
  });
});

describe('las tiras que se anuncian a los paneles', () => {
  const second = { ...demoStrip, id: 'barra', name: 'Barra', ledCount: 30 };
  const twoStrips: Config = { ...config, strips: [demoStrip, second] };

  it('son las del fichero, en su orden, con el efecto activo de cada una en el búfer y sus valores', () => {
    const control = createControl({ strips: twoStrips.strips, hasAudioSource: true });
    control.setEffect('barra', 'energy');

    expect(stripsMessage(twoStrips, control)).toEqual({
      strips: [
        { ...demoStrip, effect: 'breathing', values: { color: '#FFA957', period: 4 } },
        { ...second, effect: 'energy', values: {} },
      ],
    });
  });

  it('llevan los valores con que pinta cada ranura, no los de por defecto', () => {
    const control = createControl({ strips: twoStrips.strips, hasAudioSource: true });
    control.setValues('demo', { color: '#2040FF', period: 7 });

    expect(stripsMessage(twoStrips, control).strips[0]?.values).toEqual({
      color: '#2040FF',
      period: 7,
    });
  });

  it('no llevan el resto de la tira, aunque el fichero gane campos', () => {
    // Lo que H3 y H4 añadan a la tira (orden de color, puerto…) no sale al panel sin decidirlo.
    const withMore = { ...demoStrip, colorOrder: 'GRB' } as StripConfig;
    const control = createControl({ strips: [withMore], hasAudioSource: false });

    const [strip] = stripsMessage({ ...config, strips: [withMore] }, control).strips;

    expect(Object.keys(strip ?? {})).toEqual([
      'id',
      'name',
      'ledCount',
      'output',
      'effect',
      'values',
    ]);
  });
});
