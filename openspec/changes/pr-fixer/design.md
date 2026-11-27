# Design

> Decisiones tomadas al refinar `MOO-77` y al explorar el change con el usuario (27-nov). El usuario
> eligió en persona la 1 (la rama de la PR), la 2 (una identidad propia, verificada ese día en un repo
> de prueba), la 3 (el arreglo en el contenedor, sin bloquear, detrás de un puerto), la 4 (HTTP
> interno), la 5 (el Claude Agent SDK y sin `e2e` antes del push), los números de la 7 y la 8, y la 9
> (reintentar solo, para evitar ruido). Las demás se tomaron en la exploración como las evidentes.
> Las decisiones 2 y 6 son de `MOO-192`; la 1, la 3 a la 5, la 8 y de la 10 a la 12, de `MOO-193`; la
> 7 y la 9, de `MOO-194`.

## Context

- **El seguimiento** es un hilo de LangGraph por PR que el *driver* despierta cada 60 s con una foto de
  GitHub (D73). El *driver* recorre las PR **una tras otra** y espera a que cada hilo se pare: un nodo
  que tardara minutos pararía a todas las PR.
- **El triaje final** acaba en `decidir` (D122), que hoy solo elige `publish`: publicar el resumen y
  avisar del estado final.

  ```
  hoy:
  ... --> reunirTriaje --> decidir --(publish)--> publicarResumen --> avisarEstadoFinal --> END
  ```

- **El estado del hilo** vive en un `MemorySaver` (hasta BE7): se pierde al reiniciar. GitHub es la
  fuente de verdad (D66, D73).
- **Las identidades de hoy:** el PAT del mantenedor (sin *Contents: write*, D83, D117) y la app de
  Linear, que solo lee y comenta (D70). Ninguna puede subir commits.
- **El *ruleset* «ramas de integración»** protege `main`: PR obligatoria, comprobaciones exigidas e
  hilos resueltos, sin nadie en la lista de *bypass*.
- **La CI** pasa `lint`, `typecheck`, `test`, `e2e`, SonarQube y `sonar-issues` en cada push a una PR.

## Goals / Non-Goals

**Goals:**

- Que el arreglo de un push no pare el seguimiento de las demás PR.
- Que dónde y con qué se arregla sea una pieza que se cambia sin tocar el núcleo.
- Que el agente que arregla no vea ninguna credencial del babysitter, y que nada del sistema pueda
  integrar.
- Que las vueltas y el gasto se acoten sin estado propio que se pierda al reiniciar.

**Non-Goals:**

- Contestar o resolver hilos (`MOO-78`) y escalar (`MOO-79`).
- Persistir el estado del grafo (BE7, `MOO-85`).
- Trazar el bucle del agente en LangSmith.

## Decisions

### 1. El arreglo va a la rama de la PR, sin modo ensayo (D127, matiza D124)

D124 dejó que el sistema arreglara primero en modo ensayo: el arreglo en una rama aparte que el
mantenedor revisa antes. Al refinar `MOO-77` el mantenedor lo descartó. El modo ensayo no aporta nada
por sí solo: el merge ya es la puerta humana (BE2), y el mantenedor revisa la PR entera, commits del
sistema incluidos, antes de integrarla.

- **A favor:** el arreglo llega a la PR sin un paso de más, y la PR avanza sola hacia *lista para
  integrar*.
- **En contra:** un arreglo malo entra en la PR. Lo frenan las comprobaciones antes del push
  (decisión 5), la CI y la revisión de Codex del push nuevo, el límite de vueltas (decisión 7) y, al
  final, el merge humano.
- **Descartado:** una rama aparte con una PR pequeña contra la de la tarea. Necesitaba también BQ7 y
  añadía un merge más por arreglo.

El término *modo ensayo* del glosario de PB se tacha y se marca obsoleto.

### 2. Una GitHub App propia sube los commits, y un *ruleset* aparte solo deja integrar al mantenedor (D128, resuelve BQ7, matiza D64 y D71)

Subir commits necesita *Contents: write*, y en GitHub ese mismo permiso deja integrar por la API (BQ7).
Se separa con dos piezas:

- **Una GitHub App del PR Babysitter**, instalada solo en `mood-table-v2`, con *Contents* y *Pull
  requests* en escritura y *Metadata* en lectura. El *fixer* pide con su clave privada un token de
  instalación (dura 1 h) para cada trabajo. Sus commits salen a nombre de la App (BE4), y su push sí
  lanza la CI: un push hecho con el `GITHUB_TOKEN` de Actions no la lanza.
