import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { type Page, expect, test } from '@playwright/test';

import { createTestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-13` (HU1): lo que ve el maker en el visor con el motor real (specs/viewer).
 * Los escenarios que no paran el motor usan el del `webServer`; los que lo paran o lo arrancan
 * lanzan el suyo, en su propio puerto.
 */

/** El build del panel, que construye el `webServer` antes de los tests. */
const PANEL_BUILD = fileURLToPath(new URL('../packages/panel/dist', import.meta.url));

const CONNECTED = 'Conectado';
const DISCONNECTED = 'Sin conexión con el motor';

/** El brillo del visor: la suma de los canales RGB de todos sus píxeles. En negro, 0. */
async function viewerBrightness(page: Page): Promise<number> {
  return page.getByRole('img', { name: 'Tiras del visor' }).evaluate((element) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    if (!context || canvas.width === 0 || canvas.height === 0) return 0;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    let sum = 0;
    for (let index = 0; index < data.length; index += 4) {
      sum += (data[index] ?? 0) + (data[index + 1] ?? 0) + (data[index + 2] ?? 0);
    }
    return sum;
  });
}

/** Comprueba que el visor se anima: está encendido y su brillo cambia. */
async function expectViewerAnimating(page: Page): Promise<void> {
  await expect.poll(() => viewerBrightness(page), { message: 'el visor se enciende' }).toBeGreaterThan(0);
  const first = await viewerBrightness(page);
  await expect
    .poll(() => viewerBrightness(page), { message: 'el brillo del visor cambia' })
    .not.toBe(first);
}

function connectionStatus(page: Page) {
  return page.getByRole('banner').getByRole('status');
}

test('el maker ve la tira virtual respirando en el visor', async ({ page }) => {
  await page.goto('/');

  await expect(connectionStatus(page)).toHaveText(CONNECTED);
  await expectViewerAnimating(page);
});

test('el panel avisa si el motor no está en marcha', async ({ page }) => {
  // Sin motor no hay quien sirva el panel: el test sirve el build en la dirección de un motor que no
  // se arranca. El WebSocket no pasa por `page.route`, así que la conexión falla como sin motor.
  const engine = await createTestEngine();
  await page.route(`${engine.url}/**`, (route) => {
    const { pathname } = new URL(route.request().url());
    return route.fulfill({ path: join(PANEL_BUILD, pathname === '/' ? 'index.html' : pathname) });
  });
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto(engine.url);

  await expect(connectionStatus(page)).toHaveText(DISCONNECTED);
  await expect.poll(() => viewerBrightness(page)).toBe(0);
  // Sin motor, el único error admitido es el del navegador al no poder conectar (specs/panel-layout).
  // Se espera a que el panel haya reintentado al menos una vez, con sus errores en la consola.
  const connectionError = /WebSocket connection to .* failed/;
  await expect
    .poll(() => errors.filter((error) => connectionError.test(error)).length)
    .toBeGreaterThanOrEqual(2);
  expect(errors.filter((error) => !connectionError.test(error))).toEqual([]);
});

test('el visor se recupera solo tras un reinicio del motor', async ({ page }) => {
  const engine = await createTestEngine();
  await engine.start();
  await page.goto(engine.url);
  await expect(connectionStatus(page)).toHaveText(CONNECTED);
  // Una marca en la página: si sigue al final, el panel no se ha recargado.
  await page.evaluate(() => {
    (window as unknown as { sinRecargar: boolean }).sinRecargar = true;
  });

  await engine.stop();
  await expect(connectionStatus(page)).toHaveText(DISCONNECTED);
  await engine.start();

  await expect(connectionStatus(page)).toHaveText(CONNECTED);
  await expectViewerAnimating(page);
  expect(await page.evaluate(() => (window as unknown as { sinRecargar?: boolean }).sinRecargar)).toBe(
    true,
  );
  await engine.stop();
});

test('dos paneles ven lo mismo: los dos visores se animan', async ({ browser }) => {
  // Un contexto por panel, como dos navegadores. Que reciben los mismos frames lo prueba el motor
  // (server.test.ts): aquí se comprueba que los dos visores se animan (decisión 18).
  const first = await (await browser.newContext()).newPage();
  const second = await (await browser.newContext()).newPage();
  await first.goto('/');
  await second.goto('/');

  for (const page of [first, second]) {
    await expect(connectionStatus(page)).toHaveText(CONNECTED);
    await expectViewerAnimating(page);
  }
});
