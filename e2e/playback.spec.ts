import { expect, test } from '@playwright/test';

/**
 * E2E de la historia `MOO-22`: oír en el panel el fichero de audio por el punto al que reacciona la
 * tira (specs/audio-playback).
 */

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
