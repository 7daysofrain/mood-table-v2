# Design

> Decisiones tomadas al refinar `MOO-159` y al explorar el change con el usuario (13-nov), a partir de
> D114 y del *spike* `MOO-120` ([documento](../../../docs/spikes/moo-120-contexto-triaje.md)). El
> usuario eligió en persona la 1 (un módulo del adaptador, no un puerto), la 4 (el *fan-out*) y la 6 (la
> lista configurable y la regla antes que todo). Las demás las delegó en la recomendación de la
> exploración («si son tan claras como esta, vamos con el recomendado»). Las decisiones 1 y 2 son de
> `MOO-161`; la 3, la 4 y la 5, de `MOO-162`; la 6 y la 7, de `MOO-163`.

## Context

- **Lo que hay** (change `pr-shadow-triage`, README §2.2):
  - el nodo `triar` lee los hallazgos (`Findings`), descarta los que no tienen contexto, reserva el
    tope de gasto (`withinBudget`) y hace **una sola** llamada al puerto `Triager` con todos;
  - el adaptador (`decision-model.ts`) los mete en una petición por push (`batches()`, como mucho 32
    preguntas y 60.000 tokens), con la misma pregunta y los mismos criterios para todos;
  - después, `publicarResumen` y `avisarEstadoFinal`.

  ```
  esperar* --> triar --> publicarResumen --> avisarEstadoFinal
               (read, filtro, tope, 1 llamada con N hallazgos)
  ```

- **El contexto de una comprobación hoy** (`findings.ts`):
  - es `log: string | null`: el log del *job*, desde el último `##[group]Run` hasta el primer
    `##[error]`, cortado por el principio a 16 KiB;
  - en Playwright, el `##[error]` es la primera línea del bloque de error, y el corte lo deja fuera
    (`MOO-154`);
  - si la comprobación no es de GitHub Actions, `jobLog()` da `null` y el hallazgo sale *sin
    contexto*.
- **Las comprobaciones exigidas en `main`:** `lint`, `typecheck`, `test`, `e2e`, `sonar-issues`
  (GitHub Actions) y `SonarCloud Code Analysis` (app `sonarqubecloud`).
- **El hilo de una PR sobrevive entre pushes:** al avisar del estado final termina, y un push nuevo lo
  vuelve a empezar con el estado que ya tenía (`graph.ts`). Lo que el triaje deje en el estado se lo
  encuentra el push siguiente.
- **LangGraph.js** (documentación consultada el 13-nov):
  - `Send(nodo, payload)` sale de una arista condicional, y el nodo recibe solo el payload;
  - lo que devuelven las ramas se junta con un reductor (`ReducedValue`);
  - `maxConcurrency` va en la configuración de cada `invoke`.

## Goals / Non-Goals

**Goals:**

- Que cada hallazgo llegue al modelo de decisión solo, con la pregunta de su fuente y su contexto
  entero, y que la traza de LangSmith lo muestre: una rama por hallazgo, con su pregunta, su contexto
  y su respuesta.
- Que las decisiones que no necesitan modelo (la regla de las deterministas, sin contexto, el tope) se
  sigan tomando en funciones puras del núcleo, y se prueben sin él.
- Que aprender el patrón *fan-out* de LangGraph sea parte del resultado: es el motivo principal del PB
  (PB §1.2, `AGENTS.md`, regla 3).

**Non-Goals:**

- Que el contexto de una comprobación sirva ya a otros consumidores (las repeticiones de `MOO-155`, el
  aviso al mantenedor): la forma estructurada lo deja preparado, pero no se usa fuera del triaje.
- Reintentar una petición que falla más allá de los reintentos del cliente (2, como hoy).

## Decisions

### 1. El contexto es un tipo del núcleo y sus estrategias, un módulo del adaptador

El hallazgo de una comprobación pasa de `log: string | null` a llevar su **conclusión** y un
**contexto estructurado** (`CheckContext`, en `core/triage.ts`, validado con zod porque va en el estado
del grafo):

