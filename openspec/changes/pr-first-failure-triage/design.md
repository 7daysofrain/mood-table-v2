# Design

> Decisiones tomadas al refinar `MOO-169` y al explorar el change con el usuario (21-nov), a partir de
> D114, D119 y la prueba de la pregunta de la causa del 21-nov (en la historia). El usuario eligió en
> persona la 1: separar qué pasa (el triaje) de qué se hace (`decidir`) en vez de un nodo que
> pregunta dentro del seguimiento. Las demás se tomaron en la exploración como las evidentes. Las
> decisiones 1 a 4 y 6 a 8 son de `MOO-178`; la 5 y la 9, de `MOO-179`.

## Context

- **El seguimiento** (`graph.ts`, `tracking.ts`) es un hilo de LangGraph por PR que el *driver*
  despierta cada minuto con un *snapshot* de GitHub. Hoy, en cuanto termina el run de una relanzable
  que ha fallado en su primer intento, `afterChecksWait` devuelve `rerun` y el hilo va a `relanzar`,
  sin triar (D119). El triaje (`triar` → `preguntarModelo`×N → `reunirTriaje` → `publicarResumen`)
  solo corre en el camino del aviso final, cuando ya están todos los hallazgos del push.

  ```
  hoy:
  esperarComprobaciones --rerun--> relanzar --> esperarComprobaciones
          |
          +--estado final--> triar --> preguntarModelo* --> reunirTriaje --> publicarResumen --> avisarEstadoFinal
  ```

- **En el triaje final, una relanzable** no se pregunta (`withoutModel` → `afterRerun`):
  - con intento 2 o más, sale *real* por regla (`failedTwice`);
  - si sigue en el 1, sale *exige criterio* porque «no se ha podido relanzar».
- **La pregunta de la causa** (`CRITERIA.cause` en `adapters/decision-model.ts`) ya existe y se usa con
  las comprobaciones que no deciden una regla ni son relanzables. La prueba del 21-nov la pasó tal cual
  sobre 26 fallos de `test` y `e2e` de la CI y separó bien los dos casos, sin necesitar la lista de
  ficheros. No se toca.
- **`test` y `e2e` van en el mismo run** (`.github/workflows/ci.yml`), y `relanzar` pide
  `rerun-failed-jobs` del run: una sola llamada relanza todos sus *jobs* fallidos (D119, change
  `pr-check-rerun` decisión 2).
- **El estado del hilo:** `push` (se cambia entero con cada push nuevo), `triageRound` y
  `triageAnswers` (la ronda en curso del *fan-out*), `triage` (el último triaje, que `publicarResumen`
  publica si es del SHA del push) y `spentUsd`.

## Goals / Non-Goals

**Goals:**

- Que el triaje diga qué pasa y un nodo propio, sin modelo, decida qué se hace, con su decisión
  visible en la traza. Hoy solo decide relanzar o no; mañana, arreglar (BH3) o escalar (BH4).
- Que un fallo que causa la PR llegue al mantenedor sin esperar a un relanzamiento que no sirve.
- Que lo que respondió el primer triaje no se pierda ni se pague dos veces en el mismo push.

**Non-Goals:**

- Crear la captura en *Triage* (`MOO-166`) o arreglar y escalar (`MOO-77`, `MOO-79`).
- Triar en el primer fallo los hallazgos que no deciden ninguna acción de hoy.
- Cambiar la pregunta de la causa, sus criterios o el umbral (`MOO-76`).

## Decisions

### 1. El triaje dice qué pasa y un nodo `decidir` decide qué se hace (D# nueva, matiza D119)

```
                     +--(primer fallo de una relanzable, run terminado)--+
esperarComprobaciones                                                    |
esperarRevisor ------+--(estado final)-----------------------------------+
                                                                         v
          triar --> preguntarModelo* --> reunirTriaje --> decidir --+--> relanzar --> esperarComprobaciones
                                                                    +--> esperarComprobaciones (no relanza, MOO-179)
                                                                    +--> publicarResumen --> avisarEstadoFinal
                                                                    (BH3: arreglar · BH4: escalar)
```

