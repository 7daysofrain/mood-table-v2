# Tasks

> Una sola tarea de Linear, así que una sola sección y una sola PR. Cada paso es un commit con
> `Refs MOO-28`; la PR lleva `Fixes MOO-28`. Los pasos marcados **(usuario)** son configuración de
> cuentas externas (GitHub, SonarQube Cloud) que hace el usuario; el agente prepara las instrucciones
> y no los ejecuta.

## 1. MOO-28 · infra

- [x] 1.1 Fijar la cadena de herramientas: `package.json` raíz (`private`, `packageManager` con pnpm
  exacto, `engines.node` `>=24 <25`), `.nvmrc` (24),
  `pnpm-workspace.yaml` (`packages/*`, `tooling`, `engineStrict: true`; pnpm ≥ 11 no lee `.npmrc`), `@fission-ai/openspec` `1.14.0` exacto en
  `devDependencies` y `.gitignore` (`node_modules/`, `coverage/`, `dist/`). Verificar: con Node 24,
  `pnpm install` termina sin errores y `pnpm exec openspec --version` imprime `1.14.0`.
- [x] 1.2 Crear `tsconfig.base.json` estricto (decisión 2 de `design.md`) y los paquetes
  `@moodtable/shared` (solo `exports` de `.`) y `@moodtable/engine` (`src/core/`, `src/adapters/`,
  `src/main.ts`, dependiente de `shared` por `workspace:*`), cada uno con un módulo mínimo; script
  raíz `pnpm typecheck`. Verificar: `pnpm typecheck` pasa.
- [x] 1.3 Crear `@moodtable/panel` como cáscara de Vite + React sin UI (`index.html`, componente raíz
  vacío, `tsconfig` con DOM y `react-jsx`), dependiente de `shared`. Verificar: `pnpm typecheck` pasa
  en los tres paquetes y `pnpm --filter @moodtable/panel build` genera el bundle.
- [x] 1.4 Configurar Vitest 5 en la raíz con `test.projects` (`packages/*`; `tooling` se añade en 1.6,
  cuando existe), cobertura v8 con reporteros `text` y `lcov` en `coverage/`, exclusiones
  `packages/engine/src/main.ts`, `packages/panel/src/main.tsx` (raíz de composición del panel) y
  `**/*.hardware.ts`, y un test mínimo del punto de entrada de cada paquete; scripts `pnpm test` y
  `pnpm test:coverage`. Verificar: `pnpm test:coverage` ejecuta los tests de los tres paquetes en una
  pasada y genera un único `coverage/lcov.info` con ficheros de los tres y sin `main.ts`
  (escenarios de «Un único runner de tests…» en `specs/quality-gates`).
- [x] 1.5 Configurar ESLint (flat config en la raíz) con typescript-eslint con información de tipos y
  `eslint-plugin-react-hooks` en `panel`, sin reglas de fronteras todavía; script `pnpm lint`.
  Verificar: `pnpm lint` pasa sobre el esqueleto.
- [x] 1.6 **(TDD, rojo)** Añadir en `tooling/` los tests de la regla de fronteras: un caso por
  escenario de `specs/module-boundaries` (núcleo → adaptador falla; adaptador → núcleo pasa;
  `main.ts` → ambos pasa; panel → engine falla por nombre de paquete y por ruta relativa; panel →
  `shared` pasa; panel → fichero interno de `shared` falla; `shared` → engine falla), ejecutando
  ESLint por su API. Verificar: los casos que esperan error fallan porque la regla aún no existe.
- [x] 1.7 **(verde)** Configurar `eslint-plugin-boundaries` en *default disallow* con los tipos de
  elemento y la política de la decisión 3 de `design.md`. Verificar: los tests de 1.6 pasan y
  `pnpm lint` sigue en verde sobre el código real.
- [x] 1.8 Añadir `.github/workflows/ci.yml` con los jobs `lint`, `typecheck` y `test` (instalación
  común con `pnpm/action-setup`, `setup-node` desde `.nvmrc` con caché y
  `pnpm install --frozen-lockfile`), disparado en `pull_request` y `push` a `main` y `feature/entrega-*`; el job `test`
  ejecuta `pnpm test:coverage`. Verificar: la PR muestra las tres comprobaciones en verde, y cada job
  ejecuta el mismo script que se usa en local.
- [x] 1.9 **(usuario)** Crear el proyecto en SonarQube Cloud enlazado a `7daysofrain/mood-table-v2`,
  desactivar el análisis automático, código nuevo = últimos 30 días, comprobar que el *quality gate* es «Sonar way» y
  guardar
  `SONAR_TOKEN` como secreto de Actions y de Dependabot. Verificar: el proyecto existe y los dos
  secretos aparecen en la configuración del repo.
- [ ] 1.10 Añadir `sonar-project.properties` (organización, clave, fuentes, tests,
  `sonar.javascript.lcov.reportPaths=coverage/lcov.info` y `sonar.coverage.exclusions` iguales a los
  de Vitest, con un comentario cruzado) y el paso de análisis en el job `test` con `fetch-depth: 0`.
  Verificar: la PR muestra la comprobación de SonarQube Cloud con el resultado del *quality gate* y
  la cobertura que informa coincide con la de `coverage/lcov.info`.
- [x] 1.11 Añadir `.github/dependabot.yml` para `npm` y `github-actions`, semanal, agrupando
  *minor/patch* por ecosistema (sus PR van a `main`, la rama por defecto). Verificar: el fichero es
  válido según el esquema de Dependabot. Que GitHub lo muestre activo en *Insights → Dependency graph →
  Dependabot* solo se puede comprobar al integrar la entrega en `main` (riesgo en `design.md`).
- [x] 1.12 Actualizar `AGENTS.md`: comandos reales (`pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:coverage`, `pnpm exec openspec`), convención `*.hardware.ts` y estado actual; y registrar
  las propuestas D37-D39 de `design.md` en `docs/idea-mood-table.md` §10 si el usuario las aprueba.
  Verificar: cada comando documentado se ejecuta tal como está escrito.
- [ ] 1.13 **(usuario)** Antes de integrar la PR: declarar `(main|feature/entrega-.*)` como ramas de
  larga duración en SonarQube (*Project → Branches*, que aparece tras el primer análisis; el tipo de
  una rama se fija en su primer análisis y el *push* de la integración es el primero de
  `feature/entrega-2-JA`). Crear un *ruleset* de GitHub para `main` y `feature/entrega-*` que exija las comprobaciones `lint`,
  `typecheck`, `test` y la de SonarQube Cloud. Verificar: con alguna en rojo, GitHub no deja integrar
  la PR (escenario «Intento de integrar una PR en rojo»).
- [ ] 1.14 Comprobación de integración en la PR de esta tarea: empujar un commit temporal que importe
  un adaptador desde el núcleo y comprobar que el job `lint` queda en rojo; revertirlo y comprobar que
  todo vuelve a verde. Añadir la entrada correspondiente en `prompts.md`. Verificar: el historial de
  la PR muestra el fallo y la recuperación.
