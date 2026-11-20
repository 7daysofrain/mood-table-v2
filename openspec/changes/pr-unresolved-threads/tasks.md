# Tasks

> **Organización:**
> - Una tarea de Linear, `MOO-175`, con su sección y su PR contra `main`, en la rama de la historia
>   (que ya lleva este change).
> - Cada paso es un commit con `Refs MOO-175`, y la PR lleva `Fixes MOO-175`.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar la sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de la prueba a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin integrar y
>   sin rama.

## 1. MOO-175 · infra

- [x] 1.1 Alinear PB con lo decidido (`design.md` decisión 6): `docs/pr-babysitter.md` §8 (*Estado
  final*, entrada nueva; *Hallazgo*; *Lista para integrar*; *Necesita intervención*). Y D120 en
  `docs/idea-mood-table.md` §10, que matiza D114 y D116 (`design.md` decisiones 2 a 4).
  Verificar: el glosario define *Estado final* como el de un push; *Hallazgo* y *Lista para integrar*
  hablan de los hilos del revisor sin resolver de cualquier push; D120 enlaza este change.
- [x] 1.2 **(test en rojo)** El estado final con los hilos (`design.md` decisión 2), en
  `core/tracking.test.ts` y `core/notice.test.ts`:
  - `finalState` con `reviewerThreads`: sin hilos y revisión terminada → *lista para integrar*,
    aunque antes el bloque dijera hallazgos (la #62); hilos solo de un push anterior → `reviewFindings`
    con `earlier` (la #122); del último → `last`; de los dos → `both`; una comprobación que falla con
    un hilo de un push anterior → `checksFailed` y `reviewFindings` con `earlier`, sin
    `reviewUnfinished`;
  - el motivo de cada `pushes`, con los textos de la tabla de la decisión 2.
- [x] 1.3 El núcleo: `reviewerThreads` en la foto, `Review` sin `hasFindings`, el método nuevo de
  `ReviewReader`, `finalState`, el motivo y su texto; el driver lee los hilos para la foto.
  Verificar: los tests de 1.2 en verde y los que ya había, ajustados a la foto nueva; `pnpm typecheck`
  en verde (los adaptadores se ajustan lo justo para compilar).
- [x] 1.4 **(test en rojo)** La lectura de los hilos (`design.md` decisiones 1 y 2), con una fixture
  GraphQL grabada de la #166 (`test/fixtures/github/review-threads-166.json`, con sus dos hilos de
  `576b496`):
  - en `adapters/github.test.ts`: `listReviewThreads` da cada hilo con `isResolved` y su primer
    comentario (autor, cuerpo, fichero, `originalLine`, `line`, el SHA de `originalCommit`,
    `diffHunk`), pagina, un 401 da `GitHubUnauthorizedError`;
  - en `adapters/codex-review.test.ts`: cuenta los hilos sin resolver del revisor del último push y
    de los anteriores, sin los resueltos ni los de otra cuenta; del bloque solo lee el commit y si ha
    terminado.
- [x] 1.5 Los adaptadores: `listReviewThreads` por GraphQL en `adapters/github.ts`, sin
  `listReviewComments`; el conteo en `adapters/codex-review.ts`, sin `hasFindings`; el montaje en
  `main.ts`.
  Verificar: los tests de 1.4 en verde y los que ya había.
- [x] 1.6 **(test en rojo)** Los hallazgos del revisor (`design.md` decisiones 1 y 3), en
  `adapters/findings.test.ts`:
  - son los hilos sin resolver cuyo primer comentario es del revisor, de cualquier push; un hilo
    resuelto o de otra cuenta no es un hallazgo;
  - un comentario del último push va como hoy, sin código del último push;
  - uno de un push anterior lleva su push y el código del último push alrededor de `line` (25 antes,
    15 después) o, si `line` es `null`, de `originalLine`; si el fichero no existe en el último push,
    sin código.
- [x] 1.7 El adaptador de los hallazgos y el esquema del hallazgo del revisor en `core/triage.ts` (su
  push y el código del último push).
  Verificar: los tests de 1.6 en verde y los que ya había.
- [x] 1.8 **(test en rojo)** Las reglas del núcleo (`design.md` decisiones 3 y 4), en
  `core/triage.test.ts`:
  - `withoutModel`: un comentario de un push anterior sin código del último push sale
    `noCurrentCode`, sin reservar tope, después de `noScope` y `noContext`;
  - `classify` con la respuesta de tres probabilidades: ya arreglado ≥ 0,80 → *no aplica*
    (`alreadyFixed`); con un P1 → *exige criterio* por severidad alta; por debajo → el alcance, como
    hoy, con un caso por fila de su tabla; el 0,80 cuenta como arreglado. El veredicto guarda las tres
    probabilidades;
  - un comentario del último push sigue con las dos preguntas del alcance.
- [x] 1.9 El núcleo del triaje: la pregunta, la respuesta y el veredicto con `fixed`, `classify`,
  `withoutModel` y el puerto `DecisionModel.ask`.
  Verificar: los tests de 1.8 en verde y los que ya había.
- [x] 1.10 **(test en rojo)** El adaptador del modelo de decisión (`design.md` decisión 3), en
  `adapters/decision-model.test.ts`, con una fixture de `systemone` de una respuesta con tres
  preguntas (`test/fixtures/decision-model/`):
  - un comentario de un push anterior va en una petición con las tres preguntas, con el texto exacto
    de la nueva y sus criterios, y con el código del último push;
  - la respuesta da `fixed`, `inside` y `outside`, y los tokens cobrados;
  - `estimate` cuenta las tres preguntas y el código;
  - las tres claves de un título largo no pasan de 100 caracteres;
  - un comentario del último push sigue con dos preguntas.
- [ ] 1.11 El adaptador: la pregunta «ya arreglado» en `CRITERIA` e `instructions`, la petición con
  tres preguntas y su respuesta.
  Verificar: los tests de 1.10 en verde y los que ya había.
- [ ] 1.12 **(test en rojo)** El resumen (`design.md` decisión 5), en `core/triage-summary.test.ts`:
  la identidad con `· de un push anterior (…)` solo en los de un push anterior, y una prueba por fila
  de su tabla (ya arreglado, ya arreglado con P1, ninguna llega con tres probabilidades, sin código).
  Las demás filas no cambian.
- [ ] 1.13 Los textos en `core/triage-summary.ts`.
  Verificar: los tests de 1.12 en verde y los que ya había.
- [ ] 1.14 **(test en rojo)** Los escenarios de la spec de punta a punta en el grafo y el driver
  (`core/graph.test.ts`, `core/driver.test.ts`), con GitHub y el modelo de decisión falsos:
  - la #166: último push revisado sin hallazgos y dos hilos sin resolver de un push anterior → el
    aviso «necesita intervención» con hallazgos de un push anterior, y el resumen con los dos, cada
    uno con su push y una petición de tres preguntas;
  - el mismo hilo sigue sin resolver en un push nuevo → vuelve a salir en el resumen de ese push;
  - con el hilo resuelto → *lista para integrar* y sin resumen;
  - una comprobación que falla y un hilo resuelto → el resumen no lo trae.
- [ ] 1.15 Lo que falte para que 1.14 pase, si falta algo, y `studio.ts` con un hallazgo de un push
  anterior.
  Verificar: `pnpm test` en verde; `pnpm studio` arranca y el hilo de ejemplo llega al resumen.
- [ ] 1.16 Documentación: README §2.2 (el adaptador de GitHub con los hilos por GraphQL, el del
  revisor sin `has_any_findings`, el de los hallazgos, la foto, la pregunta «ya arreglado» y sus
  reglas) y §2.5 (qué sale hacia el proveedor: el código del último push de un comentario anterior).
  `prompts.md`.
  Verificar: el README ya no dice que el estado final use `has_any_findings` ni que los hallazgos del
  revisor sean solo los del último push.
- [ ] 1.17 **Prueba a mano** (sin commit), con el sistema en marcha desde la rama, y una PR de prueba
  lista para revisar con dos commits:
  - el primero con dos defectos, y `@codex review` a mano para que Codex comente los dos;
  - el segundo arregla uno de los dos y no toca el otro.

  Verificar:
  - el aviso del segundo push es «necesita intervención» con hallazgos de un push anterior;
  - el resumen trae los dos comentarios con su push: el arreglado sale *no aplica* por «ya
    arreglado» (o lo que dé el modelo, anotado tal cual), y el otro, por el alcance;
  - al resolver los dos hilos y hacer un tercer push sin defectos, el aviso es «lista para
    integrar» y no hay resumen;
  - en LangSmith, la foto que decide el estado final de cada push ya trae los hilos del revisor
    (`design.md`, *Risks*), y la rama `preguntarModelo` de cada comentario lleva tres preguntas en
    una petición. Anotar el camino de nodos y la foto que lo decidió.

  Si Codex no comenta lo esperado, se anota tal cual: la clasificación la cubren los tests, y esta
  prueba comprueba la lectura real de los hilos, la petición y el aviso. Los enlaces, en la
  descripción de la PR de la tarea.

## Workflow follow-up

- Al integrar la PR de `MOO-175`: `/opsx:verify` y `/opsx:archive` en una rama
  `…-archivar-change` que sale de `main` (`workflow.md` §4.5).
- Reconstruir el contenedor del PR Babysitter desde `main` (README §2.4).
