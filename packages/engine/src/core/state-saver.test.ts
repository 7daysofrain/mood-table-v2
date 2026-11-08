import { beforeEach, describe, expect, it } from 'vitest';

import { type SaverTimer, startStateSaver } from './state-saver.ts';
import type { InstrumentState, StateStore } from './state-store.ts';

/**
 * Un temporizador y un reloj falsos, que solo avanzan cuando el test lo dice. El núcleo no puede
 * usar el adaptador en memoria (regla de fronteras), así que el almacén también es de prueba: apunta
 * cada guardado y puede tardar lo que diga el test, en el reloj falso.
 */
let now: number;
let pending: { at: number; callback: () => void } | undefined;
let saves: InstrumentState[];
let saveTakesMs: number;
/** Si no es `undefined`, el guardado falla con este mensaje. */
let saveFails: string | undefined;
let logLines: string[];
let state: InstrumentState;
let listeners: Set<() => void>;

const timer: SaverTimer = {
  set(callback, ms) {
    pending = { at: now + ms, callback };
    return pending;
  },
  clear(handle) {
    if (pending === handle) pending = undefined;
  },
};

const store: StateStore = {
  load: () => ({}),
  save(saved) {
    if (saveFails !== undefined) throw new Error(saveFails);
    now += saveTakesMs;
    saves.push(structuredClone(saved));
  },
};

/** Avanza el reloj `ms` y dispara el temporizador si vence. */
function advance(ms: number): void {
  const until = now + ms;
  while (pending && pending.at <= until) {
    const { at, callback } = pending;
    pending = undefined;
    now = at;
    callback();
  }
  now = until;
}

/** Un cambio del búfer: cambia el estado y avisa, como `watch()`. */
function change(next: InstrumentState): void {
  state = next;
  for (const listener of listeners) listener();
}

const azul: InstrumentState = {
  mesa: { activeEffect: 'breathing', values: { breathing: { color: '#0000ff', period: 8 } } },
};
const rojo: InstrumentState = {
  mesa: { activeEffect: 'breathing', values: { breathing: { color: '#ff0000', period: 8 } } },
};

beforeEach(() => {
  now = 0;
  pending = undefined;
  saves = [];
  saveTakesMs = 1;
  saveFails = undefined;
  logLines = [];
  state = {};
  listeners = new Set();
});

function start() {
  return startStateSaver({
    control: {
      watch(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      instrumentState: () => state,
    },
    store,
    timer,
    clock: () => now,
    log: (line) => logLines.push(line),
  });
}

describe('el guardador del estado del instrumento', () => {
  it('un cambio suelto se guarda a los 500 ms, y no antes', () => {
    start();
    change(azul);

    advance(499);
    expect(saves).toEqual([]);

    advance(1);
    expect(saves).toEqual([azul]);
  });

  it('sin cambios no guarda nada', () => {
    start();

    advance(5000);

    expect(saves).toEqual([]);
  });

  it('cambios seguidos, uno cada 100 ms, se guardan una vez, 500 ms después del último', () => {
    start();
    for (let step = 0; step < 10; step += 1) {
      change(step % 2 === 0 ? azul : rojo);
      advance(100);
    }
    // El último cambio fue hace 100 ms.
    expect(saves).toEqual([]);

    advance(399);
    expect(saves).toEqual([]);

    advance(1);
    expect(saves).toEqual([rojo]);
  });

  it('cada guardado lleva el estado entero del búfer en ese momento', () => {
    start();
    const dos: InstrumentState = {
      ...azul,
      cabina: { activeEffect: 'energy', values: { energy: {} } },
    };
    change(dos);

    advance(500);

    expect(saves).toEqual([dos]);
  });

  it('dos cambios separados por más de 500 ms son dos guardados', () => {
    start();
    change(azul);
    advance(600);
    change(rojo);
    advance(600);

    expect(saves).toEqual([azul, rojo]);
  });

  it('un guardado de más de 10 ms deja una línea en el log con lo que ha tardado', () => {
    start();
    saveTakesMs = 25;
    change(azul);

    advance(500);

    expect(logLines).toHaveLength(1);
    expect(logLines[0]).toContain('25 ms');
  });

  it('un guardado de 10 ms o menos no escribe nada en el log', () => {
    start();
    saveTakesMs = 10;
    change(azul);

    advance(500);

    expect(saves).toEqual([azul]);
    expect(logLines).toEqual([]);
  });

  it('si el guardado falla, lo dice en el log y sigue guardando los cambios siguientes', () => {
    start();
    saveFails = 'disco lleno';
    change(azul);
    advance(500);
    saveFails = undefined;
    change(rojo);
    advance(500);

    expect(logLines).toHaveLength(1);
    expect(logLines[0]).toContain('disco lleno');
    expect(saves).toEqual([rojo]);
  });

  it('al pararlo deja de escuchar y no guarda lo pendiente', () => {
    const saver = start();
    change(azul);

    saver.stop();
    advance(1000);

    expect(saves).toEqual([]);
    expect(listeners.size).toBe(0);
  });
});
