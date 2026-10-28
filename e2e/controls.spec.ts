import { type Locator, type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-95`: el DJ mueve los controles de la respiración de una tira y la luz
 * responde mientras arrastra (specs/instrument-control). Lanza su propio motor, sin fuente de audio
 * y con la tira respirando.
 */

/** E1 (control → luz) de `docs/umbrales-para-specs.md`. */
const MAX_RESPONSE_MS = 100;

/** Pasos de cada arrastre, y la pausa entre uno y otro: un arrastre a mano, no un salto. */
const DRAG_STEPS = 12;
const STEP_PAUSE_MS = 40;

/** Lo que el script de la página anota, con la hora de `performance.now()`. */
interface ControlsTimeline {
  /** Cada movimiento del ratón con el botón pulsado. */
  moves: number[];
  /** Cada `PUT` de valores que sale hacia el motor, con su cuerpo en JSON. */
  puts: [sentAt: number, body: string][];
  /** Cada mensaje `6` que llega, con los valores de la tira en JSON. */
  echoes: [arrivedAt: number, values: string][];
  /** Cada frame de la tira que llega. */
  frames: number[];
}

declare global {
  interface Window {
    moodTableControls: ControlsTimeline;
  }
}

/**
 * Antes de cargar el panel: anota los movimientos del ratón mientras arrastra, los `PUT` de valores
 * que envía el panel y, por el WebSocket del visor, los mensajes de las tiras (tipo `6`) y los
 * frames de la tira 0 (tipo `1`), como los describe `docs/instructions/viewer-protocol.md`.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timeline: ControlsTimeline = { moves: [], puts: [], echoes: [], frames: [] };
    window.moodTableControls = timeline;
    document.addEventListener(
      'mousemove',
      (event) => {
        if (event.buttons === 1) timeline.moves.push(performance.now());
      },
      { capture: true },
    );
    const nativeFetch = window.fetch.bind(window);
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      if (url.endsWith('/values') && typeof init?.body === 'string') {
        timeline.puts.push([performance.now(), init.body]);
      }
      return nativeFetch(input, init);
    };
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        super(...args);
        this.addEventListener('message', ({ data }: MessageEvent) => {
          if (!(data instanceof ArrayBuffer)) return;
          const bytes = new Uint8Array(data);
          const arrivedAt = performance.now();
          if (bytes[0] === 1 && bytes[5] === 0) timeline.frames.push(arrivedAt);
          if (bytes[0] === 6) {
            const { strips } = JSON.parse(new TextDecoder().decode(bytes.subarray(1))) as {
              strips: { values: unknown }[];
            };
            timeline.echoes.push([arrivedAt, JSON.stringify(strips[0]?.values)]);
          }
        });
      }
    };
  });
}

/** Los mismos valores, con los campos en cualquier orden. */
function sameValues(a: string, b: string): boolean {
  const sorted = (json: string) => JSON.stringify(Object.entries(JSON.parse(json) as object).sort());
  return sorted(a) === sorted(b);
}

/**
 * Lo que tarda la luz en responder a cada movimiento: desde el movimiento hasta el primer frame que
 * llega después del eco de un `PUT` que salió tras ese movimiento. Cuenta también lo que el cambio
 * espera en la cola, con otro en camino. El motor aplica los valores antes del pulso siguiente, así
 * que todo frame que llega tras el eco ya los pinta.
 */
function responseTimes({ moves, puts, echoes, frames }: ControlsTimeline): number[] {
  return moves.map((movedAt) => {
    const put = puts.find(([sentAt]) => sentAt >= movedAt);
    if (!put) throw new Error(`Ningún PUT salió tras el movimiento de ${movedAt.toFixed(0)} ms`);
    const echo = echoes.find(([arrivedAt, values]) => arrivedAt >= put[0] && sameValues(values, put[1]));
    if (!echo) throw new Error(`El motor no confirmó ${put[1]}`);
    const frame = frames.find((arrivedAt) => arrivedAt > echo[0]);
    if (frame === undefined) throw new Error('No llegó ningún frame tras el eco');
    return frame - movedAt;
  });
}

function zone(page: Page, name: string) {
  return page.getByRole('region', { name });
}

/** Arrastra `target` en horizontal desde su centro, `distance` píxeles, paso a paso. */
async function drag(page: Page, target: Locator, distance: number): Promise<void> {
  const box = await target.boundingBox();
  if (!box) throw new Error('El control no se ve');
  const y = box.y + box.height / 2;
  const startX = box.x + box.width / 2;
  await page.mouse.move(startX, y);
  await page.mouse.down();
  for (let step = 1; step <= DRAG_STEPS; step++) {
    await page.mouse.move(startX + (distance * step) / DRAG_STEPS, y);
    await page.waitForTimeout(STEP_PAUSE_MS); // NOSONAR: el ritmo de un arrastre a mano es tiempo
  }
  await page.mouse.up();
}

/** La lista vacía: cada arrastre se mide por separado. */
async function resetTimeline(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.assign(window.moodTableControls, { moves: [], puts: [], echoes: [], frames: [] });
  });
}

/** Espera a que la cola de valores se vacíe: el último eco es lo último que salió. */
async function settledTimeline(page: Page): Promise<ControlsTimeline> {
  const timeline = () => page.evaluate(() => window.moodTableControls);
  await expect
    .poll(
      async () => {
        const { puts, echoes } = await timeline();
        const last = puts.at(-1);
        const echo = echoes.at(-1);
        return last !== undefined && echo !== undefined && sameValues(echo[1], last[1]);
      },
      { message: 'el motor confirma el último valor enviado' },
    )
    .toBe(true);
  return timeline();
}

test('el DJ mueve los controles de la respiración y la luz responde mientras arrastra', async ({
  page,
}) => {
  const engine = await createTestEngine({ effect: 'breathing' });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    const controls = zone(page, 'Controles');
    const period = controls.getByRole('slider', { name: 'Periodo (s)' });
    const color = controls.getByRole('group', { name: 'Color' });

    // La zona Controles muestra el color y el periodo con que pinta el motor.
    await expect(color).toContainText('#FFA957');
    await expect(period).toHaveAttribute('aria-valuetext', '4,0');

    // Arrastrar el periodo: la luz responde a cada movimiento en menos de 100 ms.
    await resetTimeline(page);
    await drag(page, period, 120);
    const periodTimes = responseTimes(await settledTimeline(page));
    expect(periodTimes.length, 'movimientos anotados del periodo').toBeGreaterThan(DRAG_STEPS / 2);
    expect(Math.max(...periodTimes), 'ms del movimiento a la luz (periodo)').toBeLessThan(MAX_RESPONSE_MS);

    // Al soltar, la tira se queda con el valor del control.
    const periodText = await period.getAttribute('aria-valuetext');
    expect(periodText).not.toBe('4,0');
    const { echoes: afterPeriod } = await settledTimeline(page);
    const finalPeriod = (JSON.parse(afterPeriod.at(-1)?.[1] ?? '{}') as { period: number }).period;
    expect(finalPeriod.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe(
      periodText,
    );

    // Arrastrar el color por el selector: también en menos de 100 ms.
    await resetTimeline(page);
    await drag(page, controls.getByRole('slider', { name: 'Saturación y brillo' }), -80);
    const colorTimes = responseTimes(await settledTimeline(page));
    expect(colorTimes.length, 'movimientos anotados del color').toBeGreaterThan(DRAG_STEPS / 2);
    expect(Math.max(...colorTimes), 'ms del movimiento a la luz (color)').toBeLessThan(MAX_RESPONSE_MS);
    const colorText = (await color.textContent())?.match(/#[0-9A-F]{6}/)?.[0];
    expect(colorText).toBeDefined();
    expect(colorText).not.toBe('#FFA957');

    // Al recargar el panel, los controles muestran los valores que pinta el motor.
    await page.reload();
    await expect(period).toHaveAttribute('aria-valuetext', periodText ?? '');
    await expect(color).toContainText(colorText ?? '');
  } finally {
    await engine.stop();
  }
});