| `state` | Qué lleva | Cuándo |
|---|---|---|
| `available` | `origin` (`annotations`, `log` o `appSummary`), `summary`, `errors` (fichero, línea, título y mensaje de cada uno) y `truncated` | Hay algo que dar al modelo |
| `notProvided` | nada | La comprobación no da contexto: una app con el resumen vacío, o un *job* sin anotaciones útiles y con el log vacío |
| `unreadable` | nada | GitHub no lo da: el log ha caducado, se ha borrado o falta un permiso (un 4xx) |

- **Las estrategias, en `adapters/check-context.ts`.** Es un módulo que usa el adaptador de los
  hallazgos (`findings.ts`), y no un puerto del núcleo: hoy solo lo usa el triaje, y el núcleo solo
  necesita el resultado. D114 dice «un puerto»: se sube a puerto cuando lo necesite un segundo
  consumidor, que será `MOO-155`.
- **Un fallo de red, un 5xx o el límite de la API lanzan,** como hoy: el nodo `triar` queda pendiente y
  el driver lo reintenta en la vuelta siguiente. Solo un 4xx que no se arregla solo da `unreadable`.
- **`hasContext` pasa al núcleo:** un hallazgo del revisor con su `diffHunk`, o una comprobación con
  `state: 'available'`.

*Descartados:*

- **El puerto ya** (D114 al pie de la letra): un puerto con un solo consumidor añade una interfaz,
  un falso y un montaje en `main.ts` sin nada que lo pida todavía.
- **Seguir con un texto (`log`) y añadir campos sueltos:** el estado separa «no lo da» de «no se ha
  podido leer», que hoy acaban igual, y la lista de errores deja abierto `MOO-148` sin decidirlo
  aquí.

### 2. Una estrategia por `app.slug`, un corte para todas y el origen en el resumen

| App | Contexto | Origen |
|---|---|---|
| `github-actions` | Las anotaciones útiles del *check run*, todas | `annotations` |
| `github-actions`, sin anotaciones útiles | El paso que falla del log, entero | `log` |
| Cualquier otra | `output.title` y `output.summary` del *check run* | `appSummary` |

- **Anotación útil:** todas, salvo un `failure` con el fichero en `.github` (el genérico «Process
  completed with exit code 1») y un `notice` sin título (el *spike*, §*Propuesta de estrategias*).
- **El paso que falla, entero:**
  - va desde el `##[group]Run` del paso que contiene el primer `##[error]` hasta antes del
    `##[group]Run` siguiente, o de `Post job cleanup.`, o hasta el final del log;
  - sin marcas de tiempo ni colores, como hoy;
  - sustituye a `failingStep()`, que cortaba en el primer `##[error]` (`MOO-154`);
  - sin ningún `##[error]`, el final del log, como hoy.
- **El corte es de 16 KiB para cualquier origen** (decidido al explorar, 13-nov, *(asumido)* hasta
  `MOO-76`):
  - el log y el resumen de una app se cortan por el principio, porque en un log lo último (el resumen
    de los tests, el error) es lo que más dice;
  - las anotaciones entran enteras y en orden mientras caben;
  - en los dos casos, `truncated: true`, que llega al modelo y al resumen.
- **La conclusión viaja con el contexto:** una comprobación que acaba en `timed_out` o `cancelled`
  sigue siendo un hallazgo (lo es hoy), y el modelo recibe cómo acabó. Que la decida una regla queda
  para `MOO-155`, que relanza.
- **El origen va a la traza y al resumen.** La traza lo tiene ya, porque el hallazgo entero va en el
  estado. En el resumen, la columna *Por qué* de una comprobación termina con `· contexto: anotaciones`
  (o `log`, o `resumen de la app`), y con `, cortado` si se cortó. Sin contexto, dice cuál de los
  dos casos es: «la comprobación no da contexto» o «no se ha podido leer su contexto».
- **GitHub (`adapters/github.ts`):** `jobLog(sha, nombre)` se sustituye por tres lecturas:
  - `checkRun(sha, nombre)`, con el id, la app, la conclusión y la salida;
  - `annotations(id)`;
  - `jobLog(id)`. En GitHub Actions, el id del *check run* es el del *job*, como hoy.

  El log solo se pide si no hay anotaciones útiles.

