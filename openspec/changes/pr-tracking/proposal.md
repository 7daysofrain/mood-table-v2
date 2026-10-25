# Proposal

> **Origen:** historia [`MOO-73`](https://linear.app/7daysofrain/issue/MOO-73/avisar-del-estado-de-cada-pr-abierta)
> · Avisar del estado de cada PR abierta · épica **PB** (`MOO-67`, BH1, parte 1 de 3) · expectativas
> **BE6** y **BE9** (`docs/pr-babysitter.md` §3). Resuelve **BQ1** (canal de aviso).
> Tareas: `MOO-83` (avisar de cada PR lista para revisar: paquete, contenedor, credenciales, polling y
> canal, `infra`) y `MOO-84` (seguir cada PR hasta su estado final, `infra`).

## Why

Hoy el mantenedor hace de reloj: vuelve a cada PR para ver si han terminado las comprobaciones y si
Codex ha revisado el último push. Cuando nadie mira, la puerta falla en silencio. En 3 de las 12 PR
revisadas por Codex (#57-#68), su bloque `codex-review-state` se quedó en `running` y la PR se integró
sin revisión del último push. BH1 es el mínimo útil del PR Babysitter (PB §5.1): seguir cada PR y
avisar de su estado quita al mantenedor ese papel. También monta la base sobre la que se construyen
BH2-BH5: el paquete, el contenedor, el polling, el grafo con un hilo por PR y el canal de aviso.

## What Changes

- **Sistema nuevo, el PR Babysitter**: un proceso en un contenedor que consulta GitHub por polling
  (D66) y sigue cada PR del mantenedor contra `main` que no es borrador. No escribe nada en GitHub.
- **Avisos por Linear**: cada aviso es un comentario en la tarea de Linear enlazada a la PR y menciona
  al mantenedor. Lo publica una app de Linear propia, no la cuenta del mantenedor. Lo que no tiene
  tarea (una PR sin enlazar, o un fallo del propio sistema) va a un issue buzón fijo.
- **Ciclo de cada push**: un aviso de que el sistema sigue la PR, otro cuando terminan las
  comprobaciones que exige `main` y otro con el estado final: **lista para integrar** o **necesita
  intervención**, con el motivo (qué comprobación falla, el revisor tiene hallazgos o qué no terminó a
  tiempo). Un push nuevo vuelve a empezar el ciclo.
- **Tiempo de espera de 30 min** desde que el sistema ve el push, para las comprobaciones y la
  revisión juntas.
- **Solo cuenta el revisor**: el estado final sale de las comprobaciones y del bloque del revisor; un
  comentario de otra persona no lo cambia (BE6).
- **Al arrancar**, el sistema sigue las PR que ya estaban abiertas. El estado se reconstruye desde
  GitHub, sin persistencia propia todavía (BE7 va aparte).
- **Fronteras del paquete nuevo**: núcleo y adaptadores separados, como en el motor, y ninguna
  importación del producto.

## Capabilities

### New Capabilities

- `pr-tracking`: qué PR sigue el PR Babysitter, cuándo y cómo avisa al mantenedor de su estado, y qué
  se tiene en cuenta para el estado final.

### Modified Capabilities

- `module-boundaries`: el paquete `pr-babysitter` tiene sus propias fronteras (el núcleo no importa
  adaptadores) y no importa ningún paquete del producto.
- `quality-gates`: el runner único y el informe de cobertura común incluyen el paquete nuevo.

## Non-goals

Tomados de la historia `MOO-73`:

- **Triar o arreglar hallazgos** (BH2, BH3).
- **PR de otras personas, de forks o de entrega** (PB §5.3).
- **Webhooks o un *runner* de GitHub propio** (PB §5.3).
- **Integrar PR** (BE2).
- **Retomar cada PR donde estaba tras un reinicio** (BE7, historia aparte): al arrancar puede
  repetirse el aviso de que sigue una PR.
- **Atender los comentarios del mantenedor en la PR** (BH4, `MOO-79`).
- **PR de Dependabot**, hasta comprobar BA2.

Fuera también, decidido al explorar el change (25-oct):

- **Cambiar el estado de la historia o la tarea en Linear**: el sistema solo comenta. Si debe reflejar
  en Linear el estado de la PR es una pregunta nueva de PB, con su propia historia.
- **Escribir en GitHub**: el token es de solo lectura. El token con escritura (y si hace falta una
  GitHub App) llega con BH3, que además tiene que resolver que `Contents: write` también permite
  integrar.
- **Contestar al sistema**: el puerto de aviso solo envía. La respuesta del mantenedor se diseña en
  BH4.
- **La API de *Agents* de Linear**: funciona solo con webhooks, y choca con D66.
- **Otros canales** (Telegram, ntfy): el puerto de aviso los admite, pero no se construyen.

## Impact

- **Código**:
  - `packages/pr-babysitter` (nuevo): núcleo (grafo de LangGraph, reglas puras, modelo de aviso,
    puertos), adaptadores (GitHub, Linear) y raíz de composición. Con su `Dockerfile` y un
    `compose.yaml`.
  - `eslint.config.js` y `tooling/boundaries.test.ts`: los elementos y las reglas del paquete nuevo.
  - `vitest.config.ts` y `sonar-project.properties`: excluir de la cobertura su raíz de composición.
- **Dependencias nuevas** (en el catalog): `@langchain/langgraph`, `zod`, `octokit` y `@linear/sdk`.
- **Configuración y secretos**: un `.env.example` con el token de GitHub, el *client id* y el *secret*
  de la app de Linear, el usuario de Linear del mantenedor y el ID del issue buzón. El `.env` no se
  commitea.
- **Preparación a mano** (la hace el usuario antes de `MOO-83`): la app OAuth en Linear (necesita ser
  admin), el PAT *fine-grained* en GitHub y el issue buzón en Linear.
- **Documentación**:
  - `docs/idea-mood-table.md` §10: las decisiones nuevas (`design.md`).
  - `docs/pr-babysitter.md`: BQ1 resuelta, dos preguntas nuevas (reflejar el estado en Linear; push
    sin merge en BH3) y los términos nuevos del glosario.
  - `docs/instructions/linear.md`: una sección para el PR Babysitter como actor con su propio token.
  - `docs/umbrales-para-specs.md`: el tiempo de espera y la cadencia del polling, con su medición.
  - README: §2.2 (componentes), §2.4 (despliegue) y §2.5 (seguridad de los tokens).
  - `prompts.md`.
- **Tests E2E**: ninguno. El sistema no tiene interfaz; se prueba con Vitest y con fixtures de GitHub
  y Linear. La prueba de punta a punta se hace a mano contra una PR real (`tasks.md`).
