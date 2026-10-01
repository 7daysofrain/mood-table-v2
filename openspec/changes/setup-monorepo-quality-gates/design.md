# Design

## Context

El repositorio no tiene `package.json` ni código: solo `docs/`, `openspec/`, `.claude/` y el README.
La estructura objetivo, la regla de fronteras, la estrategia de tests y la CI están descritas en
README §2.3-§2.6 y en D22/D24 de `docs/idea-mood-table.md`; este diseño concreta **cómo** se
implementan. Motivación en `proposal.md`; comportamiento exigido en `specs/module-boundaries` y
`specs/quality-gates`.

Restricciones que condicionan el enfoque:

- Despliegue futuro en **arm64** (Pi 4 y EC2 Graviton, README §2.4) con dependencias nativas
  (`serialport`, SQLite): la versión de Node debe ser una LTS con binarios arm64 y soporte largo.
- Gran parte del código lo escribirá un agente: las fronteras y las puertas tienen que fallar de forma
  **ruidosa y verificable**, no silenciosa.
- SonarQube Cloud gratuito (repo público) y GitHub Actions gratuito: sin servicios de pago.

## Goals / Non-Goals

**Goals:**

- Que cada escenario de las dos specs sea **comprobable**: los de `module-boundaries` con tests
  automáticos que ejecutan ESLint sobre ejemplos; los de `quality-gates`, en la propia PR de esta tarea.
- Dejar a `MOO-16`, `MOO-26` y `MOO-29` un esqueleto donde solo tengan que añadir código, no configuración.

**Non-Goals:**

- Formateador (Prettier o similar): no lo pide `MOO-28`; si se quiere, es una tarea aparte.
- Build de producción del motor ni empaquetado de la release (lo necesita el despliegue, no esta tarea).
- Entorno de tests de DOM para el panel (jsdom/Testing Library): llega con el primer componente
  (`MOO-29`).
- Validar las specs de OpenSpec en la CI (`openspec validate --all --strict`): no lo pide `MOO-28`.
  Si se quiere, es un paso más del job `lint` y se añade con `/opsx:update`.

## Decisions

### 1. Nombres y forma de los paquetes

- Paquetes `@moodtable/shared`, `@moodtable/engine` y `@moodtable/panel`, todos `private`, ESM
  (`"type": "module"`), enlazados con `workspace:*`.
- `engine` separa físicamente `src/core/` (bucle, efectos, puertos), `src/adapters/` y `src/main.ts`
  (raíz de composición). La regla de fronteras se apoya en estas rutas.
- `shared` publica **solo** su punto de entrada (`"exports": { ".": "./src/index.ts" }`) y se consume
  como fuente TypeScript, sin paso de build: Vite y Vitest lo entienden, y con `moduleResolution`
  `Bundler`/`NodeNext` TypeScript respeta `exports`, de modo que importar un fichero interno de `shared`
  falla en la comprobación de tipos (escenario *asumido* de la spec).
- `panel` arranca como cáscara mínima de **Vite + React** (un `index.html` y un componente raíz vacío),
  sin UI. Así la configuración de JSX, DOM y lint de React queda probada desde ya y `MOO-29` solo añade
  componentes.
- *Alternativa descartada:* paquetes con `dist/` compilado y *project references*. Añade un paso de
  build en desarrollo sin beneficio con tres paquetes; se reconsidera si la comprobación de tipos se
  vuelve lenta.

### 2. TypeScript estricto compartido

TypeScript **6.0.x**: la 7 (compilador nativo) aún no la soporta typescript-eslint (`<6.1`); se sube
cuando lo haga. `tsconfig.base.json` en la raíz con `strict`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `verbatimModuleSyntax` e `isolatedModules`. Cada paquete lo extiende:
`engine` y `shared` con `lib` ES y tipos de Node; `panel` con `lib` DOM y `jsx: react-jsx`. El comando
raíz `pnpm typecheck` ejecuta `tsc --noEmit` en cada paquete (`pnpm -r`).

`noUncheckedIndexedAccess` es deliberado: el plano de tiempo real trabaja con búferes indexados
(README §2.1) y ese es justo el error que el modo estricto normal no detecta.

### 3. Lint: ESLint (flat config) + typescript-eslint + eslint-plugin-boundaries

- Un `eslint.config.js` en la raíz para los tres paquetes; reglas de typescript-eslint con
  información de tipos (`recommendedTypeChecked`) y `eslint-plugin-react-hooks` solo en `panel`.
