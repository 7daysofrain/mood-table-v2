import { fileURLToPath } from 'node:url';

import { type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-94`: el DJ cambia el efecto de una tira desde el panel, con la música
 * sonando (specs/instrument-control). Lanza su propio motor, con el fichero de golpes y la tira con
 * energía.
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

/** E1 (control → luz) de `docs/umbrales-para-specs.md`. */
const MAX_SWITCH_MS = 100;

/** Lo que el script de la página anota: cuándo pulsó el DJ y cuándo llegó cada frame de la tira. */
interface Timeline {
  pressedAt: number | undefined;
  /** Instante de llegada de cada frame de la tira, y si es de la respiración. */
  frames: [arrivedAt: number, breathing: boolean][];
}

declare global {
  interface Window {
    moodTableTimeline: Timeline;
  }
}

/**
 * Antes de cargar el panel: anota el instante del primer `pointerdown` y el de cada frame de la
 * tira 0 que llega por el WebSocket del visor (tipo `1`, `docs/instructions/viewer-protocol.md`).
 * Un frame es de la respiración si todos sus LEDs tienen el mismo color y no están apagados: la
 * respiración nunca baja del 5 %, y energía con este fichero es un dibujo en espejo o negro.
 */
async function recordTimeline(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const timeline: Timeline = { pressedAt: undefined, frames: [] };
    window.moodTableTimeline = timeline;
    document.addEventListener(
      'pointerdown',
      () => {
        timeline.pressedAt ??= performance.now();
      },
      { capture: true },
    );
    const HEADER_BYTES = 6;
    const NativeWebSocket = window.WebSocket;
    window.WebSocket = class extends NativeWebSocket {
      constructor(...args: ConstructorParameters<typeof WebSocket>) {
        super(...args);
        this.addEventListener('message', ({ data }: MessageEvent) => {
          if (!(data instanceof ArrayBuffer)) return;
          const bytes = new Uint8Array(data);
          if (bytes[0] !== 1 || bytes[5] !== 0) return;
          const [red = 0, green = 0, blue = 0] = bytes.subarray(HEADER_BYTES, HEADER_BYTES + 3);
          let uniform = true;
          for (let index = HEADER_BYTES; index < bytes.length; index += 3) {
            if (bytes[index] !== red || bytes[index + 1] !== green || bytes[index + 2] !== blue) {
              uniform = false;
              break;
            }
          }
          timeline.frames.push([performance.now(), uniform && red + green + blue > 0]);
        });
      }
    };
  });
}

function zone(page: Page, name: string) {
  return page.getByRole('region', { name });
}

function effect(page: Page, name: string) {
  return zone(page, 'Efectos').getByRole('button', { name: new RegExp(`^${name}`) });
}

test('el DJ cambia el efecto de la tira desde el panel', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();
  // El motor se para aunque falle una comprobación: si no, quedaría vivo con su puerto ocupado.
  try {
    await recordTimeline(page);
    await page.goto(engine.url);

    // El DJ ve su tira, seleccionada, con el efecto que pinta el motor marcado.
    const strip = zone(page, 'Tiras').getByRole('radio', { name: /Tira de los E2E/ });
    await expect(strip).toBeChecked();
    await expect(strip).toContainText('60 LEDs · Virtual');
    await expect(effect(page, 'Energía')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Respiración')).not.toHaveAttribute('aria-current');

    // Elige la respiración: la tira se pinta con ella en menos de 100 ms desde que la pulsa.
    await effect(page, 'Respiración').click();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
    // El motor avisa del efecto nuevo al recibir el cambio, y el frame llega en el pulso siguiente:
    // se espera a tenerlo antes de leer los tiempos. El que cuenta es el de su llegada, no este.
    const timeline = () => page.evaluate(() => window.moodTableTimeline);
    await expect
      .poll(
        async () => {
          const { pressedAt: pressed, frames: arrived } = await timeline();
          return (
            pressed !== undefined &&
            arrived.some(([arrivedAt, breathing]) => arrivedAt >= pressed && breathing)
          );
        },
        { message: 'la tira pinta la respiración' },
      )
      .toBe(true);
    const { pressedAt, frames } = await timeline();
    if (pressedAt === undefined) throw new Error('No se anotó la pulsación');
    expect(
      frames.some(([arrivedAt, breathing]) => arrivedAt < pressedAt && breathing),
      'antes de pulsar, la tira no pinta la respiración',
    ).toBe(false);
    const firstBreathing = frames.find(
      ([arrivedAt, breathing]) => arrivedAt >= pressedAt && breathing,
    );
    if (!firstBreathing) throw new Error('La tira no ha pintado la respiración');
    // El tiempo medido queda en el informe, para ver cuánto margen deja a los 100 ms.
    const switchMs = firstBreathing[0] - pressedAt;
    test.info().annotations.push({
      type: 'pulsar → respiración',
      description: `${switchMs.toFixed(1)} ms`,
    });
    expect(switchMs).toBeLessThan(MAX_SWITCH_MS);

    // Al recargar, el panel marca lo que pinta el motor, no lo que dice el fichero.
    await page.reload();
    await expect(effect(page, 'Respiración')).toHaveAttribute('aria-current', 'true');
    await expect(effect(page, 'Energía')).not.toHaveAttribute('aria-current');
  } finally {
    await engine.stop();
  }
});
