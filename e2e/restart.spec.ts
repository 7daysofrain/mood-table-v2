import { fileURLToPath } from 'node:url';

import { type Locator, type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-25`: tras un corte, el motor vuelve con el último estado del instrumento
 * que llegó a guardarse (specs/instrument-state, *Tras reiniciar, cada tira vuelve con su efecto y
 * sus valores* y *El estado se guarda cuando el DJ deja de tocar*). Cada test lanza su propio motor,
 * con el estado en un SQLite de la carpeta del test, y lo mata con `SIGKILL`, que no le deja cerrar
 * nada, como desenchufar la mesa.
 */

/** El fichero de golpes: la fuente de audio que deja pasar una tira a la energía. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

/** Más que los 500 ms que espera el motor para guardar tras el último cambio (D103). */
const SAVED_AFTER_MS = 1000;

/** Pasos de un arrastre, y la pausa entre uno y otro: un arrastre a mano, siempre por debajo de 500 ms. */
const DRAG_STEPS = 12;
const STEP_PAUSE_MS = 40;

/** Lo que el script de la página anota. */
interface RestartTimeline {
  /** Las tiras de cada mensaje `6`: su efecto y sus valores, en JSON. */
  strips: string[];
  /** El color de cada frame de la tira 0 con todos sus LEDs iguales y alguno por encima de 64. */
  frames: [red: number, green: number, blue: number][];
}

declare global {
  interface Window {
    moodTableRestart: RestartTimeline;
  }
}

/**
 * Antes de cargar el panel: anota, por el WebSocket del visor, las tiras de cada mensaje `6` y el
 * color de los frames de la tira 0 que pinta la respiración bien encendida, para que el redondeo no
 * esconda el color (`docs/instructions/viewer-protocol.md`). Al recargar, empieza de cero.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timeline: RestartTimeline = { strips: [], frames: [] };
    window.moodTableRestart = timeline;
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
              strips: { effect: string; values: unknown }[];
            };
            timeline.strips.push(JSON.stringify(strips.map(({ effect, values }) => ({ effect, values }))));
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

/** Las tiras del último mensaje `6`: lo que el motor confirma que pinta. */
async function lastStrips(page: Page): Promise<{ effect: string; values: Record<string, unknown> }[]> {
  const last = (await page.evaluate(() => window.moodTableRestart.strips)).at(-1);
  return last ? (JSON.parse(last) as { effect: string; values: Record<string, unknown> }[]) : [];
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

function zone(page: Page, name: string) {
  return page.getByRole('region', { name });
}

function effect(page: Page, name: string) {
  return zone(page, 'Efectos').getByRole('button', { name: new RegExp(`^${name}`) });
}

function strip(page: Page, name: string) {
  return zone(page, 'Tiras').getByRole('radio', { name: new RegExp(`^${name}`) });
}

/** Pulsa el botón en el centro de `target` y lo mueve en horizontal `distance` píxeles, paso a paso. */
async function dragWithoutRelease(page: Page, target: Locator, distance: number): Promise<void> {
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
}

test('tras un corte, cada tira vuelve con el efecto y los valores que dejó el DJ', async ({ page }) => {
  const engine = await createTestEngine({
    audioFile: GOLPES,
    effects: ['breathing', 'breathing'],
    persistState: true,
  });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    const controls = zone(page, 'Controles');
    const period = controls.getByRole('slider', { name: 'Periodo (s)' });
    const color = controls.getByRole('group', { name: 'Color' });

    // En la primera tira, el DJ pone el periodo al mínimo y cambia el color.
    await expect(strip(page, 'Tira de los E2E')).toBeChecked();
    await expect(color).toContainText('#FFA957');
    await period.focus();
    await page.keyboard.press('Home');
    await expect(period).toHaveAttribute('aria-valuetext', '1,0');
    await dragWithoutRelease(page, controls.getByRole('slider', { name: 'Saturación y brillo' }), -80);
    await page.mouse.up();
    const colorText = (await color.textContent())?.match(/#[0-9A-F]{6}/)?.[0] ?? '';
    expect(colorText).not.toBe('#FFA957');
    expect(colorText).not.toBe('');

    // En la segunda, la energía.
    await strip(page, 'Tira 2 de los E2E').click();
    await effect(page, 'Energía').click();
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');

    // El motor lo confirma todo. El selector manda el color en minúsculas.
    await expect
      .poll(async () => JSON.stringify(await lastStrips(page)).toUpperCase(), {
        message: 'el motor pinta lo que ha dejado el DJ',
      })
      .toBe(
        JSON.stringify([
          { effect: 'breathing', values: { color: colorText, period: 1 } },
          { effect: 'energy', values: {} },
        ]).toUpperCase(),
      );

    // Pasado 1 s, se va la luz y el motor vuelve a arrancar.
    await page.waitForTimeout(SAVED_AFTER_MS); // NOSONAR: pasar los 500 ms del guardado es tiempo
    await engine.kill();
    await engine.start();
    await page.reload();

    // El panel muestra los dos efectos y esos valores.
    await expect(strip(page, 'Tira de los E2E')).toBeChecked();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(period).toHaveAttribute('aria-valuetext', '1,0');
    await expect(color).toContainText(colorText);
    await strip(page, 'Tira 2 de los E2E').click();
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');

    // Y el visor pinta la primera tira con ese color, no con el blanco cálido por defecto.
    await expect
      .poll(async () => (await page.evaluate(() => window.moodTableRestart.frames)).length, {
        message: 'la tira respira bien encendida',
      })
      .toBeGreaterThan(0);
    const { frames } = await page.evaluate(() => window.moodTableRestart);
    expect(frames.every((frame) => paints(colorText, frame))).toBe(true);
    expect(frames.some((frame) => paints('#FFA957', frame))).toBe(false);
  } finally {
    await engine.stop();
  }
});

test('si se va la luz en mitad de un arrastre, el periodo vuelve al de antes', async ({ page }) => {
  const engine = await createTestEngine({ effect: 'breathing', persistState: true });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    const period = zone(page, 'Controles').getByRole('slider', { name: 'Periodo (s)' });

    // El periodo, al mínimo, y guardado.
    await period.focus();
    await page.keyboard.press('Home');
    await expect
      .poll(async () => (await lastStrips(page))[0]?.values.period, { message: 'el motor tiene 1 s' })
      .toBe(1);
    await page.waitForTimeout(SAVED_AFTER_MS); // NOSONAR: pasar los 500 ms del guardado es tiempo

    // El DJ arrastra el periodo hacia arriba y, sin soltar, se va la luz: nada más acabar el último
    // paso, antes de que pasen 500 ms. Después se comprueba que el motor sí seguía el arrastre.
    await dragWithoutRelease(page, period, 150);
    await engine.kill();
    await page.mouse.up();
    expect((await lastStrips(page))[0]?.values.period, 'el motor seguía el arrastre').toBeGreaterThan(1);

    // Al volver, el periodo es el de antes del arrastre.
    await engine.start();
    await page.reload();
    await expect(period).toHaveAttribute('aria-valuetext', '1,0');
  } finally {
    await engine.stop();
  }
});
