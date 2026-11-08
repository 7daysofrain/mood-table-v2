# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-126` parte de
> `MOO-125` ya integrada (usa sus esquemas y el mensaje `7`), y `MOO-127` parte de `MOO-126`
> (necesita la ruta y el mensaje `7` saliendo del motor). Cada paso es un commit con `Refs MOO-n` de
> su tarea, y la PR lleva `Fixes MOO-n`. Un paso marcado **(test en rojo)** deja a propósito tests
> que fallan, y el siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
>
> **En el commit del change, en la rama de la historia** (no en una tarea), lo que decidió el
> refinamiento de `MOO-97`:
>
> - `docs/PRD.md` §8: *Intensidad* (`intensity`) entra en el glosario con la definición de la
>   historia; *Control* deja de ser solo «un parámetro» (también el fader de la intensidad), y
>   *Mando* suma «cambiar la intensidad» a sus órdenes. Q7 no cambia.
> - `docs/idea-mood-table.md` §10: **D99**, que matiza D49 (la sensibilidad no llega con H2: la de
>   cada efecto sigue en Q2, y H2 cierra con *energía* sin parámetros), con la nota en D49 que apunta
>   a ella, sin borrarla.
> - README: §1.4, el paso 4 de la demo pública deja *Sensibilidad* («En **Intensidad**, baja el
>   fader: todas las tiras se apagan a la vez») · la nota del efecto *energía* en la historia de H1
>   («la sensibilidad llega con H2» pasa a apuntar a Q2) · la fila de H2 en §5 (`MOO-97`, «intensidad
>   de todas las tiras»).
>
> El `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).

## 1. MOO-125 · shared

- [x] 1.1 **(test en rojo)** Tests de los esquemas de la intensidad en
  `packages/shared/src/commands.test.ts`, con `Value.Check`: el cuerpo acepta `{ "intensity": 0 }`,
  `{ "intensity": 1 }` y `{ "intensity": 0.4 }`, y rechaza `1.5`, `-0.1`, `"alta"`, `{}` y
  `{ "intensity": 0.5, "strip": "demo" }`; la respuesta acepta el mismo ejemplo (decisión 4).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 1.2 `SetIntensityBodySchema` y el esquema de la respuesta en
  `packages/shared/src/commands.ts`, cerrados y con `minimum: 0` y `maximum: 1`, exportados desde el
  punto de entrada del paquete con sus tipos.
  Verificar: los tests de 1.1 pasan y `pnpm typecheck` en verde.
- [x] 1.3 **(test en rojo)** Tests del mensaje `7` en `packages/shared/src/viewer-protocol.test.ts`:
  codificar 0,5 da los bytes del ejemplo de `design.md` (decisión 5); 0,4 y 0,07 vuelven exactos al
  decodificar; se rechaza un mensaje que no mide 9 bytes, uno con `NaN` y uno fuera de 0..1; el
  mensaje se reconoce por su tipo junto a los demás.
  Verificar: los tests nuevos fallan porque el mensaje `7` no existe.
- [x] 1.4 El mensaje `7` en `packages/shared/src/viewer-protocol.ts` (codificar y decodificar, en
  coma flotante de 64 bits, big-endian) y su sección en `docs/instructions/viewer-protocol.md`: la
  tabla de bytes y el ejemplo, cuándo se envía (al conectarse, después del `6`, y en cada cambio, a
  todos los paneles), la lista de lo que viaja por la conexión, las reglas de rechazo y el origen
  (change `instrument-intensity`, decisión 5).
  Verificar: los tests de 1.3 pasan, el documento describe exactamente lo que hace el código, y
  `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.5 `prompts.md`: la entrada del refinamiento, la estimación, la exploración y la propuesta de
  `MOO-97` (la redefinición de la historia, la capa de transformaciones descartada y las tres
  decisiones del panel), y la de esta tarea.
  Verificar: sigue el formato de `docs/instructions/course.md` §5.

## 2. MOO-126 · engine

- [x] 2.1 **(test en rojo)** Tests de `applyIntensity` en `packages/engine/src/core/intensity.test.ts`:
  a 1, el frame no cambia; a 0,5, `255, 169, 87` pasa a `128, 85, 44` (redondeado, no truncado); a 0,
  todos los canales a 0; con varios LEDs, cada canal por separado (decisiones 2 y 3).
  Verificar: los tests nuevos fallan porque la función no existe.
- [ ] 2.2 `applyIntensity` en `packages/engine/src/core/intensity.ts`: escala el frame en su sitio,
  sin crear nada, y a 1 sale sin tocarlo.
  Verificar: los tests de 2.1 pasan.
- [ ] 2.3 El contrato de `Effect` en `packages/engine/src/core/effects/effect.ts` dice que un efecto
  escribe todo `out` en cada `render` y nunca lee lo que había. Con un test en `registry.test.ts`:
  para cada efecto del registro, pintar sobre un búfer lleno de `0xAB` da el mismo frame que sobre
  uno a cero, con y sin audio (decisión 2).
  Verificar: el test pasa con los cuatro efectos, y falla si se le hace leer `out` a uno de ellos.
