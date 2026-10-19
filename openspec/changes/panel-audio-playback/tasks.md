# Tasks

> Dos tareas de Linear, dos secciones y dos PR contra `main`, en orden: `MOO-57` parte de `MOO-56` ya
> integrada (`design.md`, decisión 10). Cada paso es un commit con `Refs MOO-n` de su tarea; la PR
> lleva `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el
> paso siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la
> última PR, en una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-56 · engine

- [x] 1.1 **(test en rojo)** Tests del protocolo en `packages/shared`: el mensaje de posición (tipo `4`)
  lleva `seq` (`u32`) y posición (`f64`) en big-endian y ocupa 13 bytes; se codifica y se decodifica
  igual con posiciones de 0, de un fichero largo (una hora) y con `seq` cerca de 2³²; se rechazan una
  longitud distinta, otro tipo y una posición negativa o no finita; `decodeFrame`, `decodeLevel` y
  `decodeSource` rechazan el tipo `4` (`specs/audio-playback`, decisión 2).
  Verificar: los tests nuevos fallan porque el mensaje no existe; el resto sigue en verde.
- [x] 1.2 Codificador y decodificador del mensaje de posición en `packages/shared`;
  `docs/instructions/viewer-protocol.md` con el mensaje byte a byte y su ejemplo, y la fila del
  documento en el índice de `AGENTS.md` si cambia su descripción.
  Verificar: los tests de 1.1 pasan y el documento describe exactamente lo que hace el código.
- [x] 1.3 **(test en rojo)** Tests del núcleo: `positionAt(time)` de la fuente en memoria da, en
  segundos, la muestra en la que acaba la ventana de `read(time, …)`, y vuelve a casi 0 al pasar el
  final; con el fichero de golpes (4 s), `positionAt(5)` ronda 1 s. Tests del bucle: con una fuente con
  `positionAt`, una `PositionOutput` recibe en cada pulso la posición con el `seq` del pulso; con una
  fuente sin `positionAt` o sin fuente, no recibe nada (decisión 9).
  Verificar: los tests nuevos fallan porque ni el método ni el puerto existen.
- [x] 1.4 `positionAt` opcional en el puerto `AudioSource`, implementado en `MemoryAudioSource` con la
  misma cuenta que `read`; puerto `PositionOutput` en `core/frame-loop.ts` y entrega en cada pulso, sin
  crear objetos.
  Verificar: los tests de 1.3 pasan y los frames dorados no cambian.
- [x] 1.5 **(test en rojo)** Tests de integración del servidor: con dos clientes WebSocket y un fichero
  como fuente, los dos reciben en cada pulso un mensaje de posición con el mismo `seq` que los frames;
  sin fuente, ninguno. `GET /audio` con un fichero como fuente devuelve el fichero byte a byte con
  `Content-Type: audio/wav`, y sin fuente, 404; ni el cuerpo del 404 ni las cabeceras llevan la ruta en
  disco (`specs/audio-playback`, decisión 6).
  Verificar: los tests nuevos fallan porque el servidor no envía la posición ni sirve `/audio`.
- [x] 1.6 El servidor da una `PositionOutput` que envía la posición a todos los paneles y sirve
  `/audio` con la ruta del fichero que le pasa `main.ts`; `main.ts` lo conecta todo.
  Verificar: los tests de 1.5 pasan; con `pnpm dev`, `curl -sI http://127.0.0.1:8080/audio` da
  `200` y `audio/wav`, y un cliente WebSocket de prueba recibe mensajes de tipo `4`.
- [x] 1.7 Documentación:
  - README §2.2: adaptador *Visor* (también la posición del fichero, tipo `4`), adaptador *Fichero
    WAV* (`positionAt`) y *Reproductor* (el motor sirve el fichero en `/audio`);
  - `docs/idea-mood-table.md` §10: D53 (sincronizar contra el visor, con la posición del fichero que
    dice el motor), si el usuario la aprueba;
  - `prompts.md`: entrada del refinamiento, la estimación, la exploración y la spec del change, con el
    formato de `course.md` §5.

  Verificar: README y protocolo dicen lo mismo que el código; la PR explica que el panel aún no usa la
  posición.

## 2. MOO-57 · panel

- [x] 2.1 Comprobación del riesgo de `design.md`: un E2E mínimo en `e2e/playback.spec.ts` que, tras un
  clic, crea un `AudioContext` en Chromium sin pantalla y ve avanzar `currentTime` durante 1 s, en
  local y en la CI. Si pasa, se queda como primer test del fichero; si no, se para y se decide con el
  usuario la alternativa (navegador con pantalla con `xvfb` o reducir el E2E de sincronía).
  Verificar: el test pasa en local y en la CI, o la decisión queda anotada en `design.md`.
- [x] 2.2 **(test en rojo)** Tests de la conexión con un WebSocket falso: decodifica el mensaje de
  tipo `4` y avisa a quien escuche de cada posición con su instante de llegada; ignora un mensaje de
  posición mal formado; al cerrarse, deja de avisar; frames, fuente y nivel siguen igual.
  Verificar: los tests nuevos fallan porque la conexión no decodifica la posición.