- **Un *ruleset* nuevo sobre `main`**, aparte de «ramas de integración», con una sola regla, *Restrict
  updates*. En su lista de *bypass* está el rol de administrador en modo `exempt`.

Verificado el 27-nov en un repo público de prueba de la misma cuenta, con el bot de Actions (una App
con *Contents: write* fuera de la lista) como actor:

| Prueba | Resultado |
|---|---|
| La App sube a la rama de la PR | Pasa |
| La App integra la PR por la API | 405 «Repository rule violations… Cannot update this protected ref» |
| La App sube directo a `main` | GH013 |
| El mantenedor integra, exento | Pasa, con el botón normal |
| El mantenedor, con *bypass* `pull_request` | Pasa, pero obliga a marcar «bypass» en cada merge |
| El *bypass* de un *ruleset* con una comprobación exigida de otro pendiente | Rechazado: no se salta las comprobaciones del otro |

Va en un *ruleset* aparte porque estar exento de uno no exime de los demás. Así, el mantenedor sigue
pasando por «ramas de integración», que no tiene *bypass*.

- **El PAT del mantenedor no cambia:** sigue sin *Contents: write* y sigue pidiendo la revisión, porque
  Codex solo atiende a una cuenta vinculada (BA7, D83).
- **Descartados:**
  - darle *Contents: write* al PAT: incumple BE2 tal como está escrita;
  - el *bypass* `pull_request`: obliga a marcar «bypass» en cada merge;
  - la protección de rama clásica con *Restrict who can push*: solo existe en organizaciones.

### 3. `decidir` elige arreglar, y el grafo pide el arreglo por un puerto y lo espera (D129)

```
... reunirTriaje --> decidir --(publish)--> publicarResumen --> avisarEstadoFinal --> END
                        |
                        +--(fix)--> publicarResumen --> avisarSinArreglo? --> pedirArreglo --> esperarArreglo
                                                                                                   |
                                     +--(subido: el push nuevo lo recoge el driver)----------------+--> END
                                     +--(no subido, fallido o interrumpido dos veces)--------------+--> avisarEstadoFinal
```

- **`decide()`** gana la acción `fix` en la ronda final, con sus reglas (decisión 11). Si no hay nada
  que arreglar, o no se puede, sigue en `publish`, y el motivo va al aviso.
- **`pedirArreglo`** es un nodo de acción, como `relanzar`: pide el arreglo al puerto `Fixer` y no
  espera. Pedirlo dos veces para el mismo push no crea dos trabajos (la clave es la PR y su SHA). Está
  en `PR_ACTION_NODES`, así que el *driver* se lo salta con un push viejo o una PR detenida, como hoy.
- **`esperarArreglo`** se para con `interrupt()`, como las esperas de comprobaciones y revisión. El
  *driver* reanuda el hilo cada vuelta con una foto que trae el estado del trabajo (`Fixer.status`).
  Esperar al arreglo es el mismo mecanismo que esperar a la CI: nada se bloquea.
- **Arreglo subido:** el hilo termina sin avisar del estado final de ese push (decisión 10). El push
  nuevo lo recoge el *driver* en la vuelta siguiente y vuelve a empezar el seguimiento, como cualquier
  push.
- **El puerto, en `core/ports.ts`:**

  ```ts
  interface Fixer {
    /** Pide arreglar los hallazgos reales de un push. Idempotente por (pr, sha). */
    request(job: FixJob): Promise<void>;
    /** En qué está el trabajo de ese push, y cuánto lleva gastado la PR. */
    status(pr: number, sha: string): Promise<FixStatus>;
  }
  // FixStatus: none | queued | running | pushed { sha, fixed[], unfixed[] }
  //            | failed { reason, unfixed[] } | interrupted ; más spentUsd de la PR
  ```

  `FixJob` lleva lo que necesita el agente y nada más: el repo, la rama, el SHA, el título y la
  descripción de la PR (su alcance) y los hallazgos reales con su contexto (el texto del revisor y su
  trozo de diff, el contexto de la comprobación, la incidencia con su código).
- **Descartados:**
  - **un nodo que arregla dentro del grafo:** pararía el *driver* minutos, y el trabajo se perdería al
    reiniciar;
  - **lanzar el arreglo en GitHub Actions:** el usuario prefiere no depender de Actions para ejecutar
    el arreglo. Queda como un adaptador posible del mismo puerto.

### 4. El *fixer* es un servicio aparte del compose, y se habla con él por HTTP interno (D129)

