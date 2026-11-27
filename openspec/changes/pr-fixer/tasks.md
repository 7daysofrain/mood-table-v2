# Tasks

> **Organización:**
> - Tres tareas de Linear, cada una con su sección y su PR contra `main`, en este orden:
>   - la 2 sube los arreglos con la identidad de la 1;
>   - la 3 pone los límites al flujo de la 2.
> - La sección 1 se implementa en la rama de la historia, que ya lleva este change. Las secciones 2 y 3
>   van cada una en una rama propia que sale de `main` después de integrar la anterior.
> - Cada paso es un commit con `Refs MOO-192`, `Refs MOO-193` o `Refs MOO-194`, y cada PR lleva
>   `Fixes` con su tarea.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de las pruebas a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin
>   integrar y sin rama.

## 1. MOO-192 · infra

- [x] 1.1 Las decisiones y el documento de la épica:
  - **`docs/idea-mood-table.md` §10:** D127 a D131 (`design.md` decisiones 1 a 5), y notas en D64, D71
    y D124 de que las matizan. D124 no se borra ni se renumera.
  - **`docs/pr-babysitter.md`:**
    - BE10 reescrita: `e2e` lo pasa la CI;
    - BQ7, resuelta con D128;
    - BQ3, que pasa a `MOO-191`;
    - BQ5, con los números asumidos de este change;
    - en el glosario, *modo ensayo* tachado y marcado como obsoleto, y *arreglador* (`fixer`) nuevo.

  Verificar: los enlaces llevan a su sitio; `pnpm lint` en verde.
- [x] 1.2 La identidad (`design.md` decisión 2):
  - **El mantenedor** crea la GitHub App del PR Babysitter con *Contents* y *Pull requests* en
    escritura y *Metadata* en lectura, la instala solo en `mood-table-v2` y guarda su clave privada.
  - **El *ruleset* nuevo sobre `main`,** «solo el mantenedor integra», con *Restrict updates* y el
    rol de administrador en modo `exempt`. Se crea por la API, con permiso del mantenedor.

  Verificar: `gh api repos/7daysofrain/mood-table-v2/rulesets` lista los dos *rulesets*, y el nuevo
  con su regla y su *bypass*.
- [x] 1.3 **(test en rojo)** Subir a la rama de una PR con la App (`src/fixer/push.test.ts`):
  - se pide el token de instalación con un JWT firmado con la clave privada (`fetch` falso);
  - el push es normal, sin forzar, a la rama de la PR, sobre un repo *bare* local;
  - si la rama ha avanzado, el push se rechaza y se informa como «la rama ha cambiado».
- [x] 1.4 `src/fixer/push.ts` y `src/fixer/github-app.ts`: el token de instalación y el push. Hacen la
  E/S de red y de git y se excluyen de la cobertura como los `*.hardware.ts`; la parte pura (el JWT,
  la URL con el token) se prueba.

  Verificar: los tests de 1.3 en verde; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.5 Documentación:
  - README §2.4 (*PR Babysitter*): la App y el *ruleset* al desplegar;
  - README §2.5 (*En el PR Babysitter*): la tercera identidad, sus permisos y lo que no puede hacer;
  - `.env.example` del *fixer* (nombres sin valores);
  - `prompts.md`: la entrada de la historia (refinamiento, exploración, verificación de BQ7).
- [x] 1.6 **Prueba a mano** (sin commit), con un script de un solo uso que usa `src/fixer/push.ts`:
  - en una PR de prueba, la App sube un commit a su rama;
  - la CI se lanza sobre ese push;
  - la App intenta integrarla por la API, y GitHub responde 405;
  - el mantenedor la puede integrar con el botón (sin hacerlo: se cierra sin integrar).

  Verificar: los cuatro puntos, con los enlaces en la descripción de la PR de la tarea.

## 2. MOO-193 · infra

- [x] 2.1 **(test en rojo)** `decide()` elige arreglar (`core/decision.test.ts`, `design.md`
  decisión 11):
  - `fix` en la ronda final con un hallazgo *real* arreglable;
  - `publish` sin hallazgos reales, con solo una relanzable que ha fallado dos veces, sin tope de
    gasto o con `FIX_ENABLED=false`, cada uno con su regla (tabla de la decisión 11).
- [x] 2.2 La acción `fix` y sus reglas en `core/decision.ts`.

  Verificar: los tests de 2.1 y los que ya había en verde.
