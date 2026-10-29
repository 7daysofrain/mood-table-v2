# Spec Delta

## MODIFIED Requirements

### Requirement: Cada tira declara su identificador, su nombre, su salida y sus LEDs
Cada tira del fichero MUST declarar `id` (único en el fichero), `name`, `output`, `ledCount` (entero
mayor que 0) y `effect`, el efecto con el que arranca. `output` SHALL ser un objeto cuyo `type` decide
sus demás campos. Hay dos tipos de salida: `virtual`, sin más campos, y `adalight`, que MUST declarar
`port` (el puerto serie, una ruta no vacía) y `baudRate` (los baudios), que SHALL ser una de las
velocidades estándar: 9600, 19200, 38400, 57600, 115200, 230400, 460800, 500000, 576000, 921600,
1000000, 1500000 o 2000000.

> Traza: `MOO-13`, non-goal *El fichero de tiras es mínimo (nombre, nº de LEDs y salida virtual)*. El
> resto de campos llegan con H3 y H4. `effect`: caso feliz de `MOO-14` (*el fichero de configuración
> indica el efecto "energía" para la tira virtual*, asumido en la historia). La salida `adalight`, su
> puerto serie y sus baudios: caso feliz de `MOO-111` (*el fichero de configuración declara esa tira
> con salida Adalight, su puerto serie y sus baudios*). La lista de velocidades: `design.md`,
> decisión 6.

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
- **GIVEN** un `config/local.json` con una tira `{ "id": "mesa", "name": "Mesa", "output": { "type": "adalight", "port": "/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0", "baudRate": 115200 }, "ledCount": 173, "effect": "breathing" }`
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
