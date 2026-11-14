# Tasks

> **Organización:**
> - Tres tareas de Linear, cada una con su sección y su PR contra `main`, en este orden. Las secciones
>   1 y 2 no dependen entre sí, pero tocan los mismos ficheros (`decision-model.ts`, `graph.ts`,
>   `studio.ts`). La 3 necesita las dos.
> - La sección 1 se implementa en la rama de la historia, que ya lleva el glosario de PB y este
>   change. Las secciones 2 y 3 van en una rama propia que sale de `main` después de integrar la
>   anterior.
> - Cada paso es un commit con `Refs MOO-161`, `Refs MOO-162` o `Refs MOO-163`, y cada PR lleva
>   `Fixes` con su tarea.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de las pruebas a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
>   integrar y sin rama.
>
> **Antes del paso 1.1:** el mantenedor añade *Checks* y *Actions* en lectura al PAT del sistema
> (`design.md`, *Migration Plan*).

## 1. MOO-161 · infra

- [x] 1.1 **(test en rojo)** Las lecturas y las estrategias del contexto (`design.md` decisiones 1 y
  2).
  - **Fixtures** grabadas con `gh api` en `test/fixtures/github/`:
    - el *check run* y las anotaciones del `e2e` que falla en la #116 (con anotaciones útiles);
    - el *check run*, las anotaciones y el log del *job* del `e2e` de la #112. Su `##[error]` es la
      primera línea del bloque de error de Playwright (`MOO-154`).
    - el *check run* de `SonarCloud Code Analysis` en la #117 (otra app).

    Si algún log ya ha caducado, se toma una PR más reciente con el mismo caso.
  - **`adapters/github.test.ts`:**
    - `checkRun(sha, nombre)` da el id, la app, la conclusión y la salida;
    - `annotations(id)` y `jobLog(id)`;
    - un 404 o un 410 dan `null`, y un 5xx lanza.
  - **`adapters/check-context.test.ts`,** una prueba por fila de la tabla de la decisión 2:
    - anotaciones útiles, sin el `failure` de `.github` ni el `notice` sin título;
    - sin anotaciones útiles, el paso que falla entero, incluido lo que sigue al primer `##[error]`
      (la #112), y sin error marcado, el final del log;
    - otra app, el título y el resumen;
    - `notProvided` con el resumen vacío o el log vacío; `unreadable` con un 4xx;
    - el corte a 16 KiB con `truncated` (el log por el principio, las anotaciones enteras y en orden);
    - la conclusión.
- [x] 1.2 El esquema `CheckContext` en `core/triage.ts`, el módulo `adapters/check-context.ts` y las
  tres lecturas nuevas de `adapters/github.ts`. Todavía no los usa nadie.
  Verificar: los tests de 1.1 en verde, y los que ya había; `pnpm typecheck` en verde.
- [x] 1.3 **(test en rojo)** El hallazgo de una comprobación con su contexto:
  - **`adapters/findings.test.ts`:** cada comprobación que falla trae la conclusión y el contexto de
    `check-context`. Sustituye la prueba que fijaba el corte en el primer `##[error]`.
  - **`adapters/decision-model.test.ts`:** el modelo lee `{ source: 'check', name, conclusion,
    context }` en lugar de `log_tail`.
  - **`core/triage-summary.test.ts`:** el porqué de una comprobación termina con el origen del
    contexto (`anotaciones`, `log`, `resumen de la app`) y `, cortado` si se cortó. Sin contexto, «la
    comprobación no da contexto» o «no se ha podido leer su contexto».
  - **`core/graph.test.ts`,** en el `describe` del requisito *un hallazgo sin contexto*: con
    `notProvided` y con `unreadable`, la comprobación sale *exige criterio*, el modelo falso no
    recibe nada sobre ella y el resto se tría.
- [x] 1.4 El hallazgo de una comprobación pasa de `log` a `conclusion` y `context`:
  - `findingSchema` y `hasContext` en el núcleo;
  - `findings.ts` usa `check-context`, y se borran `failingStep()` y `tail()`;
  - la forma que lee el modelo en `decision-model.ts`;
  - el porqué en `triage-summary.ts`;
  - los hallazgos falsos de `studio.ts`, uno por origen.

  Verificar: los tests de 1.3 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [x] 1.5 Documentación:
  - README §2.2 (*PR Babysitter*): el módulo del contexto y sus estrategias por `app.slug`;
  - README §2.5 (*En el PR Babysitter*): *Checks* y *Actions* en lectura, y que al modelo llega el
    contexto estructurado;
  - `.env.example`: los permisos del PAT;
  - `docs/umbrales-para-specs.md`: el corte de 16 KiB pasa a valer para cualquier origen, con
    `truncated`, *(asumido)* hasta `MOO-76`;
  - `docs/idea-mood-table.md` §10, D114: una nota de que el puerto empieza como módulo del adaptador
    (decisión 1);
  - `prompts.md`: la entrada de la historia (refinamiento, estimación, exploración y change), con el
    formato de `course.md` §5.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [ ] 1.6 **Prueba a mano** (sin commit), con el sistema en marcha:
  - una PR de prueba con un test de Vitest roto (`test`: anotaciones o log);
  - otra con un `e2e` roto (anotaciones de Playwright).

  Verificar en cada una:
  - el resumen da la comprobación con el origen de su contexto;
  - en LangSmith, el hilo pasa por `triar`, y el hallazgo de su salida trae el contexto entero,
    incluido el `Expected/Received`. Anotar el camino de nodos y la foto que lo decidió.

  Los enlaces a los resúmenes y a las trazas, en la descripción de la PR de la tarea.

## 2. MOO-162 · infra

- [ ] 2.1 **(test en rojo)** El modelo de decisión, un hallazgo por llamada (`design.md` decisión 3),
  en `adapters/decision-model.test.ts`:
  - `ask` manda una petición con la PR y un solo hallazgo, y una sola pregunta, la de hoy. Da su
    probabilidad y `usage`.
  - `estimate` estima esa petición.
  - Un error del proveedor lanza `DecisionModelError` con los tokens cobrados.
  - Ya no hay peticiones partidas.

  La respuesta grabada sale de `test/fixtures/decision-model/systemone-88.json`, recortada a un
  hallazgo, o de una petición nueva si cambia `usage`.
- [ ] 2.2 El puerto `Triager` pasa a `DecisionModel` (`ask`, `estimate` y `DecisionModelError`) en
  `core/ports.ts`. El adaptador lo implementa sin `batches()`, `MAX_QUESTIONS` ni
  `MAX_REQUEST_TOKENS`.
  - `triar` pregunta de momento uno a uno, en un bucle, para que todo siga compilando. El paso 2.4 lo
    sustituye.
  - `withinBudget` suma la estimación de cada hallazgo (decisión 5).

  Verificar: los tests de 2.1 y todos los que ya había en verde; `pnpm typecheck` en verde.
- [ ] 2.3 **(test en rojo)** El *fan-out* (`design.md` decisiones 4 y 5):
  - **`core/triage.test.ts`:** el reductor de las respuestas se queda solo con la ronda más alta.
  - **`core/graph.test.ts`,** un `describe` por requisito de `specs/pr-triage` que toca esta sección,
    con un `DecisionModel` falso que apunta cada llamada:
    - con un comentario del revisor y dos comprobaciones, tres llamadas de un hallazgo cada una;
    - si falla la de uno, ese hallazgo sale *exige criterio* con `modelUnavailable`, los otros dos
      con su clase, y el gasto incluye los tokens de la que falló;
    - con el gasto cerca del tope, solo los que caben llegan al modelo;
    - sin nada que preguntar, el triaje termina y publica el resumen igual;
    - dos pushes seguidos en el mismo hilo: el segundo resumen no lleva respuestas del primero.
  - **`core/driver.test.ts`:** cada `invoke` lleva `maxConcurrency: 4`.
- [ ] 2.4 El *fan-out* en `core/graph.ts`:
  - `triar` reparte con `Send`, deja la ronda en el estado y va directo a `reunirTriaje` sin nada que
    preguntar;
  - `preguntarModelo` pregunta por un hallazgo y no lanza nunca;
  - `reunirTriaje` clasifica y escribe `triage`;
  - las respuestas, en un `ReducedValue`;
  - `maxConcurrency` en el driver;
  - el modelo falso de `studio.ts` tarda un poco y da probabilidades distintas por fuente.

  Verificar:
  - los tests de 2.3 y todos los que ya había en verde;
  - `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde;
  - en LangGraph Studio, un hilo con tres hallazgos abre tres ramas `preguntarModelo` a la vez.
- [ ] 2.5 Documentación:
  - README §2.2 (*PR Babysitter*): los nodos `triar`, `preguntarModelo` y `reunirTriaje`, con el
    diagrama del *fan-out*, y el puerto `DecisionModel`;
  - `docs/idea-mood-table.md` §10: D115 (el *fan-out*, la ronda, la concurrencia y lo descartado, con
    el porqué del usuario), y la nota de que matiza D91;
  - `docs/umbrales-para-specs.md`: `maxConcurrency: 4` *(asumido)*;
  - `prompts.md`: lo que añada esta tarea a la entrada de la historia.

  Verificar: `pnpm lint` en verde.
- [ ] 2.6 **Prueba a mano** (sin commit), con el sistema en marcha: una PR de prueba con un hallazgo
  de Codex y dos comprobaciones que fallan.
  Verificar:
  - el resumen trae los tres hallazgos;
  - en LangSmith, el hilo pasa por `triar`, tres `preguntarModelo` en paralelo, cada una con un solo
    hallazgo en su petición, y `reunirTriaje`. Anotar el camino de nodos y la foto que lo decidió.

  Los enlaces, en la descripción de la PR de la tarea.

## 3. MOO-163 · infra

- [ ] 3.1 **(test en rojo)** Las reglas (`design.md` decisiones 3 y 6):
  - **`core/triage.test.ts`:**
    - una comprobación de la lista sale `{ class: 'valid', reason: 'rule' }`, aunque no tenga
      contexto o el tope esté agotado;
    - `questionFor` da `cause` para una comprobación y `fixInThisPr` para un comentario del revisor.
  - **`core/triage-summary.test.ts`:** «regla: comprobación determinista».
  - **`adapters/config.test.ts`:** `TRIAGE_RULE_CHECKS`, con el valor por defecto, una lista con
    espacios y una lista vacía.
- [ ] 3.2 La regla y `questionFor` en `core/triage.ts`, el porqué en `core/triage-summary.ts`, y
  `TRIAGE_RULE_CHECKS` en `adapters/config.ts` y `.env.example`.
  Verificar: los tests de 3.1 en verde; `pnpm typecheck` en verde.
- [ ] 3.3 **(test en rojo)** La pregunta de la causa en `adapters/decision-model.test.ts`:
  - con `cause`, las instrucciones nombran la comprobación con la pregunta del *spike* y sus criterios,
    sin *"judge the finding against the diff"*;
  - con `fixInThisPr`, la pregunta y los criterios de hoy, sin cambios.
- [ ] 3.4 Las dos preguntas en `adapters/decision-model.ts`: `ask` y `estimate` reciben la pregunta.
  Verificar: los tests de 3.3 en verde.
- [ ] 3.5 **(test en rojo)** El grafo, en `core/graph.test.ts`, un `describe` por requisito de
  `specs/pr-triage` que toca esta sección:
  - `lint` sale *real* por regla sin ninguna llamada al modelo falso, también sin contexto y con el
    tope agotado;
  - `e2e` llega a `preguntarModelo` con `cause`, y un comentario del revisor, con `fixInThisPr`;
  - una comprobación que no está en la lista, también con `cause`.
- [ ] 3.6 La regla y la pregunta en `triar` y en el `Send` de `core/graph.ts`, la lista desde
  `src/main.ts` en `TrackingOptions.triage`, y la lista por defecto en `studio.ts`.
  Verificar: los tests de 3.5 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [ ] 3.7 Documentación:
  - README §2.4 (*PR Babysitter*): `TRIAGE_RULE_CHECKS`;
  - README §2.5: las dos preguntas que salen hacia el modelo;
  - `prompts.md`: lo que añada esta tarea a la entrada de la historia.

  Verificar: `pnpm lint` en verde.
- [ ] 3.8 **Prueba a mano** (sin commit), con el sistema en marcha:
  - una PR de prueba con un `lint` roto;
  - otra con un `e2e` roto.

  Verificar:
  - el resumen da el `lint` como *real* por regla, y el `e2e` con su probabilidad y el origen de su
    contexto;
  - en LangSmith, el `lint` no abre ninguna rama `preguntarModelo`, y la del `e2e` lleva la pregunta
    `cause` en su entrada. Anotar el camino de nodos y la foto que lo decidió.

  Los enlaces, en la descripción de la PR de la tarea.

## Workflow follow-up

- Tras integrar la PR de `MOO-163`, `openspec archive pr-check-triage` en una rama
  `…-archivar-change` desde `main` (`workflow.md` §4.5).
- `MOO-76` valida la pregunta de la causa con filas nuevas, y `MOO-155` resuelve BQ8.
