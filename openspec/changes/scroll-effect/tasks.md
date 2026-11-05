# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs` de su
> tarea (`Refs MOO-118`, `Refs MOO-123`), y la PR lleva `Fixes` de la suya. Un paso marcado **(test en rojo)** deja a propósito tests que
> fallan, y el siguiente los pone en verde. Antes de dar la sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. La nota de Q2 en el PRD («*scroll*: sin
> parámetros por ahora») va en el commit del change, en la rama de la historia. El
> `openspec archive` va tras integrar la PR, en una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-118 · engine

- [x] 1.1 **(test en rojo)** En `packages/shared/src/effects.test.ts`, el catálogo incluye `scroll`,
  reactivo, con un esquema sin parámetros que rechaza cualquier campo, entre `energy` y `breathing`
  (decisión 5).
  Verificar: el test nuevo falla y el resto sigue en verde.
- [x] 1.2 *Scroll* en el contrato:
  - en `packages/shared/src/effects.ts`, `ScrollParamsSchema` y la entrada del catálogo, exportados
    desde `index.ts`;
  - en `packages/panel/src/literals.ts`, `EFFECT_NAMES.scroll = 'Scroll'` y `PARAM_NAMES.scroll = {}`;
  - en `packages/engine/src/core/effects/scroll.ts`, el efecto con su id, `usesAudio` y esquema, y un
    `render` que de momento apaga la tira, registrado en `registry.ts` en el orden del catálogo.

  Verificar: los tests de 1.1 y `registry.test.ts` pasan, y `pnpm typecheck` y `pnpm lint` (fronteras
  incluidas) van en verde.
- [x] 1.3 **(test en rojo)** Tests unitarios en `packages/engine/src/core/effects/scroll.test.ts`,
  con el montaje de tonos de `energy.test.ts` (`specs/effects`):
  - es reactivo y `defaultParams` es `{}`;
  - sin rasgos del audio o en silencio, todos los LEDs a 0, y la memoria no cambia: tras el silencio,
    el siguiente frame sigue donde iba el último con audio;
  - un tono de 400 Hz pinta un rastro rojo y uno de 8 kHz uno azul, simétricos y con el brillo
    bajando del centro hacia fuera;
  - 10 frames después de entrar por el centro, un color está a 10 LEDs y su brillo es 0,98¹⁰ veces el
    inicial, con como mucho 1 de diferencia;
  - con un número impar de LEDs, los dos lados son iguales y el del centro lleva el color nuevo.

  Verificar: los tests nuevos fallan y el resto sigue en verde.
- [x] 1.4 El `visualize_scroll` de la v1 en `scroll.ts`, según las decisiones 1 a 3 de `design.md`:
  - la memoria por tira: la ganancia de cada banda y la media tira por canal, arrancando a 1, con sus
    búferes de trabajo y el espejo de *energía*;
  - la ganancia con `follow` y `dt`;
  - por frame, desplazar, ×0,98, desenfoque de sigma 0,2 y el color nuevo en el centro;
  - en silencio, a 0 sin tocar la memoria.

  El comentario de cabecera dice de dónde viene (dancyPi `0906e77`) y qué va por frame y qué con `dt`.
  `render` no crea objetos.
  Verificar: los tests de 1.3 pasan.
- [x] 1.5 Tests con el bucle real y el fichero de golpes. `energy-golpes.test.ts` pasa a
  `golpes.test.ts`, con un `describe` por efecto y el mismo `run()` (decisión 4). Para *scroll*:
  - la luz de cada golpe aparece en el centro y se aleja hacia los extremos, igual por los dos lados,
    apagándose;
  - en el silencio entre golpes, la tira se apaga;
  - a 30 fps, 0,2 s después del golpe, la luz está a 6 LEDs del centro, y a 60 fps a 12. *Este va
    en `scroll.test.ts`, con un golpe sintético: en el fichero de golpes, cada golpe suena unos
    80 ms y lo sigue un silencio digital, así que a los 0,2 s la tira ya está apagada;*
  - una tira con *energía* que pasa a *scroll* con `setEffect` no conserva nada de *energía* desde
    el primer frame: fuera de lo que ha avanzado desde el centro, ningún LED pasa de 1;
  - frames dorados en `core/effects/__golden__/scroll-60-leds.json`, en los mismos instantes que los
    de *energía*.

  Verificar: los tests pasan, los de *energía* siguen igual y su fichero dorado no cambia.
- [x] 1.6 La API y el OpenAPI:
  - `pnpm openapi` regenera `docs/openapi.yaml` con `scroll` en los ids de efecto;
  - un test en `packages/engine/src/adapters/server.test.ts`: `PUT /api/strips/{stripId}/effect` con
    `scroll` responde `200` con valores `{}`, y sin fuente de audio responde `409`.

  Verificar: los tests pasan y el diff del OpenAPI solo añade `scroll`.
