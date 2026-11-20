# Design

## Context

Motivación y alcance: `proposal.md`. Lo que hay hoy en `packages/pr-babysitter`, tras `MOO-159`:

- **`questionFor`** (`core/triage.ts`) elige la pregunta por la fuente: `cause` para una comprobación,
  `fixInThisPr` para un comentario del revisor. El adaptador (`adapters/decision-model.ts`) formula
  cada una con sus criterios (`CRITERIA`).
- **Una petición por hallazgo** (D115): `triar` decide sin el modelo lo que puede (`withoutModel`:
  regla determinista, sin contexto, tope), reparte los demás con `Send` a `preguntarModelo`, y
  `reunirTriaje` clasifica (`classify`) con una sola probabilidad.
- **`classify`** corta por el umbral y su complemento: *real* ≥ 0,80, *no aplica* ≤ 0,20, *exige
  criterio* entre medias. La regla de severidad alta convierte un *no aplica* de un P0/P1 en *exige
  criterio*.
- **El resumen** (`core/triage-summary.ts`) da por hallazgo su identidad (revisor, insignia,
  `fichero:línea`, título), su clase y su porqué. El de la regla de severidad alta incluye hoy la
  probabilidad.
- **El modelo de decisión** es Clef por `systemone` (D90): una probabilidad por pregunta, sin texto.
  Varias preguntas sobre el mismo `state` son lo que el protocolo espera (`questions` es un mapa).

## Goals / Non-Goals

**Goals:**

- Que el resumen del triaje muestre, para cada comentario del revisor, si el sistema lo arreglaría
  (*real*), lo capturaría (*no aplica*) o se lo llevaría al mantenedor (*exige criterio*).
- Que un hallazgo que pide una decisión de diseño sobre la propia PR no pueda acabar en «se
  capturaría» por cómo está escrita la pregunta.
- No tocar el triaje de las comprobaciones.

**Non-Goals:**

- Un umbral propio para P2: comparte el de 0,80 hasta que `MOO-76` lo calibre.
- Cambiar el *fan-out* ni el reparto del tope: la petición de un hallazgo del revisor sigue siendo
  una.

## Decisions

### 1. Dos preguntas para el revisor, P1 la del *spike* y P2 nueva

