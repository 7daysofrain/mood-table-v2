import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { INTENSITY_KEY, type QueueListener } from '../engine/request-queue.ts';
import { type IntensityRequests, useDraftIntensity } from './use-draft-intensity.ts';

/** Una cola falsa: cada envío la deja ocupada hasta que el test lo termina. */
function fakeQueue() {
  let busy = false;
  const listeners = new Set<QueueListener>();
  const queue = {
    send: vi.fn(() => {
      busy = true;
    }),
    busy: () => busy,
    subscribe: (listener: QueueListener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies IntensityRequests;
  /** El último envío vuelve, aplicado o no: la cola se queda vacía y avisa. */
  const finish = (applied: boolean) => {
    act(() => {
      busy = false;
      for (const listener of listeners) listener(INTENSITY_KEY, applied);
    });
  };
  return { queue, finish };
}

/** El hook con la intensidad del motor `engine`, que el test cambia como si llegara un `7`. */
function draftOf(engine: number | undefined) {
  const { queue, finish } = fakeQueue();
  const hook = renderHook(({ current }) => useDraftIntensity(current, queue), {
    initialProps: { current: engine },
  });
  const echo = (current: number | undefined) => {
    hook.rerender({ current });
  };
  const change = (value: number) => {
    act(() => {
      hook.result.current.change(value);
    });
  };
  const release = () => {
    act(() => {
      hook.result.current.release();
    });
  };
  const shown = () => hook.result.current.intensity;
  return { queue, finish, echo, change, release, shown };
}

// specs/intensity; decisiones 7 y 9 del change instrument-intensity.
describe('la intensidad que muestra el fader', () => {
  it('en reposo, la del motor', () => {
    const draft = draftOf(1);

    expect(draft.shown()).toBe(1);
    draft.echo(0.4);
    expect(draft.shown()).toBe(0.4);
  });

  it('mover el fader envía la intensidad nueva', () => {
    const draft = draftOf(1);

    draft.change(0.4);

    expect(draft.queue.send).toHaveBeenCalledWith(INTENSITY_KEY, 0.4);
  });

  it('mientras arrastra, sigue al dedo aunque llegue un eco atrasado', () => {
    const draft = draftOf(1);

    draft.change(0.7);
    draft.change(0.4);
    draft.echo(0.7);

    expect(draft.shown()).toBe(0.4);
  });

  it('al soltar, sigue con su valor hasta que la cola se vacía y llega el eco', () => {
    const draft = draftOf(1);
    draft.change(0.4);

    draft.release();
    expect(draft.shown()).toBe(0.4);
    draft.finish(true);
    expect(draft.shown()).toBe(0.4);
    draft.echo(0.4);
    expect(draft.shown()).toBe(0.4);

    // Ya manda el motor: otro cambio, de otro panel, se ve.
    draft.echo(0.6);
    expect(draft.shown()).toBe(0.6);
  });

  it('si el eco llega antes de que la cola se vacíe, también acaba en la del motor', () => {
    const draft = draftOf(1);
    draft.change(0.4);
    draft.release();

    draft.echo(0.4);
    draft.finish(true);
    draft.echo(0.5);

    expect(draft.shown()).toBe(0.5);
  });

  it('si el motor no la aplica, vuelve a la intensidad que pinta', () => {
    const draft = draftOf(1);
    draft.change(0.3);
    draft.release();

    draft.finish(false);

    expect(draft.shown()).toBe(1);
  });

  it('si el motor no la aplica mientras arrastra, sigue al dedo hasta soltar', () => {
    const draft = draftOf(1);
    draft.change(0.3);

    draft.finish(false);
    expect(draft.shown()).toBe(0.3);
    draft.release();

    expect(draft.shown()).toBe(1);
  });

  it('lo que envía va redondeado a dos decimales', () => {
    const draft = draftOf(1);

    draft.change(0.07000000000000001);
    draft.change(0.456);

    expect(draft.queue.send.mock.calls).toEqual([
      [INTENSITY_KEY, 0.07],
      [INTENSITY_KEY, 0.46],
    ]);
    expect(draft.shown()).toBe(0.46);
  });

  it('sin la intensidad del motor, no muestra ninguna ni envía', () => {
    const draft = draftOf(undefined);

    draft.change(0.4);

    expect(draft.shown()).toBeUndefined();
    expect(draft.queue.send).not.toHaveBeenCalled();
  });

  it('al perder la conexión a medio arrastre, olvida el valor local', () => {
    const draft = draftOf(1);
    draft.change(0.4);

    draft.echo(undefined);
    expect(draft.shown()).toBeUndefined();
    draft.echo(0.8);

    expect(draft.shown()).toBe(0.8);
  });
});
