# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-106` parte de
> `MOO-105` ya integrada (usa sus esquemas y el mensaje `6` con valores), y `MOO-107` parte de
> `MOO-106` (necesita la ruta y los valores en el mensaje). Cada paso es un commit con `Refs MOO-n` de
> su tarea, y la PR lleva `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito
> tests que fallan, y el paso siguiente los pone en verde. Antes de dar una sección por terminada:
> `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. Los cambios del PRD (Q2 y
> Q8) van en el commit del change, en la rama de la historia. El `openspec archive` va tras integrar
> la última PR, en una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-105 · shared

- [x] 1.1 **(test en rojo)** Tests de los esquemas de parámetros en
  `packages/shared/src/effects.test.ts`: el periodo acepta 1 y 20 y rechaza 0,5 y 25; el esquema de la
  respiración lleva `x-control: "color"` en el color y `x-scale: "log"` en el periodo; la respiración
  rechaza un campo que no declara y la energía rechaza `{ "period": 7 }` y acepta `{}`; cada efecto
  del catálogo trae su esquema de parámetros (decisiones 1, 3 y 5).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 1.2 Los esquemas en `packages/shared/src/effects.ts`: `minimum`, `maximum` y las extensiones
  `x-` de la respiración, `additionalProperties: false` en todos, y el esquema de parámetros de cada
  efecto en `EFFECT_CATALOG`, con un tipo que da los valores de cada efecto por su id.
  Verificar: los tests de 1.1 pasan y `pnpm typecheck` en verde.
- [x] 1.3 **(test en rojo)** Tests del mensaje `6` en `packages/shared/src/viewer-protocol.test.ts`:
  `encodeStrips` y `decodeStrips` con el ejemplo de `design.md` (decisión 6), con `values`;
  `decodeStrips` rechaza una tira sin `values`, una con valores de otro efecto (los de la respiración
  en una tira con energía) y una con un periodo fuera de rango.
  Verificar: los tests nuevos fallan porque las tiras no llevan valores.
