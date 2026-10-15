# Design

## Context

La motivación está en `proposal.md`, en *Why*. El estado del que se parte:

- **Tests.** Vitest es el único runner (`vitest.config.ts`). Tiene un proyecto por cada miembro de
  `packages/*` y otro para `tooling`, y la cobertura sale en un único `coverage/lcov.info`, que es el
  que lee SonarQube. El panel se prueba con jsdom (`packages/panel/vite.config.ts`).
- **El panel** tiene un script `build` (`vite build` → `packages/panel/dist/`), pero no tiene
  `preview`. Sus zonas son `<section aria-labelledby>`, con el título del glosario (`Zone.tsx`), y
  `PanelLayout.test.tsx` ya comprueba en jsdom la cabecera y las cuatro regiones.
- **CI** (`.github/workflows/ci.yml`): jobs separados `lint`, `typecheck`, `test` y `sonar-issues`.
  Todos usan la acción común `.github/actions/setup` (pnpm, Node desde `.nvmrc` e
  `pnpm install --frozen-lockfile`).
- **Workspace:** `packages/*` y `tooling`. Las versiones compartidas van en el catálogo, y
  `minimumReleaseAge: 1440` impide instalar una versión publicada hace menos de un día.
- **SonarQube:** `sonar.sources` cubre `packages`, `.claude/hooks` y `tooling/ci`. `sonar.tests`
  cubre `packages` y `tooling`. Las dos listas de exclusiones de cobertura se mantienen iguales en
  `vitest.config.ts` y en `sonar-project.properties`.
- **README** ya prevé Playwright para el E2E (§2.6) y una carpeta `e2e/` en la raíz, «fuera de los
  workspaces» (§2.3).
- **`MOO-18`** escribirá los E2E de HU1 con el motor sirviendo el build del panel (decisión 12 del
  change de `MOO-13`). Esta configuración tiene que valerle cambiando solo el servidor.

## Goals / Non-Goals

**Goals:**

- Que `MOO-18` solo tenga que escribir sus E2E y cambiar el servidor que se arranca, sin tocar la CI
  ni el *ruleset*.
- Que un fallo de E2E en la CI se pueda entender sin reproducirlo en local.
- Que el E2E no cambie lo que mide SonarQube.

**Non-Goals:**

- Probar el panel en móviles o tabletas. La spec `panel-layout` habla de una ventana de escritorio.
- Hacer la puerta más rápida con *sharding* o con caché de navegadores (ver la decisión 7).

## Decisions

### 1. Playwright Test como runner de los E2E, separado de Vitest

Los E2E se escriben con `@playwright/test` y se ejecutan con su propio runner (`playwright test`).

- **Por qué:** aporta lo que necesita un E2E y Vitest no tiene:
  - `webServer`, que arranca y para el servidor alrededor de los tests;
  - un contexto de navegador aislado por test, que `MOO-18` necesitará para el escenario de los dos
    paneles;
  - trazas del navegador cuando un test falla (decisión 6).
- **Alternativas:**
  - **Playwright como librería dentro de Vitest:** mantendría un único runner, pero habría que
    rehacer a mano el servidor, el aislamiento y las trazas.
  - **El modo navegador de Vitest:** sirve para probar componentes sueltos en un navegador, no para
    abrir la aplicación construida contra su servidor.
- Por eso el requisito «Un único runner» se acota a los tests unitarios y de integración (delta de
  `quality-gates`). README §2.6 ya los separaba así.

### 2. `e2e/` es un miembro del workspace

`e2e/` lleva su propio `package.json` (`@moodtable/e2e`), igual que `tooling`, con `@playwright/test`
como dependencia de desarrollo (`"catalog:"`).

- **Ficheros:**
  - `playwright.config.ts`;
  - los tests, como `*.spec.ts`. El sufijo los distingue de los de Vitest (`*.test.ts`);
  - un `tsconfig.json` que extiende `tsconfig.node.json`.
- **Scripts:**
  - en `e2e`: `test:e2e` (`playwright test`) y `typecheck`;
  - en la raíz: `test:e2e`, que lo llama con `pnpm --filter @moodtable/e2e`.
