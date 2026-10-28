# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-102` parte de
> `MOO-101` ya integrada (usa sus esquemas y el codec del tipo `6`), y `MOO-103` parte de `MOO-102`
> (necesita la ruta y el mensaje). Cada paso es un commit con `Refs MOO-n` de su tarea, y la PR lleva
> `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso
> siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`,
> `pnpm test` y `pnpm test:e2e` en verde. Los cambios del PRD (Q3, E3 y Q8) van en el commit del change,
> en la rama de la historia. El `openspec archive` va tras integrar la última PR, en una rama
> `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-101 · shared

- [x] 1.1 **(test en rojo)** Tests del tipo `6` en `packages/shared/src/viewer-protocol.test.ts`:
  `encodeStrips` da el byte `6` seguido del JSON en UTF-8 del ejemplo de `design.md` (decisión 3), y
  `decodeStrips` lo devuelve igual, también con nombres con acentos. `decodeStrips` rechaza otro tipo,
  un JSON roto y uno que no cumple el esquema (sin `effect`, un efecto que no está en el catálogo, un
  campo que el esquema no declara, `ledCount` no entero).
  Verificar: los tests nuevos fallan porque el tipo `6` no existe; el resto sigue en verde.
- [x] 1.2 El tipo `6` en `packages/shared/src/viewer-protocol.ts` (`STRIPS_MESSAGE_TYPE`,
  `StripsMessageSchema` con `StripStateSchema` para cada tira, `encodeStrips` y `decodeStrips`, que
  valida con el esquema), exportado en `index.ts`. Su sección en `docs/instructions/viewer-protocol.md`,
  con su ejemplo, que es el primer mensaje JSON del protocolo, cuándo se envía (al conectarse y a todos
  en cada cambio) y que la posición en la lista es el índice de la tira en los frames.
  Verificar: los tests de 1.1 pasan y el documento describe exactamente lo que hace el código.
- [x] 1.3 **(test en rojo)** Tests de la regla de la fuente de audio en
  `packages/shared/src/effects.test.ts`: `breathing` no necesita fuente y `energy` sí, y la respuesta
  sale de `usesAudio` del catálogo para todos sus efectos (decisión 5).
  Verificar: los tests nuevos fallan porque la función no existe.
- [x] 1.4 La función en `packages/shared/src/effects.ts`, exportada, y `parseConfig` la usa en lugar
  de su propia comprobación.
  Verificar: los tests de 1.3 pasan y los de `config.test.ts` (tira reactiva sin fuente) siguen en
  verde sin cambiarlos.
- [x] 1.5 Los esquemas de la ruta en `packages/shared/src/commands.ts`, exportados: el cuerpo
  (`SetEffectBodySchema`, `{ effect }` con el id del catálogo y sin campos de más), la respuesta (la
  tira, con `StripStateSchema`) y el error (`ApiErrorSchema`, `{ message }`), con tests de
  `Value.Check` que aceptan el ejemplo de `design.md` (decisión 6) y rechazan un efecto que no existe y
  un cuerpo con campos de más.
  Verificar: `pnpm test` y `pnpm typecheck` en verde.
- [x] 1.6 `prompts.md`: la entrada de la exploración y la propuesta del change (las decisiones de
  `design.md` y cómo se llegó a ellas) y la de esta tarea.
  Verificar: sigue el formato de `docs/instructions/course.md` §5.

## 2. MOO-102 · engine

- [x] 2.1 `@fastify/swagger` y `@fastify/type-provider-typebox` (6.x) en el catálogo de
  `pnpm-workspace.yaml` y en `packages/engine/package.json` con `"catalog:"`, en las versiones
  publicadas hace más de la antigüedad mínima de pnpm.
  Verificar: `pnpm install` y `pnpm typecheck` en verde.
- [x] 2.2 **(test en rojo)** Tests del búfer de control en `packages/engine/src/core/control.test.ts`,
  con las tiras y el registro de efectos a mano: `setEffect` da `changed` y cambia el efecto activo;
  el efecto que ya está activo da `unchanged`, no crea ranura ni avisa; una tira que no existe da
  `unknown-strip`; un reactivo sin fuente da `needs-audio-source` y no toca la tira; quien se suscribe
  recibe un aviso por cada `changed` y ninguno por los demás; dos `setEffect` seguidos dejan la ranura
  del último (`specs/instrument-control`, decisión 1).
  Verificar: los tests nuevos fallan porque el búfer no existe.
- [x] 2.3 El búfer en `packages/engine/src/core/control.ts`: el puerto `Commands`, la creación con las
  tiras, el registro y si hay fuente, la ranura de cada tira (memoria y parámetros por defecto creados
  en `setEffect`), el efecto activo de cada tira y la suscripción.
  Verificar: los tests de 2.2 pasan y `pnpm lint` no da errores de fronteras.
- [x] 2.4 **(test en rojo)** Tests del bucle en `packages/engine/src/core/frame-loop.test.ts` (y
  `energy-golpes.test.ts` para el fichero de golpes): un cambio entra entero en el pulso siguiente;
  los frames de la otra tira salen idénticos a los de una ejecución sin el cambio; elegir el efecto
  activo deja los frames idénticos; con fuente y todas las tiras con respiración, una tira que pasa a
  energía reacciona a los golpes y, pasados 2 s, se apaga en el silencio; sin fuente, `ctx.audio` es
  `null` (`specs/effects`, decisiones 1 y 4).
  Verificar: los tests nuevos fallan porque el bucle no lee el búfer; los frames dorados siguen en
  verde.
- [x] 2.5 `createFrameLoop` recibe el búfer y lee la ranura de cada tira al empezar el pulso, y analiza
  el audio en cada pulso si hay fuente (desaparece `needsBands`). `startEngine` en `engine.ts` recibe
  el búfer. Los comentarios de cabecera dejan de decir que el análisis se omite.
  Verificar: los tests de 2.4 y todos los del motor pasan, frames dorados incluidos.
- [x] 2.6 **(test en rojo)** Tests de la ruta en `packages/engine/src/adapters/server.test.ts`, con
  `inject` y un búfer real: `PUT /api/strips/{stripId}/effect` responde `200` con la tira y su efecto,
  también si ya lo tenía; `404` con la tira en el mensaje; `400` con `{ message }` para un efecto que
  no existe y para un cuerpo mal formado; `409` sin fuente, con el mensaje de la decisión 5;
  `/api/openapi.json` describe la ruta con su cuerpo y las respuestas `200`, `400`, `404` y `409`
  (`specs/instrument-control`, decisión 6).
  Verificar: los tests nuevos fallan porque la ruta no existe.
- [x] 2.7 La ruta y el OpenAPI en `packages/engine/src/adapters/server.ts`: `buildServer` (plugins,
  type provider, swagger, la ruta con los esquemas de `shared` y los errores con `{ message }`) y
  `startServer`, que lo usa y escucha; el servidor recibe `Commands`.
  Verificar: los tests de 2.6 pasan y los del servidor que ya había siguen en verde.
- [x] 2.8 **(test en rojo)** Tests del mensaje de las tiras en `server.test.ts`: un panel que se
  conecta recibe el tipo `6` después de la fuente (y del estado de la tarjeta, si lo hay); un cambio
  llega a todos los paneles conectados; el mensaje lleva solo id, nombre, nº de LEDs, salida y efecto
  (decisiones 2 y 3).
  Verificar: los tests nuevos fallan porque el servidor no envía el tipo `6`.
- [x] 2.9 El tipo `6` en el servidor (lo envía al conectarse y lo difunde con cada aviso), la foto de
  las tiras (`stripsMessage` en `engine.ts`, junto a `sourceMessage`) y la unión en `main.ts`: crea el
  búfer con la configuración, se lo da al servidor y al motor, y conecta su aviso con el servidor.
  Verificar: los tests de 2.8 pasan, `pnpm lint` no da errores de fronteras y, con `pnpm dev`, un
  `curl -X PUT …/api/strips/<id>/effect` cambia la tira en el visor.
- [x] 2.10 **(test en rojo)** Test en `packages/engine/src/openapi.test.ts`: el OpenAPI que genera el
  código, en YAML, es igual a `docs/openapi.yaml`; si no, el mensaje dice que se ejecute
  `pnpm openapi`.
  Verificar: el test falla porque el fichero no existe.
- [x] 2.11 `pnpm openapi` (en la raíz y en `@moodtable/engine`) monta la app con `buildServer`, sin
  escuchar, y escribe `docs/openapi.yaml`; se genera y se commitea.
  Verificar: el test de 2.10 pasa, y al cambiar a mano un esquema de la ruta vuelve a fallar.
- [ ] 2.12 Documentación: D77-D82 en `docs/idea-mood-table.md` §10, según `design.md`, con el inciso
  de D28 sobre omitir el análisis tachado y apuntando a D79. README §2.1 (diagrama y *El motor funciona
  sin audio*), §2.2 (*Análisis de audio*, *Búfer de control*, adaptadores *API HTTP* y *Visor*) y §4
  (la ruta con un ejemplo de petición y respuesta, enlaces a `docs/openapi.yaml` y al protocolo del
  visor). `prompts.md`.
  Verificar: los D# y los enlaces cuadran con `design.md` y el ejemplo del README pasa contra el motor.

## 3. MOO-103 · panel

- [ ] 3.1 **(test en rojo)** Tests de la conexión en `packages/panel/src/engine/connection.test.ts`:
  guarda las tiras que llegan por el tipo `6` y avisa al cambiar; un mensaje `6` que no cumple el
  esquema no cambia nada; las olvida al perder la conexión (decisión 8).
  Verificar: los tests nuevos fallan porque la conexión no decodifica el tipo `6`.
- [ ] 3.2 Las tiras en `packages/panel/src/engine/connection.ts` y en `PanelConnection`.
  Verificar: los tests de 3.1 pasan.
- [ ] 3.3 **(test en rojo)** Tests del envío de cambios en
  `packages/panel/src/engine/effect-requests.test.ts`, con un `fetch` falso: un cambio envía
  `PUT /api/strips/{stripId}/effect` con su cuerpo; con uno en camino, los siguientes esperan y solo se
  envía el último, y no se envía si coincide con el último enviado; un error de red o una respuesta de
  error no bloquea el siguiente (decisión 7).
  Verificar: los tests nuevos fallan porque el módulo no existe.
- [ ] 3.4 El envío de cambios en `packages/panel/src/engine/effect-requests.ts`, y `/api` en el proxy de
  `packages/panel/vite.config.ts`.
  Verificar: los tests de 3.3 pasan.
- [ ] 3.5 **(test en rojo)** Tests de las zonas (`packages/panel/src/strips/` y `effects/`, y
  `App.test.tsx` para la unión), con la conexión falsa: Tiras lista nombre, nº de LEDs y salida de
  cada tira y selecciona la primera; seleccionar otra cambia lo que muestra Efectos; Efectos etiqueta
  cada efecto como reactivo o de ambiente y marca el activo que dice la conexión, no el pulsado;
  `pointerdown` envía el cambio y Enter o Espacio también, una sola vez; sin fuente de audio, energía
  está desactivado con «Necesita una fuente de audio»; sin conexión las dos zonas solo tienen su
  título, y al volver la selección sigue por su `id`; sin indicadores de espera
  (`specs/instrument-control`, decisiones 5, 7, 8 y 9).
  Verificar: los tests nuevos fallan porque las zonas están vacías.
- [ ] 3.6 Las zonas: el módulo de literales (con los nombres de los efectos como
  `Record<EffectId, string>` y la salida), las listas de Tiras y Efectos con componentes de Mantine,
  la selección por `id` en `App.tsx` y el hueco de cada zona en `PanelLayout.tsx`.
  Verificar: los tests de 3.5 pasan, los de `PanelLayout` y `panel-layout` siguen en verde, y con
  `pnpm dev` se cambia el efecto de la tira de la demo desde el panel.
- [ ] 3.7 E2E del caso feliz en `e2e/effects.spec.ts`, con un motor propio (fichero de golpes y una
  tira con energía): la zona Tiras muestra la tira con su nombre, LEDs y salida, seleccionada; energía
  está marcado; al pulsar respiración, el visor pinta la tira de un solo color en menos de 100 ms desde
  el `pointerdown` y respiración queda marcado; al recargar el panel, respiración sigue marcado
  (`specs/instrument-control`, criterios de `MOO-94`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [ ] 3.8 README §1.3 (las zonas Tiras y Efectos, con una captura si cambia la de la sección) y
  `prompts.md`. Comprobación a mano con la demo: el calentamiento de energía al elegirla en marcha
  (decisión 4), anotado en la PR.
  Verificar: lo que describe el README coincide con lo que muestra el panel.
