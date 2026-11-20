# Tasks

> **Organización:**
> - Dos tareas de Linear, cada una con su sección y su PR contra `main`, en este orden: la 2 necesita
>   el intento de cada comprobación y el estado del relanzamiento de la 1.
> - La sección 1 se implementa en la rama de la historia, que ya lleva este change. La sección 2 va en
>   una rama propia que sale de `main` después de integrar la 1.
> - Cada paso es un commit con `Refs MOO-170` o `Refs MOO-171`, y cada PR lleva `Fixes` con su tarea.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de las pruebas a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
>   integrar y sin rama.
>
> **Antes de la prueba a mano de la sección 1:** el mantenedor añade *Actions: write* al PAT del
> sistema (`design.md`, *Migration Plan*).

## 1. MOO-170 · infra

- [x] 1.1 Documentos de PB y la decisión:
  - `docs/pr-babysitter.md` §8: *Relanzar* (`rerun`: volver a ejecutar una comprobación que falla
    sobre el mismo commit, sin cambios) y *Caso evidente* (`evidentCase`: un error que dice por sí solo
    que el fallo es transitorio: un *timeout*, la infraestructura, la red o un *runner* perdido); *Modo
    sombra* pasa a «decide y registra, pero no arregla»;
  - §4.1: el relanzamiento no cuenta en «la misma comprobación falla dos veces seguidas», que se
    refiere a fallar tras un arreglo;
  - §7: BQ8 resuelta, con un puntero a la D# nueva;
  - `docs/idea-mood-table.md` §10: D119 (`design.md` decisión 1), y una nota en D114 de que la matiza.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [x] 1.2 **(test en rojo)** El intento y la conclusión de cada comprobación (`design.md` decisión 3):
  - **Fixtures** grabadas con `gh api` en `test/fixtures/github/`: las *check runs* de un commit con un
    *job* relanzado (dos *check runs* del mismo nombre) y el *job* de cada intento (`run_id`,
    `run_attempt`). Si no hay ninguno reciente, se graban en la prueba a mano de 1.7 y este paso se
    completa entonces.
  - **`adapters/github.test.ts`:**
    - `checks()` da, de cada comprobación, su conclusión y, en una de Actions que falla, su intento y su
      run;
    - con dos *check runs* del mismo nombre, la del intento más reciente;
    - un *job* que no se puede leer deja el intento sin dato y no rompe la lectura.
- [x] 1.3 El `Check` del *snapshot* con `conclusion`, `attempt` y `runId` (`core/pull-request.ts`), y
  su lectura en `adapters/github.ts`.
  Verificar: los tests de 1.2 en verde, y los que ya había; `pnpm typecheck` en verde.
- [x] 1.4 **(test en rojo)** Cuándo se relanza y el reloj (`design.md` decisiones 3 y 4):
  - **`core/tracking.test.ts`:**
    - un relanzable fallido (`failure` o `timed_out`) en el intento 1 da el destino `rerun`;
    - no lo da si está cancelado, si su intento es 2 o más, si el push ya tiene `rerunSince`, si solo
      falla una no relanzable o si la lista de relanzables está vacía;
    - con `rerunSince`, el tiempo de espera de las comprobaciones cuenta desde él;
    - un push nuevo borra `rerunSince`.
  - **`core/graph.test.ts`,** un `describe` por requisito nuevo o cambiado de `pr-tracking`, con un
    `CheckReruns` falso que registra las peticiones:
    - falla un `e2e`: se pide un relanzamiento del run, sin aviso y sin pedir la revisión;
    - el relanzamiento pasa: se pide la revisión y se llega a *lista para integrar*;
    - vuelve a fallar: aviso «necesita intervención», sin segunda petición;
    - un push nuevo durante el relanzamiento: los avisos son del push nuevo;
    - un 4xx: aviso «necesita intervención» con el motivo de que no se ha podido relanzar;
    - un error que no es 4xx: el nodo falla y la siguiente vuelta lo vuelve a pedir, sin aviso;
    - relanzado a mano (intento 2) y fallido, cancelado, o solo `lint`: no se relanza;
    - `lint` y `e2e` fallan juntos: una sola petición para el run;
    - el relanzamiento no termina en 30 min desde la petición, y uno que termina a los 15 min tras
      comprobaciones de 20 min;
    - lo único escrito en GitHub son peticiones de revisión, resúmenes y relanzamientos (amplía el
      test de solo escrituras).