```
  pr-babysitter                            fixer (mismo compose, otra imagen)
  +--------------------+  POST /jobs       +-----------------------------------+
  | adapters/          | ----------------> | cola en SQLite (volumen propio)   |
  |  fixer-client.ts   |  GET /jobs/:pr/:sha| un trabajo a la vez               |
  |  (puerto Fixer)    | <---------------- | por trabajo: clon -> agente x N   |
  +--------------------+                   |  -> commits -> push con la App    |
                                           +-----------------------------------+
```

- **Contrato:** dos rutas, validadas con zod en los dos lados. Escucha solo en la red interna del
  compose: no publica puertos al *host*, y el babysitter sigue sin abrir nada hacia fuera.
- **Estado del trabajo** en un SQLite propio (`node:sqlite`, como el motor, D103), en un volumen. Si el
  babysitter se reinicia, el trabajo sigue y su estado se sigue pudiendo consultar.
- **Un trabajo a la vez.** La máquina de casa no da para dos agentes con `pnpm install` y tests a la
  vez, y las PR abiertas a la vez son pocas.
- **Secretos del *fixer*:** solo la clave de la API de Anthropic y la clave privada de la App. No ve el
  PAT, ni la app de Linear, ni Ollama, ni LangSmith.
- **Código:** en `src/fixer/` del mismo paquete, con su raíz de composición (`src/fixer/main.ts`) y la
  misma regla de fronteras: `src/core` no lo importa. La imagen es otro *target* del mismo
  `Dockerfile`, con `git` y lo que pida el SDK.
- **Descartados:**
  - **una cola en un volumen compartido:** acopla los dos contenedores a un fichero y a su esquema;
  - **el arreglo en el mismo proceso:** el agente con Bash vería todos los secretos del `.env`, y un
    reinicio lo cortaría;
  - **lanzar un contenedor por trabajo desde el babysitter:** necesita montar el *socket* de Docker,
    que equivale a ser root en la máquina.

### 5. El agente es el Claude Agent SDK, y pasa `lint`, `typecheck` y `test` en su bucle; `e2e` lo pasa la CI (D130, matiza BE10)

- **Un `query()` por hallazgo**, con:
  - `cwd` en el clon de la PR;
  - `settingSources: ["project"]`, para que cargue `CLAUDE.md` y, a través de él, `AGENTS.md`;
  - `allowedTools` limitado a leer, buscar, editar y un Bash restringido a `pnpm lint`, `pnpm
    typecheck` y `pnpm test`;
  - un tope de turnos;
  - Sonnet por defecto, configurable.

  El mensaje final trae `total_cost_usd` (decisión 8).
- **El agente no hace commit ni push.** Al acabar cada hallazgo, el *fixer* (código determinista)
  comprueba que `lint`, `typecheck` y `test` pasan, y solo entonces hace el commit de ese hallazgo. Si
  no pasan, deshace los cambios de ese hallazgo y sigue con el siguiente.
- **Sin `e2e` antes del push.** Necesitaría Chromium y Playwright en la imagen (cientos de MB) y varios
  minutos por trabajo. Los hallazgos de Codex y de SonarQube casi nunca tocan lo que mira el `e2e`, y
  la CI lo pasa igual tras el push. Si un arreglo lo rompe, llega en rojo y el triaje del push nuevo lo
  trata como cualquier fallo, con el límite de vueltas. BE10 se reescribe para decirlo.
- **Clave de la API, no la suscripción:** el SDK no permite el inicio de sesión de claude.ai en
  productos propios sin aprobación previa.
- **Descartados:**
  - **Deep Agents:** trazas nativas en LangSmith, pero un agente de código más genérico y menos probado;
  - **`claude -p`:** el mismo motor con menos control;
  - **Codex CLI:** revisaría y arreglaría el mismo tipo de modelo.

### 6. Un trabajo por push, un commit por hallazgo y un solo push

El *fixer* arregla todos los hallazgos reales del push en orden: comprobaciones deterministas primero,
luego incidencias de SonarQube y luego hilos del revisor. Hace un commit por hallazgo y los sube en un
solo push. Así se lanza una sola vuelta de CI y de revisión.

- **El mensaje de cada commit** sigue la convención del repo y cita el hallazgo en un *trailer*:
  `Babysitter-Fix: check:typecheck`, `Babysitter-Fix: sonar:<clave>` o `Babysitter-Fix:
  thread:<id>`. Lo lee la decisión 7.
