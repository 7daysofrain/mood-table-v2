# Tasks

> Dos tareas de Linear, una sección y una PR contra `main` cada una, en este orden: la sección 2
> publica la clasificación que la 1 deja en el estado del hilo. Cada paso es un commit con `Refs
> MOO-108` o `Refs MOO-109`, y cada PR lleva `Fixes` con su tarea. Los pasos marcados **(test en
> rojo)** dejan a propósito tests que fallan, y el paso siguiente los pone en verde. Antes de dar una
> sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El
> `openspec archive` va tras integrar la segunda PR, en una rama `…-archivar-change` (`workflow.md`
> §4.5).
>
> **Antes del paso 1.1**, el mantenedor crea la cuenta de Ollama con pago por uso y su clave de API
> (`design.md`, *Migration Plan*). Las PR de prueba no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
> integrar y sin rama.

## 1. MOO-108 · infra

- [x] 1.1 **Prueba a mano** (sin commit) del proveedor y de las lecturas (`design.md`, *Open
  Questions*), con un script de usar y tirar fuera del repo y hallazgos reales de la #85 y la #88:
  - una petición a Clef en `https://ollama.com/v1/systemone` con la forma de la decisión 5 (dos
    hallazgos, un `noul` por cada uno) con `@langchain/typesafe` y `baseUrl`; si falla, con `fetch`;
  - `usage.input_tokens` de esa petición frente al tamaño del `state`: ¿se cobra una vez o por
    pregunta?;
  - con el PAT del sistema, el log del *job* de una comprobación que falló (`GET
    /actions/jobs/{id}/logs`): ¿lo da sin *Actions: read*?

  Verificar: el resultado de las tres, anotado en `design.md` (decisiones 2, 3 y 6) con un commit. Si
  el cliente no funciona con Ollama, la decisión 3 dice si va `fetch` o Jev; si el log pide permiso,
  el mantenedor decide si lo da.
- [x] 1.2 `docs/pr-babysitter.md`:
  - §7, BQ2 resuelta: comentario resumen en la PR (`MOO-75`, 28-oct);
  - §8, glosario: *triaje* (la pregunta es si hay que arreglarlo en esta PR), *no aplica* (incluye los
    nits que no merecen un commit) y *exige criterio* (sale del umbral de confianza y de las reglas:
    severidad alta, sin contexto, tope de gasto);
  - §3, BE4: con un modelo de decisión, el porqué es la probabilidad frente al umbral o la regla que
    decide.

  Verificar: el diff del commit son solo esos puntos.
- [x] 1.3 **(test en rojo)** Las reglas del triaje (`design.md` decisiones 2, 4 y 6) en
  `core/triage.test.ts`:
  - la clase de cada hallazgo, una prueba por fila de la tabla de la decisión 4, con 0,80 y 0,20 en
    los bordes, y su porqué;
  - el reparto del tope: con lo que queda del gasto de la PR, entran por orden los hallazgos que caben
    y los demás salen *exige criterio*; el coste real con `usage` suma al gasto;
  - la clave de cada hallazgo: solo ASCII, como mucho 100 caracteres, distinta para dos hallazgos del
    mismo fichero y línea;
  - en `core/tracking.test.ts`, si hay que triar: sí con «necesita intervención» por una comprobación
    que falla o por hallazgos del revisor; no si está lista para integrar o si es solo por tiempo.
- [x] 1.4 Las reglas en `core/triage.ts` (el hallazgo, sus clases, el umbral, el reparto del tope y
  la clave) y la regla de si hay que triar en `core/tracking.ts`.
  Verificar: los tests de 1.3 en verde; `pnpm typecheck` en verde.
- [x] 1.5 **(test en rojo)** Los adaptadores (`design.md` decisiones 2, 3 y 5):
  - `test/fixtures/github/review-comments-85.json` y `-88.json` (comentarios de revisión en línea, con
    uno de otra cuenta añadido) y un log de un *job* que falla;
  - `adapters/findings.test.ts`: solo los comentarios de la cuenta del revisor sobre el SHA pedido,
    con la severidad de la insignia (P1 es alta), el título, el texto sin la insignia, el fichero, la
    línea y el `diff_hunk`; el final del log, cortado al máximo; sin log, el hallazgo va sin
    contexto;
  - `adapters/decision-model.test.ts`, contra respuestas grabadas en el paso 1.1: la petición (el
    `state` con `pr_author_description` y cada hallazgo por su clave, un `noul` por hallazgo con su
    identidad en las instrucciones y los criterios de la decisión 5); la probabilidad de cada uno y
    `usage`; partir la petición si no cabe; un error del proveedor lanza.
- [x] 1.6 Los puertos `Findings` y `Triager` en `core/ports.ts`, los adaptadores
  `adapters/findings.ts` y `adapters/decision-model.ts`, las lecturas nuevas de `adapters/github.ts`
  y, si funciona con Ollama, `@langchain/typesafe` en el catálogo de pnpm.
  Verificar: los tests de 1.5 en verde, y los que ya había de los adaptadores.
- [x] 1.7 **(test en rojo)** El grafo, en `core/graph.test.ts`, un `describe` por requisito de
  `specs/pr-triage` que toca esta sección, con puertos falsos:
  - una PR con hallazgos del revisor o una comprobación fallida pasa por `triar` antes del aviso
    final, y deja en el estado del hilo la clase, la probabilidad y el porqué de cada hallazgo, y el
    gasto;
  - lista para integrar, o por tiempo, va directa al aviso final;
  - un hallazgo sin contexto no llega al `Triager`; un comentario ajeno no llega nunca;
  - con el gasto acumulado cerca del tope, solo los que caben llegan al `Triager`;
  - si el `Triager` falla, los hallazgos salen *exige criterio* y el aviso final llega con el mismo
    estado y motivo; si falla GitHub al leer los hallazgos, el nodo queda pendiente y se reintenta.
