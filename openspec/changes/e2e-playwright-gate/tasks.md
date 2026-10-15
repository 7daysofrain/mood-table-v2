# Tasks

> Una sola tarea de Linear, así que una sola sección y una sola PR. Cada paso es un commit con
> `Refs MOO-49`, salvo el último, que es de verificación. La PR lleva `Fixes MOO-49` y va contra
> `main`.

## 1. MOO-49 · infra

- [x] 1.1 Montar el paquete `e2e` sin tests (decisión 2 de `design.md`):
  - `@playwright/test` en el catálogo de `pnpm-workspace.yaml`, en la última versión estable que
    cumpla `minimumReleaseAge`, y `e2e` en `packages:`;
  - `e2e/package.json` (`@moodtable/e2e`, con `"catalog:"`) con el script `test:e2e`
    (`playwright test`);
  - script `preview` (`vite preview`) en `packages/panel/package.json`;
  - `e2e/playwright-report/` y `e2e/test-results/` en `.gitignore`.

  El `tsconfig.json` del paquete, su script `typecheck` y su entrada en ESLint van en 1.2: sin ningún
  `.ts`, `tsc` falla con TS18003 y ESLint no puede leer ese `tsconfig`.

  Verificar: `pnpm install` termina sin avisos de `minimumReleaseAge`, `pnpm lint` y `pnpm typecheck`
  siguen en verde, y `pnpm test` ejecuta los mismos tests que antes.
- [x] 1.2 Configuración de Playwright y E2E de humo (decisiones 3, 5, 6 y 8):
  - `e2e/tsconfig.json`, que extiende `tsconfig.node.json`; el script `typecheck` en
    `e2e/package.json`, y `./e2e/tsconfig.json` en `parserOptions.project` de `eslint.config.js`,
    que además ignora `e2e/playwright-report/` y `e2e/test-results/`;
  - `e2e/playwright.config.ts`:
    - `webServer` construye el panel y lo sirve con `preview` en `127.0.0.1:4173`, con
      `--strictPort` y `reuseExistingServer: false`;
    - un único proyecto, `chromium` (`devices['Desktop Chrome']`);
    - `retries: 0`, `trace: 'retain-on-failure'`, `forbidOnly` en la CI;
    - informes `html` y, en la CI, también `github`;
  - `e2e/panel.spec.ts`, con el escenario *Se abre el panel*: hay una cabecera y exactamente las
    cuatro regiones del glosario, visibles;
  - script `test:e2e` en la raíz, que llama al del paquete con `pnpm --filter @moodtable/e2e`.

  Verificar:
  - tras `pnpm --filter @moodtable/e2e exec playwright install chromium`, borrar
    `packages/panel/dist/` y ejecutar `pnpm test:e2e`: construye el panel y el test pasa (escenario
    «El desarrollador lanza los E2E»);
  - quitando a mano una zona de `PanelLayout.tsx` (sin commitearlo), el test falla y dice qué región
    falta, y queda la traza en `e2e/test-results/` (escenario «El E2E de humo detecta un panel
    roto»);
  - `pnpm lint` y `pnpm typecheck` en verde con el test nuevo, y `typecheck` pasa por
    `@moodtable/e2e`.
- [ ] 1.3 SonarQube trata los E2E como código de test (decisión 4): `e2e` en `sonar.tests` y `e2e/**`
  en `sonar.test.inclusions` de `sonar-project.properties`, con un comentario que diga por qué no
  entran en la cobertura.

  Verificar: `pnpm test:coverage` no abre ningún navegador y `coverage/lcov.info` no tiene ninguna
  ruta bajo `e2e/` (escenario «Los E2E no entran en la cobertura»).
- [ ] 1.4 Job `e2e` en `.github/workflows/ci.yml` (decisión 7):
  - `./.github/actions/setup`;
  - `pnpm --filter @moodtable/e2e exec playwright install --with-deps chromium`;
  - `pnpm test:e2e`;
  - si falla, subir `e2e/playwright-report/` como artefacto (`if: failure()`, 7 días);
  - el comentario de cabecera de `ci.yml`, con el E2E entre las puertas.

  Verificar: en la PR de esta tarea, `e2e` se ejecuta en paralelo con `lint`, `typecheck` y `test` y
  está en verde.
- [ ] 1.5 Documentar el comando y la puerta:
  - **README §1.4**, en *Tests*: instalar Chromium una vez antes de `pnpm test:e2e`;
  - **README §2.3**: `e2e/` es un miembro del workspace (se quita de «Carpetas fuera de los
    workspaces»);
  - **README §2.6**, en *Cobertura*: los E2E no cuentan;
  - **`AGENTS.md`**: `pnpm test:e2e` en la tabla de comandos, con la instalación del navegador;
  - **`linear.md` §7**: `e2e` entre las comprobaciones requeridas del *ruleset*;
  - **el *Purpose* de `openspec/specs/quality-gates/spec.md`**: los E2E entre las comprobaciones.
    Lo que cambian los requisitos lo aplica el archivado; el *Purpose* no.

  Verificar: los comandos de README §1.4 y de `AGENTS.md` funcionan tal como están escritos en un
  clon limpio, y `pnpm exec openspec validate --specs` pasa.
- [ ] 1.6 Registrar las decisiones:
  - en `docs/idea-mood-table.md` §10, la decisión D43 (*Propuesta de D#* de `design.md`), si el
    usuario la aprueba;
  - entrada en `prompts.md` sobre el análisis de si la tarea llevaba change, el conflicto con el
    requisito de runner único y la decisión de la cobertura, con el formato de `course.md` §5.

  Verificar: la entrada de `prompts.md` tiene como mucho 3 prompts literales y la línea en cursiva.
- [ ] 1.7 **Verificación en GitHub** (sin commit; *Migration Plan* de `design.md`). El usuario añade
  `e2e` como comprobación requerida en el *ruleset* «ramas de integración» cuando el job ya se ha
  ejecutado en la PR.

  Comprobaciones, con una PR de prueba contra `main`, que no sea borrador, desde una rama que sale de
  la de esta tarea y hace que `packages/panel/src/main.tsx` busque un elemento que no existe en
  `index.html`. Así el panel construido no pinta nada, pero ningún test de Vitest lo nota (decisión
  8):
  - `e2e` está en rojo e indica qué E2E ha fallado, y `lint`, `typecheck` y `test` siguen en verde
    (escenario «Una PR rompe un E2E»);
  - GitHub no deja integrarla (escenario «Intento de integrar una PR con el E2E en rojo»);
  - el artefacto `playwright-report` se descarga desde la ejecución y abre la traza del fallo
    (escenario «Un E2E falla en la CI»).

  Después: cerrar la PR de prueba sin integrar y borrar su rama. Verificar: los enlaces a la ejecución
  y una captura del botón de integrar bloqueado están en la descripción de la PR de la tarea.
