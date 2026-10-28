# Tasks

> Dos tareas de Linear, una sección y una PR contra `main` cada una, en este orden: la sección 2 usa el
> reloj de la revisión (`reviewSince`) que añade la 1. Cada paso es un commit con `Refs MOO-90` o
> `Refs MOO-91`, y cada PR lleva `Fixes` con su tarea. Los pasos marcados **(test en rojo)** dejan a
> propósito tests que fallan, y el paso siguiente los pone en verde. Antes de dar una sección por
> terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El `openspec
> archive` va tras integrar la segunda PR, en una rama `…-archivar-change` (`workflow.md` §4.5), y
> después del de `pr-stop`.
>
> **Antes de la prueba a mano de la sección 1 (1.12)**, el mantenedor da al PAT *Issues* y *Pull
> requests* en escritura (`design.md`, *Migration Plan*). **Con las dos integradas**, apaga la
> *Automatic review* de Codex (D68).

## 1. MOO-90 · infra

- [x] 1.1 **Prueba a mano** (sin commit) del texto de la petición (`design.md` decisión 1 y riesgo
  de la firma): en una PR de sparring del mantenedor, escribir con su cuenta el comentario exacto de
  la decisión 1, con el SHA del último push.
  Verificar: el revisor revisa ese push como con un `@codex review` solo (su bloque pasa a `running`
  y luego a `completed` con ese SHA) y su respuesta no trata la firma como instrucciones. Si la trata,
  probar la firma antes de la mención o solo la marca, y fijar el texto ganador en la decisión 1 con
  un commit de `design.md`. La PR de sparring, cerrada sin integrar y sin rama.
- [x] 1.2 `docs/pr-babysitter.md`:
  - §6.1, BA7: se cumple solo para cuentas vinculadas a Codex; una GitHub App no puede (comprobado
    el 27-oct en la #77);
  - §5.2, Visión: un revisor propio en local (p. ej. con Ollama), que quitaría la dependencia de BA7;
    choca con §5.3 y §6.2 y se valoraría tras BH2, con su medición.

  Verificar: el diff del commit son solo esos dos puntos.
- [x] 1.3 `.gitignore`: `.local/`, para las credenciales locales del mantenedor.
  Verificar: `git check-ignore -v .local/x` señala `.gitignore`.
- [x] 1.4 **(test en rojo)** Las reglas (`design.md` decisiones 3 y 5) en `core/tracking.test.ts`:
  - con todas las comprobaciones pasadas, `afterChecksWait` fija `reviewSince` a la hora de la foto;
    con alguna fallida, no lo fija;
  - la regla de si hay que pedir la revisión: sí con todas pasadas, el revisor sin bloque del último
    push y `reviewRequested` falso; no si alguna falla, si el bloque del revisor apunta al último push
    (en `running` o `completed`) o si `reviewRequested` es cierto;
  - `afterReviewWait` cuenta el tiempo de espera desde `reviewSince`: comprobaciones que tardan 20 min
    y revisión que termina 20 min después no dan `timedOut`; 30 min desde `reviewSince` sí. Sin
    `reviewSince`, desde `seenAt`, como hoy.
- [x] 1.5 Las reglas en `core/tracking.ts`, `reviewSince` en `TrackedPush` y en el estado del grafo,
  y `reviewRequested` en la foto (`core/pull-request.ts`), con las fotos que construyen a mano los
  tests y `src/studio.ts` en `reviewRequested: false`.
  Verificar: los tests de 1.4 en verde; `pnpm typecheck` en verde.
- [x] 1.6 **(test en rojo)** Los adaptadores (`design.md` decisiones 2, 3 y 6):
  - `test/fixtures/github/comments-77.json`: los comentarios de la #77 (la petición de la App, la
    respuesta de Codex, la del mantenedor y su revisión), más uno con la marca escrito por otra
    cuenta y otro del mantenedor con la marca de otro SHA;
  - `adapters/codex-review.test.ts`: la petición empieza por `@codex review`, lleva la firma con el
    SHA corto y la marca con el completo; `requested` es cierto solo con la marca del SHA pedido en
    un comentario del mantenedor;
  - `adapters/github.test.ts`: `createComment` publica en `issues/{n}/comments`; un 401 lanza
    `GitHubUnauthorizedError`; un 403 o un 422 lanzan el error de petición rechazada; un 5xx, un
    error cualquiera.
- [x] 1.7 El puerto `ReviewRequests` y el error de petición rechazada en `core/ports.ts`,
  `createComment` en `adapters/github.ts` y el adaptador de la petición en
  `adapters/codex-review.ts`.
  Verificar: los tests de 1.6 en verde, y los que ya había de los dos adaptadores.
- [ ] 1.8 **(test en rojo)** El grafo y el driver, un `describe` por requisito de `specs/pr-tracking`
  que toca esta sección:
  - `core/graph.test.ts`: con las comprobaciones pasadas, avisa de que han terminado, pide la
    revisión una vez y espera al revisor; con el bloque del revisor en el último push o
    `reviewRequested`, espera sin pedirla; con alguna fallida, no la pide; si la petición se rechaza,
    no lanza y espera, y a los 30 min avisa «la revisión no ha terminado»; si falla por la red, el
    nodo queda pendiente y se reintenta;
  - `core/driver.test.ts`: la foto lleva `reviewRequested`; un borrador que pasa a lista con las
    comprobaciones en verde pide la revisión; un driver nuevo (un reinicio) con la marca del último
    push en GitHub no la vuelve a pedir; una PR detenida no la pide (si `pr-stop` ya está en
    `main`).
