import { describe, expect, it } from 'vitest';

import { parseConfig } from './config.ts';

/** Una tira virtual mínima, como la de `config/demo.json` (specs/engine-config). */
const demoStrip = {
  id: 'demo',
  name: 'Tira de prueba',
  output: { type: 'virtual' },
  ledCount: 60,
  effect: 'breathing',
};

/** Sin `instrumentState`, el estado se guarda en SQLite en `data/` (specs/engine-config). */
const DEFAULT_INSTRUMENT_STATE = { type: 'sqlite', path: 'data/instrument-state.db' };

function text(value: unknown): string {
  return JSON.stringify(value);
}

/** La tira mínima sin uno de sus campos. */
function demoStripWithout(field: keyof typeof demoStrip): Record<string, unknown> {
  const strip: Record<string, unknown> = { ...demoStrip };
  delete strip[field];
  return strip;
}

function errorOf(source: string): string {
  const result = parseConfig(source);
  if (result.ok) throw new Error('Se esperaba un error y la configuración es válida');
  return result.error;
}

describe('un fichero de configuración válido', () => {
  it('acepta una tira virtual mínima', () => {
    const result = parseConfig(text({ strips: [demoStrip] }));

    expect(result).toEqual({
      ok: true,
      config: {
        fps: 60,
        server: { host: '127.0.0.1', port: 8080 },
        instrumentState: DEFAULT_INSTRUMENT_STATE,
        strips: [demoStrip],
      },
    });
  });

  it('usa 60 fps y 127.0.0.1:8080 si no los declara', () => {
    const result = parseConfig(text({ strips: [demoStrip] }));

    expect(result.ok && result.config.fps).toBe(60);
    expect(result.ok && result.config.server).toEqual({ host: '127.0.0.1', port: 8080 });
  });

  it('usa los fps y la dirección que declara', () => {
    const result = parseConfig(
      text({ fps: 30, server: { host: '0.0.0.0', port: 9090 }, strips: [demoStrip] }),
    );

    expect(result.ok && result.config.fps).toBe(30);
    expect(result.ok && result.config.server).toEqual({ host: '0.0.0.0', port: 9090 });
  });

  it('acepta un fichero guardado con BOM', () => {
    expect(parseConfig(`\uFEFF${text({ strips: [demoStrip] })}`).ok).toBe(true);
  });

  it('acepta varias tiras, en el orden del fichero', () => {
    const second = { ...demoStrip, id: 'segunda', name: 'Segunda', ledCount: 30 };
    const result = parseConfig(text({ strips: [demoStrip, second] }));

    expect(result.ok && result.config.strips.map((strip) => strip.id)).toEqual(['demo', 'segunda']);
  });
});

