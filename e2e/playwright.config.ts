import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);

/** Puerto fijo de la vista previa del panel: `--strictPort` falla si está ocupado (design.md, decisión 3). */
const PORT = 4173;
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * E2E del repositorio (specs/quality-gates, change e2e-playwright-gate): Playwright Test, separado de
 * Vitest y fuera de la cobertura. Se prueba el build del panel, que es lo que se despliega, no el
 * servidor de desarrollo.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.spec.ts',
  // Un `test.only` olvidado no puede dejar la puerta pasando con un solo test.
  forbidOnly: CI,
  // Sin reintentos: una puerta que se reintenta hasta pasar oculta los E2E inestables (decisión 6).
  retries: 0,
  // `open: 'never'`: en local, el informe no abre el navegador ni deja el comando esperando.
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    // Sin reintentos, `on-first-retry` no grabaría nunca: se graba siempre y solo se guarda si falla.
    trace: 'retain-on-failure',
  },
  // Solo Chromium, en una ventana de escritorio (decisión 5; specs/panel-layout).
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // `MOO-18` cambia este bloque: arranca el motor, que sirve el mismo build.
  webServer: {
    command: `pnpm --filter @moodtable/panel build && pnpm --filter @moodtable/panel preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Nunca se reutiliza una vista previa ya abierta: podría servir un build anterior al código probado.
    reuseExistingServer: false,
  },
});