- [x] 1.5 El destino `rerun` en `core/tracking.ts`, el puerto `CheckReruns` en `core/ports.ts`, el
  nodo `relanzar` y su arista en `core/graph.ts`, y `rerunSince` y el rechazo en el estado.
  Verificar: los tests de 1.4 y todos los que ya había en verde; `pnpm typecheck` en verde.
- [x] 1.6 El adaptador y el montaje:
  - **`adapters/github.ts`:** `rerun(runId)` con `rerun-failed-jobs`; un 4xx da
    `GitHubRequestRejectedError`. Test en `adapters/github.test.ts` con `fakeFetch`: la URL y el método,
    201, 403 y 5xx.
  - **`adapters/config.ts`:** `RERUN_CHECKS`, por defecto `test,e2e`, y sin ningún nombre (una
    coma) desactiva el relanzamiento. Test en `adapters/config.test.ts`.
  - `.env.example`, `src/main.ts` y los puertos falsos de `src/studio.ts`.
  - **README:** §2.2 (*PR Babysitter*: el nodo `relanzar` y el puerto `CheckReruns`), §2.4
    (`RERUN_CHECKS`) y §2.5 (*Actions: write*, qué deja hacer y que el código solo relanza).
  - `prompts.md`: la entrada de la historia (refinamiento, estimación, exploración y change), con el
    formato de `course.md` §5.

  Verificar: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde; los enlaces llevan a su sitio.
