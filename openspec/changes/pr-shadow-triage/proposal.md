# Proposal

> **Origen:** historia [`MOO-75`](https://linear.app/7daysofrain/issue/MOO-75/ver-como-triaria-los-hallazgos-de-cada-pr-sin-que-actue)
> · Ver cómo triaría los hallazgos de cada PR, sin que actúe · épica **PB** (`MOO-67`, BH2, parte 1
> de 2) · expectativas **BE4** y **BE8** (`docs/pr-babysitter.md` §3), con BE3 y BE6 de fondo. Tareas:
> `MOO-108` (triar los hallazgos del último push, `infra`) y `MOO-109` (publicar el resumen del triaje
> en la PR, `infra`).

## Why

Hoy el sistema avisa de que una PR «necesita intervención» porque el revisor tiene hallazgos o falla
una comprobación, y ahí se para: leer cada hallazgo y decidir si merece un arreglo sigue siendo del
mantenedor. BH3 quiere que el sistema arregle los hallazgos reales, pero antes el mantenedor tiene que
**fiarse de su criterio** (BE3). Este change es el modo sombra: el sistema tría cada hallazgo y
publica su decisión en la PR, **sin actuar**, para que el mantenedor la compare con la suya y para que
`MOO-76` la mida contra PR ya cerradas.

## What Changes

- **El sistema tría los hallazgos del último push** cuando la PR acaba en «necesita intervención» con
  hallazgos: los comentarios del revisor y las comprobaciones que fallan (`sonar-issues` incluida, que
  lleva en su log las incidencias nuevas de SonarQube).
- **Cada hallazgo sale en una de tres clases** del glosario de PB: **real**, **no aplica** o **exige
  criterio**. Las dos primeras las decide un **modelo de decisión** (no un LLM generativo) que
  contesta con una probabilidad si el hallazgo hay que arreglarlo en esta PR. *Exige criterio* no es
  una respuesta del modelo: sale cuando su probabilidad no supera el umbral, cuando descartaría un
  hallazgo de severidad alta (P1), cuando no se pudo reunir el contexto del hallazgo o cuando se acaba
  el tope de gasto de la PR.
- **El sistema publica un comentario resumen en la PR**, firmado por el PR Babysitter, uno por push,
  con la clase de cada hallazgo y por qué: la probabilidad frente al umbral, o la regla que lo ha
  decidido.
- **No actúa:** no arregla, no contesta ni resuelve hilos, y el estado final y su aviso por Linear no
  cambian.
- **Coste acotado y visible (BE8):** un tope de gasto por PR que se comprueba antes de llamar al
  modelo, y el coste de cada triaje registrado en su traza de LangSmith.
- **BREAKING (para la operación):** el sistema escribe en GitHub algo más que la petición de revisión
  (el comentario resumen), y necesita una clave de API nueva, la del modelo de decisión.

## Capabilities

### New Capabilities

- `pr-triage`: el triaje en modo sombra de los hallazgos de una PR: qué es un hallazgo, sus tres
  clases y qué las decide, el tope de gasto, el comentario resumen y que el sistema no actúa.

### Modified Capabilities

- `pr-tracking`: «El sistema solo escribe en GitHub para pedir la revisión» pasa a permitir también el
  comentario resumen del triaje, como mucho uno por push.

## Non-goals

Tomados de la historia `MOO-75`:

- **Arreglar, contestar o resolver hilos** (BH3).
- **Medir el triaje contra PR ya cerradas** (`MOO-76`, la otra historia de BH2): también elegir el
  umbral con datos y comparar modelos y formas de preguntar.
- **Escalar los hallazgos que exigen criterio** (BH4): aquí solo se clasifican.
- **Revisar código por su cuenta:** lo hace el revisor (PB §5.3).
- **No repetir el comentario resumen tras un reinicio:** `MOO-85` (BE7).
- **PR de Dependabot**, hasta comprobar BA2 (como en `MOO-73` y `MOO-81`).

Fuera también, decidido al explorar el change (28-oct):

- **Un LLM generativo para triar** (Opus o Sonnet): un modelo de decisión da la probabilidad de cada
  respuesta, que es lo que hace medible «no lo tiene claro» (`design.md` decisión 3).
- **Guardar el veredicto de un hallazgo que se repite entre pushes:** en modo sombra, que el veredicto
  cambie es información; se pregunta en cada push y `MOO-76` lo mide. Es una pregunta para la spec de
  BH3, cuando el sistema actúe sobre él.
- **Editar el resumen cuando los hallazgos llegan en tandas:** el triaje se hace cuando ya están todos
  los del push (decisión 1), así que no hay tandas.
- **Dar al modelo las D#, la spec del change o `AGENTS.md`:** contexto de nivel 2 (el hallazgo y lo que
  señala, y el título y la descripción de la PR); `MOO-76` medirá si hace falta más.
- **Un tope de gasto mensual en el código (BA5):** se pone en la cuenta del proveedor (`design.md`,
  *Migration Plan*).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/`: el hallazgo y sus clases, las reglas del triaje (umbral, P1, sin contexto, tope), el
    texto del resumen, el puerto del modelo (`Triager`) y el de los hallazgos, y los nodos `triar` y
    `publicarResumen` del grafo.
  - `src/adapters/`: leer los comentarios del revisor de un push y el log de una comprobación que
    falla (`github.ts`, `codex-review.ts`), el adaptador del modelo de decisión, y publicar el
    resumen.
  - `src/adapters/config.ts`, `.env.example`, `src/main.ts`, `src/studio.ts`.
- **Dependencias:** `@langchain/typesafe` (cliente del protocolo de decisión), si funciona contra el
  proveedor elegido (`design.md` decisión 3).
- **Proveedor nuevo:** el modelo de decisión, de pago por uso, con su clave en el `.env` del
  contenedor.
- **Peticiones a GitHub:** solo en las PR que acaban con hallazgos, una vez por push: los comentarios
  de revisión y el log de cada comprobación que falla.
- **Documentación:**
  - `docs/pr-babysitter.md`: BQ2 resuelta; el glosario de *triaje*, *no aplica* (incluye los nits) y
    *exige criterio* (umbral y reglas); BE4 matizada (el porqué de un modelo de decisión); los
    umbrales de BQ5 que fija este change.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas (`design.md`).
  - `docs/umbrales-para-specs.md`: el umbral de confianza y el tope de gasto.
  - README §2.2 (nodos, puertos y adaptadores), §2.4 (la clave nueva) y §2.5 (qué sale hacia el
    proveedor del modelo).
  - `prompts.md`.
- **Linear:** los criterios de `MOO-75` del tope de gasto y del «por qué», y la descripción de
  `MOO-108`, se ajustan a lo decidido al explorar (lo hace el mantenedor o el agente cuando él lo pida).
- **Tests E2E:** ninguno. Vitest con fixtures de GitHub y un modelo falso detrás del puerto; la prueba
  de punta a punta, a mano contra una PR real (`tasks.md`).
