import { chipOf, type Config, type StripConfig } from '@moodtable/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MemoryOutput } from './adapters/memory-output.ts';
import { createControl } from './core/control.ts';
import { breathing } from './core/effects/breathing.ts';
import { defaultParams } from './core/effects/effect.ts';
import { estimateAmps } from './core/power-limit.ts';
import {
  powerLimitMessage,
  powerLimitMessages,
  sourceMessage,
  startEngine,
  startupMessage,
  stripOutputs,
  stripPowerLimit,
  stripsMessage,
} from './engine.ts';

const demoStrip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' as const },
  ledCount: 60,
  effect: 'breathing' as const,
};

const config: Config = {
  fps: 60,
  server: { host: '127.0.0.1', port: 8080 },
  instrumentState: { type: 'memory' },
  strips: [demoStrip],
};

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

describe('las salidas de cada tira', () => {
  const table: StripConfig = {
    ...demoStrip,
    id: 'mesa',
    output: {
      type: 'adalight',
      port: '/dev/ttyUSB0',
      baudRate: 115200,
      chip: 'WS2812B',
      power: { supplyAmps: 8 },
    },
  };

  /** Arranca el motor con `strips` durante un segundo y devuelve lo que ha recibido cada salida. */
  function runWith(
    strips: StripConfig[],
    physical: Map<string, MemoryOutput>,
  ): { viewers: MemoryOutput[] } {
    const viewers = strips.map(() => new MemoryOutput());
    const engine = startEngine({
      config: { ...config, strips },
      control: createControl({ strips, hasAudioSource: false }),
      createOutputs: stripOutputs((index) => viewers[index] ?? new MemoryOutput(), physical),
      clock: Date.now,
    });
    vi.advanceTimersByTime(1000);
    engine.stop();
    return { viewers };
  }

  it('una tira física tiene el visor y su salida Adalight, que reciben el mismo frame', () => {
    const adalight = new MemoryOutput();

    const { viewers } = runWith([table], new Map([['mesa', adalight]]));

    expect(adalight.frames).toHaveLength(61);
    expect(adalight.frames).toEqual(viewers[0]?.frames);
  });

  it('una tira virtual solo tiene el visor', () => {
    const outputs = stripOutputs(() => new MemoryOutput(), new Map([['mesa', new MemoryOutput()]]));

    expect(outputs(demoStrip, 0)).toHaveLength(1);
    expect(outputs(table, 1)).toHaveLength(2);
  });

  it('una tira física tiene el límite de su fuente; una virtual, ninguno', () => {
    expect(stripPowerLimit(table)).toMatchObject({ maxAmps: 6.4, floorAlwaysHolds: true });
    expect(stripPowerLimit(demoStrip)).toBeUndefined();
  });

  it('el bucle aplica el límite de la tira física: con 0,06 A, ningún frame pasa de la fuente', () => {
    const tiny: StripConfig = {
      ...table,
      output: {
        type: 'adalight',
        port: '/dev/ttyUSB0',
        baudRate: 115200,
        chip: 'WS2812B',
        power: { supplyAmps: 0.06 },
      },
    };
    const adalight = new MemoryOutput();

    const { viewers } = runWith([tiny, demoStrip], new Map([['mesa', adalight]]));

    const amps = (frames: MemoryOutput['frames']) =>
      Math.max(...frames.map(({ colors }) => estimateAmps(colors, chipOf('WS2812B'))));
    // La misma respiración sin límite, en la tira virtual, pide más de lo que da la fuente.
    expect(amps(viewers[1]?.frames ?? [])).toBeGreaterThan(0.06);
    expect(amps(adalight.frames)).toBeLessThanOrEqual(0.06);
    expect(adalight.frames).toEqual(viewers[0]?.frames);
  });

  it('la salida Adalight recibe el frame de cada pulso aunque no haya ningún panel', () => {
    // Sin paneles, el visor no envía nada: un visor que no hace nada con lo que recibe.
    const adalight = new MemoryOutput();
    const strips = [demoStrip, table];
    const engine = startEngine({
      config: { ...config, strips },
      control: createControl({ strips, hasAudioSource: false }),
      createOutputs: stripOutputs(() => ({ write: () => undefined }), new Map([['mesa', adalight]])),
      clock: Date.now,
    });

    vi.advanceTimersByTime(1000);
    engine.stop();

    expect(adalight.frames.map((frame) => frame.seq)).toEqual(
      Array.from({ length: 61 }, (_, seq) => seq),
    );
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

// specs/power-limit, *El log dice al arrancar el límite de cada tira física*; decisión 4.
describe('la línea del límite de potencia de cada tira física', () => {
  /** La tira de la mesa, 173 LEDs `WS2812B`, con una fuente de `supplyAmps` amperios. */
  function mesa(supplyAmps: number): StripConfig {
    return {
      id: 'mesa',
      name: 'Mesa',
      output: {
        type: 'adalight',
        port: '/dev/ttyUSB0',
        baudRate: 500000,
        chip: 'WS2812B',
        power: { supplyAmps },
      },
      ledCount: 173,
      effect: 'energy',
    };
  }

  it('con 8 A, dice la fuente, los 6,4 A, los 10,38 A en blanco total y que bajará frames', () => {
    expect(powerLimitMessage(mesa(8))).toBe(
      'Tira «Mesa»: fuente de 8 A, usará como mucho 6,4 A; en blanco total pide 10,38 A: ' +
        'bajará los frames que se pasen',
    );
  });

  it('con 18 A, dice los 14,4 A y que nunca bajará frames', () => {
    expect(powerLimitMessage(mesa(18))).toBe(
      'Tira «Mesa»: fuente de 18 A, usará como mucho 14,4 A; en blanco total pide 10,38 A: ' +
        'nunca bajará frames',
    );
  });

  it('con una fuente que no aguanta el suelo, dice que los LEDs tenues pueden apagarse', () => {
    expect(powerLimitMessage(mesa(0.06))).toBe(
      'Tira «Mesa»: fuente de 0,06 A, usará como mucho 0,048 A; en blanco total pide 10,38 A: ' +
        'bajará los frames que se pasen, y la fuente es tan pequeña que los LEDs tenues pueden ' +
        'apagarse',
    );
  });

  it('con 0,2 A, todavía avisa de los LEDs tenues; con 0,21 A, ya no', () => {
    expect(powerLimitMessage(mesa(0.2))).toBe(
      'Tira «Mesa»: fuente de 0,2 A, usará como mucho 0,16 A; en blanco total pide 10,38 A: ' +
        'bajará los frames que se pasen, y la fuente es tan pequeña que los LEDs tenues pueden ' +
        'apagarse',
    );
    expect(powerLimitMessage(mesa(0.21))).toBe(
      'Tira «Mesa»: fuente de 0,21 A, usará como mucho 0,168 A; en blanco total pide 10,38 A: ' +
        'bajará los frames que se pasen',
    );
  });

  it('una tira virtual no tiene línea', () => {
    expect(powerLimitMessage(demoStrip)).toBeUndefined();
  });

  it('del fichero, salen solo las de las tiras físicas, en su orden', () => {
    const strips = [mesa(8), demoStrip, { ...mesa(18), name: 'Barra' }];

    expect(powerLimitMessages({ ...config, strips })).toEqual([
      powerLimitMessage(mesa(8)),
      powerLimitMessage({ ...mesa(18), name: 'Barra' }),
    ]);
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

  it('de una salida Adalight, llevan el tipo y el puerto serie, pero no los baudios, el chip ni la fuente', () => {
    const table: StripConfig = {
      ...demoStrip,
      id: 'mesa',
      output: {
      type: 'adalight',
      port: '/dev/ttyUSB0',
      baudRate: 115200,
      chip: 'WS2812B',
      power: { supplyAmps: 8 },
    },
    };
    const control = createControl({ strips: [table], hasAudioSource: false });

    const [strip] = stripsMessage({ ...config, strips: [table] }, control).strips;

    expect(strip?.output).toEqual({ type: 'adalight', port: '/dev/ttyUSB0' });
  });

  it('no llevan el resto de la tira, aunque el fichero gane campos', () => {
    // Un campo que gane la tira en el fichero no sale al panel sin decidirlo.
    const withMore = { ...demoStrip, newField: 'nuevo' } as StripConfig;
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
