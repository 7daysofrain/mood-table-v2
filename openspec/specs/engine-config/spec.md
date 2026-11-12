# engine-config Specification

## Purpose

Fija qué declara el fichero de configuración del instrumento (las tiras y los ajustes de cada
instalación), dónde lo busca el motor y cuándo le impide arrancar.

## Requirements

### Requirement: El motor carga la configuración de `config/local.json`
Al arrancar, el motor SHALL leer la configuración de `config/local.json`, resuelto desde la raíz del
repositorio y no desde el directorio de trabajo. Si la configuración es válida, MUST arrancar y
escribir una línea de log que diga qué fichero ha cargado, cuántas tiras declara y a cuántos fps va.
Solo para los tests, si existe la variable de entorno `MOODTABLE_CONFIG`, el motor SHALL cargar el
fichero que indica en lugar de `config/local.json`. Si esa ruta es relativa, se resuelve desde la raíz
del repositorio.

> Traza: precondición del caso feliz de `MOO-13` (*con una sola tira virtual declarada*). La ruta y la
> línea de log son *(asumido)*: decididas en la exploración (`design.md`, decisiones 3 y Goals).
> `MOODTABLE_CONFIG` es *(asumido)*: los E2E de `MOO-18` necesitan su propio fichero y su propio
> puerto (`design.md`, decisión 3). Que su ruta relativa se resuelva desde la raíz es *(asumido)*:
> change `virtual-strip-audio-file`, `design.md`, decisión 8 (todas las rutas relativas, desde la
> raíz).

#### Scenario: Arranque con una configuración válida
- **GIVEN** un `config/local.json` que declara una tira virtual
- **WHEN** el maker arranca el motor
- **THEN** el motor queda en marcha
- **AND** el log dice que ha cargado `config/local.json`, con 1 tira a 60 fps

#### Scenario: Arranque desde otro directorio (asumido)
- **GIVEN** un `config/local.json` válido en la raíz del repositorio
- **WHEN** el motor se arranca desde un directorio de trabajo distinto de la raíz
- **THEN** el motor carga ese mismo `config/local.json` y queda en marcha

#### Scenario: Los E2E cargan su propio fichero (asumido)
- **GIVEN** la variable de entorno `MOODTABLE_CONFIG` con la ruta de un fichero de configuración
- **WHEN** se arranca el motor
- **THEN** el motor carga ese fichero en lugar de `config/local.json`
- **AND** el log dice qué fichero ha cargado

#### Scenario: `MOODTABLE_CONFIG` con una ruta relativa (asumido)
- **GIVEN** la variable de entorno `MOODTABLE_CONFIG` con la ruta relativa `e2e/config.json`
- **WHEN** se arranca el motor desde un directorio de trabajo distinto de la raíz
- **THEN** el motor carga el `e2e/config.json` de la raíz del repositorio

### Requirement: El motor no arranca si el fichero de configuración no sirve
Si el fichero de configuración no sirve, el motor MUST NOT arrancar: SHALL terminar con un código de
salida distinto de 0 y escribir en la salida de errores un mensaje que nombre el fichero y diga qué
falla en él.

> Traza: esquema del escenario *El instrumento no arranca si el fichero de configuración no sirve* de
> `MOO-13` (ejemplos *no existe* y *no declara ninguna tira*). El JSON mal escrito y el campo inválido
> son *(asumido)*: `design.md`, decisión 4. El campo que no existe es *(asumido)*: revisión de la PR de
> `MOO-16`. Sin él, una errata en un campo opcional se ignora sin avisar. El máximo de 256 tiras es
> *(asumido)*: revisión de la PR de `MOO-17`; el índice de la tira ocupa un byte en el protocolo del
> visor (D45), y sin el máximo el motor arrancaría y caería al conectar un navegador.

#### Scenario: El fichero no existe
- **GIVEN** que no existe `config/local.json`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que no encuentra el fichero de configuración e indica su ruta

#### Scenario: El fichero no declara ninguna tira
- **GIVEN** un `config/local.json` cuya lista `strips` está vacía o no existe
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que el fichero no declara ninguna tira

#### Scenario: El JSON está mal escrito (asumido)
- **GIVEN** un `config/local.json` que no es JSON válido
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que el fichero no es JSON válido y en qué punto falla

