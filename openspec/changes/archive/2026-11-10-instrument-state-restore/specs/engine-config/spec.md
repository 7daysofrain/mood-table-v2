# Spec Delta

## ADDED Requirements

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
