# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-140` parte de
> `MOO-139` ya integrada (usa el catálogo de chips y los campos de la salida), y `MOO-141` parte de
> `MOO-140` (sin el límite del motor no es seguro quitar el tope del sketch). Cada paso es un commit
> con `Refs MOO-n` de su tarea, y la PR lleva `Fixes MOO-n`. Un paso marcado **(test en rojo)** deja a
> propósito tests que fallan, y el siguiente los pone en verde. Antes de dar una sección por
> terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
>
> **En el commit del change, en la rama de la historia** (no en una tarea), lo que decidió el
> refinamiento de `MOO-135`:
>
> - `docs/PRD.md` §8: *Chip de la tira* (`chip`) entra en el glosario (el modelo de chip de una tira
>   física, del que el motor sabe cuánto consume cada LED); *Límite de potencia* se ajusta (el maker
>   declara los amperios de salida de la fuente y el motor usa como mucho el 80 %); *Tira* deja de
>   decir que declara el «límite de potencia» y dice que una física declara su chip y su fuente.
> - `docs/PRD.md` §7: **Q11**, «¿E8 cubre solo lo que pinta el motor o todo lo que llega a la tira (la
>   SD de la v1 con Hyperion, o lo que pinte el sketch al reiniciarse) una vez quitado el tope del
>   sketch?», que resuelve el maker.
> - `docs/umbrales-para-specs.md`, E8: el motor usa como mucho el **80 %** de los amperios declarados
>   (decisión del maker al refinar `MOO-135`).
>
> El `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).

## 1. MOO-139 · shared

- [x] 1.1 **(test en rojo)** Tests del catálogo de chips y de la salida `adalight` en
  `packages/shared/src/config.test.ts` (`specs/engine-config`, *Una tira física declara su chip y la
  fuente que la alimenta*):
  - acepta la tira de la mesa con `"chip": "WS2812B"` y `"power": { "supplyAmps": 8 }`, y también
    con `"supplyAmps": 7.5`;
  - rechaza, nombrando la tira y el campo: sin `chip`; sin `power` o sin `supplyAmps`; `"SK6812"`
    (y el mensaje dice qué chips hay); `0` y `-8`; `0.008` (y el mensaje dice que no llega a los
    0,06 A de un LED `WS2812B`); `chip` o `power` en una salida `virtual`;
  - el catálogo da 20 mA por canal a la `WS2812B`.

  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [x] 1.2 El catálogo de chips en `packages/shared/src/chips.ts` (nuevo) y los campos `chip` y `power`
  de la salida `adalight` en `packages/shared/src/config.ts`: `supplyAmps` como número mayor que 0, y
  el mínimo de un LED como comprobación aparte en `parseConfig`, como la de la fuente de audio
  (decisión 5). Se exportan desde el punto de entrada del paquete. Las tiras físicas de los tests
  (`engine.test.ts`, `frame-loop.test.ts`, `restore.test.ts`, `adalight.test.ts`,
  `viewer-protocol.test.ts`) declaran los campos nuevos.
  Verificar: los tests de 1.1 pasan, y `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.3 Documentación:
  - **D109** (decisión 5) en `docs/idea-mood-table.md` §10;
  - README §3.2: la tabla de la tira declarada pierde `maxCurrentMa` y `ledMaxMa`, la salida
    `adalight` suma `chip` y `power.supplyAmps` (los amperios de OUTPUT de la etiqueta), y el JSON de
    la mesa los lleva;
  - README §1.4, «En la mesa»: el paso 2 dice que se declaran el chip y los amperios de la fuente, no
    «límites de potencia»;
  - `prompts.md`: la entrada del refinamiento, la estimación, la exploración y la propuesta de
    `MOO-135`, y la de esta tarea.

  Verificar: el JSON del README pasa `parseConfig` y los D# cuadran con `design.md`.

## 2. MOO-140 · engine

- [x] 2.1 **(test en rojo)** Tests de la respuesta del LED en
  `packages/engine/src/core/led-response.test.ts`: la tabla da `round(255 · (v/255)²)` para los 256
  valores; 11 da 0 y 12 da 1 (decisión 1).
  Verificar: los tests nuevos fallan porque el módulo no existe.