#### Scenario: Una tira tiene un campo que no cumple el esquema (asumido)
- **GIVEN** un `config/local.json` con una tira cuyo `ledCount` es 0, o cuya salida es de un tipo
  que no existe
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo que falla

#### Scenario: El fichero tiene un campo que no existe (asumido)
- **GIVEN** un `config/local.json` con un campo que el esquema no declara, por ejemplo `"fsp": 30`
  (una errata de `fps`) o `"ledcont"` en una tira
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo que no existe (y la tira, si está en una)

#### Scenario: El fichero declara más de 256 tiras (asumido)
- **GIVEN** un `config/local.json` con 257 tiras
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que `strips` admite como mucho 256 tiras

### Requirement: Cada tira declara su identificador, su nombre, su salida y sus LEDs
Cada tira del fichero MUST declarar `id` (único en el fichero), `name`, `output`, `ledCount` (entero
mayor que 0) y `effect`, el efecto con el que arranca. `output` SHALL ser un objeto cuyo `type` decide
sus demás campos. Hay dos tipos de salida: `virtual`, sin más campos, y `adalight`, que MUST declarar
`port` (el puerto serie, una ruta no vacía) y `baudRate` (los baudios), que SHALL ser una de las
velocidades estándar: 9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600,
1000000, 1500000 o 2000000. La salida `adalight` MUST declarar también `chip` y `power`, que fija el
requisito *Una tira física declara su chip y la fuente que la alimenta*.

> Traza: `MOO-13`, non-goal *El fichero de tiras es mínimo (nombre, nº de LEDs y salida virtual)*. El
> resto de campos llegan con H3 y H4. `effect`: caso feliz de `MOO-14` (*el fichero de configuración
> indica el efecto "energía" para la tira virtual*, asumido en la historia). La salida `adalight`, su
> puerto serie y sus baudios: caso feliz de `MOO-111` (*el fichero de configuración declara esa tira
> con salida Adalight, su puerto serie y sus baudios*). La lista de velocidades: `design.md`,
> decisión 6. `chip` y `power`: `MOO-135` (change `power-limit`).

#### Scenario: Tira virtual mínima
- **GIVEN** un `config/local.json` con una tira `{ "id": "demo", "name": "Tira de prueba", "output": { "type": "virtual" }, "ledCount": 60, "effect": "breathing" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor arranca con esa tira de 60 LEDs

#### Scenario: Dos tiras con el mismo id (asumido)
- **GIVEN** un `config/local.json` con dos tiras con el mismo `id`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice qué `id` está repetido

#### Scenario: Tira con salida Adalight
- **GIVEN** un `config/local.json` con una tira `{ "id": "mesa", "name": "Mesa", "output": { "type": "adalight", "port": "/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0", "baudRate": 115200, "chip": "WS2812B", "power": { "supplyAmps": 8 } }, "ledCount": 173, "effect": "breathing" }`
- **AND** el controlador Adalight conectado en ese puerto
- **WHEN** el maker arranca el motor
- **THEN** el motor arranca con esa tira de 173 LEDs, con salida Adalight

#### Scenario: Una salida Adalight sin puerto serie
- **GIVEN** un `config/local.json` con una tira de salida `adalight` sin `port`, o con `port` vacío
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.port`

#### Scenario: Una salida Adalight sin baudios
- **GIVEN** un `config/local.json` con una tira de salida `adalight` sin `baudRate`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.baudRate`

#### Scenario: Unos baudios que no son una velocidad estándar
- **GIVEN** un `config/local.json` con una tira de salida `adalight` con `"baudRate": 11520`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.baudRate`, y dice qué velocidades admite

#### Scenario: Un puerto en una salida virtual (asumido)
- **GIVEN** un `config/local.json` con una tira `{ "type": "virtual", "port": "/dev/ttyUSB0" }` como
  salida
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y dice que el campo `output.port` no existe

### Requirement: Los fps son opcionales, 60 por defecto y 60 como máximo
El campo `fps` (el pulso del motor: frames que calcula por segundo) SHALL ser opcional. Si el fichero
no lo declara, el motor MUST usar 60. Si el fichero declara un `fps` que no es un entero entre 1 y 60,
el motor MUST NOT arrancar y el mensaje nombra el campo.