- [ ] 1.9 El nodo `pedirRevision` y su arista en `core/graph.ts`, `reviewRequests` en el driver y en
  `snapshotOf`, el montaje en `src/main.ts` y uno de mentira en `src/studio.ts`.
  Verificar: los tests de 1.8 y todos los que ya había en verde; `pnpm lint`, `pnpm typecheck` y
  `pnpm test` en verde; el grafo se abre en LangGraph Studio con el nodo nuevo.
- [ ] 1.10 Configuración: en `.env.example` y en el comentario de `githubToken` de
  `adapters/config.ts`, el PAT con *Issues* y *Pull requests* en escritura y sin *Contents*, y que
  `GITHUB_MAINTAINER` es su dueño.
  Verificar: los tests de la configuración en verde.
- [ ] 1.11 Documentación:
  - README §2.2 (*PR Babysitter*): el puerto `ReviewRequests`, su adaptador y el nodo
    `pedirRevision`;
  - README §2.4 (*PR Babysitter*): pararlo ya no es «no escribe en GitHub», sino que una petición
    repetida la evita la marca;
  - README §2.5 (*En el PR Babysitter*): los permisos nuevos del PAT, que comenta solo para pedir la
    revisión y que sigue sin poder subir commits ni integrar;
  - `docs/umbrales-para-specs.md`: los dos relojes y 660 peticiones por hora con 3 PR;
  - `docs/idea-mood-table.md` §10: D76 (la revisión la pide el sistema con el PAT del mantenedor,
    firmada y con marca; una GitHub App no vale por BA7), con su porqué y lo descartado; D71, con la
    nota de que la matiza D76;
  - `prompts.md` §6: la entrada de esta historia (refinamiento, exploración, prueba de BA7 y change),
    con el formato de `course.md` §5.

  Verificar: los enlaces del README y de las D# a `design.md` llevan a su sitio; `pnpm lint` en verde.
- [ ] 1.12 **Prueba a mano** (sin commit), con los permisos nuevos del PAT y el sistema en marcha:
  - con el PAT, intentar integrar una PR de sparring por la API (`PUT /pulls/{n}/merge`) → GitHub
    responde 403 y la PR sigue abierta;
  - una PR real del mantenedor: al pasar las comprobaciones aparece la petición firmada, el revisor
    revisa ese push y llega el aviso de estado final;
  - parar y arrancar el sistema después de la petición y antes del estado final → no aparece una
    segunda petición.

  Verificar: enlaces a la petición, a la revisión y a los avisos de Linear en la descripción de la PR.

## 2. MOO-91 · infra

- [ ] 2.1 **(test en rojo)** Las reglas (`design.md` decisión 4) en `core/tracking.test.ts`:
  - `afterChecksWait` distingue comprobaciones que pasan y que fallan;
  - sin `reviewSince`, el estado final nunca dice «la revisión no ha terminado»: con una fallida, solo
    qué falla, y además «el revisor tiene hallazgos» si el revisor ya terminó el último push con
    hallazgos; con una sin terminar a tiempo, solo qué no ha terminado;
  - con `reviewSince`, como hoy.
- [ ] 2.2 Las reglas en `core/tracking.ts`: el paso de comprobaciones fallidas y el estado final con
  el push que se sigue.
  Verificar: los tests de 2.1 en verde, y los que ya había de `tracking.ts`, adaptados al paso nuevo.
- [ ] 2.3 **(test en rojo)** El grafo, en `core/graph.test.ts`, un `describe` por requisito de
  `specs/pr-tracking` que toca esta sección: con una comprobación fallida, el único aviso es el de
  estado final («necesita intervención» y qué falla), sin el de comprobaciones terminadas y sin
  petición de revisión; con una comprobación sin terminar a los 30 min, el aviso no dice que la
  revisión no ha terminado; si el aviso de fallo se reintenta con la foto de un push anterior, el
  hilo termina y el push nuevo vuelve a empezar el seguimiento.
- [ ] 2.4 La arista de comprobaciones fallidas a `avisarEstadoFinal` en `core/graph.ts` y el estado
  final con el push que se sigue.
  Verificar: los tests de 2.3 y todos los del grafo y del driver en verde; `pnpm lint`,
  `pnpm typecheck` y `pnpm test` en verde.
- [ ] 2.5 Documentación: README §2.2 (*PR Babysitter*, el grafo), la salida directa al estado final
  cuando falla una comprobación; `prompts.md` §6, lo que añada esta tarea a la entrada de la historia.
  Verificar: `pnpm lint` en verde.
- [ ] 2.6 **Prueba a mano** (sin commit): una PR de sparring del mantenedor con una comprobación que
  falla → en Linear, solo el aviso de estado final con qué falla, y en la PR, ninguna petición de
  revisión del sistema.
  Verificar: enlace al aviso de Linear en la descripción de la PR; la PR de sparring, cerrada sin
  integrar y sin rama.