- [ ] 2.4 **(test en rojo)** Tests del búfer de control en `packages/engine/src/core/control.test.ts`:
  arranca con la intensidad a 1; `setIntensity(0.4)` da `changed` y `intensity()` devuelve 0,4; la
  misma otra vez da `unchanged` y no avisa; `1.5`, `-0.1`, `NaN` y `"alta"` dan `invalid` y no la
  cambian; `watchIntensity` recibe un aviso por cada `changed`; un cambio de intensidad no avisa al
  `watch` de las tiras ni toca el efecto ni los valores de ninguna tira (decisiones 4 y 8).
  Verificar: los tests nuevos fallan porque `setIntensity` no existe.
- [ ] 2.5 `setIntensity` en el puerto `Commands`, con `intensity()` y `watchIntensity` en
  `ControlBuffer` (`packages/engine/src/core/control.ts`).
  Verificar: los tests de 2.4 pasan y `pnpm lint` no da errores de fronteras.
- [ ] 2.6 **(test en rojo)** Tests del bucle en `packages/engine/src/core/frame-loop.test.ts`, con
  salidas en memoria: con dos tiras y la intensidad a 0,5, cada frame vale el del efecto a la mitad,
  redondeado; las dos tiras de un pulso llevan la misma intensidad cuando cambia entre dos pulsos; a
  0, todos los LEDs apagados; a 1, el mismo frame que sin intensidad; una tira con salida `adalight`
  entrega a su salida y al visor el mismo frame a 0,5 y a 0; la respiración, tras pasar la
  intensidad de 1 a 0 y de vuelta a 1, pinta el mismo frame que si no se hubiera tocado; la salida
  del nivel recibe el mismo nivel a cualquier intensidad (`specs/intensity`, criterios de `MOO-97`).
  Verificar: los tests nuevos fallan porque el bucle no aplica la intensidad.
- [ ] 2.7 El bucle (`packages/engine/src/core/frame-loop.ts`) lee la intensidad al empezar cada pulso
  y la aplica entre el `render` y las salidas, con un comentario que fija el orden: efecto,
  intensidad, límite de potencia (H4) y salidas.
  Verificar: los tests de 2.6 pasan y los frames dorados siguen en verde.
- [ ] 2.8 **(test en rojo)** Tests de la ruta y del mensaje en
  `packages/engine/src/adapters/server.test.ts`, con `inject` y un búfer real:
  `PUT /api/intensity` responde `200` con la intensidad aplicada; `400` con `{ message }` para `1.5`,
  `"alta"`, `{}` y un campo de más, sin cambiar la intensidad; un panel que se conecta recibe el `7`
  con la intensidad actual, después del `6`; un cambio llega a dos paneles conectados; un `unchanged`
  no envía nada; `/api/openapi.json` describe la ruta con su cuerpo, el rango de 0 a 1 y las
  respuestas `200` y `400` (`specs/intensity`, decisiones 4 y 5).
  Verificar: los tests nuevos fallan porque la ruta no existe.
- [ ] 2.9 La ruta y el mensaje `7` en `packages/engine/src/adapters/server.ts`, con un
  `PanelIntensity` aparte del `PanelStrips`; su conexión en `packages/engine/src/main.ts` con el
  mismo búfer; y `docs/openapi.yaml` regenerado con `pnpm openapi`.
  Verificar: los tests de 2.8 pasan, el test del fichero del OpenAPI sigue en verde, y con
  `pnpm dev`, un `curl -X PUT` a `/api/intensity` con `{ "intensity": 0.2 }` atenúa la tira de la
  demo en el visor.
- [ ] 2.10 Documentación:
  - **D100** (decisiones 1 a 3) y **D101** (decisiones 4 y 5) en `docs/idea-mood-table.md` §10;
  - README §2.1: el plano de tiempo real pasa a efecto → intensidad → límite de potencia → salidas;
  - README §2.2: el bucle aplica la intensidad, el búfer de control la guarda, y el adaptador *API
    HTTP* suma `PUT /api/intensity`;
  - README §4: la ruta, con un ejemplo de petición y respuesta, y su `400`;
  - `prompts.md`: la entrada de esta tarea.

  Verificar: el ejemplo del README pasa contra el motor y los D# cuadran con `design.md`.

## 3. MOO-127 · panel

- [ ] 3.1 `StripRequests` pasa a ser `RequestQueue<T>` en
  `packages/panel/src/engine/request-queue.ts` y recibe cómo construir la URL de cada clave. Las
  colas de efectos y de valores siguen con la tira como clave y las mismas rutas. Sus tests se mueven
  con ella, sin cambiar lo que comprueban (decisión 9).
  Verificar: `pnpm test` en verde sin tocar ninguna aserción, y `pnpm typecheck` en verde.
