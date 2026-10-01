# Proposal

> **Origen:** tarea *enabler* [`MOO-28`](https://linear.app/7daysofrain/issue/MOO-28/montar-el-monorepo-con-lint-tests-y-ci)
> · Montar el monorepo con lint, tests y CI · épica técnica `MOO-27` (sin historia de producto ni H#/E#).
> Desbloquea `MOO-16`, `MOO-26` y `MOO-29`.

## Why

El repositorio todavía no tiene código: solo documentación, el *harness* del agente y OpenSpec. Antes de
escribir la primera línea del motor (`MOO-16`) o del panel (`MOO-29`) hacen falta la estructura de
paquetes que impone la frontera motor/navegador (README §2.3, D24) y las puertas automáticas que
validan cada PR (README §2.4-§2.6). Si se montan después, el primer código entra sin ellas y la
arquitectura hexagonal pasa a depender de la disciplina de quien escriba, sea persona o agente.

## What Changes

- **Monorepo con pnpm workspaces** con tres paquetes vacíos pero compilables: `packages/shared`,
  `packages/engine` (con las carpetas del núcleo y de los adaptadores separadas) y `packages/panel`.
  Configuración de TypeScript estricta compartida, con la variante Node para `engine` y DOM para `panel`.
- **Lint con la regla de fronteras**: el núcleo de `engine` no importa de sus adaptadores, y `panel`
  solo importa de `shared` entre los paquetes del repo.
- **Vitest como único runner**, con un informe de cobertura único en formato que lee SonarQube.
- **CI en GitHub Actions** en cada PR a `main`: lint, tipos, tests con cobertura y análisis de
  SonarQube Cloud con su *quality gate*.
- **Dependabot** para las dependencias de npm y de GitHub Actions.
- **Versiones de la cadena de herramientas fijadas**: Node.js, pnpm y el CLI de OpenSpec (`1.14.0`,
  hoy instalado en global desde `MOO-31`) como dependencia de desarrollo del repo, para que local y CI
  usen las mismas.
- `AGENTS.md` actualizado con los comandos reales (`pnpm lint`, `pnpm typecheck`, `pnpm test`).

## Capabilities

### New Capabilities

- `module-boundaries`: qué puede importar cada parte del código (núcleo, adaptadores, panel, `shared`) y
  cómo se rechaza una importación que cruza una frontera prohibida.
- `quality-gates`: las comprobaciones que debe superar todo cambio antes de integrarse en `main` (lint,
  tipos, tests, cobertura y *quality gate* de SonarQube) y la reproducibilidad de la cadena de
  herramientas entre el entorno local y la CI.

### Modified Capabilities

Ninguna: no hay specs previas en `openspec/specs/`.

## Non-goals

Tomados de la descripción de `MOO-28` («andamiaje del repositorio, sin funcionalidad») y de su
reparto con otras tareas:

- **Ninguna funcionalidad**: ni motor, ni efectos, ni API, ni panel con UI. Los paquetes solo exportan
  lo mínimo para que lint, tipos y tests tengan algo que comprobar.
- **E2E con Playwright**: se añade con la primera tarea que lo necesite (la carpeta `e2e/` no se crea aquí).
- **Release, CD y despliegue** (README §2.4 pasos 2-5, `deploy/`): fuera de esta tarea.
- **Persistencia** (`MOO-26`) y **layout del panel** (`MOO-29`).
- **Umbral de cobertura propio en Vitest**: el umbral (≥ 80 % en código nuevo) lo aplica el *quality
  gate* de SonarQube, no el runner (ver `design.md`).

## Impact

- **Ficheros nuevos en la raíz**: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`,
  `tsconfig.base.json`, configuración de lint, `vitest.config.ts`, `.nvmrc`,
  `sonar-project.properties`, `.github/workflows/ci.yml`, `.github/dependabot.yml`.
- **Paquetes nuevos**: `packages/shared`, `packages/engine`, `packages/panel`.
- **Dependencias de desarrollo nuevas**: TypeScript, ESLint y sus plugins, Vitest y su proveedor de
  cobertura, `@fission-ai/openspec`.
- **Servicios externos**: proyecto en SonarQube Cloud enlazado a `7daysofrain/mood-table-v2` y el
  secreto `SONAR_TOKEN` en GitHub (lo configura el usuario); Dependabot activado en el repo.
- **Proceso**: tras esta tarea, una PR a `main` con lint, tipos, tests o *quality gate* en rojo no se
  integra (protección de rama, la activa el usuario).
- **Documentación**: `AGENTS.md` (comandos); `.gitignore` (`node_modules/`, `coverage/`, `dist/`).
