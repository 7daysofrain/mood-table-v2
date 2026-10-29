# Spec Delta

## MODIFIED Requirements

### Requirement: La zona Tiras lista las tiras declaradas
La zona «Tiras» del panel SHALL mostrar una lista con cada tira declarada en el fichero de
configuración, en su orden, con su nombre, su nº de LEDs y su salida, en solo lectura. De una tira con
salida Adalight MUST mostrar además la ruta de su puerto serie entera, sin recortar, en su propia
línea. Las tiras salen del motor: sin conexión con él, la zona MUST quedar vacía (requisito *Sin
conexión, Tiras y Efectos se vacían*).

> Traza: criterio *El DJ ve sus tiras* de `MOO-94` y README §1.3 (zona Tiras). La salida Adalight y
> su puerto: criterio *El panel dice qué tira es la física* de `MOO-111`. La ruta entera, en su
> propia línea: `design.md` de `adalight-strip-output`, decisión 7.

#### Scenario: El DJ ve sus tiras
- **GIVEN** que el motor está en marcha con las tiras declaradas en el fichero de configuración
- **WHEN** el DJ abre el panel
- **THEN** la zona Tiras muestra una lista con cada tira declarada
- **AND** de cada una, su nombre, su nº de LEDs y su salida

#### Scenario: El panel dice qué tira es la física
- **GIVEN** una tira «Mesa» de 173 LEDs declarada con salida Adalight en el puerto serie
  `/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0`
- **WHEN** el DJ abre el panel
- **THEN** la zona Tiras muestra esa tira con «173 LEDs · Adalight»
- **AND** debajo, la ruta entera de su puerto serie, sin recortar

#### Scenario: Una tira virtual no muestra puerto (asumido)
- **GIVEN** una tira declarada con salida virtual
- **WHEN** el DJ abre el panel
- **THEN** la zona Tiras la muestra con su nº de LEDs y «Virtual», sin ninguna línea de puerto

### Requirement: Cada panel recibe el estado de las tiras del motor
El motor SHALL enviar a cada panel, por la conexión del visor, las tiras declaradas con el efecto
activo de cada una y sus valores: al conectarse el panel y, cada vez que cambia el efecto o los
valores de una tira, a todos los paneles conectados, con el formato de
`docs/instructions/viewer-protocol.md`. El mensaje MUST llevar solo lo que muestra el panel.

> Traza: *(asumido)*, README §2.1 (*WebSocket para frames y estado*) y D51. El aviso sale del cambio,
> venga del mando que venga, así que llega a todos los paneles: `design.md` de `strip-effect-switch`,
> decisiones 1 a 3. Los valores en el mismo mensaje: `design.md`, decisión 6. Que otro panel lo vea no
> se promete en `MOO-94` ni en `MOO-95` (non-goal). El puerto sí y los baudios no: `design.md` de
> `adalight-strip-output`, decisión 7.

#### Scenario: Un panel que se conecta recibe las tiras (asumido)
- **GIVEN** el motor en marcha con dos tiras declaradas
- **WHEN** se conecta un panel
- **THEN** recibe las dos tiras, en el orden del fichero, con el efecto activo de cada una y sus
  valores

#### Scenario: Un cambio llega a todos los paneles conectados (asumido)
- **GIVEN** el motor en marcha con dos paneles conectados
- **WHEN** cambia el efecto de una tira
- **THEN** los dos paneles reciben las tiras con el efecto nuevo

#### Scenario: Un cambio de valores llega a todos los paneles conectados (asumido)
- **GIVEN** el motor en marcha con dos paneles conectados y una tira con la respiración
- **WHEN** cambian los valores de esa tira
- **THEN** los dos paneles reciben las tiras con los valores nuevos

#### Scenario: El mensaje no lleva el resto del fichero (asumido)
- **GIVEN** una tira declarada en el fichero de configuración
- **WHEN** un panel recibe el estado de las tiras
- **THEN** de esa tira solo recibe su id, su nombre, su nº de LEDs, su salida, su efecto activo y sus
  valores

#### Scenario: De una salida Adalight, el puerto sí y los baudios no (asumido)
- **GIVEN** una tira declarada con salida `adalight`, su puerto serie y sus baudios
- **WHEN** un panel recibe el estado de las tiras
- **THEN** la salida de esa tira lleva su tipo y su puerto serie
- **AND** no lleva sus baudios
