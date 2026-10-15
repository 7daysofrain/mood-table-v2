import { useEffect, useRef } from 'react';

import { layoutStrips } from './layout.ts';

/** De dónde lee el visor los frames: el último de cada tira, por su índice. */
export interface FrameSource {
  readonly frames: ReadonlyMap<number, Uint8Array>;
}

const BACKGROUND = 'black';

/**
 * Visor del panel (specs/viewer): un `<canvas>` del navegador, sin librería de dibujo (decisión 16).
 * En cada `requestAnimationFrame` dibuja el último frame recibido de cada tira, así que nunca acumula
 * retraso; sin conexión no hay frames y queda en negro (decisión 14). No calcula colores: los pinta
 * tal como llegan del motor.
 */
export function Viewer({ source }: { source: FrameSource }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    let request = 0;
    const draw = () => {
      const width = canvas.clientWidth;
      const { height, dots } = layoutStrips(source.frames, width);
      // El canvas se dibuja a la resolución de la pantalla, para que los puntos no se vean borrosos.
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
      if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);

      context.fillStyle = BACKGROUND;
      context.fillRect(0, 0, width, height);
      for (const dot of dots) {
        context.fillStyle = dot.color;
        context.beginPath();
        context.arc(dot.x, dot.y, dot.radius, 0, 2 * Math.PI);
        context.fill();
      }
      request = requestAnimationFrame(draw);
    };
    request = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(request);
    };
  }, [source]);

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Tiras del visor"
      style={{ display: 'block', width: '100%' }}
    />
  );
}
