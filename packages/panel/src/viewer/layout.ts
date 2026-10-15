/**
 * Geometría del visor (decisión 16): una fila por tira, la de su índice en el fichero de
 * configuración, con un punto por LED repartido a lo ancho del visor. Es una función pura, separada
 * del dibujo, para poder probarla sin un canvas.
 */

/** Alto de la fila de cada tira, en píxeles CSS. */
export const ROW_HEIGHT = 24;

/** Parte del hueco de cada LED que ocupa su punto: el resto los separa. */
const DOT_FILL = 0.8;

export interface Dot {
  x: number;
  y: number;
  radius: number;
  /** Color CSS del LED: `rgb(255 169 87)`. */
  color: string;
}

/** Los puntos de las tiras en un visor de `width` píxeles, y el alto que necesita. */
export function layoutStrips(
  frames: ReadonlyMap<number, Uint8Array>,
  width: number,
): { height: number; dots: Dot[] } {
  const dots: Dot[] = [];
  // La fila de cada tira es su índice: hasta que llega el frame de una tira, su fila queda en negro,
  // y las demás no se mueven.
  let rows = 0;

  for (const [row, colors] of frames) {
    rows = Math.max(rows, row + 1);
    const ledCount = colors.length / 3;
    const spacing = width / ledCount;
    const radius = (Math.min(spacing, ROW_HEIGHT) * DOT_FILL) / 2;
    const y = row * ROW_HEIGHT + ROW_HEIGHT / 2;
    for (let led = 0; led < ledCount; led++) {
      const [red, green, blue] = colors.subarray(led * 3, led * 3 + 3);
      dots.push({ x: spacing * (led + 0.5), y, radius, color: `rgb(${red} ${green} ${blue})` });
    }
  }

  // Sin tiras (sin conexión), el visor no se encoge: conserva el alto de una fila, en negro.
  return { height: Math.max(1, rows) * ROW_HEIGHT, dots };
}
