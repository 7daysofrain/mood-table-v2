# Proposal

> **Origen:** historia [`MOO-169`](https://linear.app/7daysofrain/issue/MOO-169/preguntar-si-la-pr-causa-el-fallo-de-test-o-e2e-antes-de-relanzarlo)
> · Preguntar si la PR causa el fallo de test o e2e antes de relanzarlo · épica **PB** (`MOO-67`, BH2) ·
> expectativas **BE1** y **BE4** (`docs/pr-babysitter.md` §3). Sale de dos non-goals de `MOO-155` y
> matiza D119. Tareas: `MOO-178` (triar el primer fallo de test o e2e y decidir el relanzamiento en un
> nodo propio, `infra`) y `MOO-179` (no relanzar cuando la PR causa el fallo, `infra`).

## Why

Hoy el seguimiento relanza siempre un `test` o un `e2e` que falla en su primer intento (D119), sin
mirar el error. Si el fallo lo causa la PR, el relanzamiento no sirve de nada: el mantenedor recibe el
aviso varios minutos después y el sistema ha gastado un run de CI. Y si el fallo es intermitente o
viene de `main`, al pasar en el relanzamiento se pierde, porque nada dice que habría que capturarlo.

La prueba del 21-nov, con la pregunta de la causa que ya existe y 26 fallos reales de la CI, separa
bien los dos casos: los 12 que causaba la PR salen con p ≥ 0,80, y ninguno de los 14 intermitentes
pasa de 0,67. La pregunta no tiene que cambiar; lo que cambia es cuándo se hace y qué se hace con la
respuesta.

Ese «qué se hace» es la parte nueva. Hasta ahora el triaje solo registraba y, por eso, decidir el
relanzamiento era cosa del seguimiento. Para que la respuesta del triaje decida si se relanza sin que
el triaje actúe, el usuario decidió al explorar el change separar las dos responsabilidades. El
triaje dice qué pasa con cada hallazgo, y un nodo `decidir`, sin modelo, elige qué hacer. Hoy solo
elige entre relanzar o no relanzar. Es el mismo sitio en el que BH3 pondrá arreglar y BH4 escalar.

## What Changes

- **El primer fallo de `test` o `e2e` se tría antes de relanzarlo.** Cuando termina el run del último
  push y una relanzable ha fallado en su primer intento, el triador tría esas relanzables con la
  pregunta de la causa de producción:
  - un caso evidente (*timeout*, infraestructura, red, *runner* perdido) no llega al modelo;
  - tampoco llega una comprobación sin contexto ni una que no cabe en el tope de gasto;
  - este triaje no publica resumen: su resultado se guarda para el resto del push.
- **Un nodo `decidir` elige qué hacer con el triaje.** Es una regla pura, sin modelo, y queda
  registrada en la traza:
  - **se relanza** si el fallo no lo causa la PR, si no está claro o si no ha habido respuesta;
  - **no se relanza** si el triaje da con confianza que la PR causa el fallo de alguna de las
    relanzables. Como se relanzan todos los *jobs* fallidos del run con una sola llamada (D119), en
    ese caso no se relanza ninguna. La PR va al estado final, con el aviso «necesita intervención»,
    sin esperar a ningún relanzamiento;
  - en el triaje final, va a publicar el resumen y avisar, como hasta ahora.
- **El relanzamiento deja de decidirse en el seguimiento.** El seguimiento solo detecta que una
  relanzable ha fallado en su primer intento y que su run ha terminado.
- **El triaje final reutiliza el del primer fallo:**
  - una relanzable que no se relanzó sale con la clase del primer triaje, sin preguntar otra vez;
  - una que ha fallado dos veces sigue saliendo *real* por regla (D119);
  - la que ha pasado al relanzarla sigue sin ser un hallazgo.
- **El resumen dice qué respondió el primer triaje** de cada relanzable que se relanzó: «se
  capturaría» si no lo causa la PR, el caso evidente o por qué no ha habido respuesta. Lo dice tanto si
  el relanzamiento pasa como si vuelve a fallar o no llega a dar resultado. Sigue habiendo un solo
  resumen por push.
- **Una D# nueva matiza D119:** el triaje decide qué pasa y `decidir` qué se hace. El triaje del primer
  fallo usa la pregunta de la causa sin la lista de ficheros (D114).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-tracking`:
  - una relanzable que falla en su primer intento se relanza una vez, salvo que el triaje del primer
    fallo diga que la causa la PR;
  - un requisito nuevo: si la PR causa el fallo, no se relanza y se avisa del estado final sin
    esperar.
- `pr-triage`:
  - un requisito nuevo: el primer fallo de una relanzable se tría antes de relanzarla, con el caso
    evidente y la falta de respuesta sin preguntar al modelo;
  - se tría también en el primer fallo, no solo antes del aviso final;
  - la pregunta de la causa vuelve a hacerse a las relanzables, en su primer intento;
  - el triaje sigue sin actuar: lo que se hace con su resultado lo decide `decidir`;
  - el resumen dice qué respondió el primer triaje de cada relanzable.

## Non-goals

Tomados de la historia `MOO-169`:

- **Crear la captura de verdad en *Triage*:** `MOO-166`. El resumen solo dice que se capturaría.
- **Juntar las capturas repetidas** del mismo test intermitente en varios push o PR: `MOO-166`.
- **Sacar como *real* un test intermitente que añade o cambia la propia PR** cuando la pregunta no lo
  ve claro y el relanzamiento pasa: se acepta el hueco.
- **Contar las repeticiones del fallo** en el historial de GitHub (D114).
- **Cambiar lo que pasa cuando el relanzamiento vuelve a fallar:** sigue saliendo *real* por regla
  (D119, `MOO-155`).
- **Arreglar el test o escalar al mantenedor:** `MOO-77` (BH3) y `MOO-79` (BH4). El test intermitente de
  hoy tiene su captura, `MOO-158`.
- **Calibrar los criterios o el umbral** de la pregunta de la causa: `MOO-76`.

Fuera también, decidido al explorar el change (21-nov):

- **Más acciones en `decidir`** que relanzar o no relanzar: arreglar es de BH3 y escalar de BH4.
- **Triar en el primer fallo los demás hallazgos** (hilos del revisor, otras comprobaciones): ninguna
  acción de hoy depende de ellos, y siguen triándose antes del aviso final.

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/decision.ts` (nuevo): la regla de `decidir`.
  - `src/core/graph.ts`: el triaje del primer fallo, el nodo `decidir` entre `reunirTriaje` y lo que
    viene después, y `relanzar` alcanzado desde `decidir`.
  - `src/core/tracking.ts`: el paso del primer fallo en lugar del de relanzar, y lo que no se relanza
    no vuelve a disparar el triaje.
  - `src/core/triage.ts` y `src/core/triage-summary.ts`: el triaje de una relanzable en su primer
    intento, la reutilización en el triaje final y la nota del primer triaje en el resumen.
  - `src/core/ports.ts` y `src/adapters/findings.ts`: leer solo las comprobaciones que fallan, sin los
    hilos del revisor.
  - `src/studio.ts`: los puertos falsos.
- **Coste:** una pregunta de unos 3.100 tokens por relanzable que falla en su primer intento, menos de
  0,001 $ frente al tope de 0,05 $ por PR. El triaje final no la repite.
- **Peticiones a GitHub:** en el primer fallo, la PR y el contexto de las relanzables que fallan.
- **Documentación:**
  - README §2.2: el nodo `decidir` y el triaje del primer fallo;
  - `docs/idea-mood-table.md` §10: la D# nueva y una nota en D119;
  - `prompts.md`.
- **Tests E2E:** ninguno. Vitest con fixtures; la prueba de punta a punta, a mano contra PR de prueba,
  leyendo su traza en LangSmith (`tasks.md`).