`decidir` es un nodo que llama a una función pura nueva, `decide()` en `core/decision.ts`, con los
veredictos del triaje y el estado del push, y devuelve la acción. El nodo deja la decisión en el estado
(`decision: { action, rule }`), y LangSmith la guarda en la traza (BE4). Sale por una arista
condicional que lee esa decisión, como `relanzar` hoy: así el *driver* puede saltarse `relanzar` con un
push viejo o una PR detenida, igual que ahora (`PR_ACTION_NODES`).

Acciones de hoy:

| Ronda | Acción | Cuándo |
|---|---|---|
| primer fallo | `rerun` | siempre en `MOO-178`; en `MOO-179`, si ninguna relanzable sale *real* |
| primer fallo | `skipRerun` | `MOO-179`: alguna relanzable sale *real* (decisión 9) |
| final | `publish` | siempre: publicar el resumen y avisar del estado final |

El seguimiento deja de decidir el relanzamiento: `afterChecksWait` devuelve `firstFailure` en lugar de
`rerun`, con las mismas condiciones de hoy (relanzable fallida en su primer intento, run terminado, sin
relanzamiento pedido ni rechazado y dentro del plazo). La D# dice que el triaje decide qué pasa y
`decidir` qué se hace, y que el triaje sigue sin actuar: el requisito *El triaje no actúa sobre la PR*
se mantiene y pasa a decir quién actúa.

- **Alternativas:**
  - Un nodo `preguntarCausa` dentro del seguimiento, antes de `relanzar`, que guarda la respuesta. Es
    más pequeño (era 5 puntos), pero deja el relanzamiento decidido en dos sitios y habría que tirarlo
    cuando llegue BH3.
  - Una ronda entera de triaje antes de relanzar y otra al final: pregunta dos veces por los hilos del
    revisor y obliga a mezclar dos fases en el reductor de rondas.
  - Relanzar desde el propio triaje (el «antes de triar» de D114): mezcla clasificar con actuar, que ya
    descartó D119.
- **Número:** D122.

### 2. El triaje del primer fallo solo mira las relanzables que fallan en su primer intento

La única acción que se decide en ese momento es relanzar o no, y solo depende de esas comprobaciones.
Los hilos del revisor y las demás comprobaciones se siguen triando antes del aviso final, cuando ya
están todos los hallazgos del push (change `pr-shadow-triage`, decisión 1). Así no se paga dos veces
una pregunta que todavía no decide nada.

`triageRound` lleva la ronda (`kind: 'firstFailure' | 'final'`). En la ronda del primer fallo, `triar`
lee solo esas comprobaciones con un método nuevo y acotado del puerto, `Findings.readChecks(pr, sha,
names)`, que devuelve el contexto de la PR (título y descripción, que la pregunta necesita) y el de esas
comprobaciones, sin los hilos del revisor. El adaptador reutiliza `fromCheck` y `getPullRequest`.

### 3. Qué se pregunta y qué no, en el primer fallo

`withoutModel` gana una rama para la ronda del primer fallo. En este orden, cada relanzable:

1. si tiene un caso evidente (`evidentCase()`, la tabla de D119), sale `{ kind: 'evident',
   evidentCase }` sin preguntar;
2. sin contexto, `noContext`;
3. si no cabe en lo que queda del tope, `overBudget`;
4. si no, va al modelo con la pregunta `cause` (`questionFor` ya la da para una comprobación).

La reserva del tope y el gasto son los de siempre: `withinBudget` en `triar` y `spend` en
`reunirTriaje`, así que la pregunta cuenta en `spentUsd` en ese momento. Si el modelo no responde,
`modelUnavailable`. Una respuesta se clasifica con `classify` como cualquier otra: *real*, *no aplica* o
*exige criterio* por la probabilidad.

### 4. Lo que respondió el primer triaje se guarda en el push y no se repite

