# Tasks

> Dos tareas de Linear, dos secciones y dos PR contra `main`. `MOO-84` parte de `MOO-83` ya integrada,
> porque completa su grafo y su driver (`design.md` decisión 9). Cada paso es un commit con
> `Refs MOO-n` de su tarea, y la PR lleva `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan
> a propósito tests que fallan, y el paso siguiente los pone en verde. Antes de dar una sección por
> terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El
> `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).
>
> **Antes de empezar `MOO-83`**, el usuario prepara a mano la app OAuth de Linear, el PAT de GitHub y
> el issue buzón (`design.md`, *Migration Plan*).

## 1. MOO-83 · infra

- [x] 1.1 Paquete `packages/pr-babysitter` (`@moodtable/pr-babysitter`, privado, `type: module`) con
  `package.json`, `tsconfig.json` (extiende `tsconfig.node.json`), `src/main.ts` vacío y el script
  `dev` (`node src/main.ts`). `@langchain/langgraph`, `zod`, `octokit` y `@linear/sdk` en el catalog
  de `pnpm-workspace.yaml`, con versiones de al menos un día (`minimumReleaseAge`). `src/main.ts` del
  paquete, fuera de la cobertura en `vitest.config.ts` y en `sonar-project.properties`, igual en los
  dos (`design.md` decisión 5).
  Verificar: `pnpm install`, `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.2 **(test en rojo)** Casos de fronteras en `tooling/boundaries.test.ts`: el paquete que
  importa de `shared` da error; el motor que importa del paquete da error (`specs/module-boundaries`).
  Los casos del núcleo y de la raíz de composición van en 1.10: la regla ignora un import relativo a
  un fichero que no existe, y hasta 1.11 no hay ningún adaptador (decidido con el usuario, 25-oct).
  Verificar: los casos nuevos fallan porque la regla no conoce el paquete.
- [x] 1.3 Elementos `pb-core`, `pb-adapter` y `pb-main` y sus reglas en `eslint.config.js`. El
  `tsconfig.json` del paquete ya entra en la lista de proyectos del lint (`./packages/*/tsconfig.json`).
  Verificar: los casos de 1.2 pasan y `pnpm lint` no da ningún error.
- [x] 1.4 **(test en rojo)** Tests del núcleo en `packages/pr-babysitter/src/core/`: qué PR se sigue
  (del mantenedor, contra `main` y no borrador; ni de otra persona, ni contra otra rama, ni borrador) y
  el aviso de dominio de seguimiento (número, título y URL de la PR) (`specs/pr-tracking`, decisiones
  2 y 9).
  Verificar: los tests nuevos fallan porque las funciones no existen.
- [x] 1.5 El modelo de la foto de una PR, el aviso de dominio, el puerto `Notifier`, el puerto de
  lectura de GitHub y la regla de qué PR se sigue, en `src/core/`, con `zod` para la foto.
  Verificar: los tests de 1.4 pasan.
- [x] 1.6 **(test en rojo)** Tests del grafo con `MemorySaver` y un `Notifier` falso: un hilo nuevo
  avisa de que sigue la PR y se queda esperando las comprobaciones; reanudarlo con fotos nuevas **no**
  repite el aviso (la trampa del nodo que se reejecuta, decisión 9).
  Verificar: los tests nuevos fallan porque el grafo no existe.
- [x] 1.7 El grafo en `src/core/graph.ts`: `StateSchema` con zod, nodos `avisarSeguimiento` y
  `esperarComprobaciones` (con `interrupt()`) y un hilo por PR (`thread_id` = número). La salida de la
  espera la completa `MOO-84`.
  Verificar: los tests de 1.6 pasan.
- [x] 1.8 **(test en rojo)** Tests del driver en `src/core/driver.test.ts`, con un puerto de GitHub y un
  `Notifier` falsos: al arrancar con PR abiertas, un aviso por cada una; un borrador no avisa, y al
  pasar a lista para revisar, sí; una PR que se cierra, se integra o vuelve a borrador deja de seguirse
  sin aviso; una lectura de GitHub que falla no cambia nada y se repite en la vuelta siguiente; un 401
  da un solo aviso al buzón; un aviso que falla en el `Notifier` se reintenta en la vuelta siguiente y
  llega (`specs/pr-tracking`, decisiones 3, 4 y 9).
  Verificar: los tests nuevos fallan porque el driver no existe.
- [x] 1.9 El driver en `src/core/driver.ts`: una vuelta lee GitHub, arranca los hilos que faltan,
  reintenta los nodos de aviso pendientes (`getState`) y reanuda los demás con `Command({ resume })`.
  La cadencia se inyecta, como el reloj del motor.
  Verificar: los tests de 1.8 pasan.
- [x] 1.10 **(test en rojo)** Tests del adaptador de GitHub en `src/adapters/github.test.ts`, con
  respuestas grabadas de la API: la lista de PR abiertas contra `main` se convierte en fotos (SHA,
  autor, borrador, título y URL); un 401 da un error de token distinto de los de red o de servidor
  (decisiones 3 y 4). Y en `tooling/boundaries.test.ts`, los casos que esperan a que exista un
  adaptador (ver 1.2): el núcleo que importa `adapters/github.ts` da error; la raíz de composición que
  importa núcleo y adaptadores, no.
  Verificar: los tests nuevos fallan porque el adaptador no existe.
- [x] 1.11 El adaptador de GitHub en `src/adapters/github.ts` con `octokit`, que recibe el token de un
  proveedor (decisión 3).
  Verificar: los tests de 1.10 pasan, también los de fronteras.
- [x] 1.12 **(test en rojo)** Tests de `LinearNotifier` en `src/adapters/linear.test.ts`, con
  respuestas grabadas: pide el token con `client_credentials` y lo renueva antes de que caduque y tras
  un 401; encuentra la tarea con `attachmentsForURL` y publica un comentario que menciona al
  mantenedor y lleva número, título y URL de la PR; sin tarea, publica en el buzón; si Linear falla,
  lanza un error en vez de tragárselo (decisiones 1, 2 y 4).
  Verificar: los tests nuevos fallan porque el adaptador no existe.
- [x] 1.13 `LinearNotifier` en `src/adapters/linear.ts` con `@linear/sdk`.
  Verificar: los tests de 1.12 pasan.
- [x] 1.14 La raíz de composición en `src/main.ts`: lee y valida la configuración del entorno con zod
  (token de GitHub, *client id* y *secret* de Linear, usuario de Linear del mantenedor, login de GitHub
  del mantenedor, ID del buzón, cadencia), monta adaptadores, grafo y driver, y arranca. Con
  `packages/pr-babysitter/.env.example`, `Dockerfile` (`pnpm deploy --filter`, Node 24) y
  `compose.yaml` (`env_file`, `restart: unless-stopped`, sin puertos) (decisión 10). `.env` en el
  `.gitignore`.
  Verificar: `docker compose build` termina sin errores y, con un `.env` sin valores, el proceso sale
  diciendo qué variable falta.
- [x] 1.15 Documentación: D70 (canal Linear y destino de los avisos), D71 (credenciales), D72 (paquete
  y zod) y D73 (grafo, que matiza D65) en `docs/idea-mood-table.md` §10; la sección del PR Babysitter
  en `docs/instructions/linear.md`; en `docs/pr-babysitter.md`, BQ1 resuelta y dos preguntas nuevas
  (reflejar en Linear el estado de la PR; push sin merge en BH3); la cadencia del polling, con su
  cálculo, en `docs/umbrales-para-specs.md`; README §2.2 (componentes), §2.4 (despliegue) y §2.5
  (tokens); `prompts.md`.
  Verificar: los números de D# y las referencias cuadran con `design.md`.
- [x] 1.16 Prueba a mano con el contenedor en marcha y las credenciales reales: una PR en borrador no
  avisa; al marcarla lista, su tarea de Linear recibe el aviso del PR Babysitter (no del mantenedor) y
  la notificación llega al móvil; al reiniciar el contenedor, el aviso se repite; una PR sin tarea
  avisa en el buzón; en GitHub no hay nada escrito por el sistema.
  Verificar: el resultado se anota en la PR. Si la mención no notifica, se para y se habla (riesgo de
  `design.md`).

## 2. MOO-84 · infra

- [x] 2.1 **(test en rojo)** Tests del adaptador de GitHub con respuestas grabadas: las comprobaciones
  exigidas salen del *ruleset* de `main`; cada una lleva si ha terminado y si pasa (`success`,
  `neutral` y `skipped` pasan); una exigida sin *check run* no ha terminado (`specs/pr-tracking`,
  decisión 6).
  Verificar: los tests nuevos fallan porque la foto no lleva comprobaciones.
- [x] 2.2 Las comprobaciones en la foto, en `src/adapters/github.ts`.
  Verificar: los tests de 2.1 pasan.
- [x] 2.3 **(test en rojo)** Tests del adaptador del revisor en `src/adapters/codex-review.test.ts`,
  con los comentarios reales de #57-#68 como fixtures: `completed` sobre el último SHA, sin y con
  hallazgos (`has_any_findings`); `running`; `completed` sobre un SHA anterior; sin bloque; JSON que
  no pasa zod; un comentario de otra cuenta con un bloque falso, que se ignora (decisión 7).
  Verificar: los tests nuevos fallan porque el adaptador no existe.
- [x] 2.4 El adaptador del revisor en `src/adapters/codex-review.ts` (cuenta del revisor en la
  configuración) y el estado del revisor en la foto.
  Verificar: los tests de 2.3 pasan.
- [x] 2.5 **(test en rojo)** Tests de las reglas puras en `src/core/`: comprobaciones terminadas; estado
  final «lista para integrar» y los dos «necesita intervención» con su motivo; tiempo agotado a los
  30 min desde la primera foto con ese SHA, para comprobaciones y para revisión, con qué no terminó;
  un SHA nuevo reinicia el seguimiento y el tiempo; el mismo resultado con o sin comentarios de otras
  cuentas (`specs/pr-tracking`, decisiones 6, 7 y 8).
  Verificar: los tests nuevos fallan porque las reglas no existen.
- [ ] 2.6 Las reglas en `src/core/` y el tiempo de espera en la configuración (30 min por defecto).
  Verificar: los tests de 2.5 pasan.
- [ ] 2.7 **(test en rojo)** Tests del grafo y del driver para el ciclo completo, con `Notifier` falso:
  la secuencia de avisos de cada escenario de `specs/pr-tracking`; un push nuevo mientras la sigue no
  avisa y los avisos siguientes son de ese push; un push nuevo tras el estado final vuelve a avisar de
  que la sigue.
  Verificar: los tests nuevos fallan porque el grafo se queda esperando las comprobaciones.
- [ ] 2.8 Los nodos `avisarComprobaciones`, `esperarRevisor` y `avisarEstadoFinal` y sus aristas en
  `src/core/graph.ts`, y en el driver, la nueva ejecución de un hilo terminado cuando cambia el SHA.
  Verificar: los tests de 2.7 pasan y los de `MOO-83` siguen en verde.
- [ ] 2.9 Documentación: el tiempo de espera, con la medición de #57-#68, en
  `docs/umbrales-para-specs.md`; los términos nuevos (*necesita intervención*, *issue buzón*) en el
  glosario de `docs/pr-babysitter.md` §8; README §2.2 si cambia; `prompts.md`.
  Verificar: los términos que usan los avisos están en el glosario.
- [ ] 2.10 Prueba a mano con el contenedor en marcha: una PR que pasa todo y que Codex revisa sin
  hallazgos acaba en «lista para integrar»; una con una comprobación que falla, en «necesita
  intervención» con su nombre; con el tiempo de espera bajado a pocos minutos en el `.env`, una PR que
  Codex no revisa acaba por tiempo; un push nuevo a media espera no avisa.
  Verificar: el resultado se anota en la PR.