- **Antes del push**, el *fixer* lee con el token de la App que la PR sigue abierta, sin la etiqueta
  `babysitter:stop`, y con la cabeza en el SHA del trabajo. Si no, no sube nada.
- **El push es normal, sin forzar:** si la rama ha avanzado en el último segundo, GitHub lo rechaza y no
  se pisa nada.

### 7. Las vueltas se cuentan desde GitHub: N = 3 y la misma comprobación dos veces (`MOO-194`)

Sin estado propio: antes de pedir un arreglo, el sistema lee los commits de la rama de la PR (puerto
`FixRounds`, con el PAT, que lee). Lo que cuenta:

- **Vueltas:** los push de la App desde el último commit que no es suyo. Con N = 3 *(asumido,
  configurable: `FIX_MAX_ROUNDS`)* no se pide otro arreglo. Un push del mantenedor pone la cuenta a
  cero.
- **La misma comprobación dos veces:** si los dos últimos push de la App llevan un *trailer*
  `check:<nombre>` y esa comprobación vuelve a fallar en el último push, no se arregla. Fallar al
  relanzarla no cuenta: una relanzable que falla dos veces no se arregla nunca (decisión 11).

Sobrevive a los reinicios (BE7) sin persistir nada. N = 3 lo fijó el usuario al explorar, como valor
de partida que se mide en la prueba a mano (`docs/umbrales-para-specs.md`).

### 8. Tope de 2 $ por PR, que lleva el *fixer*

- **El *fixer* guarda en su SQLite el coste de cada trabajo** (`total_cost_usd` de cada `query()`) y
  devuelve en `status` lo que lleva gastado la PR.
- **`decide()` no pide un arreglo** si lo gastado llega al tope: 2 $ *(asumido, configurable:
  `FIX_BUDGET_USD`)*.
- **Dentro de un trabajo**, el *fixer* corta en cuanto se pasa, con lo que quede del tope. El hallazgo
  en curso no se sube, y el trabajo acaba como `failed` con el motivo.
- **Es aparte del tope del triaje** (0,05 $, D90), que paga otro proveedor con otro saldo.
- **Por qué 2 $:** no está para ahorrar, sino para frenar lo anómalo. Se mide en la prueba a mano, como
  se hizo con el tope del triaje.

### 9. Un trabajo interrumpido se reintenta una vez (`MOO-194`)

Al arrancar, el *fixer* busca en su SQLite los trabajos que estaban `running`:

- **Si es su primer intento y la cabeza de la PR sigue en su SHA,** lo vuelve a empezar desde cero, con
  un clon limpio.
- **Si la cabeza ha cambiado** (por un push suyo antes de caerse o por uno del mantenedor), lo marca
  como obsoleto.
- **Si ya es el segundo intento,** lo marca como `interrupted`, y el grafo avisa con el motivo.

El gasto del reintento cuenta contra el tope. El usuario lo eligió frente a avisar siempre, para evitar
ruido.

### 10. El push que se arregla no tiene aviso de estado final; lo que no se arregla, sí

- **Si `decidir` elige arreglar,** el sistema no avisa del estado final de ese push: daría un
  «necesita intervención» de algo que ya está arreglando. El siguiente aviso es el del push del arreglo.
- **El resumen del triaje se publica igual,** antes de pedir el arreglo, para que la PR cuente qué se
  ha visto y por qué.
- **Si hay hallazgos que no se arreglan** (exigen criterio, una relanzable que ha fallado dos veces) o
  el arreglo deja alguno sin subir, `avisarSinArreglo` manda un aviso con cada uno y su motivo.
  Reutiliza el canal de BH1 (D70) y el reintento de los avisos.
- **Si el trabajo falla entero** (vueltas, tope, interrumpido dos veces o nada subido), el aviso es el
  del estado final de siempre, «necesita intervención», con el motivo del arreglo.

### 11. Qué no se arregla, en `decide()`

`decide()` elige `fix` si queda al menos un hallazgo arreglable. Un hallazgo es arreglable si se cumple
todo esto:

- su clase es *real*;
- no es una relanzable que ha fallado dos veces. Se relanzó porque el triaje no dio que la causara la
  PR: o no la causa o no está claro, y en los dos casos se avisa sin arreglar (`MOO-166` la captura);
- la PR no es de Dependabot (`MOO-191`);
- no se han agotado las vueltas ni el tope (decisiones 7 y 8).

La regla que decide queda en el estado (`decision.rule`) y en la traza (BE4), como hoy.

