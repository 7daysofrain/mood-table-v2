import { fileURLToPath } from 'node:url';

import { type Page, expect, test } from '@playwright/test';

import { createTestEngine, type TestEngine } from './engine.ts';

/**
 * E2E de la historia `MOO-22`: oír en el panel el fichero de audio por el punto al que reacciona la
 * tira (specs/audio-playback). Con fuente de audio, cada test lanza su motor con el fichero de golpes
 * (4 s: varias vueltas del bucle en pocos segundos) y una tira con *energía*; sin fuente, usa el del
 * `webServer` (`e2e/config.json`). Un E2E no puede oír: lee el estado del reproductor, su error de
 * sincronía y sus saltos en `window.moodTableAudio`, de solo lectura (decisión 8). El error que ve
 * es el medido antes de corregir, pero solo cada 100 ms; los saltos no se pierden ninguno: si el
 * reproductor arranca por un punto equivocado, la corrección salta y el test lo ve.
 */

/** El fichero de golpes: 4 s con un golpe de 50 ms en los segundos 1, 2 y 3 y silencio digital. */
const GOLPES = fileURLToPath(new URL('../packages/engine/test/fixtures/golpes.wav', import.meta.url));

const LISTEN = { name: 'Oír el fichero de audio' };
const PREPARING = { name: 'Preparando el audio' };
const STOP = { name: 'Dejar de oír el fichero de audio' };

/**
 * La tolerancia de la spec, en segundos: lo que suena no va más de 45 ms por delante del visor (la
 * luz por detrás del sonido, E2) ni más de 125 ms por detrás (ITU-R BT.1359).
 */
const AHEAD = 0.045;
const BEHIND = 0.125;

async function playback(page: Page): Promise<MoodTableAudio | undefined> {
  return page.evaluate(() => window.moodTableAudio && { ...window.moodTableAudio });
}

/**
 * Los errores de sincronía que mide el reproductor durante `ms`, cada 100 ms, y si en algún momento
 * dejó de sonar.
 */
async function sampleErrors(page: Page, ms: number): Promise<{ errors: number[]; silent: boolean }> {
  return page.evaluate(async (duration) => {
    const errors: number[] = [];
    let silent = false;
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const audio = window.moodTableAudio;
      if (audio?.state !== 'playing') silent = true;
      if (audio?.error !== undefined) errors.push(audio.error);
    }
    return { errors, silent };
  }, ms);
}

/** Los brillos distintos (suma de los canales RGB) que pinta el visor en `ms`, en cada frame. */
async function viewerBrightnesses(page: Page, ms: number): Promise<number> {
  return page.getByRole('img', { name: 'Tiras del visor' }).evaluate(async (element, duration) => {
    const canvas = element as HTMLCanvasElement;
    const context = canvas.getContext('2d');
    const seen = new Set<number>();
    const end = performance.now() + duration;
    while (performance.now() < end) {
      await new Promise(requestAnimationFrame);
      if (!context || canvas.width === 0 || canvas.height === 0) continue;
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      for (let index = 0; index < data.length; index += 4) {
        sum += (data[index] ?? 0) + (data[index + 1] ?? 0) + (data[index + 2] ?? 0);
      }
      seen.add(sum);
    }
    return seen.size;
  }, ms);
}

function expectInTolerance(errors: number[]): void {
  expect(errors.length, 'el reproductor mide el error').toBeGreaterThan(0);
  expect(Math.max(...errors), 'lo que suena no va 45 ms por delante del visor').toBeLessThanOrEqual(
    AHEAD,
  );
  expect(Math.min(...errors), 'ni 125 ms por detrás').toBeGreaterThanOrEqual(-BEHIND);
}

/** Abre el panel de `engine` y espera a que esté conectado y con el fichero de golpes como fuente. */
async function openPanel(page: Page, engine: TestEngine): Promise<void> {
  await page.goto(engine.url);
  await expect(page.getByRole('banner').getByRole('status')).toHaveText('Conectado');
  await expect(page.getByRole('banner')).toContainText('Fichero: golpes.wav');
}

/** Pide oír y espera a que suene. */
async function listen(page: Page): Promise<void> {
  await page.getByRole('button', LISTEN).click();
  await expect(page.getByRole('button', STOP)).toBeVisible();
  await expect.poll(async () => (await playback(page))?.state).toBe('playing');
}

/**
 * Un motor con el fichero de golpes y una tira con *energía*, que se para al acabar el test aunque
 * falle una comprobación: si no, quedaría vivo con su puerto ocupado.
 */
async function withEngine(run: (engine: TestEngine) => Promise<void>): Promise<void> {
  const engine = await createTestEngine({ audioFile: GOLPES, effect: 'energy' });
  await engine.start();
  try {
    await run(engine);
  } finally {
    await engine.stop();
  }
}

test('tras un gesto, el reloj de Web Audio avanza en Chromium sin pantalla', async ({ page }) => {
  // Riesgo de design.md: sin dispositivo de salida, el reloj podría no avanzar, y sin él no hay
  // sincronía que probar. El clic es el gesto que exige el navegador para sonar.
  await page.goto('/');
  await page.getByRole('banner').click();

  const clock = await page.evaluate(async () => {
    const context = new AudioContext();
    await context.resume();
    const start = context.currentTime;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const result = { state: context.state, elapsed: context.currentTime - start };
    await context.close();
    return result;
  });

  expect(clock.state).toBe('running');
  expect(clock.elapsed).toBeGreaterThan(0.8);
  expect(clock.elapsed).toBeLessThan(1.2);
});