Una sola probabilidad ordena los hallazgos en una línea, pero hay tres casos: dentro y mecánico,
dentro pero con una decisión de diseño (#134.0, #140.0 del *spike*) y trabajo de otra tarea (#88.2).
Con la pregunta del *spike*, sus criterios del *no* incluyen «necesita una decisión de diseño», así
que un hallazgo de diseño claro saldría ≤ 0,20 y el resumen diría que se capturaría: capturar como
trabajo aparte algo que es de esta PR. Si se quita el diseño de esos criterios, el hallazgo sale
*real*, y el Fixer lo tocaría sin preguntar.

Con dos preguntas, el diseño tiene un sitio propio:

```
P1 >= 0,80 y P2 < 0,80   --> real
P2 >= 0,80 y P1 < 0,80   --> no aplica, se capturaría  (P0/P1: exige criterio, regla)
ninguna >= 0,80          --> exige criterio  <-- aquí cae el diseño: bajo en las dos
las dos >= 0,80          --> exige criterio (se contradicen)
```

- **P1, sin tocar** (instrucción y criterios del *spike*): *Is fixing the {insignia} reviewer comment
  on {fichero:línea}, titled '{título}', within the scope of this PR's task?*, con los criterios de
  `scope.ts` del *spike*. Cambiarla perdería la línea base medida.
- **P2, nueva:** *Does fixing the {insignia} reviewer comment on {fichero:línea}, titled '{título}',
  belong to work outside this PR's task, such as another task or story?*
  - **true:** *Fixing it is work for another task, story or area: this PR's description does not
    cover the code or behaviour it would change, and it could be done in a separate PR without
    leaving this PR incomplete or wrong.*
  - **false:** *Fixing it belongs to this PR: it corrects or completes what this PR's task creates or
    changes, even if it needs a design decision. A design decision about this PR's own code is not
    work for another task.*

**Medición** (20-nov, antes de escribir el change, como puerta): las 10 filas del *spike*, sin la
tarea de Linear, P1 y P2 en una petición, 2 pasadas (idénticas). Puerta: ninguna fila *dentro* con
P2 ≥ 0,80.

| Hilo | Etiqueta | P1 (*spike* → ahora) | P2 | Clase |
|---|---|---|---|---|
| #88.2 | fuera | 0,12 → 0,12 | 0,806 | no aplica, se capturaría ✓ |
| #88.0 | dentro | 0,91 → 0,91 | 0,11 | real ✓ |
| #101.3 | dentro | 0,85 → 0,87 | 0,10 | real ✓ |
| #72.1 | dentro | 0,94 → 0,94 | 0,06 | real ✓ |
| #85.1 | dentro | 0,83 → 0,81 | 0,17 | real ✓ |
| #122.2 | dentro | 0,93 → 0,94 | 0,07 | real ✓ |
| #88.1 | dentro | 0,59 → 0,58 | 0,32 | exige criterio |
| #134.0 (diseño) | dentro | 0,55 → 0,50 | 0,33 | exige criterio ✓ |
| #140.0 (diseño) | dentro | 0,60 → 0,56 | 0,42 | exige criterio ✓ |
| #101.2 (dudosa) | dentro | 0,27 → 0,24 | 0,60 | exige criterio |

Pasa la puerta: 6 de 10, sin errores con confianza, ninguna contradicción, y las dos de diseño bajas
en P2. El *script* desechable no está en el repo; reutiliza los datos del prototipo del *spike*
(commit `5ff8902`, en la PR #144).

**Alternativas:** una pregunta con los criterios del *spike* (el diseño puede acabar capturado) o
sin el diseño en el *no* (el diseño acaba *real*). Las dos dan lo mismo en esta muestra (ver
*Risks*), pero solo C lo evita por construcción.

**D#:** sí, **D116**, que matiza D114 («antes del Fixer, una pregunta de alcance»): dos preguntas
en una petición, y el porqué de la decisión 3.

### 2. Las dos preguntas en una sola petición

D114 dejó un hallazgo por petición porque varios hallazgos en el mismo `state` se contaminaban. Aquí
el `state` es el mismo para las dos preguntas, así que no hay de dónde: en la medición, P1 se movió
como mucho 0,05 con P2 al lado (#134.0), por debajo del ruido de 0,07 del *spike*. Cuesta unos 190
tokens más por hallazgo del revisor (3.149 frente a 2.961 en #88.2, un 6 %), no el doble. Si la
petición falla, el hallazgo *exige criterio* («el modelo de decisión no ha respondido»), como hoy.

- El `state` no cambia. `questions` lleva dos claves derivadas de la del hallazgo (una por pregunta,
  dentro del límite de 100 caracteres de Ollama).
- `estimate` estima la petición entera, con las dos preguntas: el tope sigue reservándose por lo
  alto.
- **El puerto `DecisionModel.ask`** devuelve, según la pregunta, una probabilidad (`cause`) o las dos
  (`scope`: `inside` y `outside`), con los tokens cobrados. El núcleo sigue decidiendo qué se pregunta
  (`questionFor` → `cause` o `scope`), y el adaptador, cómo.
- **La respuesta en el estado del hilo** (`TriageAnswer`) gana una variante con las dos
  probabilidades. El veredicto las guarda las dos, también cuando decide una regla, para que `MOO-76`
  calibre P2 sobre ellas.

> **Nota al archivar (20-nov), alineada con el código:**
> - Las claves son la del hallazgo con `_inside` (P1) y `_outside` (P2), con la base cortada a 92
>   caracteres para que quepan las dos.
> - El puerto devuelve `{ answer, inputTokens }`. `answer` es la respuesta tal como la guarda el
>   hilo: `{ kind: 'answered', probability }` para la causa, o `{ kind: 'scope', inside, outside }`.
> - El veredicto nombra cada caso de la decisión 1 (`inScope`, `outOfScope`, `unclearScope`,
>   `contradictoryScope` y `highSeverity`), así que el resumen no vuelve a comparar con el umbral
>   para elegir el texto.
> - La regla que guarda las dos probabilidades es la de severidad alta. La de la PR sin descripción
>   decide antes de preguntar, así que no tiene ninguna (`MOO-165`, #160).

**Alternativa:** dos peticiones. Duplica el `state` y el coste, y solo aporta que una pregunta pueda
responder si la otra falla, lo que no sirve: sin las dos no se puede clasificar.

### 3. El porqué de «se capturaría» es P2 y su probabilidad

El modelo de decisión no redacta (D90), así que el porqué es la pregunta que ha llegado al umbral,
como pide BE4. De qué trataría la captura ya está en la fila: revisor, insignia, `fichero:línea` y
título. Los textos, en el núcleo (`triage-summary.ts`):

| Caso | Clase | Por qué |
|---|---|---|
| P1 llega | real | `dentro del alcance: p = 0,91 ≥ 0,80` |
| P2 llega | no aplica | `de otra tarea: p = 0,85 ≥ 0,80 · se capturaría` |
| Ninguna | exige criterio | `dentro p = 0,58, de otra tarea p = 0,32: ninguna llega a 0,80` |
| Las dos | exige criterio | `dentro p = 0,85, de otra tarea p = 0,82: se contradicen` |
| P0/P1 con P2 | exige criterio | `regla: descartaría un hallazgo de severidad alta` |
| Descripción vacía | exige criterio | `regla: la PR no dice su alcance` |

La regla de severidad alta pierde la probabilidad en el texto (criterio 3 de la historia: una regla
se explica sin confianza), pero la conserva el veredicto. Las comprobaciones siguen con sus textos.

**Alternativa:** un LLM generativo que redacte el motivo. Otra dependencia, otro coste y un texto que
no se audita como una probabilidad; para el modo sombra no compensa.

### 4. La descripción vacía es una regla antes del modelo

`withoutModel` recibe la descripción de la PR y decide, en este orden:

1. comprobación determinista → *real* por regla (solo comprobaciones);
2. comentario del revisor con la descripción vacía o solo con espacios → *exige criterio*
   (`noScope`);
3. sin contexto → *exige criterio*;
4. fuera del tope → *exige criterio*.

Va antes que «sin contexto» porque es de la PR entera y lo arregla el mantenedor una vez, escribiendo
la descripción. Como las demás reglas, no pregunta ni reserva tope. Una descripción escueta no es
regla: con poco contexto el modelo duda, y eso ya es *exige criterio* (*(asumido)* en la historia).

### 5. `fixInThisPr` se borra

Sin comentarios del revisor que la usen, la pregunta de validez y sus criterios desaparecen del núcleo
y del adaptador, con la rama de `instructions` que la formulaba para una comprobación (que ya no se
usaba desde `MOO-159`). `studio.ts` usa la pregunta nueva.

### 6. PB se alinea en el primer commit

- **§4.1:** «el arreglo se sale del alcance de la PR» pasa a «no está claro si el arreglo cae dentro
  del alcance de la PR»; si cae claramente fuera, no se escala: es *no aplica* y se capturaría
  (`MOO-160`, `MOO-166`).
- **§8, *No aplica*:** añade que un comentario del revisor cuyo arreglo es de otra tarea se capturaría.

## Risks / Trade-offs

- **La muestra no distingue esta opción de una sola pregunta.** Con una pregunta, las 10 filas
  habrían salido igual: las de diseño cayeron en la franja media por sí solas. La protección es por
  construcción, no está demostrada con datos → `MOO-76` la valida con filas de diseño que P1 dé
  ≤ 0,20.
- **La única fila *fuera* pasa justa** (P2 = 0,806, a 0,006 del umbral; con una pregunta estaba a
  0,12 de su corte de 0,20). P2 capturará menos que una sola pregunta → el fallo es seguro (*exige
  criterio*, no un error con confianza), y `MOO-76` calibra P2 con más filas *fuera* (BA4: hoy hay
  una).
- **Criterios escritos conociendo las filas** (P2 se redactó con el caso #88.2 delante) → mismo
  remedio, `MOO-76`, con filas nuevas.
- **Un comentario equivocado o un nit dentro del alcance sale *real*.** Es la consecuencia de dar por
  buenos los hallazgos de Codex (D114, BA3): quien arregla (BH3) comprueba cada hallazgo antes de
  tocar nada. Con otro revisor, se revisa.
- **Duplicados cuando el arreglo ya es de otra tarea** (#88.2 era de `MOO-91`): el resumen diría que
  se capturaría igual → crear la captura de verdad, y no duplicarla, es de `MOO-166`.

## Migration Plan

Sin migración de datos: el estado del hilo vive en memoria (`MemorySaver`) y el resumen de un push
anterior se queda como estaba. Tras integrar, se reconstruye el contenedor desde `main` (README
§2.4). *Rollback*: revertir la PR.

## Open Questions

- **Lo que el mantenedor ya contestó en el hilo del comentario** («lo hago en otra tarea»): el triaje
  no lee los hilos, así que el resumen puede contradecirle. No cambia nada de este change; se puede
  plantear con BH3/BH4, cuando el sistema conteste en los hilos.
