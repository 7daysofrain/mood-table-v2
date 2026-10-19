# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: cada una parte de la
> anterior ya integrada. Cada paso es un commit con `Refs MOO-n` de su tarea; la PR lleva
> `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso
> siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`,
> `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la última PR, en una
> rama `…-archivar-change` (`workflow.md` §4.5). Los pasos sobre `config/local.json` no producen
> commit: ese fichero no se versiona (`design.md`, decisión 13).

## 1. MOO-19 · engine

- [x] 1.1 **(test en rojo)** Tests de la validación en `packages/shared`: una tira sin `effect` (el
  mensaje nombra la tira y dice que el campo falta y es obligatorio); un `effect` que no existe (el
  mensaje lista los válidos: `breathing`); `audioSource` de tipo `file` con `path`; sin `audioSource`;
  `audioSource` de un tipo que no existe (nombra `audioSource.type`) y con un campo que no declara
  (`specs/engine-config`).
  Verificar: los tests nuevos fallan porque el esquema no tiene esos campos; el resto sigue en verde.
- [x] 1.2 Catálogo de efectos en `packages/shared` (id y `usesAudio`; de momento solo `breathing`),
  `effect` obligatorio como unión de literales del catálogo y `audioSource` discriminado por `type`
  (decisiones 10 y 12). En el mismo commit, `"effect": "breathing"` en `config/demo.json`,
  `e2e/config.json`, el fichero que escribe `e2e/engine.ts` y los ficheros de configuración de los
  tests del motor. Sin commit: añadir `"effect": "breathing"` a la tira de `config/local.json` de esta
  máquina.
  Verificar: los tests de 1.1 pasan, el resto sigue en verde y `pnpm dev` arranca con la tira
  respirando.
- [x] 1.3 **(test en rojo)** Tests del motor: el bucle anima cada tira con el efecto que declara (dos
  tiras, cada una con el suyo, con un efecto de prueba registrado); el registro de efectos del motor y
  el catálogo de `shared` tienen los mismos ids y el mismo `usesAudio` (`specs/effects`).
  Verificar: los tests nuevos fallan porque el bucle sigue usando siempre la respiración.
- [x] 1.4 Registro de efectos por id en el núcleo; el bucle crea cada tira con el efecto de su
  `effect` y deja de tener un efecto inicial fijo.
  Verificar: los tests de 1.3 pasan y los frames dorados de la respiración no cambian.
- [x] 1.5 **(test en rojo)** Tests de integración de `config-file.ts`: `MOODTABLE_CONFIG` con una ruta
  relativa se resuelve desde la raíz, aunque el directorio de trabajo sea otro; `audioSource.path`
  relativa se resuelve desde la raíz y la absoluta se respeta (`specs/engine-config`, decisión 8).
  Verificar: los tests nuevos fallan porque hoy se resuelve desde el directorio de trabajo.
- [x] 1.6 Resolución de rutas desde la raíz del repositorio en `config-file.ts`: `MOODTABLE_CONFIG` y
  `audioSource.path`, que queda absoluta en la configuración cargada.
  Verificar: los tests de 1.5 pasan y `pnpm test:e2e` sigue en verde (los E2E pasan rutas absolutas).
- [x] 1.7 Script determinista que genera el fichero de golpes aislados de los tests y el fichero
  generado, `packages/engine/test/fixtures/golpes.wav`: 4 s, mono, 16 bits, 44,1 kHz, con un golpe de
  unos 50 ms en los segundos 1, 2 y 3 y silencio digital entre ellos (decisión 15).
  Verificar: ejecutar el script dos veces da un fichero idéntico byte a byte, de unos 350 KB.
- [x] 1.8 **(test en rojo)** Tests del decodificador WAV, sin disco: el fichero de golpes da 4 s de
  muestras mono a 44,1 kHz; un WAV estéreo a 48 kHz generado en el test se mezcla a mono con la media;
  `WAVE_FORMAT_EXTENSIBLE` con subformato PCM se acepta; un bloque `LIST` se salta; uno de 24 bits y
  unos bytes que no son WAV dan «formato no válido» y lo que acepta (`specs/audio-source`).
  Verificar: los tests nuevos fallan porque el decodificador no existe.
- [x] 1.9 Decodificador WAV como función pura en `packages/engine/src/adapters` (decisión 7).
  Verificar: los tests de 1.8 pasan.
- [x] 1.10 **(test en rojo)** Tests de la fuente de fichero: `read(time, out)` da las muestras que acaban
  en `round(time × frecuencia)`; una ventana que cruza el final lee el final y el principio; pasado el
  final, el fichero vuelve a empezar (`mod`). Tests de integración: un fichero que no existe da un
  error con la ruta resuelta; uno con formato no válido, un error que nombra el fichero
  (`specs/audio-source`).
  Verificar: los tests nuevos fallan porque la fuente no existe.
- [x] 1.11 Puerto `AudioSource` *pull* en `packages/engine/src/core/audio` (decisión 3), adaptador de
  fuente de fichero (lee el disco y decodifica al arrancar) y fuente en memoria para los tests, en
  `adapters`. `main.ts` crea la fuente si el fichero declara `audioSource`; si no se puede leer o su
  formato no vale, el motor no arranca y dice por qué.
  Verificar: los tests de 1.10 pasan; `node packages/engine/src/main.ts` con una `audioSource` que no
  existe termina con código 1 y da la ruta.
- [x] 1.12 Documentación:
  - README §2.1 (fila de `AudioSource`: *pull*) y §2.2 (*Análisis de audio* y adaptadores: el bucle
    pide las muestras; el búfer circular pasa al adaptador de la tarjeta; el fichero, en bucle con el
    reloj del motor);
  - README §1.4 y §3 (*Tira declarada*): cada tira declara `effect`, y el fichero, su `audioSource`
    opcional;
  - `docs/idea-mood-table.md` §10: D50 (*AudioSource pull*), D52 (`effect` obligatorio) y el matiz de
    D44 (rutas relativas desde la raíz), si el usuario las aprueba;
  - `prompts.md`: entrada de la exploración y la spec del change, con el formato de `course.md` §5;
  - con permiso del usuario, en Linear: corregir el contexto técnico de `MOO-14` (ya no hay efecto por
    defecto) y dejar las notas para H5 (reconciliación con un efecto reactivo sin fuente) y para el
    despliegue de la demo (pausar el bucle sin paneles).

  Verificar: ningún documento dice que la tira arranca con *respiración* si el fichero no declara
  efecto, ni que el análisis recibe las muestras en un búfer circular propio; la PR avisa de que hay
  que añadir `effect` a cada `config/local.json`.

## 2. MOO-20 · engine

- [x] 2.1 `fft.js` en el catálogo de `pnpm-workspace.yaml` (la versión del spike, 4.0.4, si cumple
  `minimumReleaseAge`) y como dependencia de `@moodtable/engine`, con su declaración de tipos si no la
  trae.
  Verificar: `pnpm install` sin avisos, y lint, tipos y tests siguen en verde.
- [x] 2.2 **(test en rojo)** Tests del análisis en el núcleo, con una fuente en memoria: el nivel de un
  silencio es 0 y el de un seno de amplitud 1 ronda 0,707; con un tono de 400 Hz, las bandas con más
  energía están en el tercio inferior, y con uno de 8 kHz, en el superior; el silencio digital se marca
  como silencio; la ventana dura unos 40 ms a 44,1 y a 48 kHz (decisiones 4 y 11).
  Verificar: los tests nuevos fallan porque el análisis no existe.
- [x] 2.3 Análisis en `packages/engine/src/core/audio`: ventana en segundos rellenada hasta potencia de
  2, Hamming, `fft.js`, 24 bandas mel de 200 Hz a 12 kHz calculadas para la frecuencia de la fuente,
  ganancia y suavizado comunes con `dt` (decisión 2), puerta de silencio y nivel RMS sin ajustar, todo
  con memoria reservada al arrancar. Las constantes se comprueban en el código de la v1 (`dsp.py`,
  `visualization.py` y `config.py` de dancyPi) y el commit consultado se cita en el código.
  Verificar: los tests de 2.2 pasan.
- [x] 2.4 **(test en rojo)** Tests del bucle con audio: con fuente y solo *respiración*, se mide el nivel
  en cada pulso pero no se calculan las bandas (`FrameContext.audio` es `null`); con una tira reactiva,
  las bandas se calculan una vez por pulso para todas las tiras; el nivel llega a sus salidas con el
  `seq` del pulso; sin fuente, ni nivel ni bandas.
  Verificar: los tests nuevos fallan porque el bucle no lee audio.
- [x] 2.5 El bucle lee la ventana del pulso de la `AudioSource`, mide el nivel, calcula las bandas solo
  si alguna tira tiene un efecto con `usesAudio`, las pasa en `FrameContext.audio` y entrega el nivel a
  un puerto `LevelOutput` (decisiones 4 y 5).
  Verificar: los tests de 2.4 pasan y el bucle no crea objetos por pulso.
- [x] 2.6 **(test en rojo)** Tests de *energía* (`specs/effects`): con el fichero de golpes, la tira se
  ilumina con cada golpe y vuelve a apagarse antes del siguiente; en silencio, todos los LEDs a 0; un
  tono de 400 Hz enciende solo rojo y uno de 8 kHz solo azul, en tramos centrados y simétricos; tras un
  golpe, a 30 y a 60 fps la tira queda apagada en el mismo instante (como mucho un pulso de 30 fps de
  diferencia); dos tiras, una con *energía* y otra con *respiración*: en silencio, la segunda sigue
  animándose; frames dorados de una tira de 60 LEDs a 60 fps con el fichero de golpes.
  Verificar: los tests nuevos fallan porque *energía* no existe.
- [x] 2.7 Efecto *energía* en el núcleo (decisiones 1 y 2): esquema de parámetros vacío, memoria por
  tira (ganancia por banda y suavizado de los LEDs), tres tercios a rojo, verde y azul desde el centro,
  desenfoque gaussiano de sigma 4 LEDs, espejo y apagado en silencio. `energy` entra en el catálogo de
  `shared` con `usesAudio: true` y en el registro del motor. Al congelar las constantes se generan los
  frames dorados.
  Verificar: los tests de 2.6 pasan.
- [x] 2.8 **(test en rojo)** Test de la validación en `packages/shared`: una tira con `energy` y sin
  `audioSource` no arranca, y el mensaje nombra la tira y dice que *energy* necesita una fuente de
  audio (`specs/engine-config`, decisión 6).
  Verificar: el test nuevo falla porque `parseConfig` no lo comprueba.
- [x] 2.9 Comprobación en `parseConfig`, con el `usesAudio` del catálogo.
  Verificar: el test de 2.8 pasa.
- [x] 2.10 **(test en rojo)** Tests del protocolo en `packages/shared`: el mensaje de fuente (tipo `2`)
  sin fuente y con un fichero cuyo nombre lleva acentos se codifica y se decodifica igual; el de nivel
  (tipo `3`) lleva `seq` y nivel en big-endian; los mensajes mal formados se rechazan, y
  `decodeFrame` sigue rechazando los tipos que no son `1` (decisión 5).
  Verificar: los tests nuevos fallan porque los mensajes no existen.
- [x] 2.11 Codificadores y decodificadores de los mensajes de fuente y de nivel en `packages/shared`;
  `docs/instructions/viewer-protocol.md` con los dos mensajes byte a byte y su ejemplo, y la fila del
  documento en el índice de `AGENTS.md` actualizada.
  Verificar: los tests de 2.10 pasan y el documento describe exactamente lo que hace el código.
- [x] 2.12 **(test en rojo)** Test de integración del servidor con dos clientes WebSocket: cada uno
  recibe al conectarse el mensaje de fuente (fichero con su nombre, o sin fuente); en cada pulso, un
  mensaje de nivel con el mismo `seq` que los frames, igual para los dos; sin fuente, ningún mensaje de
  nivel (`specs/audio-source`).
  Verificar: el test falla porque el servidor no envía esos mensajes.
- [x] 2.13 El servidor recibe la fuente (clase y nombre, sin ruta) al arrancar y la envía a cada
  conexión, y da una `LevelOutput` que envía el nivel a todos los paneles; `main.ts` lo conecta todo.
  Verificar: el test de 2.12 pasa; con `pnpm dev`, un cliente WebSocket de prueba recibe la fuente y el
  nivel.
- [x] 2.14 Audio de la demo (decisión 9): con permiso del usuario, descargar *Bouncer* de OpenGameArt y
  comprobar su licencia CC0 en la página; el WAV original, tal cual, en `config/audio/bouncer.wav`,
  con `config/audio/README.md` (autor, enlace, licencia y que es el original). `config/demo.json`
  declara esa fuente y `"effect": "energy"`. Sin commit: lo mismo en `config/local.json` de esta
  máquina.
  Verificar: el fichero es el original, byte a byte; en un clon limpio, `pnpm dev` muestra la tira
  reaccionando a la música, y al volver a empezar la tira no se apaga (decisión 9).
- [x] 2.15 Documentación:
  - README §2.2 (*Análisis de audio*: bandas mel, nivel, sin detector de golpes; efecto *energía*) y
    el ticket `MOO-20` del §6 (sin parámetros de sensibilidad ni golpes; rasgos que calcula);
  - README §1.4: la demo suena con un loop CC0 y la tira tiene *energía*;
  - PRD §8: «golpe» y «nivel» en el glosario, con las definiciones acordadas;
  - `docs/idea-mood-table.md` §10: D49 (*energía* de la v1, con `dt`) y D51 (fuente y nivel por el
    WebSocket), si el usuario las aprueba.

  Verificar: ningún documento dice que el análisis detecta golpes ni que *energía* tiene parámetros de
  sensibilidad.

## 3. MOO-21 · panel

- [x] 3.1 **(test en rojo)** Tests de la conexión del panel con un WebSocket falso: guarda la fuente del
  mensaje de tipo `2` y el último nivel del tipo `3`; al cerrarse, olvida los dos; ignora los mensajes
  mal formados; los frames siguen funcionando igual (`specs/audio-source`).
  Verificar: los tests nuevos fallan porque la conexión no decodifica esos mensajes.
- [x] 3.2 La conexión decodifica los mensajes de fuente y de nivel con el protocolo de
  `@moodtable/shared`, avisa de los cambios de fuente a quien se suscriba y expone el último nivel.
  Verificar: los tests de 3.1 pasan.
- [x] 3.3 **(test en rojo)** Tests de la cabecera con Testing Library: con un fichero, dice
  «Fichero: golpes.wav» y tiene un vúmetro con nombre «Nivel de la fuente de audio»; sin fuente, dice
  «Sin fuente de audio» y no hay vúmetro; sin conexión, ni fuente ni vúmetro; el vúmetro va vacío a
  −60 dB o menos y lleno a 0 dB (`specs/audio-source`, decisión 14).
  Verificar: los tests nuevos fallan porque la cabecera no muestra la fuente.
- [x] 3.4 Fuente y vúmetro en la cabecera, a la izquierda del indicador de conexión, con componentes de
  Mantine; el vúmetro pinta el último nivel en cada `requestAnimationFrame`.
  Verificar: los tests de 3.3 pasan y, con `pnpm dev`, la cabecera dice «Fichero: bouncer.wav» y el
  vúmetro sigue la música.
- [x] 3.5 E2E de HU2 en `e2e/`: `e2e/engine.ts` admite la configuración de cada test; un motor con el
  fichero de golpes y una tira con *energía*. Escenarios: *La tira virtual reacciona a un fichero de
  audio* (el visor cambia entre un golpe y el silencio, la cabecera dice «Fichero: golpes.wav» y el
  vúmetro se mueve); *Instrumento sin fuente de audio* (con la configuración de `e2e/config.json`, la
  cabecera dice «Sin fuente de audio»). Los E2E de HU1 siguen pasando.
  Verificar: `pnpm test:e2e` pasa en local y en la CI.
- [ ] 3.6 Documentación y cierre de la historia:
  - README §1.3 (*Cabecera*) y §2.2 (*Panel y visor*), si cambia lo que describen;
  - `prompts.md`: entrada de la implementación de la historia, con el formato de `course.md` §5;
  - cada escenario de los criterios de `MOO-14` tiene su test (DoD de la historia).

  Verificar: la tabla de escenarios de `MOO-14` → test está en la descripción de la PR, y
  `pnpm exec openspec validate virtual-strip-audio-file --strict` pasa.