test('oír el fichero de audio mientras la tira virtual reacciona', async ({ page }) => {
  await withEngine(async (engine) => {
    // El motor lleva un rato reproduciendo el fichero cuando el maker abre el panel: es una espera
    // de tiempo por definición, y antes de abrir el panel no hay nada que observar.
    await page.waitForTimeout(2500); // NOSONAR: la precondición es «el motor lleva un rato»
    await openPanel(page, engine);

    await listen(page);

    const { errors, silent } = await sampleErrors(page, 1500);
    expect(silent).toBe(false);
    expectInTolerance(errors);
    expect((await playback(page))?.jumps, 'arranca por el punto del visor').toBe(0);
    expect(await viewerBrightnesses(page, 2000), 'la tira reacciona en el visor').toBeGreaterThan(1);
  });
});

test('el panel no suena solo', async ({ page }) => {
  await withEngine(async (engine) => {
    await openPanel(page, engine);

    // Llegan frames y posiciones: lo que haría sonar a un panel que no esperase al maker.
    // 2 s, no 1: `golpes.wav` tiene ~1,9 s de silencio digital, en el que la tira está apagada.
    expect(await viewerBrightnesses(page, 2000), 'el visor recibe frames').toBeGreaterThan(1);

    expect(await playback(page)).toEqual({ state: 'silent', error: undefined, jumps: 0 });
    await expect(page.getByRole('button', LISTEN)).toBeVisible();
  });
});

test('dejar de oír el fichero de audio', async ({ page }) => {
  await withEngine(async (engine) => {
    await openPanel(page, engine);
    await listen(page);

    await page.getByRole('button', STOP).click();

    await expect(page.getByRole('button', LISTEN)).toBeVisible();
    expect((await playback(page))?.state).toBe('silent');
    // El motor sigue: la tira sigue reaccionando al fichero.
    expect(await viewerBrightnesses(page, 2000), 'la tira sigue reaccionando').toBeGreaterThan(1);
  });
});

test('volver a oír el fichero de audio tras dejar de oírlo', async ({ page }) => {
  await withEngine(async (engine) => {
    await openPanel(page, engine);
    await listen(page);
    await page.getByRole('button', STOP).click();
    // «Hace un rato» es tiempo por definición: el motor tiene que avanzar mientras el panel calla.
    await page.waitForTimeout(1500); // NOSONAR: la precondición es «dejó de oírlo hace un rato»

    await listen(page);

    // Por el punto del visor, no por donde lo dejó hace 1,5 s: si no, la corrección saltaría.
    expectInTolerance((await sampleErrors(page, 1500)).errors);
    expect((await playback(page))?.jumps, 'arranca por el punto del visor').toBe(0);
  });
});

test('lo que se oye sigue al ritmo de la luz aunque el fichero se repita', async ({ page }) => {
  await withEngine(async (engine) => {
    await openPanel(page, engine);
    await listen(page);

    // Unos 10 s: dos vueltas y media del fichero de golpes.
    const { errors, silent } = await sampleErrors(page, 10_000);

    expect(silent, 'suena todo el rato').toBe(false);
    expectInTolerance(errors);
    // La deriva entre relojes es de ms por minuto: en 10 s, como mucho un salto, no uno por vuelta.
    expect((await playback(page))?.jumps, 'no salta en cada vuelta').toBeLessThanOrEqual(1);
  });
});

test('sin fichero de audio como fuente no se puede pedir oír', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toContainText('Sin fuente de audio');
  await expect(page.getByRole('button', LISTEN)).toHaveCount(0);
});

test('el fichero tarda en llegar', async ({ page }) => {
  await withEngine(async (engine) => {
    // La descarga de /audio tarda 1,5 s, como el fichero de la demo pública.
    await page.route('**/audio', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await openPanel(page, engine);

    await page.getByRole('button', LISTEN).click();

    await expect(page.getByRole('button', PREPARING)).toBeVisible();
    await expect(page.getByRole('button', STOP)).toBeVisible({ timeout: 5000 });
    expectInTolerance((await sampleErrors(page, 1000)).errors);
    expect((await playback(page))?.jumps, 'suena por el punto del visor').toBe(0);
  });
});

test('el motor se para mientras el maker oye', async ({ page }) => {
  await withEngine(async (engine) => {
    await openPanel(page, engine);
    await listen(page);

    await engine.stop();

    await expect(page.getByRole('banner').getByRole('status')).toHaveText(
      'Sin conexión con el motor',
    );
    expect((await playback(page))?.state).toBe('silent');

    // El panel reconecta solo, sin recargar.
    await engine.start();
    await expect(page.getByRole('banner').getByRole('status')).toHaveText('Conectado');
    await expect(page.getByRole('banner')).toContainText('Fichero: golpes.wav');
    // Vuelven a llegar frames y posiciones: lo que haría sonar a un panel que no esperase al maker.
    // 2 s, no 1: `golpes.wav` tiene ~1,9 s de silencio digital, en el que la tira está apagada.
    expect(await viewerBrightnesses(page, 2000), 'el visor recibe frames').toBeGreaterThan(1);

    // Al volver el motor no suena solo: el maker tiene que pedirlo otra vez.
    expect((await playback(page))?.state).toBe('silent');
    await expect(page.getByRole('button', LISTEN)).toBeVisible();
  });
});