- [x] 2.2 La respuesta del LED en `packages/engine/src/core/led-response.ts`, y la salida Adalight
  (`adapters/adalight.ts`) codifica con ella en lugar de con su `gamma` propia.
  Verificar: los tests de 2.1 pasan, y los de `adalight.test.ts` (*Un color tenue sale más tenue
  hacia la tira*) siguen en verde sin tocarlos.
- [x] 2.3 **(test en rojo)** Tests del límite en `packages/engine/src/core/power-limit.test.ts`, con
  una tira de 173 LEDs `WS2812B` (`specs/power-limit`, decisiones 2 y 3):
  - todo a 255 se estima en 10,38 A y todo a 128 en unos 2,6 A;
  - con 8 A, todo blanco sale a 200 y su consumo estimado queda en unos 6,39 A, por debajo de los
    6,4 A;
  - con 8 A, rojo puro (3,46 A) sale sin tocar;
  - con 8 A, 172 LEDs blancos y uno a (15, 40, 0): los blancos a 200 y el tenue a (12, 31, 0);
  - un canal por debajo de 12 baja sin suelo;
  - con 18 A, todo blanco sale sin tocar;
  - con 0,06 A, 37 canales a 255 y el resto a 12 bajan sin suelo y no pasan de la fuente; la mesa
    tiene suelo con 0,12 A y no con 0,11 A (decisión 2, el suelo solo si la fuente lo aguanta);
  - para frames al azar, el consumo estimado tras el límite nunca pasa de los amperios de la fuente.

  Verificar: los tests nuevos fallan porque el límite no existe.
- [x] 2.4 El límite en `packages/engine/src/core/power-limit.ts`: el presupuesto de una tira, calculado
  una vez desde sus amperios, su chip y sus LEDs (que deciden si tiene suelo), y la función que
  estima y, si hace falta, escala el frame en su sitio, hacia abajo y con el suelo de 12, sin crear
  nada.
  Verificar: los tests de 2.3 pasan.
- [x] 2.5 **(test en rojo)** Tests del bucle en `packages/engine/src/core/frame-loop.test.ts`, con
  salidas en memoria:
  - una tira física de 173 LEDs con 8 A, en blanco total: el visor y su salida Adalight reciben el
    mismo frame, con todos los canales a 200;
  - con la intensidad al 50 %, el mismo efecto sale a 128, sin bajar más;
  - una tira virtual en blanco total sale a 255.

  Verificar: los tests nuevos fallan porque el bucle no aplica el límite.
- [x] 2.6 `LoopStrip` gana el límite opcional de la tira; el bucle lo aplica después de la
  intensidad, y su comentario fija el orden sin el «todavía no existe». La raíz de composición
  (`engine.ts`) construye el límite de cada tira física desde su configuración y el catálogo
  (decisión 6).
  Verificar: los tests de 2.5 pasan, y los frames dorados y los de la intensidad siguen en verde.
- [x] 2.7 **(test en rojo)** Tests de la línea del log en `packages/engine/src/engine.test.ts`: la
  tira «Mesa» con 8 A dice la fuente, los 6,4 A, los 10,38 A en blanco total y que bajará los frames
  que se pasen; con 18 A, los 14,4 A y que nunca bajará frames (decisión 4); con 0,06 A, además, que
  los LEDs tenues pueden apagarse (la tira no tiene suelo, decisión 2).
  Verificar: los tests nuevos fallan porque la función no existe.
- [x] 2.8 La función de la línea en `engine.ts` y su llamada en `main.ts`, una vez por tira física al
  arrancar.
  Verificar: los tests de 2.7 pasan, y con una tira física declarada en el fichero, el log del
  arranque muestra su línea.