- [x] 1.7 E2E del caso feliz en `e2e/effects.spec.ts`, con el fichero de golpes y la tira con
  *energía*:
  - el DJ elige *Scroll*;
  - queda marcado como el activo, etiquetado como reactivo;
  - la zona Controles solo muestra su título;
  - los frames del visor dejan de ser los de *energía*.

  `e2e/engine.ts` acepta `scroll` como efecto de arranque si hace falta (`specs/instrument-control`,
  criterios de `MOO-99`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [x] 1.8 Documentación:
  - **D95** en `docs/idea-mood-table.md` (decisiones 1 y 2 de `design.md`);
  - README §1.2: *Scroll*, «la energía nace en el centro de la tira y se desplaza hacia los
    extremos»;
  - README §1.3: los efectos de la zona Efectos son *Energía*, *Scroll* y *Respiración*, y *Scroll*,
    como *Energía*, deja Controles con su título;
  - README §4: el ejemplo del `400` lista `scroll`;
  - `prompts.md`: la entrada del refinamiento, la exploración y la propuesta de `MOO-99`, y la de esta
    tarea.

  Verificar: lo que dice el README coincide con lo que hace el motor, y `prompts.md` sigue el formato
  de `docs/instructions/course.md` §5.

## 2. MOO-123 · engine

> Sale de la prueba en la mesa del 5-nov (`design.md`, decisiones 6 a 8). Antes de empezar, la Pi tiene
> dos arreglos provisionales: un parche sin commit en `adapters/adalight.ts` (`MOODTABLE_GAMMA`) y el
> Arduino ya a 500.000 baudios, con sus `local.json`.

- [x] 2.1 **(test en rojo)** En `packages/engine/src/adapters/adalight.test.ts`, la codificación aplica
  la gamma: un LED a (128, 30, 255) sale como (64, 4, 255), y en la frontera el 11 sale 0 y el 12, 1.
  El test del frame de 173 LEDs con el primero en rojo puro sigue igual (`specs/physical-strip`).

  Verificar: los tests nuevos fallan y los demás pasan.
- [x] 2.2 La gamma en la codificación Adalight (`adapters/adalight.ts`), `round(255 · (v/255)²)` en
  cada byte (decisión 6). El visor no cambia. *(Empezó como una tabla de 256 valores; pasó a la
  fórmula porque las ramas de indexarla bajaban la cobertura del código nuevo por debajo del 80 %.)*

  Verificar: `pnpm test` en verde.
- [x] 2.3 El WAV de calibración (decisión 8):
  - el generador en `packages/engine/test/fixtures/calibracion.ts`, determinista y con la forma del
    de golpes, que escribe `config/audio/calibracion.wav`;
  - su script en `packages/engine/package.json`, junto a `fixtures`;
  - su fila en `config/audio/README.md`: qué es, cómo regenerarlo y cómo usarlo (una configuración
    con `audioSource` apuntando a él).

  Verificar: dos ejecuciones dan el mismo fichero byte a byte.
- [x] 2.4 Documentación:
  - **D96** en `docs/idea-mood-table.md` (decisiones 6 a 8 de `design.md`), y en D46, «115.200
    baudios» tachado con un puntero a D96;
  - `HARDWARE_SETUP.md`: `SerialSpeed` a `500000` en §4.1, con el porqué, y el ejemplo de
    configuración y la línea del log medida, a 500.000;
  - README: el techo de Adalight por tira y el ejemplo de `baudRate`;
  - la ficha: la línea de las salidas de luz y el riesgo del techo de fps;
  - `prompts.md`: la entrada de esta tarea.

  Verificar: `git grep 115200` solo lo encuentra en tests, en la lista de velocidades admitidas y en
  el historial (decisiones y medidas antiguas).
- [x] 2.5 En la mesa: la Pi con la rama de esta tarea, sin el parche provisional ni `MOODTABLE_GAMMA`,
  con el WAV de calibración y el *scroll*.

  Verificar: el DJ confirma a ojo que la tira se ve como el visor.

  Hecho el 5-nov: la Pi con esta rama, sin el parche, a 500.000 baudios (11 ms por frame, 56 fps) y
  con `calibracion.wav`. El DJ confirmó que se ve igual que con el arreglo provisional.

## Workflow follow-up

- Cuando el DJ vea el scroll en el visor y en la mesa, la historia de velocidad y estela sale con
  `/create-story`. Se lleva las dos hipótesis de la exploración (la estela medida en LEDs y la rejilla
  de 8 celdas por LED) y la comprobación de `MOO-96`: dos efectos con parámetros en la misma tira
  guardan cada uno los suyos.
- `/estimate-story MOO-99` de nuevo: la historia es más pequeña desde que se dividió.
