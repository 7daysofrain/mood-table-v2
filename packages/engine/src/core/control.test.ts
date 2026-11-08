import type { EffectId, StripConfig } from '@moodtable/shared';
import Type from 'typebox';
import { describe, expect, it } from 'vitest';

import { type ControlBuffer, createControl } from './control.ts';
import { breathing } from './effects/breathing.ts';
import { defaultParams, type Effect } from './effects/effect.ts';
import { energy } from './effects/energy.ts';
import type { InstrumentState } from './state-store.ts';

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

/**
 * Un efecto de prueba con parámetros, que el catálogo no tiene: hoy solo la respiración los tiene, y
 * hacen falta dos para ver que cada efecto de una tira guarda los suyos. Es de ambiente.
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

/** Dos tiras con la respiración, y el efecto de prueba además de los del registro. */
function withPulse(hasAudioSource = true) {
  return createControl({
    strips: [strip('a', 'breathing'), strip('b', 'breathing')],
    effects: [breathing, energy, pulse],
    hasAudioSource,
  });
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

  describe('cambiar los valores de una tira', () => {
    const BLUE = { color: '#2040FF', period: 7 };
    const ctx = (time: number) => ({ time, dt: 1 / 60, audio: null });

    it('da changed, y la ranura pinta con los valores nuevos desde el pulso siguiente', () => {
      const { control } = twoStrips();

      expect(control.setValues('b', BLUE)).toBe('changed');

      expect(control.slot(1).values).toEqual(BLUE);
      const out = new Uint8Array(12);
      control.slot(1).render(ctx(1), out);
      const reference = new Uint8Array(12);
      breathing.render(ctx(1), BLUE, breathing.createMemory(strip('b', 'breathing')), reference);
      expect(out).toEqual(reference);
    });

    it('no reinicia la memoria del efecto: la respiración sigue su fase con el periodo nuevo', () => {
      const { control } = twoStrips();
      const out = new Uint8Array(12);
      control.slot(1).render(ctx(1), out);

      control.setValues('b', { color: '#FFA957', period: 6 });
      control.slot(1).render(ctx(1 + 1 / 60), out);

      // La misma respiración pintada sin cortes, con una sola memoria.
      const memory = breathing.createMemory(strip('b', 'breathing'));
      const reference = new Uint8Array(12);
      breathing.render(ctx(1), defaultParams(breathing), memory, reference);
      breathing.render(ctx(1 + 1 / 60), { color: '#FFA957', period: 6 }, memory, reference);
      expect(out).toEqual(reference);
    });

    it('los mismos valores, aunque lleguen en otro orden, dan unchanged y no avisan', () => {
      const { control, notices } = twoStrips();
      control.setValues('b', BLUE);
      notices.length = 0;
      const before = control.slot(1).values;

      expect(control.setValues('b', { period: 7, color: '#2040FF' })).toBe('unchanged');
      expect(control.slot(1).values).toBe(before);
      expect(notices).toEqual([]);
    });

    it('una tira que no existe da unknown-strip y no avisa', () => {
      const { control, notices } = twoStrips();

      expect(control.setValues('luces', BLUE)).toBe('unknown-strip');
      expect(notices).toEqual([]);
    });

    it.each([
      ['un periodo fuera de rango', 'b', { color: '#FFA957', period: 25 }, '`period` debe ser <= 20'],
      ['un campo de más', 'b', { ...BLUE, speed: 2 }, 'no declara `speed`'],
      ['un valor que falta', 'b', { color: '#2040FF' }, 'falta `period`'],
      ['un color que no es #RRGGBB', 'b', { color: 'azul', period: 7 }, '`color` no tiene el formato'],
      ['los valores de otro efecto', 'a', BLUE, 'no declara `color`, `period`'],
      ['algo que no es un objeto', 'b', 7, 'los valores deben ser un objeto'],
    ])('%s da invalid con su motivo y no toca la tira', (_name, id, values, reason) => {
      const { control, notices } = twoStrips();
      const index = id === 'a' ? 0 : 1;
      const slot = control.slot(index);
      const before = slot.values;

      const result = control.setValues(id, values);

      expect(result).toEqual({ invalid: expect.stringContaining(reason) as string });
      expect(control.slot(index)).toBe(slot);
      expect(slot.values).toBe(before);
      expect(notices).toEqual([]);
    });

    it('quien se suscribe recibe un aviso por cada cambio de valores', () => {
      const { control, notices } = twoStrips();

      control.setValues('b', BLUE);
      control.setValues('b', { ...BLUE, period: 8 });

      expect(notices).toEqual([0, 1]);
    });

    it('cambiar los valores de una tira no toca la ranura de las demás', () => {
      const { control } = twoStrips();
      const other = control.slot(0);
      const values = other.values;

      control.setValues('b', BLUE);

      expect(control.slot(0)).toBe(other);
      expect(other.values).toBe(values);
    });
  });

  describe('volver a un efecto', () => {
    const BLUE = { color: '#2040FF', period: 7 };
    const RED = { color: '#FF2020', period: 3 };
    const ctx = (time: number) => ({ time, dt: 1 / 60, audio: null });

    /** Lo que pinta la respiración con `values` y una memoria recién creada, en el instante `time`. */
    function freshBreathingAt(time: number, values: typeof BLUE): Uint8Array {
      const out = new Uint8Array(12);
      const memory = breathing.createMemory(strip('referencia', 'breathing'));
      breathing.render(ctx(time), values, memory, out);
      return out;
    }

    /** Ida y vuelta: la tira pasa a `other` y vuelve a la respiración. */
    function roundTrip(control: ControlBuffer, id: string, other: EffectId = 'energy') {
      control.setEffect(id, other);
      return control.setEffect(id, 'breathing');
    }

    it('la devuelve con los valores con que la dejó', () => {
      const { control } = twoStrips();
      control.setValues('b', BLUE);

      expect(roundTrip(control, 'b')).toBe('changed');

      expect(control.slot(1).effect).toBe('breathing');
      expect(control.slot(1).values).toEqual(BLUE);
    });

    it('el primer frame ya pinta con los valores recuperados, no con los de por defecto', () => {
      const { control } = twoStrips();
      control.setValues('b', BLUE);
      roundTrip(control, 'b');

      const out = new Uint8Array(12);
      control.slot(1).render(ctx(1.5), out);

      expect(out).toEqual(freshBreathingAt(1.5, BLUE));
      expect(out).not.toEqual(breathingAt(1.5));
    });

    it('vuelven los valores, no la memoria: la respiración empieza como recién creada', () => {
      const { control } = twoStrips();
      // Un cambio de periodo a mitad de respiración deja un desfase en la memoria.
      const out = new Uint8Array(12);
      control.slot(1).render(ctx(1), out);
      control.setValues('b', BLUE);
      control.slot(1).render(ctx(1 + 1 / 60), out);
      roundTrip(control, 'b');

      control.slot(1).render(ctx(2), out);

      expect(out).toEqual(freshBreathingAt(2, BLUE));
    });

    it('cada tira recupera los suyos', () => {
      const control = withPulse();
      control.setValues('a', BLUE);
      control.setValues('b', RED);
      control.setEffect('a', 'energy');
      control.setEffect('b', 'energy');

      control.setEffect('b', 'breathing');
      control.setEffect('a', 'breathing');

      expect(control.slot(0).values).toEqual(BLUE);
      expect(control.slot(1).values).toEqual(RED);
    });

    it('un efecto que nunca se ha elegido en una tira empieza con sus valores por defecto', () => {
      const { control } = twoStrips();
      control.setValues('b', BLUE);

      control.setEffect('a', 'breathing');

      expect(control.slot(0).values).toEqual(defaultParams(breathing));
    });

    it('dos efectos con valores en la misma tira guardan cada uno los suyos', () => {
      const control = withPulse();
      control.setValues('a', BLUE);
      control.setEffect('a', PULSE);
      control.setValues('a', { speed: 7 });

      control.setEffect('a', 'breathing');
      expect(control.slot(0).values).toEqual(BLUE);

      control.setEffect('a', PULSE);
      expect(control.slot(0).values).toEqual({ speed: 7 });
    });

    it('unos valores rechazados no cambian lo que se recupera', () => {
      const { control } = twoStrips();
      control.setValues('b', BLUE);
      control.setValues('b', { ...BLUE, period: 25 });
      control.setEffect('b', 'energy');
      // Unos valores atrasados de la respiración, que llegan con la energía ya activa (decisión 3).
      control.setValues('b', RED);

      control.setEffect('b', 'breathing');

      expect(control.slot(1).values).toEqual(BLUE);
    });

    it.each([
      ['unchanged', (control: ControlBuffer) => control.setEffect('b', 'breathing')],
      ['unknown-strip', (control: ControlBuffer) => control.setEffect('luces', 'breathing')],
      ['needs-audio-source', (control: ControlBuffer) => control.setEffect('b', 'energy')],
    ] as const)('%s no toca lo guardado', (result, command) => {
      const control = withPulse(false);
      control.setValues('b', BLUE);

      expect(command(control)).toBe(result);
      expect(control.slot(1).values).toEqual(BLUE);
      expect(roundTrip(control, 'b', PULSE)).toBe('changed');
      expect(control.slot(1).values).toEqual(BLUE);
    });
  });

  // Decisiones 4 y 8 del change instrument-intensity: la intensidad es del instrumento, no de una tira.
  describe('la intensidad', () => {
    const BLUE = { color: '#2040FF', period: 7 };

    /** Dos tiras y quien escucha la intensidad: cuenta un aviso por cada cambio. */
    function withIntensity() {
      const { control, notices } = twoStrips();
      const intensityNotices: number[] = [];
      control.watchIntensity(() => intensityNotices.push(control.intensity()));
      return { control, notices, intensityNotices };
    }

    it('arranca al máximo', () => {
      expect(withIntensity().control.intensity()).toBe(1);
    });

    it('cambiarla da changed, y el búfer la devuelve', () => {
      const { control } = withIntensity();

      expect(control.setIntensity(0.4)).toBe('changed');
      expect(control.intensity()).toBe(0.4);
    });

    it('la misma intensidad da unchanged y no avisa', () => {
      const { control, intensityNotices } = withIntensity();
      control.setIntensity(0.4);

      expect(control.setIntensity(0.4)).toBe('unchanged');
      expect(intensityNotices).toEqual([0.4]);
    });

    it.each([
      ['por encima de 1', 1.5],
      ['por debajo de 0', -0.1],
      ['NaN', Number.NaN],
      ['infinita', Number.POSITIVE_INFINITY],
      ['un texto', 'alta'],
      ['nada', undefined],
    ])('%s da invalid y no la cambia ni avisa', (_label, value) => {
      const { control, intensityNotices } = withIntensity();
      control.setIntensity(0.4);

      expect(control.setIntensity(value)).toBe('invalid');
      expect(control.intensity()).toBe(0.4);
      expect(intensityNotices).toEqual([0.4]);
    });

    it('acepta los dos extremos', () => {
      const { control } = withIntensity();

      expect(control.setIntensity(0)).toBe('changed');
      expect(control.intensity()).toBe(0);
      expect(control.setIntensity(1)).toBe('changed');
      expect(control.intensity()).toBe(1);
    });

    it('quien la escucha recibe un aviso por cada cambio, y ninguno al dejar de escuchar', () => {
      const { control } = twoStrips();
      const received: number[] = [];
      const stop = control.watchIntensity(() => received.push(control.intensity()));

      control.setIntensity(0.4);
      control.setIntensity(0);
      stop();
      control.setIntensity(0.7);

      expect(received).toEqual([0.4, 0]);
    });

    it('cambiarla no avisa a quien escucha las tiras ni toca el efecto ni los valores de ninguna', () => {
      const { control, notices } = withIntensity();
      control.setValues('b', BLUE);
      notices.length = 0;
      const slots = [control.slot(0), control.slot(1)];

      control.setIntensity(0.4);
      control.setIntensity(0);

      expect(notices).toEqual([]);
      expect(control.slot(0)).toBe(slots[0]);
      expect(control.slot(1)).toBe(slots[1]);
      expect(control.slot(1).values).toEqual(BLUE);
    });

    it('cambiar el efecto o los valores de una tira no avisa a quien escucha la intensidad', () => {
      const { control, intensityNotices } = withIntensity();

      control.setEffect('b', 'energy');
      control.setEffect('b', 'breathing');
      control.setValues('b', BLUE);

      expect(intensityNotices).toEqual([]);
      expect(control.intensity()).toBe(1);
    });
  });

  // Decisión 6 del change instrument-state-restore: el búfer arranca desde el estado restaurado y da
  // su foto para el guardador.
  describe('arrancar desde un estado y dar su foto', () => {
    const BLUE = { color: '#2040FF', period: 7 };
    const ctx = (time: number) => ({ time, dt: 1 / 60, audio: null });

    /** A guardada con el efecto de prueba y la respiración en azul, y B con la energía. */
    const initial: InstrumentState = {
      a: { activeEffect: 'pulse', values: { breathing: BLUE, pulse: { speed: 5 } } },
      b: { activeEffect: 'energy', values: { energy: {} } },
    };

    function fromState(state: InstrumentState = initial) {
      return createControl({
        strips: [strip('a', 'breathing'), strip('b', 'breathing')],
        effects: [breathing, energy, pulse],
        hasAudioSource: true,
        initial: state,
      });
    }

    it('cada tira arranca con el efecto activo y los valores del estado, no con los del fichero', () => {
      const control = fromState();

      expect([control.slot(0).effect, control.slot(1).effect]).toEqual(['pulse', 'energy']);
      expect(control.slot(0).values).toEqual({ speed: 5 });
    });

    it('el primer render ya pinta con los valores del estado', () => {
      const control = fromState();
      const out = new Uint8Array(12);

      control.slot(0).render(ctx(0), out);

      expect(out).toEqual(new Uint8Array(12).fill(5));
    });

    it('vuelven también los valores de los efectos no activos', () => {
      const control = fromState();

      expect(control.setEffect('a', 'breathing')).toBe('changed');

      expect(control.slot(0).values).toEqual(BLUE);
    });

    it('una tira sin estado arranca con el efecto del fichero y sus valores por defecto', () => {
      const control = fromState({ b: { activeEffect: 'energy', values: { energy: {} } } });

      expect(control.slot(0).effect).toBe('breathing');
      expect(control.slot(0).values).toEqual(defaultParams(breathing));
    });

    it('la foto devuelve el estado con que arrancó', () => {
      expect(fromState().snapshot()).toEqual(initial);
    });

    it('sin estado, la foto tiene el efecto del fichero de cada tira con sus valores por defecto', () => {
      const { control } = twoStrips();

      expect(control.snapshot()).toEqual({
        a: { activeEffect: 'energy', values: { energy: {} } },
        b: { activeEffect: 'breathing', values: { breathing: defaultParams(breathing) } },
      });
    });

    it('la foto recoge los cambios de efecto y de valores', () => {
      const control = fromState();
      control.setEffect('a', 'breathing');
      control.setValues('a', { color: '#FF2020', period: 3 });
      control.setEffect('b', PULSE);

      expect(control.snapshot()).toEqual({
        a: {
          activeEffect: 'breathing',
          values: { breathing: { color: '#FF2020', period: 3 }, pulse: { speed: 5 } },
        },
        b: { activeEffect: 'pulse', values: { energy: {}, pulse: { speed: 2 } } },
      });
    });

    it('lo que haga después quien recibe la foto no cambia el búfer', () => {
      const control = fromState();
      const photo = control.snapshot() as Record<string, { values: Record<string, unknown> }>;
      photo.a!.values.pulse = { speed: 9 };

      expect(control.snapshot()).toEqual(initial);
      expect(control.slot(0).values).toEqual({ speed: 5 });
    });

    it('lo que haga después quien dio el estado no cambia el búfer', () => {
      const state = structuredClone(initial) as Record<string, { values: Record<string, unknown> }>;
      const control = fromState(state as InstrumentState);
      state.a!.values.pulse = { speed: 9 };

      expect(control.slot(0).values).toEqual({ speed: 5 });
    });
  });
});
