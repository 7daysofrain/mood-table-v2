## MODIFIED Requirements

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
> El orden de color declarado en una tira: `MOO-136`, escenario *El fichero de configuración declara
> el orden de color de una tira*. El orden lo fija el chip, no el fichero (D111).

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

#### Scenario: El fichero de configuración declara el orden de color de una tira
- **GIVEN** un `config/local.json` con una tira física que declara su orden de color, por ejemplo
  `"colorOrder": "GRB"` en la tira o en su salida
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el campo que no existe
