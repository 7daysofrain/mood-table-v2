# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
