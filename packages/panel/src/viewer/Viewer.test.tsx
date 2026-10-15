import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { type FrameSource, Viewer } from './Viewer.tsx';

/** Un contexto 2D falso que apunta los puntos que se dibujan (jsdom no dibuja en un canvas). */
function recordingContext() {
  const drawn: { x: number; y: number; color: string }[] = [];
  let fillStyle = '';
  let background = 0;
  const context = {
    set fillStyle(value: string) {
      fillStyle = value;
    },
    get fillStyle() {
      return fillStyle;
    },
    fillRect: () => {
      background++;
    },
    beginPath: () => undefined,
    arc: (x: number, y: number) => {
      drawn.push({ x, y, color: fillStyle });
    },
    fill: () => undefined,
    setTransform: () => undefined,
  };
  return { context, drawn, backgrounds: () => background };
}

let canvas: ReturnType<typeof recordingContext>;

beforeEach(() => {
  vi.useFakeTimers();
  canvas = recordingContext();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    canvas.context as unknown as CanvasRenderingContext2D,
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Avanza un frame de pantalla: un `requestAnimationFrame`. */
function nextAnimationFrame() {
  vi.advanceTimersToNextFrame();
}

describe('el visor', () => {
  it('es un canvas con nombre accesible', () => {
    render(<Viewer source={{ frames: new Map() }} />);

    expect(screen.getByRole('img', { name: 'Tiras del visor' }).tagName).toBe('CANVAS');
  });

  it('dibuja una fila por tira y un punto por LED, en el orden del índice', () => {
    const source: FrameSource = {
      frames: new Map([
        [1, new Uint8Array(2 * 3)],
        [0, new Uint8Array(3 * 3)],
      ]),
    };
    render(<Viewer source={source} />);

    nextAnimationFrame();

    const rows = [...new Set(canvas.drawn.map((dot) => dot.y))];
    expect(canvas.drawn).toHaveLength(5);
    expect(rows).toHaveLength(2);
    expect(canvas.drawn.filter((dot) => dot.y === Math.min(...rows))).toHaveLength(3);
  });

  it('pinta cada punto con el color de su LED', () => {
    render(<Viewer source={{ frames: new Map([[0, Uint8Array.of(255, 169, 87)]]) }} />);

    nextAnimationFrame();

    expect(canvas.drawn.map((dot) => dot.color)).toEqual(['rgb(255 169 87)']);
  });

  it('sin conexión (sin frames), queda en negro: ningún punto encendido', () => {
    render(<Viewer source={{ frames: new Map() }} />);

    nextAnimationFrame();

    expect(canvas.backgrounds()).toBeGreaterThan(0);
    expect(canvas.drawn).toHaveLength(0);
  });

  it('en cada frame de pantalla dibuja el último frame de cada tira', () => {
    const frames = new Map([[0, Uint8Array.of(10, 10, 10)]]);
    render(<Viewer source={{ frames }} />);
    nextAnimationFrame();

    frames.set(0, Uint8Array.of(200, 200, 200));
    nextAnimationFrame();

    expect(canvas.drawn.map((dot) => dot.color)).toEqual(['rgb(10 10 10)', 'rgb(200 200 200)']);
  });

  it('al desmontarse, deja de dibujar', () => {
    const { unmount } = render(<Viewer source={{ frames: new Map([[0, new Uint8Array(3)]]) }} />);
    nextAnimationFrame();

    unmount();
    nextAnimationFrame();

    expect(canvas.drawn).toHaveLength(1);
  });
});
