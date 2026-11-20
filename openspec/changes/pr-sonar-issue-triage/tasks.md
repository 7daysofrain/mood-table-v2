# Tasks

> **Organización:**
> - Dos tareas de Linear, cada una con su sección y su PR contra `main`, en este orden: la 2 lee las
>   anotaciones que emite la 1.
> - La sección 1 se implementa en la rama de la historia, que ya lleva este change, el glosario de PB
>   (*Hallazgo*) y BQ9. La sección 2 va en una rama propia que sale de `main` después de integrar la 1.
> - Cada paso es un commit con `Refs MOO-167` o `Refs MOO-168`, y cada PR lleva `Fixes` con su tarea.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de las pruebas a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
>   integrar y sin rama.
>
> **Hecho antes de empezar (20-nov):** el mantenedor ha añadido *Contents* en lectura al PAT del
> sistema (`design.md`, *Migration Plan*).

## 1. MOO-167 · infra

- [x] 1.1 **(test en rojo)** Las anotaciones de `sonar-issues` (`design.md` decisión 1), en
  `tooling/ci/sonar-issues.test.ts`:
  - una incidencia con línea da `::error file=…,line=…,title=<regla> · <severidad> · <nombre>::<mensaje>`;
    una de fichero, sin `line`;
  - la severidad es la más alta de `impacts` y, sin `impacts`, la heredada traducida; sin el nombre de
    la regla, va su clave;
  - con 12 incidencias, 10 `::error` en el orden de SonarQube y un `::notice` con «12 incidencias
    nuevas; se anotan 10»; con 2, «2 incidencias nuevas; se anotan 2»;
  - el escapado: `%`, `\r` y `\n` en el texto; además `:` y `,` en `file` y `title`. Una ruta o un
    mensaje con `::stop-commands::` o un salto de línea sale en una sola línea.
- [x] 1.2 Las funciones puras en `tooling/ci/sonar-issues.ts`, y `check-sonar-issues.ts` pide
  `additionalFields=rules` e imprime las anotaciones antes del bloque `::stop-commands::`. El log y el
  resumen del *job* no cambian.
  Verificar: los tests de 1.1 en verde, y los que ya había; `pnpm lint` y `pnpm typecheck` en verde.
- [x] 1.3 Documentación: `docs/umbrales-para-specs.md` (las 10 anotaciones por paso, con la fuente del
  runner) y la parte de `sonar-issues` del README, si la describe.
  Verificar: el README no contradice la spec `quality-gates`.
- [x] 1.4 Prueba a mano, con una PR de prueba contra `main` que añade dos incidencias en ficheros
  distintos (p. ej., un ternario anidado y un `await` dentro de un bucle):
  - `sonar-issues` en rojo, con las dos anotaciones en su línea en *Files changed*;
  - `gh api repos/7daysofrain/mood-table-v2/check-runs/<job id>/annotations` da los dos `failure` con
    su título y el `notice` con el total;
  - el log sigue listándolas.

  Cerrar la PR sin integrar. Verificar: lo visto queda anotado en la PR de la tarea.

## 2. MOO-168 · infra

- [x] 2.1 Decisiones: D117 (*Contents* en lectura, matiza D64 y D71) y D118 (la pregunta de la premisa
  de la regla, con el código y criterios genéricos) en `docs/idea-mood-table.md` §10, y README §2.5
  (*Contents* en lectura, y que el código de las incidencias sale hacia el modelo de decisión).
  Verificar: las dos D# citan este change y `MOO-148`.
- [x] 2.2 **(test en rojo)** Lecturas y recorte (`design.md` decisiones 4 y 5):
  - **`adapters/github.test.ts`:** `fileAt(sha, path)` da el texto; un 404 da `null` y un 5xx lanza.
  - **`adapters/sonar-issues.test.ts`** (nuevo), con las anotaciones grabadas en 1.4 como fixture:
    - de cada `failure` saca regla, nombre, severidad (`high` con `BLOCKER` y `HIGH`), fichero, línea
      y mensaje; del `notice`, el total;
    - el código es de la línea − 25 a la + 15, numerado y con `>>` en la suya; uno de fichero, las 40
      primeras;
    - una línea fuera del fichero, o un fichero que no llega, dan `code: null`;
    - cada fichero se pide una vez.
