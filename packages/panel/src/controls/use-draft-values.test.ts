import type { StripState } from '@moodtable/shared';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDraftValues, type ValueRequests } from './use-draft-values.ts';

/** La cabina respirando con `period`, como la cuenta el motor. */
function cabina(period: number): StripState {
  return {
    id: 'cabina',
    name: 'Cabina',
    ledCount: 30,
    output: { type: 'virtual' },
    effect: 'breathing',
    values: { color: '#FFA957', period },
  };
}

/** Una cola de valores falsa: cada envío deja la tira ocupada hasta que el test lo termina. */
function fakeQueue() {
  const busy = new Set<string>();
  const listeners = new Set<() => void>();
  const queue = {
    send: vi.fn((stripId: string) => {
      busy.add(stripId);
    }),
    busy: (stripId: string) => busy.has(stripId),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies ValueRequests;
  /** El último envío de la tira vuelve (aplicado o no): la cola se queda vacía y avisa. */
  const finish = (stripId: string) => {
    act(() => {
      busy.delete(stripId);
      for (const listener of listeners) listener();
    });
  };
  return { queue, finish };
}

function draftOf(strip: StripState) {
  const { queue, finish } = fakeQueue();
  const hook = renderHook(({ current }) => useDraftValues(current, queue), {
    initialProps: { current: strip },
  });
  /** Llega el mensaje `6` con la tira como la pinta el motor. */
  const echo = (current: StripState) => {
    hook.rerender({ current });
  };
  const change = (param: string, value: unknown) => {
    act(() => {
      hook.result.current.change(param, value);
    });
  };
  const release = () => {
    act(() => {
      hook.result.current.release();
    });
  };
  const period = () => (hook.result.current.values as { period: number }).period;
  return { queue, finish, echo, change, release, period, hook };
}

describe('los valores que muestra un control', () => {
  it('en reposo, los que pinta el motor', () => {
    const draft = draftOf(cabina(4));

    expect(draft.period()).toBe(4);
    draft.echo(cabina(6));
    expect(draft.period()).toBe(6);
  });

  it('mover un control envía todos los valores de la tira', () => {
    const draft = draftOf(cabina(4));

    draft.change('period', 5);

    expect(draft.queue.send).toHaveBeenCalledWith('cabina', { color: '#FFA957', period: 5 });
  });

  it('mientras se arrastra, el control sigue al dedo aunque llegue un eco atrasado', () => {
    const draft = draftOf(cabina(2));
    draft.change('period', 3);
    draft.change('period', 5);

    draft.echo(cabina(3));

    expect(draft.period()).toBe(5);
  });

  it('al soltar, sigue con su valor hasta que la cola se vacía, y entonces muestra el del motor', () => {
    const draft = draftOf(cabina(2));
    draft.change('period', 6);
    draft.release();

    draft.echo(cabina(4));
    expect(draft.period()).toBe(6);

    draft.finish('cabina');
    draft.echo(cabina(6));
    expect(draft.period()).toBe(6);
  });

  it('si el motor no aplica el valor, al vaciarse la cola vuelve al que pinta', () => {
    const draft = draftOf(cabina(4));
    draft.change('period', 8);
    draft.release();

    draft.finish('cabina');

    expect(draft.period()).toBe(4);
  });

  it('mientras se arrastra, que se vacíe la cola no lo devuelve al motor', () => {
    const draft = draftOf(cabina(4));
    draft.change('period', 6);

    draft.finish('cabina');

    expect(draft.period()).toBe(6);
  });

  it('el valor local es de su tira: otra tira muestra los suyos', () => {
    const draft = draftOf(cabina(4));
    draft.change('period', 6);

    draft.echo({ ...cabina(9), id: 'barra' });

    expect(draft.period()).toBe(9);
  });
});