> Traza: *(asumido)*, `design.md`, decisión 4. Fuente de las cifras: glosario del PRD (*unos 60 por
> segundo*), D30 (la demo pública va a 30) y README §2.2 (*tasa objetivo configurable, 30-60 fps*). El
> máximo es *(asumido)*: revisión de la PR de `MOO-16`.

#### Scenario: Sin fps en el fichero (asumido)
- **GIVEN** un `config/local.json` válido sin `fps`
- **WHEN** el maker arranca el motor
- **THEN** el log dice que va a 60 fps

#### Scenario: Con fps en el fichero (asumido)
- **GIVEN** un `config/local.json` válido con `"fps": 30`
- **WHEN** el maker arranca el motor
- **THEN** el log dice que va a 30 fps

#### Scenario: Con fps por encima de 60 (asumido)
- **GIVEN** un `config/local.json` con `"fps": 120`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que `fps` debe ser 60 o menos

### Requirement: La dirección del motor es opcional y solo local por defecto
El campo `server` (con `host` y `port`) SHALL ser opcional. Si el fichero no lo declara, el motor MUST
escuchar solo en la propia máquina (`127.0.0.1`), en el puerto 8080.

> Traza: *(asumido)*, `design.md`, decisión 13. El panel no tiene contraseña (README §2.5).

#### Scenario: Sin server en el fichero (asumido)
- **GIVEN** un `config/local.json` válido sin `server`
- **WHEN** el motor está en marcha
- **THEN** el panel se abre en `http://127.0.0.1:8080`
- **AND** el motor no acepta conexiones desde otra máquina de la red

#### Scenario: Con server en el fichero (asumido)
- **GIVEN** un `config/local.json` válido con `"server": { "host": "0.0.0.0", "port": 9090 }`
- **WHEN** el motor está en marcha
- **THEN** el panel se abre en el puerto 9090 desde cualquier máquina de la red

### Requirement: El simulador arranca sin preparar nada
`pnpm dev` SHALL crear `config/local.json` copiando `config/demo.json` si no existe, y arrancar el
motor. `config/demo.json` MUST declarar una sola tira virtual, con el efecto *energía*, y un fichero de
audio versionado en el repositorio como fuente de audio. `config/local.json` MUST NOT versionarse.

> Traza: caso feliz de `MOO-13` (*el instrumento funciona sin hardware, con una sola tira virtual
> declarada*), caso feliz de `MOO-14` (*con un fichero de audio como fuente de audio*) y expectativa
> E7. La copia automática es *(asumido)*: `design.md` de `virtual-strip-breathing`, decisiones 3 y 6.
> El fichero de audio de la demo: `design.md`, decisión 9.

#### Scenario: Primer arranque del simulador
- **GIVEN** un clon del repositorio sin `config/local.json`
- **WHEN** el maker ejecuta `pnpm dev`
- **THEN** existe `config/local.json` con el contenido de `config/demo.json`
- **AND** el motor arranca con una tira virtual con *energía*, que reacciona al fichero de audio de
  la demo

#### Scenario: El fichero local no se pisa (asumido)
- **GIVEN** un `config/local.json` que el maker ha cambiado
- **WHEN** el maker ejecuta `pnpm dev`
- **THEN** `config/local.json` conserva los cambios del maker
- **AND** git no lo muestra como fichero nuevo ni modificado

### Requirement: La fuente de audio es opcional y se declara con su tipo
El campo `audioSource` SHALL ser opcional. Si existe, MUST ser un objeto cuyo `type` decide sus demás
campos. `file` lleva `path`: la ruta del fichero, absoluta o relativa a la raíz del repositorio.
`soundcard` lleva `name` (el nombre que muestra el panel), `device` (la cadena de dispositivo de ALSA)
y `silenceThreshold`, opcional: el umbral de silencio en dBFS, entre −120 y 0, −60 por defecto. Sin
`audioSource`, el instrumento no tiene fuente de audio.

> Traza: caso feliz de `MOO-14` (*con un fichero de audio como fuente de audio*), caso feliz de
> `MOO-15` (*el fichero de configuración declara la tarjeta de sonido como fuente de audio*) y
> glosario del PRD (*fuente de audio: opcional*). El tipo como discriminador y la raíz del repositorio
> son *(asumido)*: `design.md` de `virtual-strip-audio-file`, decisiones 8 y 12. Los campos de la
> tarjeta son *(asumido)*: `design.md`, decisiones 3 y 7.

