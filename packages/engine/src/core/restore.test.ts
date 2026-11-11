import type { EffectId, StripConfig } from '@moodtable/shared';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import { breathing } from './effects/breathing.ts';
import { defaultParams, type Effect } from './effects/effect.ts';
import { energy } from './effects/energy.ts';
import { restore } from './restore.ts';
import type { InstrumentState } from './state-store.ts';

function strip(id: string, effect: EffectId, more: Partial<StripConfig> = {}): StripConfig {
  return { id, name: id, output: { type: 'virtual' }, ledCount: 4, effect, ...more };
}

/**
 * Un efecto de prueba con parámetros, que el catálogo no tiene: hacen falta dos con parámetros para
 * ver que cada efecto de una tira recupera los suyos. Es de ambiente.
 */
const PULSE = 'pulse' as EffectId;
const pulse: Effect<{ speed: number }, null> = {
  id: PULSE,
  usesAudio: false,
  paramsSchema: Type.Object(
    { speed: Type.Number({ minimum: 1, maximum: 10, default: 2 }) },
    { additionalProperties: false },
  ),
  createMemory: () => null,
  render: (_ctx, params, _memory, out) => out.fill(params.speed),
};

const EFFECTS = [breathing, energy, pulse];
const azul = { color: '#0000ff', period: 8 };
const porDefecto = defaultParams(breathing);

/** Dos tiras, A con la respiración y B con la energía, con fuente de audio salvo que se diga. */
function restoreTwo(saved: InstrumentState, hasAudioSource = true) {
  return restore({
    strips: [strip('a', 'breathing'), strip('b', 'energy')],
    effects: EFFECTS,
    hasAudioSource,
    saved,
  });
}

