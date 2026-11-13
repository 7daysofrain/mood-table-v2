# Proposal

> **Origen:** historia [`MOO-159`](https://linear.app/7daysofrain/issue/MOO-159/triar-cada-comprobacion-que-falla-con-su-contexto-y-segun-su-tipo)
> · Triar cada comprobación que falla con su contexto y según su tipo · épica **PB** (`MOO-67`, BH2)
> · expectativas **BE3**, **BE4** y **BE8** (`docs/pr-babysitter.md` §3). Sale del *spike* `MOO-120`
> (D114) y absorbe `MOO-154`. Tareas: `MOO-161` (leer el contexto de cada comprobación según su app,
> `infra`), `MOO-162` (un hallazgo por petición, `infra`) y `MOO-163` (reglas para las comprobaciones
> deterministas y la pregunta de la causa, `infra`).

## Why

Hoy el triador se equivoca con confianza en las comprobaciones que fallan, y el *spike* `MOO-120`
encontró tres causas:

- **Le falta el error.** El corte del log se queda en el primer `##[error]`, así que en un `e2e` de
  Playwright el modelo de decisión no ve el `Expected/Received` (`MOO-154`).
- **Le llega la pregunta del revisor.** «¿Hay que arreglarlo en esta PR?» no separa un fallo que
  causa la PR de uno intermitente.
- **Le llegan todos los hallazgos juntos.** En la #116, el `e2e` pasó de 0,64 a 0,83 solo por ir en
  la misma petición que `sonar-issues`.

Con la pregunta de la causa y un hallazgo por petición, la separación entre *real* y *relanzar* pasó
de 0,14 a 0,51, y ninguna fila salió con confianza del lado equivocado. Para que el mantenedor se fíe
del triaje (BE3) antes de BH3, hay que llevar eso al sistema.

## What Changes

- **El contexto de cada comprobación que falla depende de la app que la ejecuta:**
  - en GitHub Actions, sus anotaciones útiles o, si no queda ninguna, el paso que falla del log,
    entero;
  - en cualquier otra app, el resumen que publica la comprobación.

  El contexto dice de dónde sale, se corta a 16 KiB (y entonces lo dice) y distingue entre una
  comprobación que no da contexto y una cuyo contexto no se ha podido leer. Sustituye el corte de hoy.
- **`lint`, `typecheck` y `SonarCloud Code Analysis` salen *real* por regla,** sin preguntar al modelo
  de decisión. La lista es configurable, y la regla va antes que el contexto y que el tope de gasto.
- **Las demás comprobaciones se preguntan por la causa:** «¿lo causa esta PR?», con sus propios
  criterios. Los hallazgos del revisor siguen con la pregunta y los criterios de hoy (`MOO-160`).
- **Un hallazgo por petición:**
  - el triador pregunta cada hallazgo por separado y en paralelo (*fan-out* con `Send` de LangGraph);
  - si una petición falla, ese hallazgo sale *exige criterio* y los demás no se ven afectados;
  - el tope de gasto se reserva antes de repartir las peticiones, como hoy.
- **El resumen dice de dónde sale el contexto** de cada comprobación (anotaciones, log o resumen de la
  app), si se cortó y, cuando no lo hay, cuál de los dos casos es.
- **El puerto `Triager` pasa a llamarse `DecisionModel`,** como el glosario de PB §8, y pregunta un
  hallazgo cada vez.
- **El PAT declara *Checks* y *Actions* en lectura** (D114), aunque hoy funcione sin ellos porque el
  repo es público.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-triage`:
  - la pregunta depende de la fuente del hallazgo;
  - las comprobaciones deterministas salen *real* por regla;
  - un hallazgo por petición, y una petición que falla no arrastra a las demás;
  - el contexto de una comprobación según su app, y los dos casos sin contexto;
  - el resumen dice de dónde sale el contexto.

## Non-goals

Tomados de la historia `MOO-159`:

- **Relanzar los fallos transitorios y detectar las repeticiones:** `MOO-155`, con `MOO-79`. Con
  ellos va la lista de ficheros con la pregunta de la causa, que el *spike* manda solo en los `test` y
  `e2e` que fallan dos veces.
- **Partir una comprobación en varios hallazgos** y que `sonar-issues` emita anotaciones: `MOO-148`.
- **Cambiar la pregunta de los hallazgos del revisor o darlos por buenos:** `MOO-160`. Siguen con la
  pregunta de hoy, aunque también van uno por petición.
- **Validar las preguntas nuevas con PR ya cerradas y calibrar el umbral:** `MOO-76`.

Fuera también, decidido al explorar el change (13-nov):

- **Una clase nueva para lo que no causa la PR:** es BQ8 y la resuelve `MOO-155`. Hasta entonces sale
  *no aplica*, como hoy.
- **El contexto de una comprobación como puerto del núcleo:** de momento es un módulo del adaptador
  de los hallazgos. Se sube a puerto cuando lo necesite otro consumidor (`MOO-155`), como dice D114.
- **Pasar el diff de la PR:** el *spike* lo descartó (baja la p de todas las filas y cuesta unas 10
  veces más).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/triage.ts`:
    - el contexto de una comprobación dentro del hallazgo;
    - la regla de las deterministas y el veredicto por regla;
    - la pregunta según la fuente;
    - la reserva del tope por hallazgo.
  - `src/core/ports.ts`: `Triager` pasa a `DecisionModel`, con un hallazgo por llamada.
  - `src/core/graph.ts`: el nodo `triar` reparte, un nodo por hallazgo pregunta al modelo y otro reúne
    las respuestas antes de `publicarResumen`.
  - `src/core/triage-summary.ts`: el porqué de la regla y el origen del contexto.
  - `src/adapters/`:
    - `check-context.ts` (nuevo), con las estrategias por `app.slug`;
    - `findings.ts`, que las usa;
    - `github.ts`, que lee el *check run* con su salida, sus anotaciones y el log del *job*;
    - `decision-model.ts`: una petición por hallazgo, sin `batches()`, con la pregunta de la causa.
  - `src/adapters/config.ts` y `.env.example` (`TRIAGE_RULE_CHECKS`), `src/core/driver.ts` (la
    concurrencia del grafo), `src/main.ts` y `src/studio.ts`.
- **Dependencias:** ninguna nueva. `Send` y `ReducedValue` son de `@langchain/langgraph`.
- **Peticiones a GitHub:** por cada comprobación que falla, el *check run* y sus anotaciones, y el log
  solo si no hay anotaciones útiles. Siguen siendo solo en las PR que se trían.
- **Peticiones al modelo de decisión:** una por hallazgo en vez de una por push. Cada una repite la
  PR, unos 0,0004 $ más por hallazgo, y el tope de 0,05 $ no cambia (BQ5).
- **Documentación:**
  - README §2.2 (los nodos nuevos, el puerto `DecisionModel` y el módulo del contexto), §2.4
    (`TRIAGE_RULE_CHECKS`) y §2.5 (*Checks* y *Actions* en lectura, y qué sale hacia el modelo);
  - `docs/umbrales-para-specs.md`: el corte de 16 KiB para cualquier origen y la concurrencia;
  - `docs/idea-mood-table.md` §10: una D# nueva para el *fan-out* (`design.md`, decisión 4);
  - `prompts.md`.

  El glosario de PB (*triador*, *modelo de decisión*) y BQ8 ya están en la rama de la historia.
- **Tests E2E:** ninguno. Vitest con fixtures de GitHub y un modelo de decisión falso; la prueba de
  punta a punta, a mano contra PR de prueba, leyendo sus trazas en LangSmith (`tasks.md`).