`reunirTriaje`, en la ronda del primer fallo, no escribe `triage` (que `publicarResumen` tomaría por el
triaje del push), sino `push.firstTriage`: cada relanzable con su veredicto. Como `push` se cambia
entero con cada push nuevo, un push nuevo empieza sin él (requisito *el triaje final no vuelve a
preguntar lo que respondió el primero*).

Se lee en tres sitios:

- **en `triar`, en la ronda del primer fallo:** una relanzable que ya está en `push.firstTriage` no se
  vuelve a preguntar. Pasa si el *driver* se ha saltado `relanzar` tras un fallo pasajero y el hilo
  vuelve a ver el primer intento fallido;
- **en `triar`, en la ronda final,** dentro de `afterRerun`: una relanzable que sigue en su primer
  intento sin haberse relanzado (`MOO-179`) sale con el veredicto guardado, sin preguntar. Las reglas
  de hoy siguen por delante: «ha fallado dos veces», «no ha terminado», «cancelada» y «GitHub no dejó
  relanzarla»;
- **en `publicarResumen`:** para la nota de la decisión 8.

### 5. Una pregunta por relanzable; si la PR causa una, no se relanza ninguna

Si fallan `test` y `e2e`, cada una tiene su pregunta (D114: una petición por hallazgo). Como
`rerun-failed-jobs` las relanza juntas y relanzar *job* a *job* choca con el run en marcha (D119),
`decide()` no relanza ninguna si alguna sale *real*. La otra queda en el resumen con su nota
(«se capturaría» si no la causa la PR).

### 6. Se relanza cuando no se sabe

Lo que no da *real* se relanza: *no aplica*, *exige criterio* por la probabilidad, el caso evidente,
sin contexto, fuera del tope o sin respuesta del modelo. Es el comportamiento de hoy (D119) para todo
lo que el triaje no tiene claro: un fallo de la PR que se relanza solo cuesta un run y unos minutos,
pero uno intermitente que no se relanza le llega al mantenedor como si fuera real.

### 7. El triaje del primer fallo no publica resumen

Sigue habiendo un resumen por push y sale en el camino del aviso final, como hoy: cuando `decidir`
elige `publish`. Lo del primer triaje solo queda en la traza y en `push.firstTriage` hasta ese
resumen.

### 8. El resumen lleva la nota del primer triaje de cada relanzable relanzada

`TriagedPush` gana `firstTriage` y `triageSummary` añade a cada relanzable que se relanzó (en
`rerunNames`) lo que dijo su primer triaje:

| Primer triaje | Nota |
|---|---|
| *no aplica* | `primer intento: p = 0,12 ≤ 0,20 · se capturaría` |
| *exige criterio* por la probabilidad | `primer intento: p = 0,55, no llega al umbral` |
| caso evidente | `primer intento: caso evidente: timeout` |
| sin respuesta | `primer intento: no se ha podido preguntar por la causa: <motivo>` |
| *real* | `primer intento: p = 0,93 ≥ 0,80` |

Va en la línea «se relanzó y pasó» o en el porqué de su fila (*real* por regla, *exige criterio* porque
no ha terminado). *Real* solo lleva nota mientras `decidir` relanza siempre (`MOO-178`): desde
`MOO-179` no se relanza, y la fila es la del propio primer triaje. «Se capturaría» es una nota, no una
clase: una comprobación exigida en rojo no puede ser *no aplica* (BQ8, D119).

La cabecera pasa de «modo sombra: no actúa» a «modo sombra: no arregla», como el glosario (*decide y
registra, pero no arregla*): desde D119 el sistema relanza, y desde aquí lo decide con el triaje.

### 9. Sin relanzar, la PR vuelve a la espera y llega al estado final por el camino de siempre (`MOO-179`)

Con `skipRerun`, `decidir` apunta en el push qué relanzables no relanza (`rerunSkipped`) y vuelve a
`esperarComprobaciones`. `afterChecksWait` las trata como hoy las rechazadas: no quedan por relanzar.
A partir de ahí, la PR sigue el camino de cualquier fallo:

- si no queda nada en marcha, el estado final;
- si falta una comprobación sin *check run* (con `test` roja, *SonarCloud Code Analysis* no llega),
  el margen de las que no van a ejecutarse (`MOO-164`, 2 min) y después el estado final;
- en los dos casos, `triar` en la ronda final, `decidir` (`publish`), el resumen y el aviso.

A diferencia de `rerunRejected`, `finalState` no añade ningún motivo nuevo: «falla `test`» ya lo dice.

- **Alternativa:** ir directo al aviso final desde `decidir`. Ahorra el margen, pero daría «no ha
  terminado» para lo que aún está en marcha y se saltaría el triaje de los demás hallazgos.

## Las cinco decisiones de arquitectura

1. **Qué se reparte entre agentes y qué no:** sigue sin haber agentes. El triador hace llamadas
   estructuradas al modelo de decisión, y `decidir` es código.
2. **Qué contexto recibe cada uno:** la pregunta del primer fallo lleva el título y la descripción de
   la PR y el error de la comprobación, sin el diff ni la lista de ficheros (D114, prueba del 21-nov).
   Si el contexto falta o no se puede leer, no se pregunta y se relanza (decisión 6).
3. **Dónde vive el estado y qué pasa si algo falla a medias:**
   - lo del primer triaje vive en `push.firstTriage`, en el *checkpointer* del hilo;
   - si `relanzar` falla, el *driver* se lo salta y el hilo vuelve a esperar. La siguiente ronda del
     primer fallo reutiliza ese veredicto y no repite la pregunta (decisión 4);
   - si el proceso se reinicia y pierde el estado (hasta BE7), el primer fallo se vuelve a triar: cuesta
     una pregunta.
4. **Qué decisiones no necesitan un LLM:**
   - `decidir` entero;
   - el caso evidente;
   - las reglas de «ha fallado dos veces», de las deterministas y del tope.

   El modelo solo da la probabilidad de la causa.
5. **Cuándo vuelve el control a una persona:** cuando la PR causa con confianza el fallo (p ≥ 0,80),
   el aviso «necesita intervención» llega sin esperar a un relanzamiento. El criterio es el umbral y
   queda en la traza. Escalar lo que exige criterio es de BH4: hoy, lo que no está claro se relanza.

## Risks / Trade-offs

- **[El modelo da *real* a un fallo intermitente]** → no se relanza y el mantenedor recibe un aviso
  que no hacía falta; lo arregla con un relanzamiento a mano. En la prueba, 0 de 14 intermitentes
  llegaron a 0,80 (el más alto, 0,67), pero las etiquetas son de la IA y 7 de las 12 filas de la PR
  son PR de prueba. `MOO-76` lo mide. Vuelta atrás: revertir `MOO-179` (*Migration Plan*).
- **[Un relanzamiento tarda unos segundos más]** → la pregunta corre antes de `relanzar`. Es poco
  frente a los ~2 min de un run.
- **[Un cambio grande en el grafo central]** → `graph.test.ts` tiene unas 2.300 líneas, y casi todos los
  tests del relanzamiento pasan ahora por `triar` y `decidir`. Por eso `MOO-178` hace la reforma sin
  cambiar el comportamiento (siempre relanza) y `MOO-179` solo añade la regla.
- **[El reductor de rondas mezcla las respuestas de dos rondas del mismo push]** → no pasa: cada ronda
  tiene su número (`latestRound`), y la del primer fallo se guarda en `push.firstTriage` antes de que
  empiece la siguiente.

## Migration Plan

1. Sin configuración nueva ni permisos nuevos. Desplegar `MOO-178`: relanza como hoy y el resumen
   lleva la nota del primer triaje. Después, `MOO-179`, que deja de relanzar lo que causa la PR.
2. **Vuelta atrás:**
   - de `MOO-179`, revertir su PR: `decidir` vuelve a relanzar siempre;
   - de todo, `RERUN_CHECKS=,` (una coma sola): sin relanzables no hay primer fallo que triar, ni
     relanzamiento.
