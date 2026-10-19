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
      config: { fps: 60, server: { host: '127.0.0.1', port: 8080 }, strips: [demoStrip] },
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

  it('con una salida de un tipo que no existe, nombra la tira y el campo', () => {
    const error = errorOf(text({ strips: [{ ...demoStrip, output: { type: 'dmx' } }] }));

    expect(error).toMatch(/«demo»/);
    expect(error).toMatch(/`output\.type`/);
    expect(error).toMatch(/«dmx»/);
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
      'la tira «demo», campo `effect`: «energia» no es un efecto (hay: `breathing`, `energy`)',
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

  it('con fuente de audio, arranca', () => {
    const audioSource = { type: 'file', path: 'config/audio/bouncer.wav' };

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
      'campo `audioSource.type`: «mp3» no es un valor válido (se admite «file»)',
    ],
    [
      { type: 'file', path: 'musica.wav', volume: 1 },
      'campo `audioSource.volume`: no existe (¿está bien escrito?)',
    ],
    [{ type: 'file' }, 'campo `audioSource.path`: falta y es obligatorio'],
    [{ type: 'file', path: '' }, 'campo `audioSource.path`: no puede estar vacío'],
  ])('con %j, nombra el campo y dice qué falla', (audioSource, message) => {
    expect(errorOf(text({ audioSource, strips: [demoStrip] }))).toBe(message);
  });
});
