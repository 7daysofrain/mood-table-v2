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
sus demás campos. El único tipo de salida que existe es `virtual`, sin más campos.

> Traza: `MOO-13`, non-goal *El fichero de tiras es mínimo (nombre, nº de LEDs y salida virtual)*. El
> resto de campos llegan con H3 y H4. `effect`: caso feliz de `MOO-14` (*el fichero de configuración
> indica el efecto "energía" para la tira virtual*, asumido en la historia).

#### Scenario: Tira virtual mínima
- **GIVEN** un `config/local.json` con una tira `{ "id": "demo", "name": "Tira de prueba", "output": { "type": "virtual" }, "ledCount": 60, "effect": "breathing" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor arranca con esa tira de 60 LEDs

#### Scenario: Dos tiras con el mismo id (asumido)
- **GIVEN** un `config/local.json` con dos tiras con el mismo `id`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice qué `id` está repetido

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
campos. El único tipo que existe en este change es `file`, con `path`: la ruta del fichero, absoluta o
relativa a la raíz del repositorio. Sin `audioSource`, el instrumento no tiene fuente de audio.

> Traza: caso feliz de `MOO-14` (*con un fichero de audio como fuente de audio*) y glosario del PRD
> (*fuente de audio: opcional*). El tipo como discriminador y la raíz del repositorio son *(asumido)*:
> `design.md`, decisiones 8 y 12. `MOO-15` añade el tipo de la tarjeta de sonido.

#### Scenario: Fichero de audio con ruta relativa (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "file", "path": "config/audio/bouncer.wav" }`
- **WHEN** el maker arranca el motor desde un directorio de trabajo distinto de la raíz
- **THEN** el motor usa como fuente el `config/audio/bouncer.wav` de la raíz del repositorio

#### Scenario: Fichero de audio con ruta absoluta (asumido)
- **GIVEN** un `config/local.json` cuya fuente de audio es un fichero con ruta absoluta
- **WHEN** el maker arranca el motor
- **THEN** el motor usa como fuente ese fichero

#### Scenario: Una fuente de audio de un tipo que no existe (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "mp3", "path": "musica.mp3" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo `audioSource.type` y dice qué valor admite

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
