# Proposal

> **Origen:** tarea *enabler* [`MOO-49`](https://linear.app/7daysofrain/issue/MOO-49/montar-los-tests-e2e-con-playwright-y-su-puerta-en-la-ci)
> · Montar los tests E2E con Playwright y su puerta en la CI · épica técnica `MOO-27` (sin historia
> de producto ni H#/E#). Desbloquea `MOO-18`.

## Why

El DoD de las historias *Feature* pide los E2E en verde, y la entrega final pide al menos un E2E del
flujo principal (`course.md` §3). Sin embargo, Playwright no está montado: `pnpm test:e2e`, que cita
README §1.4, no existe, y ninguna puerta de la PR ejecuta un navegador. `MOO-18` tiene que escribir
los E2E de HU1 y está bloqueada hasta que haya dónde escribirlos y una CI que los haga cumplir.

## What Changes

- **Playwright Test como runner de los E2E**, aparte de Vitest. Va en una carpeta `e2e/` en la raíz
  (README §2.3), con su configuración, y su versión está en el catálogo de `pnpm-workspace.yaml`.
- **`pnpm test:e2e` desde la raíz.** Construye el panel, lo sirve y ejecuta los E2E en un navegador
  real, sin pasos previos aparte de instalar el navegador la primera vez.
- **Un primer E2E de humo**, que no necesita el motor: el escenario *Se abre el panel* de
  `specs/panel-layout`, sobre el build del panel.
- **Job `e2e` en la CI** (`.github/workflows/ci.yml`), que instala el navegador en el runner y, si
  falla, deja el informe de Playwright con las trazas como artefacto.
- **El E2E es una comprobación requerida** del *ruleset* «ramas de integración». Lo configura el
  usuario (`linear.md` §7).
- **Los E2E no cuentan en la cobertura.** En el informe que lee SonarQube entran solo los tests
  unitarios y de integración, que son los de Vitest (decisión del usuario, 15-oct).
- **Documentación:** `linear.md` §7 (comprobaciones requeridas), README §1.4 y §2.3, `AGENTS.md`
  (tabla de comandos), el *Purpose* de `quality-gates` y `prompts.md`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `quality-gates`:
  - *Cada PR a una rama de integración pasa lint, tipos y tests*: los tests incluyen los E2E, con un
    escenario para una PR que rompe un E2E;
  - *Las comprobaciones locales son las mismas que las de la CI*: se añade el comando de los E2E;
  - *Un único runner de tests con un informe de cobertura común*: se acota a los tests unitarios y de
    integración. Los E2E van con su propio runner y quedan fuera del informe;
  - *Una PR con comprobaciones en rojo no se integra*: el E2E entra en la lista de comprobaciones
    obligatorias;
  - requisito nuevo: los E2E se ejecutan en un navegador real sobre el build del panel, con un solo
    comando.

## Non-goals

Tomados de `MOO-49`:

- **Los E2E de HU1** (la tira respira, el aviso sin motor, la reconexión, dos paneles). Van en
  `MOO-18`, con el motor sirviendo el build del panel (decisión 12 del change de `MOO-13`).

Por decisión de diseño (`design.md`):

- **Más navegadores que Chromium.** No hay ningún requisito del PRD que pida otro, y cada navegador
  alarga la puerta.
- **E2E en la Raspberry Pi o con hardware real.** Se prueban a mano (nivel *Hardware*, README §2.6).
- **Comparación visual por capturas.** Los E2E localizan las zonas por su nombre accesible
  (`specs/panel-layout`), no por píxeles.

## Impact

- **Dependencias:** `@playwright/test` en el catálogo y en el paquete `e2e`. Para ejecutarlo en local
  hay que instalar Chromium una vez (`pnpm exec playwright install chromium`).
- **Workspace:** `e2e/` pasa a ser un miembro del workspace, como `tooling`. Cambian
  `pnpm-workspace.yaml`, `eslint.config.js` (su `tsconfig`) y `sonar-project.properties` (los E2E se
  analizan como código de test, sin cobertura).
- **Panel:** script `preview` en `packages/panel/package.json`, para servir su build.
- **CI:** job nuevo `e2e` en `.github/workflows/ci.yml`.
- **Configuración de GitHub (la hace el usuario):** `e2e` como comprobación requerida en el *ruleset*
  «ramas de integración».
- **`MOO-18`:** hereda la configuración. Solo tiene que cambiar el servidor que arranca Playwright
  (el motor en lugar de la vista previa del panel) y añadir sus E2E.
- **Documentación:** la de *What Changes* y, si el usuario la aprueba, una decisión D43 en
  `docs/idea-mood-table.md` §10.