- [ ] 3.2 **(test en rojo)** Tests en `packages/panel/src/engine/`, con un `fetch` y un socket
  falsos: la cola de la intensidad envía `PUT /api/intensity` con `{ "intensity": … }`; con uno en
  camino, solo se envía el último; la conexión decodifica el mensaje `7` y da la intensidad del
  motor, que vuelve a no conocerse al perder la conexión.
  Verificar: los tests nuevos fallan porque la cola y el mensaje no existen en el panel.
- [ ] 3.3 La cola de la intensidad (`intensityRequests`) y la intensidad en `EngineConnection`
  (`packages/panel/src/engine/connection.ts`).
  Verificar: los tests de 3.2 pasan.
- [ ] 3.4 **(test en rojo)** Tests de `useDraftIntensity` en
  `packages/panel/src/intensity/use-draft-intensity.test.ts`: mientras se arrastra, el valor sigue
  al dedo aunque llegue un eco atrasado (100 % → 40 % con el motor en 70 %); al soltar, sigue con su
  valor hasta que la cola se vacía y llega el eco, y entonces muestra el del motor; si el motor no
  lo aplica, vuelve a la intensidad que pinta; lo que envía va redondeado a dos decimales
  (`specs/intensity`, decisiones 7 y 9).
  Verificar: los tests nuevos fallan porque el hook no existe.
- [ ] 3.5 El hook `useDraftIntensity` en `packages/panel/src/intensity/use-draft-intensity.ts`.
  Verificar: los tests de 3.4 pasan.
- [ ] 3.6 **(test en rojo)** Tests de la zona y del panel (`IntensityZone.test.tsx`, `App.test.tsx` y
  los de `PanelLayout`), con la conexión y la cola falsas:
  - el panel tiene seis zonas, se encuentran por su nombre («Intensidad» incluida) y la intensidad
    es la última en el orden de lectura;
  - la zona muestra un fader vertical y «100 %» o «40 %», según la intensidad de la conexión;
  - mover el fader envía la intensidad;
  - seleccionar otra tira no cambia lo que muestra;
  - sin conexión, o antes del primer mensaje `7`, solo muestra su título, y sin motor se ven las seis
    zonas vacías (`specs/intensity`, `specs/panel-layout`).

  Verificar: los tests nuevos fallan porque la zona no existe.
- [ ] 3.7 La zona en `packages/panel/src/intensity/IntensityZone.tsx`, con el `Slider` vertical de
  Mantine, paso 0,01 y la etiqueta en porcentaje; sus textos en `literals.ts`; y su sitio en
  `PanelLayout.tsx`, en un `AppShell.Aside` de unos 100 px, después de `AppShell.Main` (decisiones 6
  y 7).
  Verificar: los tests de 3.6 pasan, y con `pnpm dev`, el fader atenúa la tira de la demo en el visor.
- [ ] 3.8 E2E del caso feliz en `e2e/intensity.spec.ts`, con un motor propio, el fichero de golpes y
  dos tiras, una con la respiración y otra con *energía*:
  - el panel se abre con «100 %»;
  - al arrastrar el fader, el visor pinta el cambio en las dos tiras en menos de 100 ms desde cada
    movimiento, con el método de `e2e/controls.spec.ts` y el panel ya usado (D98);
  - abajo del todo, todos los puntos del visor se apagan;
  - el vúmetro sigue moviéndose;
  - al recargar el panel, la zona muestra la intensidad que dejó el DJ.

  `e2e/panel.spec.ts` pasa a esperar seis zonas (`specs/intensity`, `specs/panel-layout`, criterios
  de `MOO-97`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [ ] 3.9 Documentación:
  - **D102** (decisiones 6 y 7) en `docs/idea-mood-table.md` §10;
  - README §1.3: la zona *Intensidad* (qué hace, que no depende de la tira seleccionada y que sin
    conexión queda vacía, como las demás), y el recorrido de H2 suma la intensidad;
  - `prompts.md`: la entrada de esta tarea.

  Verificar: lo que describe el README coincide con lo que muestra el panel.
- [ ] 3.10 Comprobación a mano en la mesa, con música y la tira física, que confirma el DJ:
  - el fader atenúa a la vez la mesa y el visor, y abajo del todo se apaga todo;
  - por debajo del 10 %, si se ve el cambio de tono y desde qué porcentaje la mesa ya no se distingue
    de apagada (el tope del 25 % del sketch, D46).

  Se anota en la PR. No es documentación hasta que el DJ lo confirme.
  Verificar: el DJ da el visto bueno en la PR.

## Workflow follow-up

- Tras integrar `MOO-127`, `openspec archive instrument-intensity` en una rama
  `…-archivar-change`, con la lista de tareas hijas de `MOO-97` revisada en Linear antes.
- Si en la mesa molesta el cambio de tono a baja intensidad (3.10), una historia aparte para todos
  los efectos (un mínimo por canal o *dithering* temporal).
- Con el límite de potencia (H4), volver a mirar si la intensidad y el límite merecen una interfaz
  común (`design.md`, decisión 1).
