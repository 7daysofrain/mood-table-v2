import { expect, test } from '@playwright/test';

/** Zonas con nombre del glosario (PRD §8), en el orden del wireframe (specs/panel-layout). */
const ZONAS = ['Visor', 'Tiras', 'Efectos', 'Controles'];

/**
 * E2E de humo: el escenario «Se abre el panel» de specs/panel-layout sobre el build servido. Repite en
 * un navegador real lo que `PanelLayout.test.tsx` comprueba en jsdom, porque prueba otra cosa: que el
 * bundle carga y pinta (design.md, decisión 8).
 */
test('se abre el panel con la cabecera y sus cuatro zonas, sin ninguna otra', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('banner')).toBeVisible();
  for (const nombre of ZONAS) {
    await expect(page.getByRole('region', { name: nombre }), `zona «${nombre}»`).toBeVisible();
  }
  await expect(page.getByRole('region')).toHaveCount(ZONAS.length);
});
