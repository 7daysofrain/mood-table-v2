# Tasks

> Dos tareas de Linear, dos secciones y dos PR contra `main`: `MOO-60` parte de `MOO-23` ya integrada
> (`design.md`, decisión 2). Cada paso es un commit con `Refs MOO-n` de su tarea; la PR lleva
> `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso
> siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`,
> `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la última PR, en una
> rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-23 · engine

- [x] 1.1 **(test en rojo)** Tests del esquema en `packages/shared/src/config.test.ts`: acepta
  `{ "type": "soundcard", "name", "device" }` y aplica `silenceThreshold: -60`; acepta un
  `silenceThreshold` de −120, de 0 y de −45,5; rechaza, nombrando el campo, una tarjeta sin `name` o
  sin `device`, con alguno vacío, con `silenceThreshold` fuera de −120 a 0 o que no es un número, y
  con un campo que no existe (`path` en una tarjeta); el tipo desconocido dice que se admiten «file»
  y «soundcard»; un efecto reactivo con una tarjeta como fuente arranca (`specs/engine-config`,
  decisión 3).
  Verificar: los tests nuevos fallan porque el tipo `soundcard` no existe; el resto sigue en verde.
- [x] 1.2 `AudioSourceConfigSchema` con la variante `soundcard` (cerrada, como la de `file`) y el
  valor por defecto de `silenceThreshold`.
  Verificar: los tests de 1.1 pasan.
- [x] 1.3 **(test en rojo)** Tests del protocolo en `packages/shared/src/viewer-protocol.test.ts`:
  `encodeSource` con `{ kind: 'soundcard', name: 'Mixer de la mesa' }` da `02 02` seguido del nombre
  en UTF-8, y `decodeSource` lo devuelve igual; rechaza la clase `2` sin nombre o con un UTF-8
  inválido; las clases `0` y `1` no cambian (decisión 9).
  Verificar: los tests nuevos fallan porque la clase `2` no existe.
- [x] 1.4 `SourceMessage` con `kind: 'soundcard'` y la clase `2` en `encodeSource` y `decodeSource`;
  `docs/instructions/viewer-protocol.md` con la clase nueva y su ejemplo.
  Verificar: los tests de 1.3 pasan, el documento describe exactamente lo que hace el código, y
  `pnpm typecheck` pasa también en `panel` (la cabecera aún dice «Fichero:» para la tarjeta: estado
  intermedio de la decisión 2).
- [ ] 1.5 **(test en rojo)** Tests del núcleo: con una fuente en memoria que declara
  `silenceThreshold: -60`, un ruido de −80 dBFS RMS cuenta como silencio y *energía* deja la tira a 0;
  una señal de −30 dBFS no, y la tira reacciona; una fuente sin `silenceThreshold` y ese mismo ruido
  no es silencio (la puerta digital sigue igual); los frames dorados de `energy` no cambian
  (`specs/effects`, decisión 7).
  Verificar: los tests nuevos fallan porque el análisis no conoce el umbral.
- [ ] 1.6 `silenceThreshold` opcional (dBFS) en el puerto `AudioSource`; el análisis lo recibe al
  crearse y da por silencio la ventana con silencio digital o con nivel RMS por debajo del umbral.
  Verificar: los tests de 1.5 pasan y los dorados no cambian.
- [ ] 1.7 **(test en rojo)** Tests de `packages/engine/src/adapters/soundcard.ts` con un proceso falso
  en memoria (decisiones 4, 5 y 6):
  - los argumentos de `arecord` salen de `device` (`-q -D … -t raw -f S16_LE -c 1 -r 48000
    --period-time=10000 --buffer-time=40000`);
  - el arranque se resuelve bien con el primer bloque, aunque sea silencio, y mal si el proceso
    termina antes, con un mensaje con el nombre, la cadena y la última línea de `stderr`; un `ENOENT`
    al lanzar da el mensaje de «necesita Linux con ALSA»; una línea de `stderr` sin final no es un
    fallo;
  - los bytes s16le se convierten a muestras de −1 a 1, también con bloques de longitud impar que
    parten una muestra;
  - los primeros 14 400 bytes (300 ms) no llegan al búfer;
  - `read` da las últimas muestras, con ceros por delante si aún no hay bastantes, sin mirar `time`;
  - si el proceso termina en plena sesión, `read` da ceros desde ese momento y el log recibe una sola
    línea con el nombre, la cadena y el motivo;
  - la fuente lleva `sampleRate` 48 000, el `silenceThreshold` de la configuración, y no tiene
    `positionAt`.

  Verificar: los tests nuevos fallan porque el adaptador no existe.
- [ ] 1.8 `soundcard.ts` (la parte pura de 1.7) y `soundcard.hardware.ts` (`child_process.spawn` de
  `arecord`, que implementa el proceso).
  Verificar: los tests de 1.7 pasan; `soundcard.hardware.ts` queda fuera de la cobertura por su
  nombre.
- [ ] 1.9 **(test en rojo)** Tests de `engine.ts`: `sourceMessage` con una tarjeta como fuente da
  `{ kind: 'soundcard', name }`, sin la cadena de dispositivo; con un fichero, igual que ahora
  (`specs/audio-source`, *Un panel se conecta con la tarjeta de sonido como fuente*).
  Verificar: los tests nuevos fallan porque `sourceMessage` solo conoce el fichero.
- [ ] 1.10 `sourceMessage` con la tarjeta; `main.ts` abre la tarjeta antes que el servidor (como el
  fichero), con el log de la pérdida en `console.error`, y no sirve `/audio` con ella.
  Verificar: los tests de 1.9 pasan; en el Mac, con una tarjeta declarada, `pnpm dev` no arranca y
  dice que necesita Linux con ALSA.
- [ ] 1.11 Comprobación en la Pi (excepción al DoD de la historia; el usuario está en la mesa):
  - con la cadena de la tarjeta de la mesa, el motor arranca aunque no le llegue nada;
  - con la tarjeta desconectada, y con una cadena que no existe, no arranca y lo dice (los dos
    ejemplos del esquema de `MOO-15`);
  - al desconectarla con el motor en marcha, el motor sigue y el log lo dice una vez;
  - con el mixer conectado y en silencio, el usuario apaga el control automático de ganancia, ajusta
    la ganancia de grabación (decisión 8) y comprueba en el vúmetro si el ruido pasa de −60 dBFS; si
    pasa, elige `silenceThreshold` en su `config/local.json`.

  Verificar: lo comprobado, y los valores de ganancia y umbral elegidos, quedan en la descripción de
  la PR.
- [ ] 1.12 Documentación:
  - README §2.2 (adaptador *Tarjeta de sonido*: `arecord`, búfer circular, descarte inicial, arranque
    y pérdida, umbral de silencio) y §3 (el tipo `soundcard` de `audioSource`, con un ejemplo);
  - `HARDWARE_SETUP.md`: cómo sacar la cadena con `arecord -l`, por qué `plughw` y el nombre en vez
    del número, la regla de udev para dos tarjetas iguales, el mezclador con `amixer` y
    `sudo alsactl store`, y cómo elegir el umbral de silencio con el vúmetro;
  - `docs/idea-mood-table.md` §10: D56 a D59 (decisiones 3, 4 y 5, 7 y 8) y el riesgo de `arecord`
    de la ficha, que pasa a resuelto;
  - `prompts.md`: entrada de la exploración, la medición en la Pi, la spec y la implementación, con el
    formato de `course.md` §5.

  Verificar: README, `HARDWARE_SETUP.md` y protocolo dicen lo mismo que el código; la PR explica que
  la cabecera muestra la tarjeta en `MOO-60`.

## 2. MOO-60 · panel

- [ ] 2.1 **(test en rojo)** Tests de `AudioSourceIndicator` con Testing Library: con
  `{ kind: 'soundcard', name: 'Mixer de la mesa' }`, la cabecera dice «Tarjeta de sonido: Mixer de la
  mesa» y muestra el vúmetro; un nombre largo se recorta y el completo va en el `title`, como el del
  fichero. Test de `App`: con una tarjeta como fuente no aparece el control de oír
  (`specs/audio-source`, *La cabecera nombra la tarjeta de sonido*; decisión 9).
  Verificar: los tests nuevos fallan porque la cabecera escribe «Fichero:».
- [ ] 2.2 `AudioSourceIndicator` distingue la tarjeta del fichero.
  Verificar: los tests de 2.1 pasan, y los E2E de HU1 y HU2 siguen pasando (no hay E2E nuevo: la CI no
  tiene tarjeta de sonido, `MOO-24`).
- [ ] 2.3 Comprobación en la mesa del caso feliz de `MOO-15` (excepción al DoD): con música desde el
  mixer y una tira virtual con *energía*, el usuario abre el panel desde el portátil, ve la tira
  reaccionar, la cabecera dice «Tarjeta de sonido: \<nombre\>» con el nivel moviéndose, y juzga a ojo
  que la luz no llega tarde a los golpes (decisión 1). Con el mixer en silencio, la tira se queda
  apagada.
  Verificar: el resultado («verificado visualmente», sin cifra) queda en la descripción de la PR.
- [ ] 2.4 Documentación y cierre de la historia:
  - README §1.3 (*Cabecera*: la tarjeta de sonido) y la ficha de la historia en §5 (*Tareas*: `MOO-23`
    y `MOO-60`, sin la frase de que no hay tarea de panel; el escenario del retraso con 45 ms);
  - `prompts.md`: la entrada de la tarea;
  - cada escenario de los criterios de `MOO-15` tiene su test o su comprobación en la mesa (DoD de la
    historia): *La tira virtual reacciona* (2.3 y los tests de 1.7 y 2.1), *No arranca si la tarjeta
    no está* (1.7 y 1.11), *No llega tarde* (2.3), *Con varias tarjetas, usa la declarada* (1.7: los
    argumentos llevan la cadena declarada).

  Verificar: la tabla de escenarios de `MOO-15` → test está en la descripción de la PR, y
  `pnpm exec openspec validate soundcard-audio-source --strict` pasa.