- **Fronteras con `eslint-plugin-boundaries`**, política `default: "disallow"` y una lista explícita
  de lo permitido. Tipos de elemento: `shared`, `engine-core`, `engine-adapter`, `engine-main`,
  `panel`. Permitido: `engine-core → engine-core, shared`; `engine-adapter → engine-adapter,
  engine-core, shared`; `engine-main → todo lo de engine, shared`; `panel → panel, shared`;
  `shared → shared`. Lo no listado falla, así que una carpeta nueva sin clasificar también falla en
  lugar de pasar por omisión.
- *Alternativas consideradas:*
  - `import/no-restricted-paths` (eslint-plugin-import): sirve, pero es una lista de prohibiciones;
    con *default allow*, una carpeta nueva queda sin protección.
  - **dependency-cruiser**: muy capaz, pero es otra herramienta fuera del lint y README §2.3
    compromete "una regla de lint".
  - **Biome**: más rápido, pero sin reglas con información de tipos comparables ni un equivalente a
    `boundaries` con política por defecto.
- **Propuesta de D#:** "Fronteras con eslint-plugin-boundaries en *default disallow*" como **D37**.

### 4. La regla de fronteras se prueba a sí misma

Un fallo silencioso es el riesgo principal (ver Riesgos): si la resolución de imports no reconoce un
paquete del workspace como local, el plugin lo trata como dependencia externa y **no** aplica la
política. Por eso cada escenario de `module-boundaries` es un test de Vitest que ejecuta ESLint por su
API sobre un fichero de ejemplo situado en la carpeta que toca y comprueba el resultado (error de
`boundaries/dependencies` o ninguno). Los tests viven en `tooling/` (proyecto de Vitest propio,
fuera de los paquetes) junto con sus ejemplos.

### 5. Tests: Vitest 5 con `projects` y un único informe

- `vitest.config.ts` raíz con `test.projects: ["packages/*", "tooling"]`; cada paquete puede tener su
  `vitest.config.ts` con su entorno (`node` hoy en los tres).
- Cobertura con `@vitest/coverage-v8`, reporteros `text` y `lcov`, en `coverage/lcov.info` en la raíz:
  es el único informe que lee SonarQube.
- **Exclusiones de cobertura por convención de nombre:** `packages/engine/src/main.ts` y
  `**/*.hardware.ts`. Un adaptador de hardware separa la parte pura (p. ej. codificar el protocolo
  Adalight, que sí tiene tests unitarios, README §2.6) de la E/S real (abrir el puerto serie, lanzar
  `arecord`), que va en un fichero `*.hardware.ts`. *Alternativa descartada:* una carpeta
  `adapters/hardware/`, que obligaría a agrupar por tipo de E/S en vez de por puerto.
  **Propuesta de D#:** convención `*.hardware.ts` como **D38**.
- **Sin umbral de cobertura en Vitest.** El umbral del proyecto es "≥ 80 % en código nuevo" y solo
  SonarQube sabe qué es código nuevo; un umbral global en Vitest sería una segunda puerta con otra
  semántica (y fallaría con el esqueleto casi vacío).

### 6. CI: un workflow, tres jobs más el análisis

`.github/workflows/ci.yml`, disparado en `pull_request` y en `push` a las **ramas de integración**:
`main` y `feature/entrega-*`. Las PR de las tareas van contra la rama de la entrega (`linear.md` §7), y
el `push` a esas ramas hace que SonarQube las analice y puedan servir de destino a las PR.

| Job | Pasos | Comprobación requerida |
|---|---|---|
| `lint` | instalar · `pnpm lint` | sí |
| `typecheck` | instalar · `pnpm typecheck` | sí |
| `test` | instalar · `pnpm test:coverage` · análisis de SonarQube con `coverage/lcov.info` | sí |
| *SonarCloud Code Analysis* | lo publica SonarQube Cloud al terminar con el resultado del *quality gate* | sí |

- Jobs separados para que la PR diga **qué** falló (escenarios de la spec) y para poder marcarlos
  como requeridos uno a uno. El coste es instalar tres veces; con la caché de pnpm es poco.
- Instalación común: `pnpm/action-setup` (lee `packageManager`), `actions/setup-node` con
  `node-version-file: .nvmrc` y caché de pnpm, `pnpm install --frozen-lockfile`.
- Análisis con la acción oficial de SonarSource y `fetch-depth: 0` (necesita el historial para
  distinguir código nuevo). El análisis automático de SonarQube Cloud se desactiva: no importa
  cobertura.
- En SonarQube, ramas de larga duración `main|feature/entrega-.*` y **rama de referencia del código
  nuevo = `main`**: `main` es lo ya entregado, así que una rama de entrega se mide por lo que añade a la
  entrega, y una PR, por lo que añade a su rama destino.