- [x] 1.8 El nodo `triar` y su arista en `core/graph.ts`, los puertos en el grafo y el montaje en
  `src/main.ts` y uno falso en `src/studio.ts`.
  Verificar: los tests de 1.7 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde; el grafo se abre en LangGraph Studio con el nodo nuevo.
- [x] 1.9 Configuración: `DECISION_MODEL_BASE_URL`, `DECISION_MODEL`, `DECISION_MODEL_API_KEY`,
  `DECISION_MODEL_INPUT_PRICE_PER_MTOK`, `TRIAGE_THRESHOLD` y `TRIAGE_BUDGET_USD` en
  `adapters/config.ts` y `.env.example`, con los valores por defecto de las decisiones 3, 4 y 6 y la
  clave obligatoria.
  Verificar: los tests de la configuración en verde, con una clave que falta y un umbral fuera de
  rango.
- [x] 1.10 Documentación:
  - README §2.2 (*PR Babysitter*): el nodo `triar`, los puertos `Findings` y `Triager` y sus
    adaptadores, y que ya hay un modelo (de decisión, no un LLM);
  - README §2.4 (*PR Babysitter*): la cuenta de Ollama y las variables nuevas;
  - README §2.5 (*En el PR Babysitter*): qué sale hacia el proveedor del modelo (decisión 9);
  - `docs/umbrales-para-specs.md`: el umbral de 0,80, el tope de 0,05 $ por PR, la estimación de
    tokens y el corte del log, con su porqué y *(asumido)* hasta `MOO-76`;
  - `docs/idea-mood-table.md` §10: D90 (el modelo de decisión, Clef con Jev de plan B, detrás de un
    puerto) y D91 (el triaje en modo sombra: dónde va, *exige criterio* por umbral y reglas, y el
    resumen), con su porqué y lo descartado; D73, con la nota de que la matiza D91 (el nodo `triar`
    lee de GitHub);
  - `prompts.md` §6: la entrada de esta historia (refinamiento, estimación, exploración, las dos
    investigaciones y el change), con el formato de `course.md` §5.

  Verificar: los enlaces del README y de las D# a `design.md` llevan a su sitio; `pnpm lint` en verde.
- [x] 1.11 **Prueba a mano** (sin commit), con el sistema en marcha y la clave en su `.env`: una PR
  de prueba del mantenedor con un fallo de `lint` y otra con un hallazgo de Codex.
  Verificar, en cada una: el aviso final de Linear es el de siempre; en LangSmith, el hilo de la PR
  pasa por `triar` antes de `avisarEstadoFinal`, y su salida trae la clase, la probabilidad y el
  porqué de cada hallazgo, y el coste (anotar el camino de nodos y la foto que lo decidió); y en la
  PR no hay comentario del sistema todavía. Enlaces a los avisos y a las trazas, anotados en la
  descripción de la PR de la tarea.

## 2. MOO-109 · infra

- [ ] 2.1 **(test en rojo)** El texto del resumen (`design.md` decisión 7) en
  `core/triage-summary.test.ts`: la firma y el push con su SHA corto; una fila por hallazgo con su
  identidad, la clase en español (real, no aplica, exige criterio) y el porqué de cada regla; la
  marca oculta con el SHA completo.
- [ ] 2.2 El texto en `core/triage-summary.ts`.
  Verificar: los tests de 2.1 en verde.
- [ ] 2.3 **(test en rojo)** El adaptador del resumen en `adapters/triage-summary.test.ts`: publica
  con `createComment`; `published` es cierto solo con la marca de ese SHA en un comentario del
  mantenedor; un 403 o un 422 lanzan el error de petición rechazada, y un 5xx, un error cualquiera.
- [ ] 2.4 El puerto `TriageSummaries` en `core/ports.ts` y su adaptador en
  `adapters/triage-summary.ts`.
  Verificar: los tests de 2.3 en verde.
- [ ] 2.5 **(test en rojo)** El grafo, en `core/graph.test.ts`, un `describe` por requisito de
  `specs/pr-triage` y `specs/pr-tracking` que toca esta sección: tras `triar`, `publicarResumen`
  publica una vez y sigue al aviso final; con el resumen de ese SHA ya publicado, no lo repite; si
  GitHub lo rechaza, lo deja en el log y el aviso final llega igual; si falla por la red, el nodo queda
  pendiente y se reintenta sin volver a llamar al `Triager`; un push nuevo publica su propio resumen.
- [ ] 2.6 El nodo `publicarResumen` y su arista en `core/graph.ts`, y el montaje en `src/main.ts` y
  `src/studio.ts`.
  Verificar: los tests de 2.5 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde.
- [ ] 2.7 Documentación: README §2.2 (*PR Babysitter*), el nodo `publicarResumen` y el puerto
  `TriageSummaries`; README §2.5, que el token comenta para pedir la revisión y para el resumen;
  `prompts.md` §6, lo que añada esta tarea a la entrada de la historia.
  Verificar: `pnpm lint` en verde.
- [ ] 2.8 **Prueba a mano** (sin commit), con el sistema en marcha: una PR de prueba del mantenedor
  con un hallazgo de Codex y una comprobación que falla.
  Verificar: aparece un resumen firmado con el push y una fila por hallazgo, y después el aviso final
  de Linear; tras un push nuevo con hallazgos, un segundo resumen y el primero intacto. En LangSmith, el hilo pasa por
  `triar`, `publicarResumen` y `avisarEstadoFinal` (anotar el camino y la foto que lo decidió). Enlaces
  a los resúmenes, avisos y trazas en la descripción de la PR de la tarea.