describe('un fichero de configuración que no sirve', () => {
  it('sin strips, dice que no declara ninguna tira', () => {
    expect(errorOf(text({ fps: 60 }))).toMatch(/no declara ninguna tira/);
  });

  it('con strips vacía, dice que no declara ninguna tira', () => {
    expect(errorOf(text({ strips: [] }))).toMatch(/no declara ninguna tira/);
  });

  it('con el JSON mal escrito, dice que no es JSON válido y en qué punto falla', () => {
    const error = errorOf('{ "strips": [ }');

    expect(error).toMatch(/no es JSON válido/);
    expect(error).toMatch(/línea 1, columna 15/);
  });

  it('con un anidamiento tan profundo que no se puede localizar el error, dice que no es JSON', () => {
    expect(errorOf('['.repeat(100_000))).toBe('no es JSON válido');
  });

  it('con una tira que no es un objeto, la nombra y dice qué esperaba', () => {
    expect(errorOf(text({ strips: [demoStrip, null] }))).toBe(
      'la tira 2, la entrada: debe ser un objeto',
    );
  });

  it('que no es un objeto, dice qué esperaba', () => {
    expect(errorOf(text([demoStrip]))).toMatch(/objeto/);
  });

  it('con ledCount 0, nombra la tira y el campo', () => {
    const error = errorOf(text({ strips: [{ ...demoStrip, ledCount: 0 }] }));

    expect(error).toMatch(/«demo»/);
    expect(error).toMatch(/`ledCount`/);
  });

  it('con una salida de un tipo que no existe, nombra la tira y el campo y dice cuáles hay', () => {
    expect(errorOf(text({ strips: [{ ...demoStrip, output: { type: 'dmx' } }] }))).toBe(
      'la tira «demo», campo `output.type`: «dmx» no es un valor válido (se admite «virtual» o «adalight»)',
    );
  });

  it('con un campo obligatorio que falta, nombra la tira y el campo', () => {
    const error = errorOf(text({ strips: [demoStripWithout('ledCount')] }));

    expect(error).toMatch(/«demo»/);
    expect(error).toMatch(/`ledCount`/);
  });

  it('con una tira sin id, la nombra por su posición', () => {
    expect(errorOf(text({ strips: [demoStrip, demoStripWithout('id')] }))).toMatch(/tira 2/);
  });

  it('con un id repetido, dice qué id está repetido', () => {
    const error = errorOf(text({ strips: [demoStrip, { ...demoStrip, name: 'Otra' }] }));

    expect(error).toMatch(/«demo»/);
    expect(error).toMatch(/repetido/);
  });

  it.each([
    [{ fsp: 30, strips: [demoStrip] }, 'campo `fsp`: no existe (¿está bien escrito?)'],
    [
      { server: { host: '0.0.0.0', prot: 9090 }, strips: [demoStrip] },
      'campo `server.prot`: no existe (¿está bien escrito?)',
    ],
    [
      { strips: [{ ...demoStrip, colour: 'rojo' }] },
      'la tira «demo», campo `colour`: no existe (¿está bien escrito?)',
    ],
    [
      { strips: [{ ...demoStrip, output: { type: 'virtual', port: '/dev/ttyUSB0' } }] },
      'la tira «demo», campo `output.port`: no existe (¿está bien escrito?)',
    ],
  ])('con un campo que no existe (%j), lo nombra', (config, message) => {
    expect(errorOf(text(config))).toBe(message);
  });

  it('con un campo obligatorio mal escrito, nombra el que no existe', () => {
    const { ledCount, ...rest } = demoStrip;

    expect(errorOf(text({ strips: [{ ...rest, ledcont: ledCount }] }))).toBe(
      'la tira «demo», campo `ledcont`: no existe (¿está bien escrito?)',
    );
  });

  it('con más de 256 tiras, dice cuántas admite como mucho', () => {
    const strips = Array.from({ length: 257 }, (_, index) => ({ ...demoStrip, id: `tira-${index}` }));

    expect(errorOf(text({ strips }))).toBe('campo `strips`: admite como mucho 256 tiras');
  });

  it('con 256 tiras, arranca', () => {
    const strips = Array.from({ length: 256 }, (_, index) => ({ ...demoStrip, id: `tira-${index}` }));

    expect(parseConfig(text({ strips })).ok).toBe(true);
  });

  it('con fps por encima de 60, dice que debe ser 60 o menos', () => {
    expect(errorOf(text({ fps: 120, strips: [demoStrip] }))).toBe(
      'campo `fps`: debe ser 60 o menos',
    );
  });

  it('con fps 0, nombra el campo', () => {
    expect(errorOf(text({ fps: 0, strips: [demoStrip] }))).toMatch(/`fps`/);
  });

  it.each([
    [{ fps: '60', strips: [demoStrip] }, /campo `fps`: debe ser un número entero/],
    [{ server: { port: 99999 }, strips: [demoStrip] }, /campo `server.port`: debe ser 65535 o menos/],
    [{ strips: [{ ...demoStrip, name: '' }] }, /«demo», campo `name`: no puede estar vacío/],
  ])('con %j, dice qué falla', (config, message) => {
    expect(errorOf(text(config))).toMatch(message);
  });
});

