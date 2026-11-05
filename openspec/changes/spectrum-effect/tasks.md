# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs MOO-122`,
> y la PR lleva `Fixes MOO-122`. Un paso marcado **(test en rojo)** deja a propósito tests que
> fallan, y el siguiente los pone en verde. Antes de dar la sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. La nota de Q2 en el PRD («*espectro*: sin
> parámetros por ahora») va en el commit del change, en la rama de la historia. El
> `openspec archive` va tras integrar la PR, en una rama `…-archivar-change` (`workflow.md` §4.5).
>
> **Antes de empezar** (`design.md`, decisión 6): la PR #116 (*scroll*) integrada, `scroll-effect`
> archivado, `main` traída a esta rama y `openspec validate spectrum-effect` en verde.

## 1. MOO-122 · engine

- [x] 1.1 **(test en rojo)** En `packages/shared/src/effects.test.ts`, el catálogo incluye
  `spectrum`, reactivo, con un esquema sin parámetros que rechaza cualquier campo, entre `scroll` y
  `breathing` (decisión 5).
  Verificar: el test nuevo falla y el resto sigue en verde.
- [x] 1.2 El *espectro* en el contrato:
  - en `packages/shared/src/effects.ts`, `SpectrumParamsSchema` y la entrada del catálogo, exportados
    desde `index.ts`;
  - en `packages/panel/src/literals.ts`, `EFFECT_NAMES.spectrum = 'Espectro'` y
    `PARAM_NAMES.spectrum = {}`;
  - en `packages/engine/src/core/effects/spectrum.ts`, el efecto con su id, `usesAudio` y esquema, y
    un `render` que de momento apaga la tira, registrado en `registry.ts` en el orden del catálogo.

  Verificar: los tests de 1.1 y `registry.test.ts` pasan, y `pnpm typecheck` y `pnpm lint` (fronteras
  incluidas) van en verde. Los tests del panel y los E2E que dependan del orden de la zona Efectos se
  ajustan en este mismo paso.
- [x] 1.3 **(test en rojo)** Tests unitarios en `packages/engine/src/core/effects/spectrum.test.ts`,
  con el montaje de tonos de `energy.test.ts` y `scroll.test.ts` (`specs/effects`):
  - es reactivo y `defaultParams` es `{}`;
  - sin rasgos del audio o en silencio, todos los LEDs a 0, y la memoria no cambia: tras el silencio,
    el siguiente frame sigue donde iba el último con audio;
  - un tono de 400 Hz, a los 10 s, enciende LEDs en torno al centro, simétricos, sobre todo azules y
    ninguno en el cuarto exterior de cada lado; uno de 8 kHz, cerca de los extremos y ninguno en la
    mitad central;
  - con un tono quieto, pasado el primer medio segundo, el verde de ningún LED pasa de 5; al pasar de
    golpe de 400 Hz a 8 kHz, en ese frame hay verde en torno al centro y cerca de los extremos;
  - el arranque: con un tono de 400 Hz, en el primer medio segundo el LED más brillante tiene rojo por
    encima de 128, y a los 10 s ningún LED pasa de 5 de rojo y el azul sigue encendido;
  - el verde va por frame: un mismo salto de la banda da el mismo verde a 30 y a 60 fps;
  - con un número impar de LEDs, los dos lados son iguales y el del centro es el de la banda más
    grave.

  Verificar: los tests nuevos fallan y el resto sigue en verde.
- [x] 1.4 El `visualize_spectrum` de la v1 en `spectrum.ts`, según las decisiones 1 a 3 de
  `design.md`:
  - la memoria por tira: suelo, rojo, azul y banda anterior (media tira cada uno, arrancando a 0,01),
    el búfer de la interpolación y el espejo de `mirror.ts`;
  - la interpolación lineal de las 24 bandas a media tira, como `interpolate` de la v1;
  - el suelo, el rojo y el azul con `follow` y `dt`; el verde, la diferencia sin suavizar;
  - ×255, recorte a 0-255 y truncado; en silencio, a 0 sin tocar la memoria.

  El comentario de cabecera dice de dónde viene (dancyPi `0906e77`), qué va por frame y qué con `dt`,
  y que el arranque en rojo se conserva a propósito. `render` no crea objetos.
  Verificar: los tests de 1.3 pasan.
- [x] 1.5 Tests con el bucle real y el fichero de golpes, en un `describe` nuevo de `golpes.test.ts`
  (decisión 4):
  - la luz de cada golpe aparece igual por los dos lados de la tira;
  - en el silencio entre golpes, la tira se apaga;
  - una tira con *energía* que pasa al *espectro* con `setEffect` deja de pintar *energía* desde el
    primer frame;
  - frames dorados en `core/effects/__golden__/spectrum-60-leds.json`, en los mismos instantes que
    los de *energía* y *scroll*.

  Verificar: los tests pasan, los de *energía* y *scroll* siguen igual y sus ficheros dorados no
  cambian.
- [x] 1.6 La API y el OpenAPI:
  - `pnpm openapi` regenera `docs/openapi.yaml` con `spectrum` en los ids de efecto;
  - un test en `packages/engine/src/adapters/server.test.ts`: `PUT /api/strips/{stripId}/effect` con
    `spectrum` responde `200` con valores `{}`, y sin fuente de audio responde `409`.

  Verificar: los tests pasan y el diff del OpenAPI solo añade `spectrum`.
- [x] 1.7 E2E del caso feliz en `e2e/effects.spec.ts`, con el fichero de golpes y la tira con
  *energía*:
  - el DJ elige *Espectro*;
  - queda marcado como el activo, etiquetado como reactivo;
  - la zona Controles solo muestra su título;
  - los frames del visor dejan de ser los de *energía*.

  `e2e/engine.ts` acepta `spectrum` como efecto de arranque si hace falta (`specs/instrument-control`,
  criterios de `MOO-98`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [x] 1.8 Documentación:
  - la **D#** nueva en `docs/idea-mood-table.md` (decisiones 1 a 3 de `design.md`);
  - README §1.2: *Espectro*, «cada zona de la tira representa una banda de frecuencia: los graves en
    el centro y los agudos en los extremos»;
  - README §1.3: los efectos de la zona Efectos son *Respiración*, *Espectro*, *Scroll* y *Energía*,
    y el *Espectro*, como *Energía*, deja Controles con su título;
  - README §4: el ejemplo del `400` lista `spectrum`;
  - `prompts.md`: la entrada del refinamiento, la estimación, la exploración y la propuesta de
    `MOO-98`, y la de esta tarea.

  Verificar: lo que dice el README coincide con lo que hace el motor, y `prompts.md` sigue el formato
  de `docs/instructions/course.md` §5.

## Workflow follow-up

- Cuando el DJ vea el *espectro* en el visor y en la mesa, decidir si el arranque en rojo se queda
  (`design.md`, decisión 2) y qué controles quiere; cada cosa, con `/create-story`.
- Al integrar la PR: `/opsx:verify` y `/opsx:archive` en una rama `…-archivar-change`.