describe('restaurar el estado del instrumento', () => {
  it('sin estado guardado, cada tira arranca con el efecto del fichero y sus valores por defecto, sin avisos', () => {
    expect(restoreTwo({})).toEqual({
      state: {
        a: { activeEffect: 'breathing', values: { breathing: porDefecto } },
        b: { activeEffect: 'energy', values: { energy: {} } },
      },
      notices: [],
    });
  });

  it('con estado guardado, cada tira vuelve con su efecto activo y los valores de cada efecto', () => {
    const saved: InstrumentState = {
      a: { activeEffect: 'pulse', values: { breathing: azul, pulse: { speed: 5 } } },
      b: { activeEffect: 'energy', values: { energy: {} } },
    };

    expect(restoreTwo(saved)).toEqual({ state: saved, notices: [] });
  });

  it('lo que dejó el DJ manda sobre el efecto del fichero', () => {
    const saved: InstrumentState = {
      a: { activeEffect: 'energy', values: { breathing: azul, energy: {} } },
    };

    expect(restoreTwo(saved).state.a).toEqual(saved.a);
  });

  describe('conciliar con las tiras del fichero', () => {
    it('una tira nueva arranca como la primera vez, y las demás con lo suyo', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: azul } },
      };

      expect(restoreTwo(saved).state).toEqual({
        a: { activeEffect: 'breathing', values: { breathing: azul } },
        b: { activeEffect: 'energy', values: { energy: {} } },
      });
    });

    it('una tira que se vuelve a declarar recupera lo suyo, y las que no se declaran no salen', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: azul } },
        c: { activeEffect: 'pulse', values: { pulse: { speed: 7 } } },
      };

      const { state } = restore({
        strips: [strip('c', 'breathing')],
        effects: EFFECTS,
        hasAudioSource: true,
        saved,
      });

      expect(state).toEqual({ c: { activeEffect: 'pulse', values: { pulse: { speed: 7 } } } });
    });

    it('una tira con otro nombre, otro nº de LEDs u otra salida sigue siendo la misma', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: azul } },
      };

      const { state } = restore({
        strips: [
          strip('a', 'breathing', {
            name: 'Cabina',
            ledCount: 60,
            output: {
          type: 'adalight',
          port: '/dev/ttyACM0',
          baudRate: 500_000,
          chip: 'WS2812B',
          power: { supplyAmps: 8 },
        },
          }),
        ],
        effects: EFFECTS,
        hasAudioSource: true,
        saved,
      });

      expect(state).toEqual(saved);
    });

    it('una tira con otro id arranca como una nueva', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: azul } },
      };

      const { state } = restore({
        strips: [strip('b', 'breathing')],
        effects: EFFECTS,
        hasAudioSource: true,
        saved,
      });

      expect(state).toEqual({ b: { activeEffect: 'breathing', values: { breathing: porDefecto } } });
    });

    it('una tira cuyo id coincide con una propiedad de Object recupera lo suyo', () => {
      const saved = JSON.parse(
        '{"__proto__": {"activeEffect": "breathing", "values": {"breathing": {"color": "#0000ff", "period": 8}}}}',
      ) as InstrumentState;

      const { state } = restore({
        strips: [strip('__proto__', 'energy'), strip('constructor', 'breathing')],
        effects: EFFECTS,
        hasAudioSource: true,
        saved,
      });

      expect(Object.keys(state)).toEqual(['__proto__', 'constructor']);
      expect(Object.getOwnPropertyDescriptor(state, '__proto__')?.value).toEqual({
        activeEffect: 'breathing',
        values: { breathing: azul },
      });
      expect(state.constructor).toEqual({
        activeEffect: 'breathing',
        values: { breathing: porDefecto },
      });
    });
  });

  describe('el efecto guardado necesita una fuente de audio que ya no hay', () => {
    const saved: InstrumentState = {
      a: { activeEffect: 'energy', values: { breathing: azul, energy: {} } },
    };

    it('arranca con el efecto del fichero y conserva los valores de todos sus efectos', () => {
      const { state } = restore({
        strips: [strip('a', 'breathing')],
        effects: EFFECTS,
        hasAudioSource: false,
        saved,
      });

      expect(state).toEqual({
        a: { activeEffect: 'breathing', values: { breathing: azul, energy: {} } },
      });
    });

    it('el aviso nombra la tira y dice que su efecto guardado necesita una fuente de audio', () => {
      const { notices } = restore({
        strips: [strip('a', 'breathing')],
        effects: EFFECTS,
        hasAudioSource: false,
        saved,
      });

      expect(notices).toHaveLength(1);
      expect(notices[0]).toContain('«a»');
      expect(notices[0]).toContain('energy');
      expect(notices[0]).toContain('fuente de audio');
    });
  });

  describe('unos valores guardados que ya no encajan', () => {
    it('un campo que falta toma su valor por defecto', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: { color: '#0000ff' } } },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: { color: '#0000ff', period: 4 } },
      });
    });

    it('un campo que sobra se quita', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: { ...azul, speed: 3 } } },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: azul },
      });
    });

    it('un valor fuera de rango devuelve a sus valores por defecto solo ese efecto', () => {
      const saved: InstrumentState = {
        a: {
          activeEffect: 'breathing',
          values: { breathing: { color: '#0000ff', period: 25 }, pulse: { speed: 5 } },
        },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: porDefecto, pulse: { speed: 5 } },
      });
    });

    it('unos valores que no son un objeto vuelven a los de por defecto', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: 'azul' } },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: porDefecto },
      });
    });

    it('los de un efecto que ya no existe se ignoran', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'breathing', values: { breathing: azul, retirado: { x: 1 } } },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: azul },
      });
    });
  });

  describe('el efecto activo guardado ya no existe', () => {
    it('arranca con el efecto del fichero, con sus valores guardados si los había', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'retirado', values: { breathing: azul, retirado: { x: 1 } } },
      };

      expect(restoreTwo(saved)).toEqual({
        state: {
          a: { activeEffect: 'breathing', values: { breathing: azul } },
          b: { activeEffect: 'energy', values: { energy: {} } },
        },
        notices: [],
      });
    });

    it('sin valores guardados del efecto del fichero, con los de por defecto', () => {
      const saved: InstrumentState = {
        a: { activeEffect: 'retirado', values: { retirado: { x: 1 } } },
      };

      expect(restoreTwo(saved).state.a).toEqual({
        activeEffect: 'breathing',
        values: { breathing: porDefecto },
      });
    });
  });

  it('un efecto activo guardado sin sus valores arranca con los de por defecto', () => {
    const saved: InstrumentState = {
      a: { activeEffect: 'pulse', values: { breathing: azul } },
    };

    expect(restoreTwo(saved).state.a).toEqual({
      activeEffect: 'pulse',
      values: { breathing: azul, pulse: { speed: 2 } },
    });
  });

  it('no cambia el estado guardado que recibe', () => {
    const saved: InstrumentState = {
      a: { activeEffect: 'breathing', values: { breathing: { color: '#0000ff', extra: 1 } } },
    };
    const before = structuredClone(saved);

    restoreTwo(saved);

    expect(saved).toEqual(before);
  });
});