- **Encaje con las herramientas que ya hay:**
  - `pnpm typecheck` lo comprueba sin tocar nada, porque su `typecheck` entra en `pnpm -r`;
  - en `eslint.config.js`, su `tsconfig` se añade a `parserOptions.project`, y así el lint con tipos
    lo cubre (por ejemplo, `no-floating-promises` sobre los `expect` que devuelven promesas);
  - Vitest no lo ve, porque sus `projects` son `packages/*` y `tooling`.
- **La regla de fronteras** no aplica a `e2e/`, porque solo cubre `packages/**`. Los E2E prueban el
  sistema desde fuera, por el navegador y la red, y no importan código de los paquetes.
- **Alternativa:** dejar `@playwright/test` en el `package.json` de la raíz y no hacer `e2e/` un
  paquete. Haría falta otro `tsconfig` suelto y otra entrada en `typecheck`, y las dependencias del
  E2E se mezclarían con las del repositorio. Se cambia la frase de README §2.3 que lo situaba fuera
  de los workspaces.

### 3. El servidor: el build del panel con `vite preview`

En `playwright.config.ts`, `webServer` construye el panel y lo sirve con `vite preview` (script nuevo
`preview` en el panel) en `127.0.0.1:4173`, con `--strictPort`.

- **Por qué el build y no `vite dev`:** es lo que se despliega. Un E2E sobre el servidor de
  desarrollo no detectaría un fallo del bundle, de los estilos de Mantine o de `index.html`.
- **`reuseExistingServer: false`**, también en local. Si se reutilizara una vista previa vieja, los
  E2E pasarían contra un build anterior al código que se quiere probar. Si el puerto está ocupado,
  falla y dice por qué.
- **`127.0.0.1` y no `localhost`:** así no depende de cómo resuelve el sistema `localhost` (IPv4 o
  IPv6).
- **`MOO-18`** cambia solo este bloque: arranca el motor, que sirve el mismo build.

### 4. Los E2E fuera de la cobertura; SonarQube los analiza como código de test

Decisión del usuario (15-oct): la cobertura que lee SonarQube es la de los tests unitarios y de
integración (Vitest).

- **No hay que hacer nada para excluirlos:** Playwright no instrumenta el bundle, y `pnpm test:coverage`
  no ejecuta los E2E. El escenario «Los E2E no entran en la cobertura» lo deja fijado.
- **En SonarQube:** `e2e` se añade a `sonar.tests`, y `e2e/**` a `sonar.test.inclusions`. Así su
  código se analiza como test, con sus reglas, y no como código del producto sin cubrir.
- **Por qué no cuentan:**
  - medir la cobertura desde un E2E obliga a instrumentar el build (istanbul en Vite) y a fusionar
    dos informes;
  - un E2E recorre mucho código sin comprobarlo en detalle, y eso inflaría la cobertura del código
    nuevo, que es la que juzga el *quality gate*.
- **Alternativa:** instrumentar el build y fusionar los informes. Se descarta por las dos razones
  anteriores.

### 5. Solo Chromium, con un perfil de escritorio

Un único proyecto de Playwright, `chromium`, con `devices['Desktop Chrome']`.

- **Por qué:**
  - ni el PRD ni las specs piden un navegador concreto;
  - `panel-layout` define la disposición «en una ventana de escritorio»;
  - cada navegador más repite todos los E2E en la puerta de cada PR.
- **Ampliarlo** es añadir un proyecto a la configuración, si una historia lo pide.

### 6. Sin reintentos, con traza de cada fallo

- **`retries: 0`**, en local y en la CI. Una puerta que se reintenta hasta pasar oculta los E2E
  inestables. Si uno lo es, se arregla el test.
- **`trace: 'retain-on-failure'`:** sin reintentos, `on-first-retry` no grabaría nunca. Así se graba
  una traza de cada test, pero solo se conserva la de los que fallan.
- **`forbidOnly` en la CI**, para que un `test.only` olvidado no deje la puerta pasando con un solo
  test.
- **Informes:** `html` siempre y, en la CI, también `github`, que anota el fallo en la PR.
- **Alternativa:** `retries: 1` en la CI, que es lo habitual en Playwright. Se descarta por la primera
  razón. Si los E2E de `MOO-18` (reconexión) resultan inestables por diseño, se revisa entonces con
  `/opsx:update`.

### 7. Job `e2e` en la CI

Job propio, igual que los demás, para que la PR diga qué ha fallado y para que se pueda exigir
(cabecera de `ci.yml`):