#### Scenario: Fichero de audio con ruta relativa (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "file", "path": "config/audio/bouncer.wav" }`
- **WHEN** el maker arranca el motor desde un directorio de trabajo distinto de la raíz
- **THEN** el motor usa como fuente el `config/audio/bouncer.wav` de la raíz del repositorio

#### Scenario: Fichero de audio con ruta absoluta (asumido)
- **GIVEN** un `config/local.json` cuya fuente de audio es un fichero con ruta absoluta
- **WHEN** el maker arranca el motor
- **THEN** el motor usa como fuente ese fichero

#### Scenario: Tarjeta de sonido sin umbral de silencio (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "soundcard", "name": "Mixer de la mesa", "device": "plughw:CARD=Device,DEV=0" }`
- **WHEN** el maker arranca el motor en la Pi, con esa tarjeta conectada
- **THEN** el motor usa como fuente esa tarjeta, con un umbral de silencio de −60 dBFS

#### Scenario: Un campo de la tarjeta de sonido que falta o no vale (asumido)
- **GIVEN** un `config/local.json` cuya fuente de audio es una tarjeta de sonido sin `name`, sin
  `device`, con alguno de los dos vacío, o con un `silenceThreshold` fuera de −120 a 0
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo (`audioSource.name`, `audioSource.device` o
  `audioSource.silenceThreshold`) y dice qué falla

#### Scenario: Una fuente de audio de un tipo que no existe (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "mp3", "path": "musica.mp3" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo `audioSource.type` y dice qué valores admite

### Requirement: El efecto de cada tira es obligatorio y tiene que existir
El motor MUST NOT arrancar si una tira no declara `effect` o si declara un efecto que no existe. El
identificador del efecto va en inglés (`breathing`, `energy`) y el mensaje SHALL nombrar la tira y, si
el efecto no existe, decir cuáles hay.

> Traza: caso feliz de `MOO-14` (*el fichero de configuración indica el efecto "energía"*, asumido en
> la historia). Que sea obligatorio y se valide es *(asumido)*: `design.md`, decisión 10.

#### Scenario: Una tira sin efecto (asumido)
- **GIVEN** un `config/local.json` con una tira sin `effect`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y dice que el campo `effect` falta y es obligatorio

#### Scenario: Un efecto que no existe (asumido)
- **GIVEN** un `config/local.json` con una tira con `"effect": "energia"`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira, dice que «energia» no es un efecto y cuáles hay: `breathing`,
  `energy`

### Requirement: Un efecto reactivo necesita una fuente de audio
Si una tira declara un efecto que usa audio y el fichero no declara `audioSource`, el motor MUST NOT
arrancar. El mensaje SHALL nombrar la tira y decir que su efecto necesita una fuente de audio.

> Traza: *(asumido)*, `design.md`, decisión 6: al arrancar solo puede ser un error de configuración.
> Glosario del PRD: *sin fuente solo funcionan los efectos de ambiente*.

#### Scenario: Energía sin fuente de audio (asumido)
- **GIVEN** un `config/local.json` sin `audioSource` y con una tira con `"effect": "energy"`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y dice que *energy* necesita una fuente de audio

### Requirement: El fichero dice dónde se guarda el estado del instrumento
El campo `instrumentState` SHALL ser opcional. Si existe, su `type` decide: `sqlite` guarda el estado
en el fichero de `path`, absoluta o relativa a la raíz del repositorio; `memory` no lo guarda, y cada
arranque es como el primero. Sin el campo, el motor MUST guardarlo en `data/instrument-state.db`, en la
raíz del repositorio, que git ignora.

> Traza: *(asumido)*, decisión al explorar `MOO-25` (`design.md`, decisión 7).

#### Scenario: Sin `instrumentState` en el fichero (asumido)
- **GIVEN** un `config/local.json` válido sin `instrumentState`
- **WHEN** el maker arranca el motor desde un directorio de trabajo distinto de la raíz, cambia el
  efecto de una tira y, pasado 1 s, lo reinicia
