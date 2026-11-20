# Proposal

> **Origen:** historia [`MOO-160`](https://linear.app/7daysofrain/issue/MOO-160/saber-si-el-arreglo-de-un-hallazgo-del-revisor-cae-dentro-del-alcance)
> · Saber si el arreglo de un hallazgo del revisor cae dentro del alcance de la PR · épica **PB**
> (`MOO-67`, BH2) · expectativas **BE3**, **BE4** y **BE5** (`docs/pr-babysitter.md` §3). Sale del
> *spike* `MOO-120` (D114). Tarea: `MOO-165` (preguntar por el alcance de la PR los hallazgos del
> revisor, `infra`).

## Why

Hoy el triador pregunta por cada comentario del revisor «¿hay que arreglarlo en esta PR?», y el
*spike* `MOO-120` midió que acierta 2 de 8: sin el código, el modelo de decisión no puede comprobar
si Codex tiene razón, y Codex la tiene casi siempre (23 de 24). Lo que sí puede responder con lo que
recibe es si el arreglo **cae dentro del alcance de la PR**: 6 de 10, sin ninguno con confianza del
lado equivocado (D114).

Esa es la pregunta que decide qué podrá arreglar solo el sistema (BH3) y qué tendrá que llevar al
mantenedor. Antes de dejarle actuar, el mantenedor quiere verla en modo sombra (BE3, BE5).

## What Changes

- **Los hallazgos del revisor se clasifican por el alcance de la PR,** con dos preguntas al modelo de
  decisión en la misma petición:
  - P1, «¿cae el arreglo dentro del alcance de la PR?», la del *spike*, sin tocar. Si llega a 0,80,
    el hallazgo es *real*.
  - P2, «¿es trabajo de otra tarea o historia?», nueva. Si llega a 0,80, el hallazgo es *no aplica* y
    el resumen dice que **se capturaría**.
  - Si no llega ninguna, o llegan las dos, el hallazgo *exige criterio*.

  Un hallazgo que pide una decisión de diseño sobre el código de la propia PR sale bajo en las dos y
  acaba en *exige criterio*, no en «se capturaría» (`design.md` decisión 1).
- **La pregunta de validez (`fixInThisPr`) deja de usarse** y se borra con sus criterios. Los
  hallazgos del revisor se dan por buenos (D114).
- **Un hallazgo de severidad alta que caería fuera *exige criterio*,** por la regla de severidad alta
  que ya existe, y el resumen no dice que se capturaría.
- **Una PR con la descripción vacía no dice su alcance:** sus hallazgos del revisor *exigen criterio*
  por esa regla, sin preguntar al modelo de decisión.
- **El resumen del triaje dice el porqué de cada clase del revisor:**
  - *real* y *no aplica*: la pregunta que ha llegado al umbral y su probabilidad;
  - «se capturaría», cuando el hallazgo es *no aplica* por P2;
  - *exige criterio* por probabilidad: las dos probabilidades, para que se vea hacia qué lado iba;
  - *exige criterio* por una regla: la regla, sin probabilidad. Cambia el texto de hoy de la regla
    de severidad alta, que la incluye.
- **PB §4.1 y el glosario (*No aplica*) se alinean con esto:** un arreglo claramente fuera del
  alcance de la PR no se escala, se capturaría.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-triage`:
  - los hallazgos del revisor se clasifican con la pregunta de alcance (P1 y P2), y no con la de
    validez;
  - la regla de severidad alta mira P2 y no dice que se capturaría;
  - una regla nueva para la PR con la descripción vacía;
  - el porqué de una regla en el resumen va sin probabilidad.

## Non-goals

Tomados de la historia `MOO-160`:

- **Arreglar o escalar de verdad:** BH3 (`MOO-77`) y BH4 (`MOO-79`). Aquí solo se ve en el resumen
  del triaje.
- **Comprobar el parche después del arreglo:** `MOO-77`, fuera de su primera implementación.
- **Leer la tarea de Linear como contexto:** en el *spike* no aportó frente a la descripción de la PR
  (D114).
- **Las comprobaciones que fallan:** `MOO-159`, ya integrada. Su pregunta de la causa no cambia.
- **Crear la captura de verdad en *Triage*:** aquí el resumen solo dice que se capturaría. Está
  capturado en `MOO-166`.
- **Validar la pregunta de alcance y sus umbrales con PR ya cerradas:** `MOO-76`. El acierto se mide
  allí, no en este change.

Fuera también, decidido al explorar el change (19 y 20-nov):

- **Un motivo redactado de por qué cae fuera:** el modelo de decisión no genera texto (D90). El porqué
  es la pregunta P2 y su probabilidad (`design.md` decisión 3).
- **Tener en cuenta lo que el mantenedor ya contestó en el hilo del comentario:** el triaje no lee los
  hilos, como hoy (`design.md`, *Open Questions*).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/triage.ts`:
    - la pregunta `scope` para el revisor, en lugar de `fixInThisPr`;
    - una respuesta con las dos probabilidades;
    - `classify` con P1 y P2, la contradicción y la regla de severidad alta sobre P2;
    - la regla de la descripción vacía en `withoutModel`.
  - `src/core/ports.ts`: `DecisionModel.ask` devuelve la respuesta según la pregunta.
  - `src/core/graph.ts`: `triar` pasa la descripción de la PR a `withoutModel`; `preguntarModelo`
    guarda la respuesta tal como llega.
  - `src/core/triage-summary.ts`: el porqué de cada clase del revisor y «se capturaría».
  - `src/adapters/decision-model.ts`: P1 y P2 en una petición, con sus criterios; sin `fixInThisPr`.
  - `src/studio.ts`: un hallazgo del revisor que muestra «se capturaría».
- **Dependencias:** ninguna nueva.
- **Peticiones al modelo de decisión:** las mismas, una por hallazgo. La de un hallazgo del revisor
  lleva una pregunta más: unos 190 tokens, un 6 % más en la medición (`design.md` decisión 2). El
  tope de 0,05 $ no cambia (BQ5).
- **Documentación:**
  - `docs/pr-babysitter.md` §4.1 y §8 (*No aplica*), en el primer commit;
  - `docs/idea-mood-table.md` §10: D116, que matiza D114 (`design.md` decisiones 1 a 3);
  - README §2.2 (el grafo, las reglas, el puerto y el adaptador del modelo de decisión) y §2.5 (qué
    sale hacia el proveedor: la pregunta del revisor);
  - `prompts.md`.
- **Tests E2E:** ninguno. Vitest con un modelo de decisión falso y una fixture de `systemone`; la
  prueba de punta a punta, a mano contra una PR de prueba con un comentario de Codex, leyendo su traza
  en LangSmith (`tasks.md`).