- [x] 2.3 **(test en rojo)** El arreglo en el grafo (`core/graph.test.ts`, un `describe` por requisito
  de `pr-fix` y por cada requisito cambiado de `pr-tracking` y `pr-triage`, con un `Fixer` falso):
  - un hallazgo real: `decidir` da `fix`, se publica el resumen, `pedirArreglo` pide un trabajo con
    ese hallazgo y su contexto, y el hilo espera en `esperarArreglo` sin avisar;
  - el arreglo subido: el hilo termina sin aviso del estado final; el push nuevo lo vuelve a empezar
    el *driver*;
  - un hallazgo que no se sube: `avisarArreglo` con el hallazgo y su motivo;
  - un real y uno que exige criterio: se pide el real y se avisa del otro;
  - una relanzable que ha fallado dos veces: no se pide, se avisa;
  - el trabajo `failed`: aviso del estado final «necesita intervención» con el motivo;
  - pedir dos veces el mismo push no crea dos trabajos;
  - con un push viejo o una PR detenida, el *driver* se salta `pedirArreglo` (`core/driver.test.ts`).
- [x] 2.4 El puerto `Fixer` (`core/ports.ts`), los tipos del arreglo (`core/fix.ts`), los nodos
  `pedirArreglo`, `esperarArreglo` y `avisarArreglo` (`core/graph.ts`), el *fixer* y sus opciones a
  través del *driver* (`core/driver.ts`) y los avisos nuevos (`core/notice.ts`, `core/tracking.ts`).
  Al implementar (`design.md` decisión 3): el estado del trabajo lo pregunta `esperarArreglo`, no va en
  la foto, y el *fixer* es opcional, así que `src/studio.ts` no cambia.

  Verificar: los tests de 2.3 en verde; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] 2.5 **(test en rojo)** El servicio *fixer* (`src/fixer/*.test.ts`, con un agente falso y un repo
  *bare* local):
  - `POST /jobs` encola un trabajo, y repetirlo con la misma PR y el mismo SHA no crea otro;
    `GET /jobs/:pr/:sha` da su estado; los cuerpos se validan con zod;
  - un trabajo a la vez, en orden de llegada;
  - por cada hallazgo, en el orden de la decisión 6: el agente, luego `lint`, `typecheck` y `test`, y
    un commit con su *trailer* `Babysitter-Fix`. Si no pasan, se deshacen sus cambios, queda en
    `unfixed` con el motivo y se sigue con el siguiente;
  - un solo push al final; sin ningún commit, no hay push;
  - el coste de cada `query()` se guarda, y `status` da lo gastado por la PR;
  - el trabajo se corta al pasar del tope que queda.
- [ ] 2.6 El servicio en `src/fixer/`:
  - la cola en `node:sqlite`;
  - las rutas HTTP;
  - el bucle del trabajo;
  - las comprobaciones con `pnpm`;
  - el agente con el Claude Agent SDK, en un adaptador fino (`src/fixer/agent.ts`) con un falso en los
    tests: `cwd`, `settingSources: ["project"]`, `allowedTools` limitado, tope de turnos y Sonnet por
    defecto;
  - la raíz de composición `src/fixer/main.ts`.

  Las fronteras: `src/core` no importa nada de `src/fixer/`, y el lint lo comprueba
  (`specs/module-boundaries`).

  Verificar: los tests de 2.5 en verde; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] 2.7 El cableado:
  - **el cliente HTTP del puerto,** `adapters/fixer-client.ts`, con su test contra un servidor falso;
  - **`main.ts`,** que lo conecta;
  - **la configuración:** `FIX_ENABLED`, `FIX_BUDGET_USD`, `FIXER_URL` y el modelo, con valor por
    defecto;
  - **el despliegue:** el servicio `fixer` en `compose.yaml` (sin puertos al *host*, con su volumen y
    su `.env`), y su *target* en el `Dockerfile`.

  Verificar: `docker compose build` y `docker compose up -d` levantan los dos servicios, y el
  babysitter llega al *fixer* por la red interna. `pnpm lint`, `pnpm typecheck` y `pnpm test` en
  verde.
