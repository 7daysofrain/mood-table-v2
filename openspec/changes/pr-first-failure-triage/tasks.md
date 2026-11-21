# Tasks

> **Organización:**
> - Dos tareas de Linear, cada una con su sección y su PR contra `main`, en este orden: la 2 usa el nodo
>   `decidir` y lo que guarda el primer triaje, que llegan con la 1.
> - La sección 1 se implementa en la rama de la historia, que ya lleva este change. La sección 2 va en
>   una rama propia que sale de `main` después de integrar la 1.
> - Cada paso es un commit con `Refs MOO-178` o `Refs MOO-179`, y cada PR lleva `Fixes` con su tarea.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de las pruebas a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
>   integrar y sin rama.

## 1. MOO-178 · infra

- [x] 1.1 La decisión: D122 en `docs/idea-mood-table.md` §10 (`design.md` decisión 1) y, en D119, una
  nota de que D122 la matiza.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [x] 1.2 **(test en rojo)** El triaje del primer fallo y la nota del resumen (`design.md` decisiones
  3, 4 y 8):
  - **`core/triage.test.ts`:**
    - en la ronda del primer fallo, una relanzable con caso evidente sale `evident` con su caso, sin
      pregunta; sin contexto, `noContext`; fuera del tope, `overBudget`; y si no, va al modelo con la
      pregunta `cause`;
    - que una relanzable que ya está en `push.firstTriage` no se vuelva a preguntar lo decide la
      selección de las comprobaciones de la ronda, en `tracking.ts`: se prueba en 1.5;
    - en la ronda final, las reglas de «ha fallado dos veces», «no ha terminado», «cancelada» y «no se
      ha podido relanzar» siguen como hoy.
  - **`core/triage-summary.test.ts`:**
    - la nota del primer triaje de cada fila de la tabla de la decisión 8, en la línea «se relanzó y
      pasó» y en el porqué de una fila *real* por regla y de una *exige criterio* porque no ha
      terminado;
    - sin nota en una relanzable que no se relanzó;
    - la cabecera «modo sombra: no arregla».
- [x] 1.3 La ronda en `triageRound` (`kind`), la rama del primer fallo en `withoutModel` y la respuesta
  `evident` en `core/triage.ts`; `firstTriage` en `TriagedPush` y la nota en `core/triage-summary.ts`.

  Verificar: los tests de 1.2 y todos los que ya había en verde; `pnpm typecheck` en verde.
- [x] 1.4 Leer solo las comprobaciones que fallan (`design.md` decisión 2):
  - **test en rojo primero,** en `adapters/findings.test.ts`: `readChecks` da el contexto de la PR y el
    de esas comprobaciones, y no pide los hilos del revisor;
  - el método en el puerto `Findings` (`core/ports.ts`) y en `adapters/findings.ts`;
  - los puertos falsos de `src/studio.ts`.

  Verificar: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.5 **(test en rojo)** El nodo `decidir` y el primer fallo en el grafo (`design.md` decisiones 1,
  4, 6 y 7):
  - **`core/decision.test.ts`:** `decide()` da `rerun` en la ronda del primer fallo, sea cual sea el
    veredicto (en esta tarea siempre relanza), y `publish` en la final.
  - **`core/tracking.test.ts`:** `afterChecksWait` da `firstFailure` con las condiciones que hoy dan
    `rerun`, y ya no da `rerun`.
  - **`core/graph.test.ts`,** un `describe` por requisito nuevo o cambiado, con el modelo falso
    contando las preguntas:
    - falla un `e2e` en su primer intento: el hilo pasa por `triar`, una sola pregunta `cause` sobre
      `e2e`, `reunirTriaje`, `decidir` y `relanzar`, sin aviso, sin resumen y sin pedir la revisión;
    - un hilo del revisor de un push anterior no se pregunta en esa ronda;
    - caso evidente, sin contexto, fuera del tope y modelo caído: se relanza igual, sin pregunta en
      los tres primeros;
    - el gasto de la pregunta cuenta en `spentUsd`;
    - el relanzamiento pasa: un solo resumen, que dice «se relanzó y pasó · … se capturaría»;
    - vuelve a fallar: *real* por regla con la nota, y ninguna pregunta nueva sobre `e2e`;
    - no termina a tiempo: *exige criterio* con la nota;
    - un fallo pasajero de `relanzar`: la vuelta siguiente lo vuelve a pedir sin preguntar otra vez;
    - un push nuevo: se vuelve a preguntar;
    - la decisión queda en el estado, con su acción y su regla;
    - los tests del relanzamiento de `pr-check-rerun` siguen pasando, ahora a través de `triar` y
      `decidir`.
