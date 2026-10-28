import type { EffectId, StripConfig } from '@moodtable/shared';
import { describe, expect, it } from 'vitest';

import { createControl } from './control.ts';
import { breathing } from './effects/breathing.ts';
import { defaultParams } from './effects/effect.ts';
import { energy } from './effects/energy.ts';

function strip(id: string, effect: EffectId): StripConfig {
  return { id, name: id, output: { type: 'virtual' }, ledCount: 4, effect };
}

/** Dos tiras, A con energía y B con la respiración, con fuente de audio salvo que se diga. */
function twoStrips(hasAudioSource = true) {
  const control = createControl({
    strips: [strip('a', 'energy'), strip('b', 'breathing')],
    effects: [breathing, energy],
    hasAudioSource,
  });
  const notices: number[] = [];
  control.watch(() => notices.push(notices.length));
  return { control, notices };
}

/** Lo que pinta la respiración por defecto, recién creada, en el instante `time`. */
function breathingAt(time: number): Uint8Array {
  const out = new Uint8Array(12);
  breathing.render(
    { time, dt: 0, audio: null },
    defaultParams(breathing),
    breathing.createMemory(strip('referencia', 'breathing')),
    out,
  );
  return out;
}

describe('el búfer de control', () => {
  it('cada tira empieza con el efecto que declara el fichero', () => {
    const { control } = twoStrips();

    expect([control.slot(0).effect, control.slot(1).effect]).toEqual(['energy', 'breathing']);
  });

  it('con un efecto que no está en el registro, no se crea y dice cuál es', () => {
    expect(() =>
      createControl({
        strips: [strip('fija', 'solid' as EffectId)],
        effects: [breathing],
        hasAudioSource: false,
      }),
    ).toThrow('la tira «fija» declara el efecto «solid», que el motor no tiene');
  });

  it('cambiar el efecto de una tira da changed y la ranura nueva pinta el efecto desde cero', () => {
    const { control } = twoStrips();

    expect(control.setEffect('a', 'breathing')).toBe('changed');

    const out = new Uint8Array(12);
    control.slot(0).render({ time: 1.5, dt: 0, audio: null }, out);
    expect(control.slot(0).effect).toBe('breathing');
    expect(out).toEqual(breathingAt(1.5));
  });

  it('cambiar el efecto de una tira no toca la ranura de las demás', () => {
    const { control } = twoStrips();
    const other = control.slot(1);

    control.setEffect('a', 'breathing');

    expect(control.slot(1)).toBe(other);
  });

  it('el efecto que ya está activo da unchanged, no crea ranura ni avisa', () => {
    const { control, notices } = twoStrips();
    const before = control.slot(1);

    expect(control.setEffect('b', 'breathing')).toBe('unchanged');
    expect(control.slot(1)).toBe(before);
    expect(notices).toEqual([]);
  });

  it('una tira que no existe da unknown-strip y no avisa', () => {
    const { control, notices } = twoStrips();

    expect(control.setEffect('luces', 'breathing')).toBe('unknown-strip');
    expect(notices).toEqual([]);
  });

  it('sin fuente de audio, un efecto reactivo da needs-audio-source y no toca la tira', () => {
    const { control, notices } = twoStrips(false);
    // Sin fuente, el fichero no deja arrancar una tira con energía: aquí A empieza en energía solo
    // para tener las dos tiras de siempre. B es la que importa.
    const before = control.slot(1);

    expect(control.setEffect('b', 'energy')).toBe('needs-audio-source');
    expect(control.slot(1)).toBe(before);
    expect(notices).toEqual([]);
  });

  it('quien se suscribe recibe un aviso por cada cambio, y ninguno al dejar de escuchar', () => {
    const { control, notices } = twoStrips();
    const later: string[] = [];
    const unwatch = control.watch(() => later.push(control.slot(0).effect));

    control.setEffect('a', 'breathing');
    control.setEffect('a', 'energy');
    unwatch();
    control.setEffect('a', 'breathing');

    expect(notices).toEqual([0, 1, 2]);
    expect(later).toEqual(['breathing', 'energy']);
  });

  it('no da la ranura de una posición sin tira', () => {
    expect(() => twoStrips().control.slot(2)).toThrow(RangeError);
  });

  it('de dos cambios seguidos de la misma tira queda la ranura del último', () => {
    const { control } = twoStrips();

    control.setEffect('b', 'energy');
    control.setEffect('b', 'breathing');

    expect(control.slot(1).effect).toBe('breathing');
  });
});