- **THEN** la tira vuelve con el efecto que le había puesto
- **AND** el estado está en `data/instrument-state.db`, en la raíz del repositorio

#### Scenario: Con una ruta propia (asumido)
- **GIVEN** un `config/local.json` con `"instrumentState": { "type": "sqlite", "path": "/var/lib/moodtable/estado.db" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor guarda el estado en `/var/lib/moodtable/estado.db`

#### Scenario: En memoria (asumido)
- **GIVEN** un `config/local.json` con `"instrumentState": { "type": "memory" }` y una tira con
  `"effect": "breathing"`
- **AND** el DJ ha cambiado esa tira a la energía
- **WHEN** el motor se reinicia
- **THEN** la tira respira, como la primera vez
- **AND** el motor no ha escrito ningún fichero de estado

#### Scenario: Un tipo que no existe (asumido)
- **GIVEN** un `config/local.json` con `"instrumentState": { "type": "json" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo `instrumentState.type` y dice qué valores admite

### Requirement: Si no puede guardar el estado, el motor arranca igualmente
Si el motor no puede crear ni abrir el fichero del estado (p. ej. no tiene permiso o el disco es de
solo lectura), MUST arrancar sin guardar, como con `memory`, y SHALL decir en el log qué fichero no
puede usar y por qué. Si falta la carpeta del fichero, el motor MUST crearla.

> Traza: *(asumido)*, decisión al proponer `MOO-25` (`design.md`, decisión 7): un instrumento que no
> arranca es peor que uno que no recuerda, y el aviso va al log, como un estado dañado.

#### Scenario: Un fichero de estado que no se puede crear (asumido)
- **GIVEN** un `config/local.json` cuyo `instrumentState.path` está en una carpeta de solo lectura
- **WHEN** el maker arranca el motor
- **THEN** el motor arranca y las tiras se animan con el efecto del fichero
- **AND** el log dice qué fichero de estado no puede usar y por qué

#### Scenario: La carpeta del fichero no existe (asumido)
- **GIVEN** un clon del repositorio sin la carpeta `data/` y un `config/local.json` sin
  `instrumentState`
- **WHEN** el maker arranca el motor
- **THEN** existe `data/instrument-state.db`

### Requirement: Una tira física declara su chip y la fuente que la alimenta
La salida `adalight` MUST declarar `chip` (hoy solo `WS2812B`) y `power.supplyAmps`, los amperios
de salida de la etiqueta de su fuente. El motor MUST NOT arrancar si falta alguno, si no conoce el
chip o si los amperios no llegan a un LED de ese chip a todo brillo. El mensaje SHALL nombrar la
tira y el campo.

> Traza: `MOO-135`, esquema del escenario *El instrumento no arranca si la declaración de la fuente
> no sirve*. Dónde se declara: `design.md`, decisión 5.

#### Scenario: La tira no declara los amperios de su fuente
- **GIVEN** un `config/local.json` con una tira de salida `adalight` sin `power`, o con `power` sin
  `supplyAmps`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.power` u `output.power.supplyAmps`

#### Scenario: La tira no declara su chip
- **GIVEN** un `config/local.json` con una tira de salida `adalight` sin `chip`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.chip`

#### Scenario: La tira declara un chip que el motor no conoce
- **GIVEN** un `config/local.json` con una tira de salida `adalight` con `"chip": "SK6812"`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.chip`, y dice qué chips conoce

#### Scenario: La tira declara unos amperios de 0 o negativos
- **GIVEN** un `config/local.json` con una tira de salida `adalight` con `"supplyAmps": 0` o
  `"supplyAmps": -8`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.power.supplyAmps`

#### Scenario: La tira declara menos amperios de los que pide un solo LED de su chip (asumido)
- **GIVEN** un `config/local.json` con una tira de salida `adalight`, chip `WS2812B` y
  `"supplyAmps": 0.008`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo `output.power.supplyAmps`, y dice que no llega a los
  0,06 A de un LED `WS2812B` a todo brillo

#### Scenario: Un chip o una fuente en una salida virtual (asumido)
- **GIVEN** un `config/local.json` con una tira `{ "type": "virtual", "chip": "WS2812B" }` como salida
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y dice que el campo `output.chip` no existe