- *Quality gate* "Sonar way" por defecto, que ya exige ≥ 80 % de cobertura en código nuevo (README
  §2.6). Sin *quality gate* propio mientras el por defecto encaje.
- Las acciones se fijan por versión mayor y las actualiza Dependabot.
- La protección de `main` y `feature/entrega-*` (comprobaciones requeridas) la configura el usuario con un *ruleset* de
  GitHub: es un cambio de configuración de la cuenta, no del repositorio.

### 7. Versiones fijadas

- **Node.js 24 LTS** en `.nvmrc` y en `engines` (`>=24 <25`), con `engineStrict: true` en
  `pnpm-workspace.yaml` (desde pnpm 11, `.npmrc` solo guarda registro y autenticación).
  Es la LTS activa (soporte hasta abril de 2028, con binarios arm64); Node 22, la que hay hoy en
  local, sale de soporte en abril de 2027, cerca del final del máster.
  **Propuesta de D#:** como **D39** (concreta el "Node.js LTS" de README §2.4).
- **pnpm** `12.8.1` fijado exacto en `packageManager` (última estable al implementar); corepack y
  `pnpm/action-setup` lo respetan.
- **OpenSpec** `@fission-ai/openspec` `1.14.0` exacto en `devDependencies` de la raíz; se ejecuta con
  `pnpm exec openspec`. La instalación global de `MOO-31` puede quedarse, pero la del repo es la de
  referencia.

### 8. Dependabot

`.github/dependabot.yml` con dos ecosistemas: `npm` (raíz; Dependabot entiende el workspace de pnpm) y
`github-actions`, revisión semanal y agrupando las actualizaciones *minor/patch* en una sola PR por
ecosistema para no saturar la cola. Las alertas de seguridad se activan en la configuración del repo.

## Risks / Trade-offs

- **[La regla de fronteras pasa en silencio si no resuelve un import]** → los tests de la decisión 4
  ejercitan cada frontera, incluido el import por nombre de paquete (`@moodtable/engine`) además de por
  ruta relativa.
- **[Los tests de lint con información de tipos sobre ficheros de ejemplo]** typescript-eslint exige
  que el fichero analizado pertenezca a un proyecto de TypeScript → los ejemplos son ficheros reales en
  `tooling/`, mapeados a la carpeta que simulan, o se lintan con la configuración de fronteras sin las
  reglas con tipos. Se decide al implementar el paso; no cambia la spec.
- **[Exclusiones de cobertura duplicadas]** Vitest las quita del informe, pero SonarQube contaría esos
  ficheros como no cubiertos si no se excluyen también en `sonar.coverage.exclusions` → los dos
  patrones se escriben iguales, con un comentario que enlaza uno con otro. Es la única duplicación
  consciente.
- **[Secretos en PRs de Dependabot y de forks]** GitHub no pasa `SONAR_TOKEN` a esas PRs → para
  Dependabot se crea el mismo secreto en *Dependabot secrets*; las PRs de forks se quedan sin análisis
  (repo de un solo autor: riesgo aceptado).
- **[Dependabot inactivo hasta el cierre de la entrega]** GitHub solo lee `.github/dependabot.yml`
  en la rama por defecto, y esta tarea se integra en `feature/entrega-2-JA` → se acepta: la
  configuración se valida en la PR y Dependabot se activa al integrar la entrega en `main`
  (23-oct-2026). Sus PR van contra `main` y llegan a la entrega siguiente, que sale de `main`.
- **[Primera PR contra una rama de entrega aún no analizada]** SonarQube no tiene análisis previo de
  `feature/entrega-2-JA` cuando llega la PR de esta tarea → el resultado puede compararse con `main`;
  tras integrarla, el `push` genera el análisis de la rama y las PR siguientes ya tienen destino.
- **[Node 24 en local]** el entorno actual tiene Node 22 → `engine-strict` falla la instalación con un
  mensaje claro; el usuario instala Node 24 (nvm/fnm leen `.nvmrc`).
- **[Esqueleto casi vacío frente al *quality gate*]** con muy poco código, un fichero sin test baja
  mucho el porcentaje → cada paquete trae un test mínimo de su punto de entrada.
- **[Coste de jobs separados]** tres instalaciones por PR → caché de pnpm; si se nota, se unifican en
  un job con pasos con nombre.

## Migration Plan

No hay nada que migrar: es el primer código del repositorio. La PR de esta tarea es la primera que pasa
por la CI que ella misma crea; se valida mirando sus comprobaciones. Volver atrás es revertir la PR.
