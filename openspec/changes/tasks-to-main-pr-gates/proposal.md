# Proposal

> **Origen:** tarea *enabler* [`MOO-42`](https://linear.app/7daysofrain/issue/MOO-42/integrar-las-tareas-en-main-y-endurecer-las-puertas-de-la-pr-sonar-y)
> · Integrar las tareas en main y endurecer las puertas de la PR (Sonar y Copilot) · épica técnica
> `MOO-27` (sin historia de producto ni H#/E#). Desbloquea `MOO-36`.

## Why

Las dos puertas de la PR que no son tests no están haciendo su trabajo:

- **Sonar.** En el plan gratuito, SonarQube Cloud no enseña los datos de una PR que no va contra
  `main`. Además, *Sonar way* no falla por incidencias nuevas. La PR `7daysofrain/mood-table-v2#10`
  (`MOO-36`) tiene 5 incidencias que nadie puede leer, y su *quality gate* está en verde.
- **Copilot.** Su revisión solo se pide a mano. En esa misma PR encontró un bug real.

Hay que arreglarlo antes de que entre más código en la E2 (23-oct).

## What Changes

- **Las PR de las tareas van contra `main`.** Las tareas salen de `main` y vuelven a `main`. Es la
  única base sobre la que Sonar gratis enseña los datos de la PR.
- **La rama de entrega pasa a ser una foto de `main`.** Al cerrar cada entrega se abre una PR de
  `main` a `feature/entrega-N-JA`, y su enlace `…/tree/` es el que va al Typeform. Deja de ser una
  rama de integración intermedia, pero sigue protegida por el mismo *ruleset*.
- **Comprobación nueva en la CI: incidencias nuevas de SonarQube.** En cada PR contra `main`, un job
  espera a que termine el análisis y consulta las incidencias abiertas de la PR. Si hay alguna, falla
  y las lista.
  - Sustituye al *quality gate* propio que preveía la tarea: la documentación de SonarQube Cloud
    confirma que los gates propios son solo de los planes Team y Enterprise.
  - Una incidencia que no aplica se marca como aceptada en Sonar, y deja de contar.
- **Copilot como puerta, configurada en el *ruleset* de GitHub:**
  - revisión automática de Copilot en cada PR que no es borrador y en cada push;
  - no se integra mientras quede un hilo de revisión sin resolver.
- **El protocolo del agente con cada hallazgo de Copilot o Sonar:** lo verifica, lo arregla o
  contesta en el hilo por qué no aplica, y lo resuelve.
- **Documentación del flujo:**
  - `linear.md` §7, `workflow.md` §4.2, §4.4 y §4.5, `course.md` §3 y `AGENTS.md`;
  - el *Purpose* de la spec `quality-gates`;
  - `prompts.md`.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `quality-gates`:
  - el *quality gate* de Sonar se comprueba en las PR de las tareas contra `main`, no contra la rama
    de entrega. El requisito se quita y se vuelve a añadir con otro nombre, porque OpenSpec no deja
    quitar un escenario con MODIFIED;
  - requisito nuevo: una PR contra `main` con incidencias nuevas de Sonar queda en rojo;
  - requisitos nuevos: revisión automática de Copilot y bloqueo con hilos sin resolver;
  - requisito nuevo: a qué rama va cada PR, con la rama de entrega como foto de `main`;
  - la lista de comprobaciones obligatorias para integrar incluye la de incidencias.

## Non-goals

Tomados de `MOO-42`:

- **No se cambian lint, typecheck ni test en la CI.** Solo se añade la comprobación de incidencias,
  que es la alternativa de Sonar que preveía la tarea.
- **No se hace la foto de la E2.** Se hace al cerrarla (23-oct). El escenario «Cierre de una
  entrega» se verifica entonces.
- **No se pasa a un plan de pago de Sonar.**

Por decisión de diseño (`design.md`):

- **No se restringen los métodos de integración del *ruleset*.** El merge commit de la foto lo elige
  el usuario al integrar.

## Impact

- **CI:**
  - `.github/workflows/ci.yml`: el job `test` publica el informe del análisis como artefacto, y hay
    un job nuevo, `sonar-issues`.
  - `tooling/ci/`: script que consulta la API de SonarQube Cloud. Su parte pura tiene tests y entra
    en la cobertura y en el análisis de Sonar, así que cambian `vitest.config.ts` y
    `sonar-project.properties`.
- **Configuración de GitHub (la hace el usuario):** en el *ruleset* «ramas de integración»:
  - la regla `copilot_code_review`;
  - `required_review_thread_resolution: true`;
  - `sonar-issues` como comprobación requerida.
- **Proceso:**
  - las ramas de las tareas y las de `…-archivar-change` salen de `main`;
  - la PR `7daysofrain/mood-table-v2#10` cambia su base a `main` para que sus incidencias se vean y se
    corrijan allí.
- **Documentación:** la de *What Changes* y, si el usuario la aprueba, la decisión D41 en
  `docs/idea-mood-table.md` §10.