1. checkout y `./.github/actions/setup`;
2. `pnpm --filter @moodtable/e2e exec playwright install --with-deps chromium`;
3. `pnpm test:e2e`, el mismo comando que en local;
4. si falla, sube `e2e/playwright-report/` como artefacto (`if: failure()`, 7 días).

- **Sin caché de navegadores:** la documentación de Playwright la desaconseja. Restaurar la caché
  tarda lo mismo que descargar, y las dependencias del sistema de Linux no se pueden cachear.
- **El artefacto solo si falla:** es lo que se necesita para depurar, y no ocupa espacio en cada
  ejecución en verde.
- **`e2e/playwright-report/` y `e2e/test-results/`** se añaden a `.gitignore`.

### 8. El E2E de humo

`e2e/panel.spec.ts` abre `/` y comprueba el escenario *Se abre el panel* de `panel-layout`:

- hay una cabecera (`banner`);
- hay exactamente cuatro regiones, «Visor», «Tiras», «Efectos» y «Controles», y son visibles.

Repite en un navegador real lo que `PanelLayout.test.tsx` comprueba en jsdom. No sobra, porque
prueba otra cosa: que el **build** se sirve, carga sus scripts y estilos y pinta las zonas. Un fallo
del bundle o de `main.tsx` (excluido de la cobertura) pasaría todos los tests de Vitest.

### Propuesta de D#

~~**D43**: «E2E con Playwright Test, separado de Vitest, solo en Chromium y fuera de la cobertura de
SonarQube; sin reintentos en la puerta». Recoge el porqué de las decisiones 1, 4, 5 y 6.~~
**Obsoleto:** no se añadió a la ficha (decisión del usuario, 15-oct): la decisión queda en este
`design.md`. El número lo usa la D43 del change `virtual-strip-breathing`.

## Risks / Trade-offs

- **[Un E2E inestable bloquea las PR]** Sin reintentos, un fallo intermitente pone la PR en rojo →
  la traza se descarga del artefacto, y el test se arregla en lugar de reintentarlo. Relanzar el job
  es la salida de emergencia, no la norma.
- **[La puerta tarda más]** Instalar Chromium con sus dependencias y construir el panel puede añadir
  uno o dos minutos → el job corre en paralelo con los demás, así que la PR no espera la suma.
- **[Versión de Playwright y versión del navegador]** El navegador se instala con el mismo paquete
  del workspace (`pnpm --filter @moodtable/e2e exec playwright install`), así que siempre coincide con
  la versión del catálogo. Cuando Dependabot sube Playwright, la CI descarga el navegador nuevo: no hay
  caché que se quede vieja.
- **[`minimumReleaseAge`]** La versión del catálogo tiene que llevar publicada al menos un día → se
  elige al implementar la última estable que lo cumpla.
- **[El puerto 4173 ocupado en local]** Con `--strictPort` y sin reutilizar el servidor, el E2E falla
  con un mensaje claro en lugar de probar otra cosa → se libera el puerto.
- **[Una PR sin el job `e2e`]** Una PR cuya rama no tiene el job se queda esperando el check requerido
  → se actualiza su rama desde `main`. Igual que pasó con `sonar-issues`.

## Migration Plan

1. Abrir la PR de esta tarea y esperar a que el job `e2e` se ejecute en verde.
2. El usuario añade `e2e` como comprobación requerida en el *ruleset* «ramas de integración». Si lo
   hace antes de que el job exista en la rama de la PR, GitHub espera un check que nadie publica.
3. Comprobar que una PR con el E2E de humo en rojo no se puede integrar. Se hace con una PR de prueba
   contra `main`, desde una rama que sale de la de esta tarea y rompe el montaje en `main.tsx`. Ese
   fallo solo lo ve el E2E: quitar una zona también rompería `PanelLayout.test.tsx` y no aislaría la
   puerta nueva. La PR se cierra sin integrar, y así la de la tarea no se llena de commits que rompen
   y revierten (último paso de `tasks.md`).
   - No puede ser un borrador: un borrador no se puede integrar en ningún caso, así que no probaría
     la puerta. A cambio, Copilot la revisará y gastará una petición.
4. Integrar la PR y actualizar desde `main` las ramas de las PR abiertas, para que reciban el job.

Para volver atrás: quitar `e2e` de las comprobaciones requeridas y revertir la PR.