- [x] 1.6a **(hallado en 1.7)** Relanzar en cuanto termina el run de la que falla, sin esperar a las
  demás exigidas (`design.md` decisión 3): con `test` roja, *SonarCloud Code Analysis* no llega nunca.
  - **Tests en rojo primero:** `adapters/github.test.ts` (el run terminado, en marcha y que no se puede
    leer, con la fixture `run-116.json`), `core/tracking.test.ts` y `core/graph.test.ts` (relanza con
    SonarCloud pendiente; con el run en marcha, espera).
  - El `Check` lleva `runFinished`; el adaptador lo lee de `GET …/actions/runs/{id}`.
  - El requisito y su escenario en `specs/pr-tracking/spec.md`.

  Verificar: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.6b **(hallado en la revisión de la PR)** Tras un fallo pasajero de `relanzar`, decidir con la
  foto siguiente y no con la que tenía (`design.md` decisión 5): GitHub pudo aceptar la petición
  aunque se perdiera la respuesta.
  - **Test en rojo primero,** en `core/driver.test.ts`: la foto siguiente trae el intento 2 y no se
    vuelve a pedir; con el intento 1, se pide con la foto nueva.
  - `retryPending` en `core/driver.ts` se salta `relanzar` también en el mismo push.
  - El requisito y su escenario en `specs/pr-tracking/spec.md`.
  - Sin un relanzamiento aceptado, no se vuelve a pedir pasados los 30 min del push
    (`core/tracking.ts`, con su test en rojo primero en `core/tracking.test.ts`).

  Verificar: `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.7 **Prueba a mano** (sin commit), con el sistema en marcha y el PAT con *Actions: write*:
  - una PR de prueba con un test de Vitest que falla solo en el primer intento
    (`process.env.GITHUB_RUN_ATTEMPT === '1'`);
  - otra con un test que falla siempre.

  Verificar:
  - en la primera, el sistema relanza `test` una vez, pasa, pide la revisión y la PR llega a *lista
    para integrar* sin aviso de fallo;
  - en la segunda, relanza una vez y avisa «necesita intervención» con `test`; el resumen sigue con la
    pregunta de la causa (la regla llega en la sección 2);
  - en Actions, el run de cada una tiene dos intentos y solo uno pedido por el sistema;
  - en LangSmith, el hilo pasa por `relanzar` y vuelve a `esperarComprobaciones`. Anotar el camino de
    nodos y la foto que lo decidió.

  Si faltaban las fixtures de 1.2, se graban aquí. Los enlaces a los runs y a las trazas, en la
  descripción de la PR de la tarea.

## 2. MOO-171 · infra

- [x] 2.1 **(test en rojo)** Las reglas del triaje tras el relanzamiento (`design.md` decisiones 1, 6
  y 7):
  - **`core/triage.test.ts`:**
    - un relanzable fallido con intento 2 o más sale *real* por la regla nueva, que registra que ha
      fallado dos veces; antes que la de sin contexto y que el tope;
    - el caso evidente, una prueba por fila de la tabla de la decisión 6, con los mensajes reales de
      las fixtures, y una aserción sin caso evidente;
    - *exige criterio* con el motivo: relanzamiento rechazado, no terminado o cancelado;
    - `questionFor` ya no pregunta por la causa a un relanzable.
  - **`core/triage-summary.test.ts`:** el porqué «ha fallado dos veces» con el caso evidente o sin él;
    los tres motivos de *exige criterio*; las líneas «se relanzó y pasó», con hallazgos y sin ellos.
- [x] 2.2 El hallazgo de una comprobación con su intento y el resultado del relanzamiento, y las reglas
  en `core/triage.ts`: la regla nueva, la función del caso evidente y los tres motivos; el porqué en
  `core/triage-summary.ts`.
  Verificar: los tests de 2.1 y todos los que ya había en verde; `pnpm typecheck` en verde.
- [x] 2.3 **(test en rojo)** El triaje y el resumen en el grafo (`design.md` decisión 8), en
  `core/graph.test.ts`, un `describe` por requisito nuevo o cambiado de `pr-triage`:
  - vuelve a fallar: el resumen da *real* por regla, sin ninguna pregunta al modelo falso;
  - rechazado, no terminado o cancelado: *exige criterio* con su motivo, sin pregunta al modelo;
  - relanzado y pasado en una PR lista para integrar: un resumen sin hallazgos que lo dice, y después
    el aviso «lista para integrar» de siempre;
  - relanzado y pasado junto a un `lint` que falla: el resumen lleva las dos cosas;
  - una PR que pasa a la primera no tiene resumen;
  - un solo resumen por push, también en el camino de *lista para integrar*.
- [ ] 2.4 `needsTriage` con el relanzamiento que no termina, el resultado del relanzamiento hasta el
  triaje, y `publicarResumen` en el camino de *lista para integrar* (`core/graph.ts`,
  `core/tracking.ts`); las respuestas falsas de `src/studio.ts`.
  Verificar: los tests de 2.3 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [ ] 2.5 Documentación:
  - README §2.2 (*PR Babysitter*: la regla tras el relanzamiento y el resumen en una PR lista para
    integrar) y §2.5 (`test` y `e2e` ya no envían su contexto al modelo de decisión);
  - `prompts.md`, si la sección 1 dejó algo por contar.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [ ] 2.6 **Prueba a mano** (sin commit), con el sistema en marcha:
  - las dos PR de prueba de 1.7, otra vez;
  - una tercera con un `e2e` que falla solo en el primer intento y un `lint` roto.

  Verificar:
  - la que falla siempre: el resumen da `test` *real*, «ha fallado dos veces»;
  - la que falla una vez: la PR llega a *lista para integrar* y tiene un resumen que dice que `test`
    se relanzó y pasó;
  - la tercera: el resumen da `lint` *real* y dice que `e2e` se relanzó y pasó;
  - en LangSmith, ninguna rama `preguntarModelo` para `test` ni `e2e`, y el camino de *lista para
    integrar* pasa por `publicarResumen`. Anotar el camino de nodos y la foto que lo decidió.

  Los enlaces a los resúmenes y a las trazas, en la descripción de la PR de la tarea.

## Workflow follow-up

- Tras integrar la PR de `MOO-171`, `openspec archive pr-check-rerun` en una rama
  `…-archivar-change` desde `main` (`workflow.md` §4.5).
- Si `pr-sonar-issue-triage` (`MOO-148`) se integra antes con otro número para sus D#, renumerar
  D119.
- `MOO-169` recoge las repeticiones y el test intermitente que añade la PR.
