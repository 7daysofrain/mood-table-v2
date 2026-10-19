import { fileURLToPath } from 'node:url';

import { type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-14` (HU2): la tira virtual reacciona a un fichero de audio y la cabecera
 * muestra la fuente y su nivel (specs/audio-source). Con fuente de audio, cada test lanza su motor con
 * el fichero de golpes aislados de los tests; sin fuente, usa el del `webServer` (`e2e/config.json`).
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

const METER = { name: 'Nivel de la fuente de audio' };

/** Los golpes duran unos 90 ms por segundo: se muestrea en cada frame de pantalla, durante 3 s. */
const SAMPLE_MS = 3000;

/** El brillo del visor (suma de los canales RGB) más bajo y más alto en `SAMPLE_MS`. */
async function viewerBrightnessRange(page: Page): Promise<{ min: number; max: number }> {
  return page.getByRole('img', { name: 'Tiras del visor' }).evaluate(async (element, duration) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    let min = Infinity;
    let max = -Infinity;
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      if (!context || canvas.width === 0 || canvas.height === 0) continue;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      for (let index = 0; index < data.length; index += 4) {
        sum += (data[index] ?? 0) + (data[index + 1] ?? 0) + (data[index + 2] ?? 0);
      }
      min = Math.min(min, sum);
      max = Math.max(max, sum);
    }
    return { min, max };
  }, SAMPLE_MS);
}

/** Los valores distintos que toma el vúmetro (en dB) en `SAMPLE_MS`. */
async function meterValues(page: Page): Promise<number[]> {
  return page.getByRole('meter', METER).evaluate(async (element, duration) => {
    const values = new Set<number>();
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      values.add(Number(element.getAttribute('aria-valuenow')));
    }
    return [...values];
  }, SAMPLE_MS);
}

function header(page: Page) {
  return page.getByRole('banner');
}

test('la tira virtual reacciona a un fichero de audio', async ({ page }) => {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();

  await page.goto(engine.url);

  await expect(header(page).getByRole('status')).toHaveText('Conectado');
  await expect(header(page)).toContainText('Fichero: golpes.wav');
  // El visor cambia entre un golpe (encendido) y el silencio (en negro).
  const brightness = await viewerBrightnessRange(page);
  expect(brightness.max, 'el visor se enciende con los golpes').toBeGreaterThan(0);
  expect(brightness.min, 'el visor se apaga en el silencio').toBe(0);
  // El vúmetro se mueve: sube con los golpes y vuelve al mínimo en el silencio.
  const levels = await meterValues(page);
  expect(Math.max(...levels), 'el vúmetro sube con los golpes').toBeGreaterThan(-60);
  expect(Math.min(...levels), 'el vúmetro vuelve al mínimo').toBe(-60);
  await engine.stop();
});

test('instrumento sin fuente de audio', async ({ page }) => {
  await page.goto('/');

  await expect(header(page).getByRole('status')).toHaveText('Conectado');
  await expect(header(page)).toContainText('Sin fuente de audio');
  await expect(page.getByRole('meter')).toHaveCount(0);
});