- [x] 1.4 `StripStateSchema` como unión discriminada por `effect`, generada del catálogo, en
  `packages/shared/src/viewer-protocol.ts`. La sección del mensaje `6` en
  `docs/instructions/viewer-protocol.md`, con `values` en el ejemplo y que también se envía en cada
  cambio de valores. Y sus usos, para que el motor y el panel no se rompan hasta `MOO-106`: el
  panel descarta un mensaje `6` sin valores. `stripsMessage` (`packages/engine/src/engine.ts`) pone
  en cada tira los valores por defecto de su efecto activo, que son los que pinta el motor mientras
  no exista `setValues`. Las tiras de los tests del motor y del panel, y la respuesta del cambio de
  efecto en `commands.test.ts`, llevan `values`.
  Verificar: los tests de 1.3 pasan, el documento describe exactamente lo que hace el código, y
  `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
- [x] 1.5 Los esquemas de la ruta de valores en `packages/shared/src/commands.ts`, exportados: el
  cuerpo (`SetValuesBodySchema`, la unión de los esquemas de parámetros del catálogo) y la respuesta
  (la tira), con tests de `Value.Check` que aceptan el ejemplo de `design.md` (decisión 4) y rechazan
  un periodo fuera de rango y un campo de más.
  Verificar: `pnpm test` y `pnpm typecheck` en verde.
- [x] 1.6 `prompts.md`: la entrada de la exploración y la propuesta del change (las decisiones de
  `design.md` y cómo se llegó a ellas, con la marcha atrás de la decisión 3) y la de esta tarea.
  Verificar: sigue el formato de `docs/instructions/course.md` §5.

## 2. MOO-106 · engine

- [x] 2.1 **(test en rojo)** Tests de la respiración en
  `packages/engine/src/core/effects/breathing.test.ts`: con el periodo pasando de 4 a 6 s a media
  subida, el brillo del frame siguiente no salta (diferencia de un pulso, como sin el cambio); con el
  periodo pasando de 4 a 8 s en el segundo 1, el frame del segundo 9 es igual al del segundo 1
  (`specs/effects`, decisión 7).
  Verificar: los tests nuevos fallan; los frames dorados siguen en verde.
- [x] 2.2 El desfase en la memoria de la respiración (`packages/engine/src/core/effects/breathing.ts`),
  y el registro del motor toma el esquema de parámetros del catálogo de `shared` en vez de repetirlo
  (con un test en `registry.test.ts` que comprueba que es el mismo).
  Verificar: los tests de 2.1 pasan y los frames dorados no cambian.
- [x] 2.3 **(test en rojo)** Tests del búfer de control en `packages/engine/src/core/control.test.ts`:
  `setValues` da `changed` y la ranura pinta con los valores nuevos desde el pulso siguiente, sin
  reiniciar la memoria; los mismos valores dan `unchanged` y no avisan; una tira que no existe da
  `unknown-strip`; un periodo fuera de rango, un campo de más o los valores de otro efecto dan
  `invalid` con su motivo y no tocan la tira; quien se suscribe recibe un aviso por cada `changed`;
  cambiar el valor de una tira no cambia los frames de otra; `setEffect` sigue empezando con los
  valores por defecto (decisión 8).
  Verificar: los tests nuevos fallan porque `setValues` no existe.
- [x] 2.4 `setValues` en el puerto `Commands` y en el búfer (`packages/engine/src/core/control.ts`):
  los valores de cada ranura como una referencia que se sustituye fuera del bucle; la foto de las
  tiras (`stripsMessage` en `engine.ts`) lleva los valores de cada ranura.
  Verificar: los tests de 2.3 pasan, los del bucle siguen en verde y `pnpm lint` no da errores de
  fronteras.
- [x] 2.5 **(test en rojo)** Tests de la ruta en `packages/engine/src/adapters/server.test.ts`, con
  `inject` y un búfer real: `PUT /api/strips/{stripId}/values` responde `200` con la tira y sus
  valores; `400` con `{ message }` para un periodo fuera de rango, un campo de más y los valores de la
  respiración en una tira con energía; `404` con la tira en el mensaje; la respuesta `200` del cambio
  de efecto lleva los valores; el mensaje `6` lleva los valores y llega a todos los paneles en cada
  cambio de valores; `/api/openapi.json` describe la ruta nueva con su cuerpo, el rango del periodo y
  las respuestas `200`, `400` y `404` (`specs/instrument-control`, decisiones 4 y 6).
  Verificar: los tests nuevos fallan porque la ruta no existe.
- [x] 2.6 La ruta en `packages/engine/src/adapters/server.ts`, con los esquemas de `shared` y los
  errores con `{ message }`, y `docs/openapi.yaml` regenerado con `pnpm openapi`.
  Verificar: los tests de 2.5 y el de `openapi.test.ts` pasan, y con `pnpm dev` un
  `curl -X PUT …/api/strips/<id>/values` cambia la tira en el visor.
- [x] 2.7 Documentación: D84-D89 en `docs/idea-mood-table.md` §10, según `design.md`, con D81 y D82
  matizadas y D78 ampliada (apuntando a las nuevas, sin borrar ni renumerar). README §2.2 (*Búfer de
  control*, adaptador *API HTTP*) y §4 (la ruta nueva con un ejemplo de petición y respuesta).
  `prompts.md`.
  Verificar: los D# y los enlaces cuadran con `design.md` y el ejemplo del README pasa contra el motor.

## 3. MOO-107 · panel

- [x] 3.1 **(test en rojo)** Tests del envío en `packages/panel/src/engine/`, con un `fetch` falso:
  los valores van por `PUT /api/strips/{stripId}/values` con todos los valores; con uno en camino,
  solo se envía el último; un error de red o de respuesta no bloquea el siguiente; la cola dice si
  una tira tiene envíos en camino o pendientes y avisa cuando se vacía. Los tests del cambio de efecto
  siguen pasando con la cola generalizada (decisión 3).
  Verificar: los tests nuevos fallan porque la cola de valores no existe.
- [ ] 3.2 La cola por tira generalizada (ruta y cuerpo como parámetros) a partir de
  `effect-requests.ts`, con una instancia para efectos y otra para valores.
  Verificar: los tests de 3.1 y los de `effect-requests` pasan.
- [ ] 3.3 **(test en rojo)** Tests de la traducción de esquema a control (función pura): el color da
  un selector de color; el periodo, un slider de 1 a 20 s en escala logarítmica, con el centro del
  recorrido en unos 4,5 s; cada parámetro de cada efecto del catálogo tiene control y nombre
  (decisiones 1, 5 y 9).
  Verificar: los tests nuevos fallan porque la función no existe.
- [ ] 3.4 La función de traducción y los nombres de los parámetros en `literals.ts`, con un tipo que
  obliga a tener el de cada parámetro de cada efecto.
  Verificar: los tests de 3.3 pasan y `pnpm typecheck` falla si se quita un nombre.
- [ ] 3.5 **(test en rojo)** Tests de la zona Controles (componente y `App.test.tsx`), con la conexión
  y la cola falsas: con la respiración muestra el color y el periodo que dice la conexión; con la
  energía, solo el título; al seleccionar otra tira muestra sus valores; mover un control envía todos
  los valores de la tira; mientras se arrastra, el control sigue al dedo aunque llegue un eco
  atrasado; al soltar, sigue con su valor hasta que la cola se vacía y entonces muestra el del motor;
  si el motor no aplica el valor, vuelve al que pinta; sin conexión, solo el título
  (`specs/instrument-control`, decisión 2).
  Verificar: los tests nuevos fallan porque la zona está vacía.
- [ ] 3.6 La zona Controles con el `Slider` y el `ColorPicker` de Mantine, la unión en `App.tsx` y su
  hueco en `PanelLayout.tsx`.
  Verificar: los tests de 3.5 pasan, los de `PanelLayout` y `panel-layout` siguen en verde, y con
  `pnpm dev` se mueve el periodo de la tira de la demo desde el panel.
- [ ] 3.7 E2E del caso feliz en `e2e/controls.spec.ts`, con un motor propio y una tira con la
  respiración: la zona Controles muestra el color y el periodo; al arrastrar el periodo y el color, el
  visor pinta el cambio en menos de 100 ms desde cada movimiento; al soltar, la tira se queda con el
  valor; al recargar el panel, los controles muestran esos valores (`specs/instrument-control`,
  criterios de `MOO-95`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [ ] 3.8 README §1.3 (la zona Controles, y el ejemplo del recorrido pasa de la sensibilidad al
  periodo) y `prompts.md`. Comprobación a mano con la demo: arrastrar el periodo a media respiración
  no da un salto de brillo, anotado en la PR.
  Verificar: lo que describe el README coincide con lo que muestra el panel.
