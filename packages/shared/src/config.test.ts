import { describe, expect, it } from 'vitest';

import { parseConfig } from './config.ts';

/** Una tira virtual mínima, como la de `config/demo.json` (specs/engine-config). */
const demoStrip = { id: 'demo', name: 'Tira de prueba', output: { type: 'virtual' }, ledCount: 60 };

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
    expect(error).toMatch(/line 1 column \d+/);
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

  it('con fps 0, nombra el campo', () => {
    expect(errorOf(text({ fps: 0, strips: [demoStrip] }))).toMatch(/`fps`/);
  });
});
