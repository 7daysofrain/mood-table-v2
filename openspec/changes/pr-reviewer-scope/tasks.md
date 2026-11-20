# Tasks

> **Organización:**
> - Una tarea de Linear, `MOO-165`, con su sección y su PR contra `main`, en la rama de la historia
>   (que ya lleva este change).
> - Cada paso es un commit con `Refs MOO-165`, y la PR lleva `Fixes MOO-165`.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar la sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de la prueba a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin integrar y
>   sin rama.

## 1. MOO-165 · infra

- [x] 1.1 Alinear PB con lo decidido (`design.md` decisión 6): `docs/pr-babysitter.md` §4.1 (un
  arreglo claramente fuera del alcance de la PR no se escala: es *no aplica* y se capturaría) y §8
  (*No aplica*). Y D116 en `docs/idea-mood-table.md` §10, que matiza D114 (`design.md` decisiones 1 a
  3, con la medición).
  Verificar: el glosario y §4.1 ya no dicen que salirse del alcance escala siempre; D116 enlaza este
  change.
- [ ] 1.2 **(test en rojo)** Las reglas del núcleo (`design.md` decisiones 1, 2 y 4), en
  `core/triage.test.ts`:
  - `questionFor`: `scope` para un comentario del revisor, `cause` para una comprobación;
  - `classify` con una respuesta `scope`, una prueba por fila de la tabla de la decisión 1: P1 llega →
    *real*; P2 llega → *no aplica*; ninguna → *exige criterio*; las dos → *exige criterio*
    (contradicción); un P1 con P2 → *exige criterio* por severidad alta; un P1 con P1 → *real*; los
    extremos de 0,80 cuentan dentro de su caso. El veredicto guarda las dos probabilidades;
  - `withoutModel` con la descripción vacía o solo con espacios: los comentarios del revisor salen
    `noScope`, sin reservar tope; las comprobaciones, como siempre; `noScope` antes que `noContext`.
- [ ] 1.3 El núcleo: `questionSchema` (`cause`, `scope`), la respuesta y el veredicto con `inside` y
  `outside`, `classify`, `withoutModel` con la descripción de la PR, el puerto `DecisionModel.ask`
  según la pregunta, y `graph.ts` (`triar` pasa la descripción; `preguntarModelo` guarda la respuesta
  tal como llega). `fixInThisPr` sale del núcleo.
  Verificar: los tests de 1.2 en verde y los que ya había; `pnpm typecheck` en verde (el adaptador y
  `studio.ts` se ajustan lo justo para compilar).
- [ ] 1.4 **(test en rojo)** El adaptador del modelo de decisión (`design.md` decisiones 1, 2 y 5), en
  `adapters/decision-model.test.ts`, con una fixture de `systemone` de una respuesta con dos
  preguntas (`test/fixtures/decision-model/`):
  - un comentario del revisor va en una petición con las dos preguntas, con el texto exacto de P1 y P2
    y sus criterios;
  - la respuesta da `inside` y `outside`, y los tokens cobrados;
  - `estimate` cuenta las dos preguntas;
  - las dos claves de un título largo no pasan de 100 caracteres;
  - una comprobación sigue con una pregunta, la de la causa.
- [ ] 1.5 El adaptador: P1 (la del *spike*, sin tocar) y P2 en `CRITERIA` e `instructions`, la
  petición con dos preguntas y la respuesta `scope`; sin `fixInThisPr` ni su rama para una
  comprobación.
  Verificar: los tests de 1.4 en verde y los que ya había.
- [ ] 1.6 **(test en rojo)** El resumen (`design.md` decisión 3), en `core/triage-summary.test.ts`: una
  prueba por fila de su tabla (*real* por P1, *no aplica* con «se capturaría», ninguna llega, se
  contradicen, regla de severidad alta sin probabilidad, la PR no dice su alcance). Las filas de las
  comprobaciones no cambian.
- [ ] 1.7 Los textos del porqué en `core/triage-summary.ts`.
  Verificar: los tests de 1.6 en verde y los que ya había.
- [ ] 1.8 **(test en rojo)** Los escenarios de la spec de punta a punta en el grafo, en
  `core/graph.test.ts`, con el modelo de decisión falso:
  - una PR con un comentario del revisor y una comprobación que falla: el modelo recibe una petición
    `scope` y otra `cause`, y el resumen da cada uno con su clase;
  - con la descripción vacía: el comentario sale *exige criterio* sin petición, y la comprobación se
    tría con el modelo.
- [ ] 1.9 Lo que falte para que 1.8 pase, si falta algo, y `studio.ts` con un hallazgo del revisor que
  muestre «se capturaría».
  Verificar: `pnpm test` en verde; `pnpm studio` arranca y el hilo de ejemplo llega al resumen.
- [ ] 1.10 Documentación: README §2.2 (el grafo, las reglas, el puerto `DecisionModel` y el adaptador
  del modelo de decisión: las dos preguntas del revisor, la regla de la descripción vacía y el porqué
  de «se capturaría») y §2.5 (qué sale hacia el proveedor: la pregunta del revisor). `prompts.md`.
  Verificar: ninguna mención a «hay que arreglarlo en esta PR» para el revisor en el README.
- [ ] 1.11 **Prueba a mano** (sin commit), con el sistema en marcha desde la rama, y una PR de prueba
  en borrador con `@codex review` a mano (como en `pr-check-triage`):
  - una PR que dice en su descripción lo que cubre, con un defecto en lo que cambia y otro en código
    que no toca, para que Codex comente los dos;
  - la misma PR con la descripción vacía.

  Verificar en cada una:
  - el resumen da cada comentario de Codex con su clase y el porqué de la tabla de la decisión 3, y en
    la segunda, *exige criterio* porque la PR no dice su alcance;
  - en LangSmith, la rama `preguntarModelo` del comentario lleva la pregunta `scope` y una sola
    petición con las dos preguntas; en la segunda, el comentario no abre ninguna rama. Anotar el camino
    de nodos y la foto que lo decidió.

  Si Codex no comenta lo esperado, se anota tal cual: la clasificación la cubren los tests, y esta
  prueba comprueba la petición real y el resumen. Los enlaces, en la descripción de la PR de la tarea.

## Workflow follow-up

- Al integrar la PR de `MOO-165`: `/opsx:verify` y `/opsx:archive` en una rama
  `…-archivar-change` que sale de `main` (`workflow.md` §4.5).
- Reconstruir el contenedor del PR Babysitter desde `main` (README §2.4).