- [x] 2.3 `fileAt` en `adapters/github.ts` y el módulo `adapters/sonar-issues.ts`. Todavía no los usa
  nadie.
  Verificar: los tests de 2.2 en verde; `pnpm typecheck` en verde.
- [ ] 2.4 **(test en rojo)** El triaje de una incidencia:
  - **`core/triage.test.ts`:**
    - `questionFor` da `rule` para una incidencia;
    - `classify`: real, no aplica y exige criterio por la probabilidad; `high` que saldría no aplica da
      `highSeverity`, con la probabilidad;
    - `withoutModel`: con `code: null`, `noContext`; la comprobación sin incidencias, `noIssues`.
  - **`adapters/findings.test.ts`:**
    - la comprobación de `TRIAGE_SONAR_ISSUES_CHECK` se parte en una incidencia por anotación, y no es
      hallazgo;
    - sin incidencias legibles (sin anotaciones, o con el log), es un hallazgo `check` con `noIssues`;
    - el resultado trae `{ total, triaged }`;
    - otra comprobación no cambia.
  - **`adapters/decision-model.test.ts`:** el `state` de una incidencia (regla, nombre, fichero,
    línea, mensaje y código), la instrucción y los criterios de `rule`.
  - **`core/triage-summary.test.ts`:**
    - la fila de una incidencia, con la regla, el fichero y la línea;
    - «se aceptaría en SonarQube» en *no aplica*, y no en `highSeverity`;
    - «no anota ninguna incidencia legible»;
    - la línea de la lista cortada, solo cuando `triaged < total`.
  - **`core/graph.test.ts`:** dos incidencias dan dos peticiones al modelo falso, cada una sin la otra;
    una sin código no recibe ninguna y la otra sí.
- [ ] 2.5 La implementación: `findingSchema`, `hasContext`, `questionFor`, `classify`, `withoutModel` y
  `verdictSchema` en `core/triage.ts`; el resumen; `findings.ts` con `adapters/sonar-issues.ts`;
  `decision-model.ts`; `TRIAGE_SONAR_ISSUES_CHECK` en `config.ts` y `.env.example`; el montaje en
  `main.ts` y `studio.ts`.
  Verificar: los tests de 2.4 en verde, y todos los demás; `pnpm lint` y `pnpm typecheck` en verde.
- [ ] 2.6 Documentación:
  - README §2.2 (el módulo `sonar-issues` y la pregunta `rule`) y §2.4 (`TRIAGE_SONAR_ISSUES_CHECK`);
  - `docs/umbrales-para-specs.md`: la ventana de código (25 antes, 15 después), *(asumido)* hasta
    `MOO-76`;
  - `prompts.md`.

  Verificar: el README no contradice las specs.
- [ ] 2.7 Prueba a mano, con el babysitter en local y LangSmith, contra una PR de prueba contra `main`
  con dos incidencias: una mecánica (p. ej., un ternario anidado) y un `await` dentro de un bucle que
  debe ir en orden, con el porqué en el código.
  - El resumen del push trae dos filas, una por incidencia, cada una con su clase. Se espera la
    mecánica *real* y el `await` *no aplica* o *exige criterio*. Con *no aplica*, dice «se aceptaría
    en SonarQube».
  - En LangSmith, el hilo de la PR tiene dos ramas `preguntarModelo`, cada una con una incidencia y
    su código, y la pregunta `rule`. Se anota el camino de nodos y el *snapshot* que decide cada una.

  Cerrar la PR sin integrar. Verificar: lo visto queda anotado en la PR de la tarea, con la URL de la
  traza.

## Workflow follow-up

- Con las dos PR integradas: `/opsx:verify` y `/opsx:archive` en una rama `…-archivar-change`.
- Al archivar, las tres incidencias aceptadas de las notas de `MOO-148` quedan como filas para `MOO-76`.