describe('la salida Adalight de una tira', () => {
  /** La tira de la mesa, como la de specs/engine-config (*Tira con salida Adalight*). */
  const adalight = {
    type: 'adalight',
    port: '/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0',
    baudRate: 115200,
  };
  const tableStrip = { id: 'mesa', name: 'Mesa', output: adalight, ledCount: 173, effect: 'breathing' };

  /** La salida de la mesa sin uno de sus campos. */
  function adalightWithout(field: keyof typeof adalight): Record<string, unknown> {
    const output: Record<string, unknown> = { ...adalight };
    delete output[field];
    return output;
  }

  it('acepta la tira de la mesa con su puerto serie y sus baudios', () => {
    const result = parseConfig(text({ strips: [tableStrip] }));

    expect(result.ok && result.config.strips).toEqual([tableStrip]);
  });

  it.each([
    9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600, 1000000, 1500000,
    2000000,
  ])('acepta %d baudios', (baudRate) => {
    expect(parseConfig(text({ strips: [{ ...tableStrip, output: { ...adalight, baudRate } }] })).ok).toBe(
      true,
    );
  });

  it.each([
    [adalightWithout('port'), 'la tira «mesa», campo `output.port`: falta y es obligatorio'],
    [{ ...adalight, port: '' }, 'la tira «mesa», campo `output.port`: no puede estar vacío'],
    [adalightWithout('baudRate'), 'la tira «mesa», campo `output.baudRate`: falta y es obligatorio'],
    [
      { ...adalight, baudRate: 11520 },
      'la tira «mesa», campo `output.baudRate`: «11520» no es un valor válido (se admite «9600», ' +
        '«19200», «38400», «57600», «115200», «230400», «460800», «500000», «576000», «921600», ' +
        '«1000000», «1500000» o «2000000»)',
    ],
    [
      { ...adalight, baudrate: 115200 },
      'la tira «mesa», campo `output.baudrate`: no existe (¿está bien escrito?)',
    ],
    [
      { ...adalight, parity: 'none' },
      'la tira «mesa», campo `output.parity`: no existe (¿está bien escrito?)',
    ],
  ])('con la salida %j, nombra la tira y el campo y dice qué falla', (output, message) => {
    expect(errorOf(text({ strips: [demoStrip, { ...tableStrip, output }] }))).toBe(message);
  });
});

describe('el efecto de cada tira', () => {
  it('acepta una tira con la respiración', () => {
    const result = parseConfig(text({ strips: [demoStrip] }));

    expect(result.ok && result.config.strips).toEqual([demoStrip]);
  });

  it('sin effect, nombra la tira y dice que el campo falta y es obligatorio', () => {
    expect(errorOf(text({ strips: [demoStrip, { ...demoStripWithout('effect'), id: 'sin-efecto' }] }))).toBe(
      'la tira «sin-efecto», campo `effect`: falta y es obligatorio',
    );
  });

  it('con un efecto que no existe, nombra la tira y dice cuáles hay', () => {
    expect(errorOf(text({ strips: [{ ...demoStrip, effect: 'energia' }] }))).toBe(
      'la tira «demo», campo `effect`: «energia» no es un efecto (hay: `breathing`, `spectrum`, `scroll`, `energy`)',
    );
  });
});

describe('un efecto reactivo sin fuente de audio', () => {
  it('no arranca: nombra la tira y dice que su efecto necesita una fuente de audio', () => {
    const energyStrip = { ...demoStrip, id: 'reactiva', effect: 'energy' };

    expect(errorOf(text({ strips: [demoStrip, energyStrip] }))).toBe(
      'la tira «reactiva», efecto `energy`: necesita una fuente de audio (`audioSource`)',
    );
  });

  it.each([
    { type: 'file', path: 'config/audio/bouncer.wav' },
    { type: 'soundcard', name: 'Mixer de la mesa', device: 'plughw:CARD=Device,DEV=0' },
  ])('con la fuente de audio %j, arranca', (audioSource) => {
    expect(parseConfig(text({ audioSource, strips: [{ ...demoStrip, effect: 'energy' }] })).ok).toBe(
      true,
    );
  });
});

describe('la fuente de audio', () => {
  it('acepta un fichero con su ruta', () => {
    const audioSource = { type: 'file', path: 'config/audio/bouncer.wav' };
    const result = parseConfig(text({ audioSource, strips: [demoStrip] }));

    expect(result).toEqual({
      ok: true,
      config: {
        fps: 60,
        server: { host: '127.0.0.1', port: 8080 },
        audioSource,
        instrumentState: DEFAULT_INSTRUMENT_STATE,
        strips: [demoStrip],
      },
    });
  });

  it('es opcional: sin audioSource, el instrumento no tiene fuente de audio', () => {
    const result = parseConfig(text({ strips: [demoStrip] }));

    expect(result.ok).toBe(true);
    expect(result.ok && 'audioSource' in result.config).toBe(false);
  });

  it.each([
    [
      { type: 'mp3', path: 'musica.mp3' },
      'campo `audioSource.type`: «mp3» no es un valor válido (se admite «file» o «soundcard»)',
    ],
    [
      { type: 'file', path: 'musica.wav', volume: 1 },
      'campo `audioSource.volume`: no existe (¿está bien escrito?)',
    ],
    [{ type: 'file' }, 'campo `audioSource.path`: falta y es obligatorio'],
    [{ type: 'file', path: '' }, 'campo `audioSource.path`: no puede estar vacío'],
    [{ path: 'musica.wav' }, 'campo `audioSource.type`: falta y es obligatorio'],
    ['musica.wav', 'campo `audioSource`: debe ser un objeto'],
  ])('con %j, nombra el campo y dice qué falla', (audioSource, message) => {
    expect(errorOf(text({ audioSource, strips: [demoStrip] }))).toBe(message);
  });
});