*Descartados:*

- **Elegir la estrategia por el nombre de la comprobación:** ata el triaje a los nombres de los *jobs*
  (D114).
- **Un adaptador de la API de SonarCloud:** su comprobación la decide una regla (decisión 6).
- **El origen solo en la traza:** el mantenedor lee el resumen. Ver que un *real* sale de un log
  cortado le dice cuánto fiarse.

### 3. Un hallazgo por llamada: el puerto `DecisionModel` y la pregunta según la fuente

- **El puerto `Triager` pasa a `DecisionModel`,** como lo llama el glosario de PB §8: el *triador* es
  el agente (los nodos), y el *modelo de decisión*, la pieza de dentro que responde.
  - `ask(pr, finding, question)` da la probabilidad del sí y los tokens de entrada cobrados.
  - `estimate(pr, finding, question)` da los tokens que costaría esa petición, por lo alto.
  - Si el modelo no responde, lanza `DecisionModelError` con los tokens que ya ha cobrado (hoy,
    `TriageFailedError`).
- **Qué se pregunta lo decide el núcleo** (`questionFor(finding)` en `core/triage.ts`):
  - `cause` para una comprobación;
  - `fixInThisPr` para un comentario del revisor.

  Es dominio (D114: la pregunta depende de la fuente), se prueba sin modelo y queda en la traza, en la
  entrada de cada rama. El adaptador solo sabe cómo se formula cada una.
- **Las preguntas, en inglés, en el adaptador:**
  - `fixInThisPr`, la de hoy, con sus criterios sin tocar (`MOO-160`): *"Should <el hallazgo> be fixed
    in this PR before merging?"*
  - `cause`, la del *spike*: *"Is the failure of the required check '<name>' caused by the changes in
    this PR?"* Sus criterios, a partir de los que midió el *spike*:
    - sí: el fallo viene de lo que cambia la PR, o la regla de la comprobación señala algo que la PR
      añade o modifica; la comprobación es exigida, y sin pasarla la PR no se integra;
    - no: un test intermitente o sensible a los tiempos, un *timeout*, la infraestructura o la CI, o
      código y tests que la PR no toca; relanzarla sin cambiar la PR podría bastar.

    No piden *"judge the finding against the diff"*, porque el diff no llega (D114).
- **Lo que lee el modelo de una comprobación:** `{ source: 'check', name, conclusion, context: {
  origin, summary, errors, truncated } }`, en lugar de `log_tail`.