- [ ] 2.8 Documentación:
  - README §2.2 (*PR Babysitter*): el *fixer*, el puerto y el camino nuevo del grafo, con el diagrama;
  - README §2.4: el servicio `fixer`, su `.env` y la clave de Anthropic;
  - README §2.5: qué sale hacia Anthropic y qué secretos ve el *fixer*;
  - `packages/pr-babysitter/README.md`: el arreglador ya funciona;
  - `docs/umbrales-para-specs.md`: el tope de 2 $ *(asumido)*;
  - `prompts.md`, si la sección 1 dejó algo por contar.
- [ ] 2.9 **Prueba a mano** (sin commit), con el sistema en marcha:
  - una PR de prueba con un error de `lint` y un comentario de Codex que se arregla en una línea;
  - una con un hallazgo real y otro que exige criterio;
  - la PR de Dependabot que esté abierta.

  Verificar:
  - en la primera, un push del sistema con dos commits, cada uno con su *trailer*, a nombre de la App;
    la CI se lanza; no hay aviso del estado final del primer push, y sí del push del arreglo;
  - en la segunda, el arreglo del real y un aviso con el que exige criterio;
  - en la de Dependabot, ningún commit del sistema (no la sigue);
  - en LangSmith, el camino de nodos de cada hilo (`decidir` → `publicarResumen` → `pedirArreglo` →
    `esperarArreglo`), la decisión con su regla y la foto que lo decidió;
  - en el log del *fixer*, el coste de cada trabajo, para el tope y el de turnos.

  Los enlaces y los costes, en la descripción de la PR de la tarea.

## 3. MOO-194 · infra

- [ ] 3.1 **(test en rojo)** Las vueltas (`design.md` decisión 7):
  - **`core/decision.test.ts`:** `publish` con N push de la App desde el último commit ajeno, y con la
    misma comprobación en los *trailers* de los dos últimos push de la App y fallando otra vez; `fix`
    tras un push del mantenedor;
  - **`adapters/fix-rounds.test.ts`:** de una lista de commits (fixture), cuántos push de la App hay
    desde el último commit ajeno y qué comprobaciones arreglaron los dos últimos.
- [ ] 3.2 El puerto `FixRounds` (`core/ports.ts`), su adaptador con el PAT (`adapters/fix-rounds.ts`),
  las reglas en `decide()` y `FIX_MAX_ROUNDS` en la configuración.

  Verificar: los tests de 3.1 en verde; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] 3.3 **(test en rojo)** La PR que cambia y el reinicio (`src/fixer/*.test.ts`, decisiones 6 y 9):
  - antes del push, con la PR cerrada, con la etiqueta `babysitter:stop` o con la cabeza en otro SHA,
    no se sube nada y el trabajo acaba como obsoleto;
  - al arrancar, un trabajo `running` en su primer intento se vuelve a empezar, y en el segundo queda
    `interrupted`;
  - con la cabeza cambiada, queda obsoleto sin reintentar;
  - en `core/graph.test.ts`: `interrupted` da el aviso del estado final con el motivo, y obsoleto
    termina sin aviso.
- [ ] 3.4 La comprobación antes del push y el arranque del *fixer* (`src/fixer/`).

  Verificar: los tests de 3.3 en verde; `pnpm lint`, `pnpm typecheck` y `pnpm test` en verde.
- [ ] 3.5 Documentación: `docs/umbrales-para-specs.md` (N = 3, *asumido*), README §2.2 (los límites)
  y `prompts.md`.
- [ ] 3.6 **Prueba a mano** (sin commit), con el sistema en marcha:
  - con `FIX_MAX_ROUNDS=1`, una PR de prueba cuyo arreglo deja otro hallazgo real: tras el primer
    arreglo, aviso con el motivo de las vueltas;
  - un push del mantenedor mientras el *fixer* arregla: no se sube nada, y el push se sigue;
  - la etiqueta `babysitter:stop` mientras arregla: no se sube nada;
  - `docker compose restart fixer` a mitad de un trabajo: se reintenta y se sube, sin aviso.

  Verificar: los cuatro puntos y, en LangSmith, el camino de nodos y la decisión con su regla de cada
  hilo. Los enlaces, en la descripción de la PR de la tarea.

## Workflow follow-up

- Con la última PR integrada: `/opsx:verify` y `/opsx:archive`, en una rama `…-archivar-change` que
  sale de `main`, con `Refs MOO-77`.
- Antes de archivar, comprobar en Linear que `MOO-192`, `MOO-193` y `MOO-194` están en *Done*.
- Reconstruir el contenedor desde `main` tras cada PR integrada (*dogfooding*).