- [x] 2.9 Documentación:
  - **D108** (decisiones 1 a 3) en `docs/idea-mood-table.md` §10, y una nota en D96 que apunta a
    ella (la gamma pasa al núcleo, sin borrarla);
  - README §2.1 y §2.2: el plano de tiempo real ya tiene el límite; el bloque *Límite de potencia*
    dice cómo estima (con la respuesta del LED), cuánto usa (el 80 %) y cómo baja el frame (`√k`,
    hacia abajo, con el suelo de 12); el adaptador *Adalight serie* codifica con la respuesta del
    núcleo;
  - `prompts.md`: la entrada de esta tarea.

  Verificar: lo que dice el README coincide con el código y los D# cuadran con `design.md`.

- [x] 2.10 **(test en rojo)** Tras la revisión de la #134 (decisiones 1 y 2): los tests del límite
  miden con el PWM que se envía (la tabla de la respuesta del LED), no con la fórmula sin redondear:
  - todo a 128 se estima en 2,605 A;
  - con 0,12 A, 53 canales a 255 y el resto a 12 no pasan de la fuente;
  - la línea del log avisa de que los LEDs tenues pueden apagarse con 0,2 A y no con 0,21 A.

  Verificar: los tests nuevos fallan con el límite de 2.4.
- [x] 2.11 El límite estima con la tabla, y si el frame bajado aún se pasa de la fuente, lo vuelve a
  bajar sin suelo hasta que cabe.
  Verificar: los tests de 2.3 y 2.10 pasan.

## 3. MOO-141 · firmware

- [x] 3.1 `HARDWARE_SETUP.md` §3 y §4.1 (decisión 7): `Brightness` pasa a `255`, porque el límite
  del motor protege la fuente; §3 explica que Mood Table baja cada frame al 80 % de la fuente
  declarada; se copia la cifra en amperios de **OUTPUT**, no la de INPUT; al cambiar de fuente hay que
  cambiar el fichero de configuración; y se recomienda un fusible o una fuente con protección contra
  sobrecorriente.
  Verificar: §3 y §4.1 cuadran con `specs/power-limit` y con el README §3.2.
- [x] 3.2 En la Pi: el `config/local.json` de la mesa declara `"chip": "WS2812B"` y
  `"power": { "supplyAmps": 8 }`, y el motor arranca con `main`.
  Verificar: el log del arranque dice la fuente de 8 A, los 6,4 A y que bajará los frames que se
  pasen.
- [x] 3.3 Cargar el sketch con `Brightness = 255` en el Arduino de la mesa (`arduino-cli`,
  `HARDWARE_SETUP.md` §4.1).
  Verificar: el Arduino responde y la tira pinta lo mismo que el visor.
- [x] 3.4 Comprobación a mano en la mesa, que confirma el maker (criterios de `MOO-135`):
  - **caso peor**: todo blanco con la intensidad al máximo, durante un par de minutos; la fuente no
    corta, la tira no parpadea y el controlador Adalight no se reinicia; con el polímetro, la tensión
    al final de la tira (`HARDWARE_SETUP.md` §5);
  - **un color puro** se ve claramente más brillante que con el tope del 25 %, y un LED tenue se
    sigue viendo;
  - **un frame que se pasa con LEDs tenues** (el *espectro* con graves a tope): los tenues no se
    apagan.

  Se anota en la PR. No es documentación hasta que el maker lo confirme.
  Verificar: el maker da el visto bueno en la PR.
- [x] 3.5 `prompts.md`: la entrada de esta tarea.
  Verificar: sigue el formato de `docs/instructions/course.md` §5.

## Workflow follow-up

- Tras integrar `MOO-141`, `openspec archive power-limit` en una rama `…-archivar-change`, con la
  lista de tareas hijas de `MOO-135` revisada en Linear antes.
- En Linear, quitar de `MOO-135` el non-goal «Que el visor muestre el recorte: pinta el frame sin
  bajar hasta MOO-132»: con D100, el visor recibe el frame ya bajado.
- Al refinar `MOO-132`: el tope del controlador ya no existe y el visor ya recibe el recorte; solo
  queda simular la gamma y el redondeo.
- El README §1.4 apunta a `deploy/config/mesa.example.json`, que no existe en el repositorio. Es
  anterior a este change: una tarea aparte si se quiere crear.