describe('la tarjeta de sonido como fuente de audio', () => {
  const soundcard = {
    type: 'soundcard',
    name: 'Mixer de la mesa',
    device: 'plughw:CARD=Device,DEV=0',
  };

  function audioSourceOf(audioSource: unknown): unknown {
    const result = parseConfig(text({ audioSource, strips: [demoStrip] }));
    if (!result.ok) throw new Error(result.error);
    return result.config.audioSource;
  }

  it('acepta su nombre y su cadena de ALSA, con el umbral de silencio por defecto a -60 dBFS', () => {
    expect(audioSourceOf(soundcard)).toEqual({ ...soundcard, silenceThreshold: -60 });
  });

  it.each([-120, 0, -45.5])('acepta un umbral de silencio de %d dBFS', (silenceThreshold) => {
    expect(audioSourceOf({ ...soundcard, silenceThreshold })).toEqual({
      ...soundcard,
      silenceThreshold,
    });
  });

  it.each([
    [{ ...soundcard, name: undefined }, 'campo `audioSource.name`: falta y es obligatorio'],
    [{ ...soundcard, device: undefined }, 'campo `audioSource.device`: falta y es obligatorio'],
    [{ ...soundcard, name: '' }, 'campo `audioSource.name`: no puede estar vacío'],
    [{ ...soundcard, device: '' }, 'campo `audioSource.device`: no puede estar vacío'],
    [
      { ...soundcard, silenceThreshold: -121 },
      'campo `audioSource.silenceThreshold`: debe ser -120 o más',
    ],
    [
      { ...soundcard, silenceThreshold: 1 },
      'campo `audioSource.silenceThreshold`: debe ser 0 o menos',
    ],
    [
      { ...soundcard, silenceThreshold: '-60' },
      'campo `audioSource.silenceThreshold`: debe ser un número',
    ],
    [
      { ...soundcard, path: 'musica.wav' },
      'campo `audioSource.path`: no existe (¿está bien escrito?)',
    ],
  ])('con %j, nombra el campo y dice qué falla', (audioSource, message) => {
    expect(errorOf(text({ audioSource, strips: [demoStrip] }))).toBe(message);
  });
});

describe('dónde se guarda el estado del instrumento', () => {
  function instrumentStateOf(instrumentState: unknown): unknown {
    const result = parseConfig(text({ instrumentState, strips: [demoStrip] }));
    if (!result.ok) throw new Error(result.error);
    return result.config.instrumentState;
  }

  it('sin instrumentState, en SQLite en data/instrument-state.db', () => {
    const result = parseConfig(text({ strips: [demoStrip] }));

    expect(result.ok && result.config.instrumentState).toEqual(DEFAULT_INSTRUMENT_STATE);
  });

  it.each(['estado.db', '/var/lib/moodtable/estado.db'])(
    'acepta SQLite con la ruta %j',
    (path) => {
      expect(instrumentStateOf({ type: 'sqlite', path })).toEqual({ type: 'sqlite', path });
    },
  );

  it('acepta memory, sin ruta', () => {
    expect(instrumentStateOf({ type: 'memory' })).toEqual({ type: 'memory' });
  });

  it.each([
    [
      { type: 'json' },
      'campo `instrumentState.type`: «json» no es un valor válido (se admite «sqlite» o «memory»)',
    ],
    [{ type: 'sqlite' }, 'campo `instrumentState.path`: falta y es obligatorio'],
    [{ type: 'sqlite', path: '' }, 'campo `instrumentState.path`: no puede estar vacío'],
    [
      { type: 'memory', path: 'estado.db' },
      'campo `instrumentState.path`: no existe (¿está bien escrito?)',
    ],
    [{ path: 'estado.db' }, 'campo `instrumentState.type`: falta y es obligatorio'],
  ])('con %j, no arranca: nombra el campo y dice qué falla', (instrumentState, message) => {
    expect(errorOf(text({ instrumentState, strips: [demoStrip] }))).toBe(message);
  });
});
