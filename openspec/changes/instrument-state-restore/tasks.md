# Tasks

> Una tarea de Linear, una sección y una PR contra `main`, en este orden: `MOO-26`, `MOO-129` y
> `MOO-130`. Cada paso es un commit con `Refs MOO-n` de su tarea, y la PR lleva `Fixes MOO-n`. El paso
> marcado **(test en rojo)** deja a propósito tests que fallan, y el siguiente los pone en verde.
> Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
> `pnpm test:e2e` en verde. Los cambios del PRD (glosario y Q9), de la ficha (D103 y D104) y de
> `docs/umbrales-para-specs.md` (E6) van en el commit del change, en la rama de la historia.

## 1. MOO-26 · db

- [x] 1.1 Comprobación previa: un test de Vitest que abre una base `node:sqlite` en un fichero
  temporal, crea una tabla en una transacción y la lee (en Vitest 5, en el CI y en la Pi con
  `node --test` o un script de una línea). `engines` de `package.json` sube a `>=24.15`.
  Verificar: el test pasa en local y en el CI, y en la Pi `node -e` abre `node:sqlite` sin flag ni
  aviso (design.md, decisión 1 y riesgo de Vitest).
- [x] 1.2 **(test en rojo)** El campo `instrumentState` en
  `packages/shared/src/config.test.ts`: sin el campo, SQLite en `data/instrument-state.db` resuelto
  desde la raíz; `sqlite` con ruta relativa y absoluta; `memory`; un `type` que no existe, un `path`
  vacío y un campo de más no arrancan, con el mensaje que nombra el campo
  (`specs/engine-config`, *El fichero dice dónde se guarda el estado del instrumento*).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 1.3 El esquema de `instrumentState` en `packages/shared/src/config.ts` y la resolución de su
  ruta en `packages/engine/src/adapters/config-file.ts`, como la del audio. `data/` en `.gitignore`.
  Verificar: los tests de 1.2 pasan.
- [x] 1.4 El puerto `StateStore` y los tipos del estado del instrumento en
  `packages/engine/src/core/state-store.ts`, y el adaptador en memoria en
  `packages/engine/src/adapters/memory-state-store.ts`, con los tests de contrato del puerto
  (guardar y leer devuelve lo mismo; guardar no borra las tiras que no van en la foto) escritos para
  correr contra cualquier adaptador (design.md, decisión 8).
  Verificar: los tests de contrato pasan con el adaptador en memoria y `pnpm lint` no da errores de
  fronteras.
- [x] 1.5 **(test en rojo)** Tests del adaptador SQLite en
  `packages/engine/src/adapters/sqlite-state-store.test.ts`, con ficheros temporales: los de
  contrato de 1.4; las restricciones del esquema (un efecto activo sin sus valores se rechaza);
  las migraciones (se aplican una vez y quedan en la tabla de control); y los cuatro casos de
  apertura de design.md, decisión 4 (sin fichero, dañado, sin permiso, de una versión más nueva),
  con lo que dice cada uno al log.
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 1.6 El adaptador SQLite en `packages/engine/src/adapters/sqlite-state-store.ts`: apertura con
  WAL, `synchronous = FULL` y `foreign_keys = ON`, creación de la carpeta, migración 1
  (`strip_state` y `strip_effects`, sin `schema_version`) y `save` en una transacción con *upsert*.
  Verificar: los tests de 1.5 pasan, y `sqlite3 data/instrument-state.db '.schema'` muestra las dos
  tablas y la de control.
- [x] 1.7 La raíz de composición (`packages/engine/src/main.ts`) elige el adaptador según
  `instrumentState` y lo abre al arrancar, antes que el búfer de control; todavía no restaura ni
  guarda. `e2e/config.json` y los ficheros que genera `e2e/engine.ts` declaran `memory`.
  Verificar: `pnpm dev` crea `data/instrument-state.db`; con la carpeta en solo lectura, el motor
  arranca y lo dice en el log; `pnpm test:e2e` en verde y sin ficheros nuevos en `data/`.
- [x] 1.8 Documentación: README §3 (el modelo sin `schema_version`, con la razón de D104; la tabla de
  control de migraciones; los casos de apertura; `node:sqlite`; la incoherencia de la demo, que va en
  memoria), §1.4 (dónde queda el estado y el campo `instrumentState`) y §2.5 (la demo declara
  `memory`). `prompts.md`: la entrada de la exploración y la propuesta del change, y la de esta tarea.
  Verificar: lo que describe el README coincide con el esquema que crea la migración, y `prompts.md`
  sigue el formato de `docs/instructions/course.md` §5.

## 2. MOO-129 · engine

