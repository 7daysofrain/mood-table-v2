import { fileURLToPath } from 'node:url';

import { type Locator, type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de las historias `MOO-95`, el DJ mueve los controles de la respiración de una tira y la luz
 * responde mientras arrastra, y `MOO-96`, al volver a la respiración la tira recupera sus valores
 * (specs/instrument-control). Cada test lanza su propio motor con la tira respirando: el de `MOO-95`
 * sin fuente de audio, y el de `MOO-96` con el fichero de golpes, para poder pasar a la energía.
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

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

/** Lo que el script de la página anota para `MOO-96`. */
interface RecallTimeline {
  /** Los valores de la tira de cada mensaje `6`, en JSON. */
  echoes: string[];
  /** El color de cada frame de la tira con todos sus LEDs iguales y alguno por encima de 64. */
  frames: [red: number, green: number, blue: number][];
}

declare global {
  interface Window {
    moodTableControls: ControlsTimeline;
    moodTableRecall: RecallTimeline;
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

    // E1 se mide en directo, con el panel ya usado en las pruebas de antes de la sesión (D98): el
    // DJ mueve el periodo un paso con el teclado y lo devuelve, y el motor lo confirma.
    await period.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowLeft');
    await settledTimeline(page);

    // Arrastrar el periodo: la luz responde a cada movimiento en menos de 100 ms.
    await resetTimeline(page);
    await drag(page, period, 120);
    const periodTimes = responseTimes(await settledTimeline(page));
    expect(periodTimes.length, 'movimientos anotados del periodo').toBeGreaterThan(DRAG_STEPS / 2);
    // El peor tiempo queda en el informe, para ver cuánto margen deja a los 100 ms.
    test.info().annotations.push({
      type: 'movimiento → luz (periodo)',
      description: `${Math.max(...periodTimes).toFixed(1)} ms`,
    });
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
    test.info().annotations.push({
      type: 'movimiento → luz (color)',
      description: `${Math.max(...colorTimes).toFixed(1)} ms`,
    });
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

/**
 * Antes de cargar el panel: anota los valores de la tira de cada mensaje `6` y el color de los
 * frames de la tira 0 que pinta la respiración bien encendida: todos los LEDs iguales y alguno por
 * encima de 64, para que el redondeo no esconda el color (`docs/instructions/viewer-protocol.md`).
 * La energía con el fichero de golpes es un dibujo en espejo o negro, así que no entra.
 */
async function recordRecall(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timeline: RecallTimeline = { echoes: [], frames: [] };
    window.moodTableRecall = timeline;
    const HEADER_BYTES = 6;
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        super(...args);
        this.addEventListener('message', ({ data }: MessageEvent) => {
          if (!(data instanceof ArrayBuffer)) return;
          const bytes = new Uint8Array(data);
          if (bytes[0] === 6) {
            const { strips } = JSON.parse(new TextDecoder().decode(bytes.subarray(1))) as {
              strips: { values: unknown }[];
            };
            timeline.echoes.push(JSON.stringify(strips[0]?.values));
          }
          if (bytes[0] !== 1 || bytes[5] !== 0) return;
          const [red = 0, green = 0, blue = 0] = bytes.subarray(HEADER_BYTES, HEADER_BYTES + 3);
          for (let index = HEADER_BYTES; index < bytes.length; index += 3) {
            if (bytes[index] !== red || bytes[index + 1] !== green || bytes[index + 2] !== blue) return;
          }
          if (Math.max(red, green, blue) > 64) timeline.frames.push([red, green, blue]);
        });
      }
    };
  });
}

/**
 * Si `frame` es la respiración con el color `hex`: cada canal es el del color por el mismo brillo,
 * que se saca del canal más alto. Con el redondeo, cada canal puede desviarse un punto.
 */
function paints(hex: string, [red, green, blue]: [number, number, number]): boolean {
  const color = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  const brightest = Math.max(...color);
  const level = Math.max(red, green, blue) / brightest;
  return [red, green, blue].every((channel, index) => Math.abs(channel - (color[index] ?? 0) * level) <= 1.5);
}

function effect(page: Page, name: string) {
  return zone(page, 'Efectos').getByRole('button', { name: new RegExp(`^${name}`) });
}

test('al volver a la respiración, la tira recupera el color y el periodo que dejó el DJ', async ({
  page,
}) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'breathing' });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordRecall(page);
    await page.goto(engine.url);
    const controls = zone(page, 'Controles');
    const period = controls.getByRole('slider', { name: 'Periodo (s)' });
    const color = controls.getByRole('group', { name: 'Color' });
    await expect(color).toContainText('#FFA957');

    // El DJ cambia el periodo, al mínimo, y el color.
    await period.focus();
    await page.keyboard.press('Home');
    await expect(period).toHaveAttribute('aria-valuetext', '1,0');
    await drag(page, controls.getByRole('slider', { name: 'Saturación y brillo' }), -80);
    const colorText = (await color.textContent())?.match(/#[0-9A-F]{6}/)?.[0] ?? '';
    expect(colorText).not.toBe('#FFA957');
    expect(colorText).not.toBe('');
    // Antes de cambiar de efecto, el motor ya tiene los valores: uno que va de camino al cambiar de
    // efecto se pierde (decisión 3 del change strip-effect-recall), y no es lo que se prueba aquí.
    // El selector manda el color en minúsculas, y la cabecera lo enseña en mayúsculas.
    const expected = JSON.stringify({ color: colorText, period: 1 }).toUpperCase();
    await expect
      .poll(
        async () => (await page.evaluate(() => window.moodTableRecall.echoes)).at(-1)?.toUpperCase(),
        { message: 'el motor confirma el color y el periodo' },
      )
      .toBe(expected);

    // Pasa la tira a la energía y vuelve a abrir el panel.
    await effect(page, 'Energía').click();
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    await expect(controls.getByRole('slider')).toHaveCount(0);
    await page.reload();
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');

    // Vuelve a la respiración: los controles muestran el color y el periodo que dejó...
    await effect(page, 'Respiración').click();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(period).toHaveAttribute('aria-valuetext', '1,0');
    await expect(color).toContainText(colorText);

    // ...y el visor pinta la tira con ese color, no con el blanco cálido por defecto.
    await expect
      .poll(async () => (await page.evaluate(() => window.moodTableRecall.frames)).length, {
        message: 'la tira respira bien encendida',
      })
      .toBeGreaterThan(0);
    const { frames } = await page.evaluate(() => window.moodTableRecall);
    expect(frames.every((frame) => paints(colorText, frame))).toBe(true);
    expect(frames.some((frame) => paints('#FFA957', frame))).toBe(false);
  } finally {
    await engine.stop();
  }
});