### 12. Las cinco decisiones de arquitectura de un agente

| Pregunta | Respuesta en este change |
|---|---|
| Qué se reparte entre agentes y qué no | Solo el arreglo es un agente (un bucle con herramientas). El triador es una llamada a un modelo de decisión (D90); `decidir`, el *driver*, las esperas, los commits y el push son código determinista |
| Qué contexto recibe cada uno | El agente recibe un hallazgo cada vez, con su contexto, el alcance de la PR y `AGENTS.md`. No recibe tokens, ni el diff entero, ni los demás hallazgos. Con un contexto equivocado, lo frena el código: si no pasa `lint`, `typecheck` y `test` no hay commit, y después la CI, el triaje del push nuevo y el límite de vueltas |
| Dónde vive el estado y qué pasa si algo falla a mitad | El trabajo, en el SQLite del *fixer*; las vueltas, en GitHub; el hilo, en el `MemorySaver` hasta BE7. Si el *fixer* cae, reintenta una vez (decisión 9); si cae el babysitter, el trabajo sigue y el *driver* vuelve a preguntar por él |
| Qué decisiones no necesitan un LLM | Arreglar o no, las vueltas, el tope, la PR que cambia, el orden de los hallazgos, los commits y el push |
| Cuándo vuelve el control a una persona | Con un criterio explícito: los hallazgos que exigen criterio, la relanzable que falla dos veces, las vueltas, el tope, el arreglo que no pasa, la interrupción doble y las PR de Dependabot. Y siempre en el merge (BE2) |

## Risks / Trade-offs

- **[Un arreglo malo pasa `lint`, `typecheck` y `test` y entra en la PR.]** → Lo ven la CI (`e2e`,
  SonarQube), Codex en el push nuevo, el triaje y, al final, el mantenedor en el merge. El límite de
  vueltas corta los bucles.
- **[Un arreglo rompe un `e2e` y llega en rojo.]** → Es el precio de no pasar `e2e` antes. Se trata
  como cualquier fallo y cuenta como vuelta. Si pasa a menudo, la prueba a mano lo dirá, y se puede
  añadir `e2e` al *fixer* sin tocar el núcleo.
- **[El agente se sale del alcance del hallazgo.]** → Recibe un hallazgo cada vez, con el alcance de la
  PR, y Bash solo con los scripts de `pnpm`. Lo que cambie de más lo verá Codex en el push nuevo.
- **[Lo que sale hacia Anthropic.]** → El código del clon y el contexto de cada hallazgo. El repo es
  público, como ya pasa con Ollama (README §2.5). El clon no lleva `.env` ni secretos: el *fixer* no
  los pasa al agente.
- **[La clave privada de la App da escritura en el repo.]** → Solo puede subir a ramas que no son
  `main` (decisión 2). Vive en el `.env` del *fixer*, no en el del babysitter. Si se filtra, se revoca
  en los ajustes de la App.
- **[Exento del *ruleset* nuevo, el mantenedor también lo está con su PAT.]** → No es un riesgo nuevo:
  el PAT del babysitter sigue sin *Contents: write*, y «ramas de integración» se le sigue aplicando.
- **[El gasto del arreglo se mide por PR en el *fixer*, no en el hilo.]** → Así sobrevive a un
  reinicio del babysitter. Si se borra el volumen del *fixer*, la cuenta vuelve a cero: se acepta.
- **[Dos PR con hallazgos a la vez esperan en cola.]** → Un trabajo a la vez. La espera se nota poco
  frente a los minutos de la CI.

## Migration Plan

1. `MOO-192`: crear la App e instalarla en el repo (la crea el mantenedor y guarda su clave), crear el
   *ruleset* nuevo y probar desde el *fixer* que sube a una PR de prueba y no puede integrar.
2. `MOO-193`: desplegar el servicio `fixer` con `docker compose up -d` junto al babysitter. Hasta que se
   integre, `decidir` no tiene la acción `fix`, y el sistema sigue como hoy.
3. `MOO-194`: los límites.

**Vuelta atrás:** quitar la acción `fix` con la variable `FIX_ENABLED=false` (por defecto `true` tras
`MOO-193`), parar el servicio `fixer` y desinstalar la App. El *ruleset* puede quedarse.

## Open Questions

- Qué tope de turnos por hallazgo se le pone al agente. Se fija con la prueba a mano, junto con el
  coste.
- Si la imagen del *fixer* necesita el binario de Claude Code aparte o le basta el SDK. Se ve al montar
  la imagen en `MOO-193`.
