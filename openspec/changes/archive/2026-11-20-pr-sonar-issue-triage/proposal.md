# Proposal

> **Origen:** historia [`MOO-148`](https://linear.app/7daysofrain/issue/MOO-148/triar-cada-error-de-una-comprobacion-como-un-hallazgo-propio)
> · Triar cada error de una comprobación como un hallazgo propio · épica **PB** (`MOO-67`, BH2)
> · expectativas **BE3** y **BE4** (`docs/pr-babysitter.md` §3). Sale del *spike* `MOO-120` (D114).
> Tareas: `MOO-167` (emitir cada incidencia de `sonar-issues` como anotación, `infra`) y `MOO-168`
> (triar cada incidencia de SonarQube como un hallazgo propio, `infra`).

## Why

Hoy `sonar-issues` es un solo hallazgo, traiga las incidencias que traiga. En la #134 juntó una
complejidad cognitiva (que pide decidir cómo partir la función) con un `for…of` mecánico, y salió
*exige criterio* con p = 0,76: la p mezcla las dos y la clase solo puede ser la del más difícil. Además,
la pregunta que recibe, «¿lo causa esta PR?», casi siempre responde que sí, porque SonarQube solo mira
el código nuevo. Así, el triador no puede separar lo que hay que arreglar de lo que hay que aceptar en
SonarQube: los tres casos aceptados como *Won't fix* (dos `await` dentro de un bucle a propósito y un
`<canvas role="img">`) saldrían *real*. `sonar-issues` es la comprobación que más falla (28 de 52 runs).

## What Changes

- **`sonar-issues` anota cada incidencia** en su línea: un `::error` con el fichero, la línea, la regla,
  su nombre, su severidad y el mensaje, fuera del bloque `::stop-commands::` y con el texto escapado.
  Como el runner de GitHub guarda 10 errores por paso, anota las 10 primeras y deja un aviso con el
  total. El log y el resumen del *job* siguen listándolas todas.
- **Cada incidencia es un hallazgo propio**, con su fichero y su línea, en lugar de la comprobación
  entera. La comprobación entera solo es un hallazgo cuando no lista ninguna incidencia legible, y
  entonces *exige criterio* sin preguntar.
- **Una pregunta nueva para las incidencias:** «¿tiene el código señalado el problema que describe la
  regla?», con criterios genéricos. El modelo de decisión recibe la regla, su nombre, el mensaje, el
  fichero, la línea y **el código alrededor de la línea** en el commit del push. Sin el código la
  pregunta no separa (medido al refinar: 5 de 12 frente a 7 de 12).
- **Cómo se clasifica:** por la probabilidad del sí, con el umbral de siempre. *No aplica* dice en el
  resumen que la incidencia se aceptaría en SonarQube. Una de severidad alta (`BLOCKER` o `HIGH`) que
  saldría *no aplica* exige criterio por la regla de severidad alta.
- **Sin el código de una incidencia** (fichero borrado, línea fuera del fichero, GitHub falla), esa
  incidencia *exige criterio* sin preguntar, y las demás se trían.
- **Si la comprobación trae más incidencias de las que anota**, el resumen lo dice.
- **El PAT declara *Contents* en lectura** para leer el fichero en el commit del push. No deja hacer
  push ni integrar: eso es *Contents: write*, que sigue fuera (BQ7).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-triage`: los hallazgos de un push pasan a incluir cada incidencia nueva de SonarQube en lugar de
  la comprobación que las lista; la pregunta y la clasificación de una incidencia; la regla de severidad
  alta para incidencias; sin código o sin incidencias legibles; y la lista cortada.
- `quality-gates`: la comprobación de incidencias nuevas anota cada una en su línea y avisa del total.

## Non-goals

Tomados de la historia `MOO-148`:

- **El contexto de una comprobación que no se puede partir, y relanzarla:** `MOO-120` / `MOO-155`.
- **Arreglar los hallazgos:** BH3 (`MOO-77`).
- **Calibrar el umbral del triaje y validar la pregunta con filas nuevas:** `MOO-76`. Las tres
  incidencias aceptadas son filas para él.
- **Partir un `test` o `e2e` con varios tests que fallan dos veces:** depende del relanzamiento
  (`MOO-155`).

Fuera también, decidido al escribir el change (20-nov):

- **Partir `lint` o `typecheck`:** salen *real* por regla (D114), así que partirlos no cambia su clase.
- **Aceptar la incidencia en SonarQube:** el resumen solo dice que se aceptaría; aceptarla es del
  mantenedor (PB §4.1), y BQ9 decide si debe salir *no aplica* o *exige criterio*.

## Impact

- **CI** (`tooling/ci/`): `sonar-issues.ts` (las anotaciones, puras y con tests) y
  `check-sonar-issues.ts` (pide el nombre de la regla y las publica).
- **Código** (`packages/pr-babysitter`):
  - `src/core/triage.ts`: el hallazgo de una incidencia, la pregunta `rule`, su clasificación, la regla
    de severidad alta y el motivo «sin incidencias legibles».
  - `src/core/triage-summary.ts`: la fila de una incidencia, «se aceptaría en SonarQube» y la nota de
    la lista cortada.
  - `src/adapters/`: `sonar-issues.ts` (nuevo: lee las anotaciones y recorta el código),
    `findings.ts` (parte la comprobación), `github.ts` (lee un fichero en un commit),
    `decision-model.ts` (la pregunta y sus criterios) y `config.ts` (`TRIAGE_SONAR_ISSUES_CHECK`).
  - `src/main.ts` y `src/studio.ts`, para el montaje.
- **Peticiones a GitHub:** un fichero por incidencia, solo en las PR que se trían y solo con
  `sonar-issues` en rojo.
- **Peticiones al modelo de decisión:** una por incidencia en lugar de una por comprobación. Con el
  código, unos 2.600 tokens cada una (0,0006 $); el tope de 0,05 $ no cambia.
- **Documentación:**
  - README §2.2 (el módulo nuevo y la pregunta), §2.4 (`TRIAGE_SONAR_ISSUES_CHECK`) y §2.5
    (*Contents* en lectura, y que el código de las incidencias sale hacia el modelo);
  - `docs/umbrales-para-specs.md`: el fragmento de código y las 10 anotaciones;
  - `docs/idea-mood-table.md` §10: D117 (*Contents* en lectura) y D118 (la pregunta de la premisa
    con el código);
  - `prompts.md`.

  El glosario de PB (*Hallazgo*) y la pregunta abierta BQ9 ya están en la rama de la historia.
- **Tests E2E:** ninguno. Vitest con fixtures y un modelo de decisión falso; la prueba de punta a
  punta, a mano contra PR de prueba, leyendo sus trazas en LangSmith (`tasks.md`).
