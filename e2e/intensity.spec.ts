import { fileURLToPath } from 'node:url';

import { type Locator, type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-97`: el DJ sube y baja la intensidad de todas las tiras a la vez desde la
 * zona Intensidad (specs/intensity). Un motor propio con el fichero de golpes y dos tiras, una con
 * la respiración y otra con la energía: una de ambiente y una reactiva.
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

/** E1 (control → luz) de `docs/umbrales-para-specs.md`. */
const MAX_RESPONSE_MS = 100;

/** Pasos de cada arrastre, y la pausa entre uno y otro: un arrastre a mano, no un salto. */
const DRAG_STEPS = 12;
const STEP_PAUSE_MS = 40;

/** Cuánto se mira el vúmetro con todo apagado: tiene que pasar al menos un golpe (uno por segundo). */
const METER_SAMPLE_MS = 2500;

/** Bytes de la cabecera de un frame (`docs/instructions/viewer-protocol.md`). */
const FRAME_HEADER_BYTES = 6;

/** Lo que el script de la página anota, con la hora de `performance.now()`. */
interface IntensityTimeline {
  /** Cada movimiento del ratón con el botón pulsado. */
  moves: number[];
  /** Cada `PUT /api/intensity` que sale hacia el motor, con su intensidad. */
  puts: [sentAt: number, intensity: number][];
  /** Cada mensaje `7` que llega, con su intensidad. */
  echoes: [arrivedAt: number, intensity: number][];
  /** Cada frame que llega: su tira y su canal más alto. */
  frames: [arrivedAt: number, stripIndex: number, brightest: number][];
}

declare global {
  interface Window {
    moodTableIntensity: IntensityTimeline;
  }
}

/**
 * Antes de cargar el panel: anota los movimientos del ratón mientras arrastra, los `PUT` de la
 * intensidad que envía el panel y, por el WebSocket del visor, los mensajes `7` y los frames de las
 * dos tiras, como los describe `docs/instructions/viewer-protocol.md`.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.addInitScript((headerBytes) => {
    const timeline: IntensityTimeline = { moves: [], puts: [], echoes: [], frames: [] };
    window.moodTableIntensity = timeline;
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
      if (url.endsWith('/api/intensity') && typeof init?.body === 'string') {
        const { intensity } = JSON.parse(init.body) as { intensity: number };
        timeline.puts.push([performance.now(), intensity]);
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
          if (bytes[0] === 7 && bytes.length === 9) {
            timeline.echoes.push([arrivedAt, new DataView(data).getFloat64(1, false)]);
          }
          if (bytes[0] === 1) {
            let brightest = 0;
            for (let index = headerBytes; index < bytes.length; index++) {
              brightest = Math.max(brightest, bytes[index] ?? 0);
            }
            timeline.frames.push([arrivedAt, bytes[5] ?? -1, brightest]);
          }
        });
      }
    };
  }, FRAME_HEADER_BYTES);
}

/**
 * Lo que tarda la luz en responder a cada movimiento: desde el movimiento hasta que las dos tiras
 * tienen un frame que llega después del eco de un `PUT` que salió tras ese movimiento. El motor
 * aplica la intensidad desde el pulso siguiente, así que todo frame que llega tras el eco ya la lleva.
 */
function responseTimes({ moves, puts, echoes, frames }: IntensityTimeline): number[] {
  return moves.map((movedAt) => {
    const put = puts.find(([sentAt]) => sentAt >= movedAt);
    if (!put) throw new Error(`Ningún PUT salió tras el movimiento de ${movedAt.toFixed(0)} ms`);
    const echo = echoes.find(([arrivedAt, intensity]) => arrivedAt >= put[0] && intensity === put[1]);
    if (!echo) throw new Error(`El motor no confirmó la intensidad ${put[1]}`);
    const lit = [0, 1].map((strip) => {
      const frame = frames.find(([arrivedAt, index]) => index === strip && arrivedAt > echo[0]);
      if (!frame) throw new Error(`No llegó ningún frame de la tira ${strip} tras el eco`);
      return frame[0];
    });
    return Math.max(...lit) - movedAt;
  });
}

function zone(page: Page, name: string) {
  return page.getByRole('region', { name });
}

/** Arrastra el fader en vertical desde su pulgar, `distance` píxeles hacia abajo, paso a paso. */
async function drag(page: Page, thumb: Locator, distance: number): Promise<void> {
  const box = await thumb.boundingBox();
  if (!box) throw new Error('El fader no se ve');
  const x = box.x + box.width / 2;
  const startY = box.y + box.height / 2;
  await page.mouse.move(x, startY);
  await page.mouse.down();
  for (let step = 1; step <= DRAG_STEPS; step++) {
    await page.mouse.move(x, startY + (distance * step) / DRAG_STEPS);
    await page.waitForTimeout(STEP_PAUSE_MS); // NOSONAR: el ritmo de un arrastre a mano es tiempo
  }
  await page.mouse.up();
}

/** La lista vacía: cada arrastre se mide por separado. */
async function resetTimeline(page: Page): Promise<void> {
  await page.evaluate(() => {
    Object.assign(window.moodTableIntensity, { moves: [], puts: [], echoes: [], frames: [] });
  });
}

/** Espera a que la cola se vacíe: el último eco es lo último que salió. */
async function settledTimeline(page: Page): Promise<IntensityTimeline> {
  const timeline = () => page.evaluate(() => window.moodTableIntensity);
  await expect
    .poll(
      async () => {
        const { puts, echoes } = await timeline();
        const last = puts.at(-1);
        const echo = echoes.at(-1);
        return last !== undefined && echo !== undefined && echo[1] === last[1];
      },
      { message: 'el motor confirma la última intensidad enviada' },
    )
    .toBe(true);
  return timeline();
}

/** Los valores distintos que toma el vúmetro (en dB) en `METER_SAMPLE_MS`. */
async function meterValues(page: Page): Promise<number[]> {
  return page.getByRole('meter', { name: 'Nivel de la fuente de audio' }).evaluate(async (element, duration) => {
    const values = new Set<number>();
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      values.add(Number(element.getAttribute('aria-valuenow')));
    }
    return [...values];
  }, METER_SAMPLE_MS);
}

test('el DJ baja la intensidad de todas las tiras a la vez desde el panel', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effects: ['breathing', 'energy'] });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);
    const intensity = zone(page, 'Intensidad');
    const fader = intensity.getByRole('slider', { name: 'Intensidad' });

    // El panel se abre con la intensidad al máximo.
    await expect(fader).toHaveAttribute('aria-valuetext', '100 %');
    await expect(intensity).toContainText('100 %');

    // E1 se mide en directo, con el panel ya usado en las pruebas de antes de la sesión (D98): el
    // DJ baja el fader un paso con el teclado y lo devuelve, y el motor lo confirma.
    await fader.focus();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await settledTimeline(page);

    // Arrastrar el fader: las dos tiras responden a cada movimiento en menos de 100 ms.
    await resetTimeline(page);
    await drag(page, fader, 150);
    const times = responseTimes(await settledTimeline(page));
    expect(times.length, 'movimientos anotados').toBeGreaterThan(DRAG_STEPS / 2);
    // El peor tiempo queda en el informe, para ver cuánto margen deja a los 100 ms.
    test.info().annotations.push({
      type: 'movimiento → luz (intensidad)',
      description: `${Math.max(...times).toFixed(1)} ms`,
    });
    expect(Math.max(...times), 'ms del movimiento a la luz').toBeLessThan(MAX_RESPONSE_MS);
    const dimmed = await fader.getAttribute('aria-valuetext');
    expect(dimmed).not.toBe('100 %');

    // Abajo del todo: todos los puntos del visor se apagan, y el vúmetro sigue moviéndose.
    await resetTimeline(page);
    await drag(page, fader, 2000);
    await expect(fader).toHaveAttribute('aria-valuetext', '0 %');
    const { echoes } = await settledTimeline(page);
    const offSince = echoes.at(-1)?.[0] ?? Infinity;
    await resetTimeline(page);
    const levels = await meterValues(page);
    expect(Math.max(...levels), 'el vúmetro sube con los golpes').toBeGreaterThan(-60);
    const { frames } = await page.evaluate(() => window.moodTableIntensity);
    expect(new Set(frames.map(([, strip]) => strip)), 'llegan frames de las dos tiras').toEqual(
      new Set([0, 1]),
    );
    expect(
      frames.filter(([arrivedAt]) => arrivedAt > offSince).every(([, , brightest]) => brightest === 0),
      'todos los LEDs apagados',
    ).toBe(true);

    // Al recargar el panel, la zona muestra la intensidad que dejó el DJ.
    await page.reload();
    await expect(fader).toHaveAttribute('aria-valuetext', '0 %');
    await expect(intensity).toContainText('0 %');
  } finally {
    await engine.stop();
  }
});
