# Spec Delta

## MODIFIED Requirements

### Requirement: El frame de cada tira llega a todas sus salidas
El motor SHALL entregar el frame de cada tira a todas sus salidas. El visor MUST ser siempre una de
ellas, sea cual sea la salida declarada en el fichero; una tira con salida `virtual` solo tiene el
visor, y una con salida `adalight` tiene el visor y su salida Adalight. La salida Adalight MUST
recibir los frames haya o no paneles conectados.

> Traza: caso feliz de `MOO-13` (*ve la tira virtual en el visor*); glosario del PRD (*el visor dibuja
> todas las tiras*). `design.md` de `virtual-strip-breathing`, decisión 2. La tira física: caso feliz
> de `MOO-111` (*la tira física pinta lo mismo que esa tira en el visor*) y su esquema del escenario
> *La tira física pinta aunque no haya ningún panel mirando*.

#### Scenario: Una tira virtual llega al visor
- **GIVEN** el motor con una tira de salida `virtual`
- **WHEN** se produce un pulso
- **THEN** el visor recibe el frame de esa tira
- **AND** ninguna otra salida lo recibe

#### Scenario: Una tira física llega al visor y a su salida Adalight
- **GIVEN** el motor con una tira de salida `adalight`
- **WHEN** se produce un pulso
- **THEN** el visor y la salida Adalight de esa tira reciben el mismo frame

#### Scenario: La tira física recibe frames sin ningún panel
- **GIVEN** el motor con una tira de salida `adalight` y ningún panel conectado (no se ha abierto
  ninguno, o el DJ ha cerrado o recargado el último)
- **WHEN** se producen pulsos
- **THEN** la salida Adalight de esa tira recibe el frame de cada pulso