- [ ] 1.6 `core/decision.ts`, el paso `firstFailure` en `core/tracking.ts`, y en `core/graph.ts`:
  - la ronda del primer fallo en `triar`;
  - `push.firstTriage` en `reunirTriaje`;
  - el nodo `decidir` y sus aristas, con `relanzar` alcanzado desde `decidir`;
  - `firstTriage` hasta `publicarResumen`.

  Las respuestas falsas de `src/studio.ts`.

  Verificar: los tests de 1.5 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [ ] 1.7 Documentación:
  - README §2.2 (*PR Babysitter*): el nodo `decidir`, el triaje del primer fallo y el diagrama del
    grafo;
  - `prompts.md`: la entrada de la historia (refinamiento, prueba de la pregunta, estimación,
    exploración con la decisión del usuario y change), con el formato de `course.md` §5.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [ ] 1.8 **Prueba a mano** (sin commit), con el sistema en marcha:
  - una PR de prueba con un test de Vitest que falla solo en el primer intento
    (`process.env.GITHUB_RUN_ATTEMPT === '1'`) y una descripción que no dice nada del test;
  - otra con un test que rompe la propia PR y falla siempre.

  Verificar:
  - las dos se relanzan una vez (en esta tarea siempre se relanza);
  - en la primera, el resumen dice que `test` se relanzó y pasó, con la nota del primer triaje;
  - en la segunda, `test` sale *real* por regla, con la nota del primer triaje (debería ser p ≥ 0,80);
  - en LangSmith, el hilo pasa por `triar` → `preguntarModelo` → `reunirTriaje` → `decidir` →
    `relanzar`, y en el triaje final no hay pregunta sobre `test`. Anotar el camino de nodos, la
    decisión y la foto que lo decidió.

  Los enlaces a los resúmenes y a las trazas, en la descripción de la PR de la tarea.

## 2. MOO-179 · infra

- [ ] 2.1 **(test en rojo)** No relanzar lo que causa la PR (`design.md` decisiones 5 y 9):
  - **`core/decision.test.ts`:** `skipRerun` si alguna relanzable sale *real* en el primer triaje,
    también con la otra *no aplica*; `rerun` en los demás casos de la decisión 6.
  - **`core/tracking.test.ts`:** con `rerunSkipped`, `afterChecksWait` no vuelve a dar `firstFailure` y
    sigue como con una rechazada (margen de las no ejecutadas, estado final); `finalState` no añade
    motivo nuevo.
  - **`core/triage.test.ts`:** en la ronda final, una relanzable en su primer intento que no se
    relanzó sale con el veredicto de `push.firstTriage`, sin pregunta.
  - **`core/graph.test.ts`:**
    - `test` causado por la PR: ninguna petición a `CheckReruns`, aviso «necesita intervención» con
      `test`, y el resumen lo da *real* con su probabilidad, con una sola pregunta en todo el push;
    - `test` causado y `e2e` no: ninguna petición, aviso con las dos, y el resumen da `test` *real* y
      la nota «se capturaría» de `e2e`;
    - con *SonarCloud Code Analysis* sin *check run*: el aviso llega tras el margen, no tras 30 min;
    - las vueltas siguientes no vuelven a triar el primer fallo.
- [ ] 2.2 La regla en `core/decision.ts`, `rerunSkipped` en el push y en `afterChecksWait`
  (`core/tracking.ts`), la arista de `skipRerun` a `esperarComprobaciones` (`core/graph.ts`) y el
  veredicto guardado en `afterRerun` (`core/triage.ts`).

  Verificar: los tests de 2.1 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [ ] 2.3 Documentación: README §2.2 (*PR Babysitter*: `decidir` ya no relanza lo que causa la PR) y
  `prompts.md`, si la sección 1 dejó algo por contar.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [ ] 2.4 **Prueba a mano** (sin commit), con el sistema en marcha:
  - las dos PR de prueba de 1.8, otra vez;
  - una tercera con un test que rompe la PR y un `e2e` que falla solo en el primer intento.

  Verificar:
  - la intermitente: se relanza, pasa y tiene la nota «se capturaría» si el modelo lo dio por de `main`;
  - la que rompe la PR: no se relanza (un solo intento en Actions), y el aviso «necesita intervención»
    llega sin esperar al relanzamiento; el resumen la da *real* con su probabilidad;
  - la tercera: no se relanza ninguna; el resumen da `test` *real* y dice si `e2e` se capturaría;
  - en LangSmith, `decidir` da `skipRerun` con su regla y el hilo vuelve a `esperarComprobaciones` y
    después a `triar` en la ronda final, sin pregunta nueva. Anotar el camino de nodos, la decisión y
    la foto que lo decidió.

  Los enlaces a los resúmenes y a las trazas, en la descripción de la PR de la tarea.

## Workflow follow-up

- Tras integrar la PR de `MOO-179`, `openspec archive pr-first-failure-triage` en una rama
  `…-archivar-change` desde `main` (`workflow.md` §4.5).
- Si otro change integra antes una D# con el mismo número, renumerar D122.