- [x] 2.3 La conexión decodifica la posición con el protocolo de `@moodtable/shared` y la entrega a sus
  suscriptores con `performance.now()` de la llegada.
  Verificar: los tests de 2.2 pasan.
- [x] 2.4 **(test en rojo)** Tests de `sync.ts`, sin navegador ni temporizadores: el punto de arranque
  es la posición del visor más la latencia declarada; sin latencia declarada, se toma 0; el error es
  circular (93,7 s frente a 0,1 s en un fichero de 93,8 s es +0,2 s); unas pocas llegadas retrasadas
  por *jitter* no mueven la referencia filtrada; a 19 ms de error no salta y a 21 ms sí; tras muchas
  vueltas simuladas con una deriva de 3 ms/min, el error nunca pasa de los 45/125 ms de la spec
  (decisiones 4 y 5).
  Verificar: los tests nuevos fallan porque `sync.ts` no existe.
- [x] 2.5 `packages/panel/src/audio/sync.ts`: filtro de mediana circular sobre la última ventana de
  posiciones, error circular, punto de arranque con latencia y decisión de salto con umbral de 20 ms.
  Verificar: los tests de 2.4 pasan.
- [x] 2.6 **(test en rojo)** Tests del reproductor con un `AudioContext` falso: descarga `/audio` una
  sola vez por conexión y decodifica; suena en bucle desde el punto que le pide la sincronía; dejar de
  oír para el nodo; volver a oír crea uno nuevo en el punto del momento sin volver a descargar; un error
  por encima del umbral para el nodo y arranca otro; al perder la conexión, deja de sonar y suelta el
  buffer (decisión 3).
  Verificar: los tests nuevos fallan porque el reproductor no existe.
- [x] 2.7 `packages/panel/src/audio/player.ts`: Web Audio (`decodeAudioData`, `AudioBufferSourceNode`
  con `loop`, `start(cuando, desde)`, `getOutputTimestamp` y `outputLatency`), con la sincronía de 2.5
  comprobada unas pocas veces por segundo.
  Verificar: los tests de 2.6 pasan.
- [x] 2.8 **(test en rojo)** Tests del control con Testing Library: con un fichero como fuente, un
  botón «Oír el fichero de audio» en la cabecera; al pulsarlo, «Preparando el audio» y después «Dejar
  de oír el fichero de audio»; al pulsar este, vuelve a «Oír…»; sin fuente de audio o sin conexión,
  ningún botón; al perder la conexión mientras suena, vuelve a «Oír…» (decisión 7).
  Verificar: los tests nuevos fallan porque el control no existe.
- [x] 2.9 `AudioControl.tsx` en la cabecera, junto a la fuente, con iconos de *play* y *pause* de
  Mantine; el objeto de solo lectura en `window` con el error de sincronía estimado y el estado del
  reproductor (decisión 8).
  Verificar: los tests de 2.8 pasan; con `pnpm dev`, el botón suena y calla `bouncer.wav`.
- [ ] 2.10 E2E de `MOO-22` en `e2e/playback.spec.ts`, con un motor con `golpes.wav` y una tira con
  *energía* (`e2e/engine.ts`). Escenarios: *Oír el fichero de audio mientras la tira virtual reacciona*
  (tras unos segundos de motor, pedir oír: el error queda dentro de la tolerancia); *El panel no suena
  solo*; *Dejar de oír* (el reproductor calla y el visor sigue cambiando); *Volver a oír tras dejar de
  oírlo* (tras 1,5 s callado, el error vuelve a estar dentro de la tolerancia); *Lo que se oye sigue al
  ritmo aunque el fichero se repita* (error muestreado durante ~10 s, dos vueltas o más, siempre dentro
  de la tolerancia); *Sin fichero como fuente* (con `e2e/config.json`, ningún botón); *El fichero
  tarda en llegar* (`page.route` retrasa `/audio`: se ve «Preparando el audio»); *El motor se para
  mientras el maker oye* (calla y, al volver, no suena solo). Los E2E de HU1 y HU2 siguen pasando.
  Verificar: `pnpm test:e2e` pasa en local y en la CI.
- [ ] 2.11 Comprobación a oído con el usuario: con `pnpm dev` y `bouncer.wav`, el usuario oye el panel
  unos minutos, deja de oírlo y vuelve, y juzga si la tira va al ritmo de lo que oye (caso feliz de
  `MOO-22`). Si el salto de la corrección se nota, se anota para pasar a `playbackRate` (decisión 4).
  Verificar: el resultado queda en la descripción de la PR.
- [ ] 2.12 Documentación y cierre de la historia:
  - README §1.3 (*Cabecera*: el control de oír) y §2.2 (*Reproductor*: Web Audio, sincronía contra el
    visor y corrección con salto);
  - `docs/idea-mood-table.md` §10: D54 (Web Audio con salto al pasar 20 ms) y D55 (solo el retraso de
    salida declarado), si el usuario las aprueba;
  - `prompts.md`: entrada de la implementación de la historia, con el formato de `course.md` §5;
  - cada escenario de los criterios de `MOO-22` tiene su test (DoD de la historia).

  Verificar: la tabla de escenarios de `MOO-22` → test está en la descripción de la PR, y
  `pnpm exec openspec validate panel-audio-playback --strict` pasa.