- **Desaparecen `batches()`, `MAX_QUESTIONS` y `MAX_REQUEST_TOKENS`:** una petición lleva una pregunta,
  y su contexto está cortado a 16 KiB. De paso se va el límite que no contaba las preguntas (#101.3).

*Descartados:*

- **Que el adaptador elija la pregunta por la fuente:** funcionaría igual, pero la decisión quedaría
  donde no se ve en el grafo ni se prueba con un falso.
- **Mantener el nombre `Triager`:** el glosario ya separa los dos términos (añadidos al refinar la
  historia), y el código los mezclaría.

### 4. Las preguntas salen en paralelo, con un *fan-out* de `Send`

```
              findings.read
triar ----->  por hallazgo:  regla?            --> respuesta: rule
(reparte)                    contexto?         --> respuesta: noContext
              withinBudget(estimaciones)       --> respuesta: overBudget
                       |
                       | arista condicional
                       |   N > 0:  Send("preguntarModelo", {ronda, i, pr, hallazgo, pregunta}) x N
                       |   N = 0:  "reunirTriaje"
                       v
          +--> preguntarModelo(h1) --+
          +--> preguntarModelo(h2) --+   cada una: decisionModel.ask(); si falla, modelUnavailable
          +--> preguntarModelo(h3) --+   devuelve {ronda, i, respuesta, tokens} al reductor
                                     v
                               reunirTriaje --> classify y gasto --> triage --> publicarResumen
```

- **`triar` reparte.** Lee los hallazgos, aplica la regla, mira el contexto y reserva el tope
  (decisión 5). Deja en el estado una **ronda**: un número que crece en cada triaje del hilo, los
  hallazgos y las respuestas que ya tiene. Emite un `Send` por hallazgo que va al modelo.
- **`preguntarModelo` pregunta por un hallazgo** y no lanza nunca. Si `ask` falla, captura el error,
  lo deja en el log y devuelve `modelUnavailable` con los tokens cobrados. Si lanzara, fallaría todo el
  *superstep*, y con él el criterio de que una petición que falla no arrastra a las demás.
- **Las respuestas se juntan en un `ReducedValue`** cuyo reductor concatena y se queda solo con las
  de la ronda más alta. El hilo sobrevive entre pushes, y un reductor que solo concatena mezclaría las
  respuestas del triaje anterior con las del nuevo. Así, además, el estado no crece push a push.
- **`reunirTriaje` clasifica** las respuestas de su ronda con `classify`, suma el gasto y escribe
  `triage` como hoy. `publicarResumen` y su reintento no cambian.
- **Sin nada que preguntar** (todo por regla, sin contexto o fuera del tope), la arista va directa a
  `reunirTriaje`: sin ningún `Send`, el grafo no tendría nodo siguiente.
- **Concurrencia: `maxConcurrency: 4`** en cada `invoke` del driver *(asumido)*. No sabemos los
  límites de la nube de Ollama, y un 429 en ráfaga dejaría varios hallazgos en *exige criterio*. Solo
  afecta al *fan-out*, porque es el único sitio del grafo con tareas en paralelo.
- **LangGraph Studio** (`src/studio.ts`): el modelo falso tarda un poco y da probabilidades distintas
  por fuente, para ver las ramas en paralelo y las tres clases.

**Debería ser una D# nueva** en `docs/idea-mood-table.md` §10 (D115): el triaje pregunta cada hallazgo
en una rama propia del grafo (*fan-out* con `Send`), con una ronda por triaje y un tope de concurrencia;
matiza D91, como D114.

*Descartados:*

- **Un `Promise.all` dentro de `triar` (A').** Hace lo mismo con menos piezas, y la exploración lo
  recomendaba primero. Se elige el *fan-out* por tres razones:
  - una rama por hallazgo en la traza (BE4);
  - con un *checkpointer* persistente (BE7), las ramas que ya han respondido quedarían guardadas, y no
    se volverían a pagar si el proceso cae a mitad. Hoy no aplica, porque el sistema usa `MemorySaver`
    y un reinicio lo pierde todo;
  - y, sobre todo, aprender el patrón y verlo funcionar, como dijo el usuario al explorar: «quiero
    aprender y fan-out me parece un patron interesante de aprender y ver funcionando asi que me
    inclino por el».
- **Un bucle secuencial:** sin el tope, sería lo más simple. Con el tope reservado antes (decisión 5),
  el orden no cambia el gasto, y en paralelo el triaje tarda lo que la petición más lenta.
- **Vaciar el reductor al empezar cada triaje:** un reductor que concatena no se vacía solo, y un valor
  especial para vaciarlo es más difícil de leer que la ronda.

### 5. El tope se reserva antes de repartir, y lo cobrado al fallar también cuenta

- **`withinBudget` estima por hallazgo:** `estimate` de cada petición, que repite la PR, y entran por
  orden los que caben en lo que queda del tope. Como hoy, se reserva por lo alto antes de llamar, así
  que el paralelismo no puede pasarse del tope.
- **El gasto real es la suma de los tokens de todas las ramas,** también los que cobró una petición
  que falló después de pagarse. Esto ya lo hacía `TriageFailedError` con una petición por push.
- **Una comprobación que decide la regla no reserva nada:** no hay petición (decisión 6).

*Descartado:* comprobar el tope dentro de cada rama, con el gasto que llevan las demás. En paralelo
habría carreras, y la reserva por lo alto ya basta para BE8.

### 6. Las comprobaciones deterministas, por una regla configurable que va antes que todo

- **`TRIAGE_RULE_CHECKS`,** una lista separada por comas, por defecto `lint,typecheck,SonarCloud Code
  Analysis`. Llega al núcleo con el umbral y el tope, en `TrackingOptions.triage`. Los nombres son los
  de la comprobación exigida en `main` (`requiredChecks()`).
- **El orden: regla, contexto, tope y modelo.** La regla no necesita contexto ni gasta del tope, así
  que va primero:
  - un `lint` que falla con el log ilegible sale *real*, y no *exige criterio*;
  - con el tope agotado, también sale *real*.

  El usuario lo aceptó al explorar.
- **El veredicto:** `{ class: 'valid', reason: 'rule' }`, sin probabilidad. El resumen dice «regla:
  comprobación determinista».
- **Una comprobación exigida nueva o un *job* renombrado** no está en la lista, así que va por la
  pregunta de la causa. Es el camino seguro: preguntar cuesta unos 0,0004 $ y puede salir *exige
  criterio*, mientras que una regla equivocada daría *real* sin mirar.

*Descartados:*

- **La lista en el código:** ata el núcleo a los nombres de los *jobs* de este repo, que D114 quiere
  evitar.
- **Detectarlas por la app** (SonarCloud): `lint` y `typecheck` son de GitHub Actions, como `test`.

### 7. Lo que no cambia, y por qué

- **Una comprobación que la PR no causa sale *no aplica*,** como hoy. Qué clase le toca y cómo se
  nombra es BQ8, que resuelve `MOO-155` con el relanzamiento.
- **Una comprobación relanzada a mano que pasa** no necesita nada: `checks()` ya lee el *check run*
  más reciente de cada nombre, así que deja de ser un hallazgo en la vuelta siguiente.
- **La lista de ficheros con la pregunta de la causa** va con `MOO-155`: el *spike* la manda solo en
  los `test` y `e2e` que fallan dos veces.
- **El PAT declara *Checks* y *Actions* en lectura** (D114). Hoy los lee sin ellos porque el repo es
  público. Es un cambio de configuración del token y de `.env.example`, no de código.

## Risks / Trade-offs

- **Los criterios de la pregunta de la causa se escribieron conociendo las 5 filas del *spike*.** →
  Se validan con filas nuevas en `MOO-76`. Hasta entonces, el modo sombra no actúa: equivocarse cuesta
  poco.
- **Más peticiones por push** (una por hallazgo), y cada una repite la PR. → Unos 0,0004 $ más por
  hallazgo; el tope de 0,05 $ no cambia (BQ5) y sigue reservándose antes.
- **Un 429 en ráfaga del proveedor.** → `maxConcurrency: 4` y los reintentos del cliente. Si aun así
  pasa, esos hallazgos salen *exige criterio* con el motivo, y la prueba a mano lo diría.
- **Más piezas en el grafo** (dos nodos, un reductor y la ronda) frente a A'. → Se acepta por las
  razones de la decisión 4. Las reglas siguen siendo puras y el grafo se prueba con un modelo falso.
- **La historia está estimada en 8, el máximo, y la sección de `MOO-162` crece con el *fan-out*.** →
  Si al implementarla pasa de lo previsto, se para y se reestima antes de seguir, sin esperar a
  descubrirlo a mitad de la PR.
- **Una comprobación con muchas anotaciones** deja fuera las que no caben en 16 KiB. → `truncated` lo
  dice en el resumen. `MOO-148` las partirá en hallazgos.

## Migration Plan

- **Antes de desplegar la sección 1,** el mantenedor añade *Checks* y *Actions* en lectura al PAT del
  sistema (README §2.5). Sin ellos funciona igual mientras el repo sea público.
- **`TRIAGE_RULE_CHECKS` tiene valor por defecto,** así que el `.env` del contenedor no tiene que
  cambiar.
- **No hay estado que migrar:** el sistema usa `MemorySaver` hasta BE7 (D73), así que desplegar
  reinicia el proceso y los hilos se reconstruyen desde GitHub con el esquema nuevo. Como cualquier
  reinicio, se pierde el gasto acumulado de cada PR (`spentUsd`).
- **Volver atrás** es desplegar la versión anterior, por la misma razón.