- [x] 2.1 **(test en rojo)** Tests de la restauración en `packages/engine/src/core/restore.test.ts`,
  con dos tiras y un efecto de prueba con parámetros: sin estado, el efecto del fichero con valores
  por defecto; con estado, el efecto activo y los valores de cada efecto guardados; tira nueva, tira
  que vuelve a declararse, tira con otro nombre, LEDs o salida, y tira con otro `id`; efecto
  guardado reactivo sin fuente de audio (con su aviso); valores con un campo de menos, uno de más o
  uno fuera de rango; efecto activo que ya no existe (`specs/instrument-state`, requisitos de
  conciliación, del efecto del fichero y de los valores que ya no encajan).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 2.2 La restauración en `packages/engine/src/core/restore.ts`, función pura (design.md,
  decisiones 5 y 6).
  Verificar: los tests de 2.1 pasan.
- [x] 2.3 **(test en rojo)** Tests del búfer en `packages/engine/src/core/control.test.ts`: arranca
  desde un estado dado (efecto activo y valores de cada efecto, también de los no activos, y el
  primer `render` ya los lleva) y su foto del estado devuelve lo que tiene, también tras
  `setEffect` y `setValues`. Los tests de arranque desde el fichero siguen igual.
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 2.4 `createControl` acepta el estado inicial y da su foto (`packages/engine/src/core/control.ts`).
  Verificar: los tests de 2.3 pasan, y los del bucle y del servidor siguen en verde.
- [x] 2.5 La raíz de composición carga el estado del adaptador, lo restaura con las tiras del
  fichero, escribe los avisos en el log y crea el búfer con él.
  Verificar: con un `data/instrument-state.db` preparado a mano con `sqlite3` (la respiración en azul
  y otra tira que el fichero ya no declara), `pnpm dev` arranca con la tira respirando en azul, y la
  fila de la otra tira sigue en la base.
- [x] 2.6 Documentación: README §2.2 (*Configuración de las tiras* y *Búfer de control*: la
  restauración, la reserva del efecto del fichero y los valores que no encajan) y §3
  (*Reconciliación al arrancar*: ya no escribe nada al arrancar; lo hace el primer guardado). `prompts.md`: la
  entrada de esta tarea.
  Verificar: lo que describe el README coincide con lo que hace el motor.

## 3. MOO-130 · engine

- [x] 3.1 **(test en rojo)** Tests del guardador en `packages/engine/src/core/state-saver.test.ts`,
  con un reloj falso y el adaptador en memoria: un cambio suelto se guarda a los 500 ms y no antes;
  cambios seguidos, uno cada 100 ms, solo se guardan 500 ms después del último; cada guardado lleva
  el estado entero; un guardado de más de 10 ms deja una línea en el log con lo que ha tardado, y uno
  más rápido, ninguna (`specs/instrument-state`, *El estado se guarda cuando el DJ deja de tocar* y
  *Una escritura lenta queda en el log*).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 3.2 El guardador en `packages/engine/src/core/state-saver.ts`, con el temporizador y el reloj
  inyectados (design.md, decisiones 2 y 3), y su montaje en la raíz de composición sobre `watch()`.
  Verificar: los tests de 3.1 pasan; con `pnpm dev`, cambiar el color en el panel y esperar 1 s deja
  ese color en `SELECT * FROM strip_effects;`.
- [x] 3.3 E2E de arranque tras corte en `e2e/` (nuevo `restart.spec.ts`), con un motor propio con
  `instrumentState` en una ruta temporal: el DJ pone la respiración en azul con otro periodo en una
  tira y la energía en otra; pasado 1 s, el motor se mata con `SIGKILL` y se vuelve a arrancar; el
  panel muestra los dos efectos y esos valores, y el visor pinta la respiración en azul. Otro caso:
  el DJ arrastra el periodo y el motor se mata antes de soltar; al volver, el periodo es el de antes
  (`specs/instrument-state`, *Tras reiniciar…* y *El estado se guarda cuando el DJ deja de tocar*).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [ ] 3.4 Documentación: README §2.2 (el guardado con su retardo, que ya no es «pequeño» sino de
  500 ms, y el log de las escrituras lentas), §2.4 (servicio `systemd` + estado guardado) y §2.6 (el
  E2E de arranque tras corte). `prompts.md`: la entrada de esta tarea.
  Verificar: lo que describe el README coincide con lo que hace el motor.

## Workflow follow-up

- Probar en la mesa, tras integrar las tres PR: cambiar efecto y valores, desenchufar la Pi, volver a
  enchufarla y arrancar el motor a mano (el arranque solo es `MOO-131`). Es una comprobación del DJ,
  no un paso del change.
- `/opsx:verify` y `/opsx:archive` tras integrar la última PR, en una rama `…-archivar-change`
  (`workflow.md` §4.5).
