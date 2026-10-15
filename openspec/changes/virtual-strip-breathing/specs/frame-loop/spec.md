# Spec Delta

## Purpose

Fija el pulso del motor: cuántos frames calcula por segundo para cada tira declarada, qué hace cuando
va con retraso y cómo entrega el frame de cada tira a sus salidas.

## ADDED Requirements

### Requirement: El motor calcula un frame por tira en cada pulso
En cada pulso, el motor SHALL calcular un frame para **cada** tira declarada, con su efecto, y dar
`fps` pulsos por segundo. Los frames de un mismo pulso MUST llevar el mismo número de frame (`seq`), y
ese número MUST crecer de uno en uno de un pulso al siguiente.

> Traza: caso feliz de `MOO-13` (*ve la tira animarse*). Varias tiras y `seq`: *(asumido)*,
> `design.md`, decisión 2 (la tira es una entidad desde el principio, README §2.1).

#### Scenario: Un segundo de pulso con una tira
- **GIVEN** el motor con una tira declarada a 60 fps
- **WHEN** pasa un segundo de reloj
- **THEN** la tira ha producido 60 frames, numerados de forma consecutiva

#### Scenario: Dos tiras en el mismo pulso (asumido)
- **GIVEN** el motor con dos tiras declaradas
- **WHEN** se produce un pulso
- **THEN** cada tira produce un frame con tantos LEDs como declara
- **AND** los dos frames llevan el mismo `seq`

### Requirement: Un pulso que llega tarde se salta
Si un pulso llega tarde, el motor MUST NOT acumular retraso: SHALL saltarse los pulsos que ya han
pasado y calcular el del instante actual. El `seq` del frame que se calcula SHALL corresponder a ese
instante, así que los pulsos saltados dejan un hueco en la numeración.

> Traza: *(asumido)*, README §2.2 (*si llega tarde, se salta el frame en lugar de acumular retraso*) y
> `design.md`, decisión 7.

#### Scenario: El motor se retrasa tres pulsos (asumido)
- **GIVEN** el motor a 60 fps, que acaba de entregar el frame con `seq` 10
- **WHEN** el siguiente pulso se ejecuta cuatro pulsos más tarde de lo previsto
- **THEN** el frame que se calcula lleva `seq` 14 y corresponde al instante actual
- **AND** no se calculan los frames 11, 12 y 13

### Requirement: El frame de cada tira llega a todas sus salidas
El motor SHALL entregar el frame de cada tira a todas sus salidas. El visor MUST ser siempre una de
ellas, sea cual sea la salida declarada en el fichero; una tira con salida `virtual` solo tiene el
visor.

> Traza: caso feliz de `MOO-13` (*ve la tira virtual en el visor*); glosario del PRD (*el visor dibuja
> todas las tiras*). `design.md`, decisión 2.

#### Scenario: Una tira virtual llega al visor
- **GIVEN** el motor con una tira de salida `virtual`
- **WHEN** se produce un pulso
- **THEN** el visor recibe el frame de esa tira
- **AND** ninguna otra salida lo recibe

### Requirement: Una salida no ve cambiar un frame que ya ha recibido
Un frame entregado a una salida MUST reflejar los colores de su pulso. Si una salida lo conserva, los
pulsos siguientes MUST NOT cambiar lo que esa salida ha guardado.

> Traza: *(asumido)*, `design.md`, decisión 2 (el búfer del frame es del bucle y se reutiliza).

#### Scenario: Una salida guarda los frames que recibe (asumido)
- **GIVEN** una salida que guarda cada frame que recibe
- **WHEN** se producen dos pulsos con colores distintos
- **THEN** la salida tiene dos frames distintos, cada uno con los colores de su pulso
