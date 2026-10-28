# Spec Delta

## ADDED Requirements

### Requirement: La zona Controles muestra los controles del efecto activo
La zona «Controles» SHALL mostrar un control por cada parámetro del efecto activo de la tira
seleccionada, generado a partir del esquema del efecto: un número con rango es un slider y un color es
un selector de color. Si el efecto activo no tiene parámetros, la zona MUST quedar solo con su título.

> Traza: criterio *El panel muestra los controles de la respiración* de `MOO-95` y README §1.3 (zona
> Controles). El efecto sin parámetros es *(asumido)*: requisito *Las zonas vacías no inventan datos*
> de `panel-layout`. `design.md`, decisión 5.

#### Scenario: El panel muestra los controles de la respiración
- **GIVEN** que una tira tiene activa la respiración
- **WHEN** el DJ selecciona esa tira
- **THEN** la zona Controles muestra un control por cada parámetro de la respiración: un selector
  para el color y un slider para el periodo

#### Scenario: Un efecto sin parámetros no tiene controles (asumido)
- **GIVEN** que una tira tiene activa la energía
- **WHEN** el DJ selecciona esa tira
- **THEN** la zona Controles solo muestra su título

### Requirement: El slider del periodo va de 1 a 20 s en escala logarítmica
El slider del periodo de la respiración SHALL ir de 1 a 20 s, con una escala logarítmica: el mismo
recorrido del slider multiplica el periodo por el mismo factor en cualquier punto.

> Traza: *(asumido)*, decisión del DJ al explorar el change (`design.md`, decisión 1). Resuelve el
> rango que faltaba en PRD Q2.

#### Scenario: Los extremos y el centro del slider (asumido)
- **GIVEN** la zona Controles con la respiración de una tira
- **WHEN** el DJ lleva el slider del periodo al principio, a la mitad y al final de su recorrido
- **THEN** el periodo es 1 s, unos 4,5 s y 20 s

### Requirement: La luz responde mientras el DJ arrastra un control
Mientras el DJ arrastra un control, la tira SHALL pintarse con cada nuevo valor en menos de 100 ms
desde que lo marca el control, sin esperar a que lo suelte y sin tirones.

> Traza: esquema del escenario *La luz responde mientras el DJ arrastra un control* de `MOO-95`
> (ejemplos: color y periodo). Los 100 ms son el umbral de E1 (control → luz) en
> `docs/umbrales-para-specs.md`. `design.md`, decisiones 2 y 3.

#### Scenario: La luz responde mientras el DJ arrastra el color
- **GIVEN** que la zona Controles muestra los controles de la respiración de una tira
- **WHEN** el DJ arrastra el control de color
- **THEN** el visor pinta esa tira con cada nuevo color mientras arrastra, en menos de 100 ms y sin
  tirones

#### Scenario: La luz responde mientras el DJ arrastra el periodo
- **GIVEN** que la zona Controles muestra los controles de la respiración de una tira
- **WHEN** el DJ arrastra el control de periodo
- **THEN** el visor pinta esa tira con cada nuevo periodo mientras arrastra, en menos de 100 ms y sin
  tirones

### Requirement: Al soltar un control, la tira se queda en su valor
Cuando el DJ suelta un control, la tira SHALL quedar pintando con el valor en que lo soltó, aunque lo
haya arrastrado deprisa, y la luz MUST NOT seguir cambiando después por ese control.

> Traza: criterio *Al soltar, la luz se queda en el valor del control* de `MOO-95`. `design.md`,
> decisión 3.

#### Scenario: Al soltar, la luz se queda en el valor del control
- **GIVEN** que el DJ arrastra deprisa el control de periodo de una tira
- **WHEN** lo suelta
- **THEN** la tira pinta con el valor en que soltó el control
- **AND** la luz no sigue cambiando después

### Requirement: Mientras el DJ arrastra, el control sigue al dedo
Mientras el DJ arrastra un control, ese control SHALL seguir al dedo, aunque el motor confirme valores
que el DJ ya ha dejado atrás. En reposo, cada control MUST mostrar el valor con que pinta el motor;
si un valor no llega a aplicarse, al soltar el control vuelve al valor que pinta el motor.

> Traza: *(asumido)*, decisión del DJ al explorar el change (`design.md`, decisión 2). Excepción a
> *El panel marca el efecto que pinta el motor* solo para el control que se arrastra. Qué más debe ver
> el DJ si un valor no llega es la pregunta abierta Q8 del PRD.

#### Scenario: El control no tiembla bajo el dedo (asumido)
- **GIVEN** que el DJ arrastra el periodo de una tira de 2 s a 6 s
- **WHEN** el motor confirma 3 s mientras el dedo ya marca 5 s
- **THEN** el slider sigue marcando 5 s

#### Scenario: Un valor que no llega al motor (asumido)
- **GIVEN** una tira con la respiración a 4 s y un motor que no aplica los cambios de valores
- **WHEN** el DJ arrastra el periodo hasta 8 s y lo suelta
- **THEN** el slider vuelve a 4 s, el periodo con que pinta el motor

### Requirement: Los controles muestran los valores con que pinta el motor
Los controles de cada tira SHALL mostrar los valores con que la pinta el motor, no los valores por
defecto del efecto: también al abrir o recargar el panel con el motor en marcha.

> Traza: criterio *El panel muestra los valores con que pinta el motor* de `MOO-95`.

#### Scenario: El panel muestra los valores con que pinta el motor
- **GIVEN** que el motor está en marcha con una tira con la respiración
- **AND** el DJ le ha cambiado el color y el periodo
- **WHEN** se abre el panel
- **THEN** los controles de esa tira muestran ese color y ese periodo, no los valores por defecto

### Requirement: Cada tira tiene sus valores
Los valores de un efecto SHALL ser de cada tira: los controles muestran los de la tira seleccionada, y
cambiar un valor de una tira MUST NOT cambiar los frames de ninguna otra.

> Traza: criterios *Cada tira tiene sus valores* y *Mover un control de una tira no toca las demás* de
> `MOO-95`, y E4 (*cada una con su efecto y sus valores*).

#### Scenario: Cada tira tiene sus valores
- **GIVEN** que hay dos tiras, A y B, con la respiración y valores distintos
- **WHEN** el DJ selecciona la tira B
- **THEN** los controles muestran los valores de B

#### Scenario: Mover un control de una tira no toca las demás
- **GIVEN** que hay dos tiras, A y B, con la respiración
- **WHEN** el DJ arrastra el periodo de A
- **THEN** B sigue respirando con su periodo en el visor

### Requirement: La API cambia los valores de una tira
El motor SHALL ofrecer `PUT /api/strips/{stripId}/values`, con todos los valores del efecto activo de
la tira en el cuerpo, que los aplica desde el pulso siguiente y responde `200` con la tira. MUST
responder `404` si la tira no existe y `400` si los valores no cumplen el esquema del efecto activo
(falta uno, sobra uno o está fuera de rango), sin cambiar ninguna tira.

> Traza: *(asumido)*, README §2.2 (adaptador *API HTTP*: *los parámetros llegan con MOO-95*) y glosario
> del PRD (*mando*: cambiar un valor). Valores completos, `PUT` y esquemas cerrados: `design.md`,
> decisiones 3 y 4.

#### Scenario: Cambiar los valores por la API (asumido)
- **GIVEN** el motor en marcha con la tira «demo» con la respiración
- **WHEN** llega `PUT /api/strips/demo/values` con `{ "color": "#2040FF", "period": 7 }`
- **THEN** la API responde `200` con la tira «demo», la respiración y esos valores
- **AND** la tira respira en azul cada 7 s

#### Scenario: Un periodo fuera de rango (asumido)
- **GIVEN** el motor en marcha con la tira «demo» con la respiración a 4 s
- **WHEN** llega `PUT /api/strips/demo/values` con `{ "color": "#FFA957", "period": 25 }`
- **THEN** la API responde `400`
- **AND** la tira sigue respirando cada 4 s

#### Scenario: Valores que no son del efecto activo (asumido)
- **GIVEN** el motor en marcha con la tira «demo» con la energía
- **WHEN** llega `PUT /api/strips/demo/values` con `{ "color": "#FFA957", "period": 7 }`
- **THEN** la API responde `400`
- **AND** la tira sigue con la energía

#### Scenario: Valores de una tira que no existe (asumido)
- **GIVEN** el motor en marcha sin ninguna tira «luces»
- **WHEN** llega `PUT /api/strips/luces/values` con `{ "color": "#FFA957", "period": 7 }`
- **THEN** la API responde `404` con un mensaje que nombra la tira «luces»

### Requirement: Sin conexión, Controles se vacía
Sin conexión con el motor, la zona Controles MUST quedar vacía, solo con su título, como Tiras y
Efectos. Al volver la conexión, SHALL mostrar los controles de la tira seleccionada con los valores
que pinta el motor.

> Traza: *(asumido)*, requisito *Sin conexión, Tiras y Efectos se vacían* y *Las zonas vacías no
> inventan datos* de `panel-layout`.

#### Scenario: Se pierde la conexión con el motor y vuelve (asumido)
- **GIVEN** el panel abierto con una tira con la respiración seleccionada
- **WHEN** se pierde la conexión con el motor
- **THEN** la zona Controles solo muestra su título
- **AND** al volver la conexión, muestra el color y el periodo que pinta el motor

## MODIFIED Requirements

### Requirement: La API cambia el efecto de una tira
El motor SHALL ofrecer `PUT /api/strips/{stripId}/effect`, con el id del efecto en el cuerpo
(`{ "effect": "breathing" }`), que cambia el efecto de esa tira y responde `200` con la tira, su
efecto activo y sus valores. MUST responder `404` si la tira no existe y `400` si el cuerpo no es
válido o el efecto no existe, sin cambiar ninguna tira.

> Traza: *(asumido)*, README §2.1 (puerto `Commands`, *HTTP para comandos*) y §2.2 (adaptador *API
> HTTP*). Una sola ruta, `PUT`, sin versión en el prefijo: `design.md` de `strip-effect-switch`,
> decisiones 2 y 6. Los valores en la respuesta: `design.md`, decisión 6.

#### Scenario: Cambiar el efecto por la API (asumido)
- **GIVEN** el motor en marcha con la tira «demo» con energía
- **WHEN** llega `PUT /api/strips/demo/effect` con `{ "effect": "breathing" }`
- **THEN** la API responde `200` con la tira «demo», respiración como efecto activo y sus valores por
  defecto
- **AND** la tira se pinta con respiración

#### Scenario: Una tira que no existe (asumido)
- **GIVEN** el motor en marcha sin ninguna tira «luces»
- **WHEN** llega `PUT /api/strips/luces/effect` con `{ "effect": "breathing" }`
- **THEN** la API responde `404` con un mensaje que nombra la tira «luces»

#### Scenario: Un efecto que no existe (asumido)
- **GIVEN** el motor en marcha con la tira «demo» con energía
- **WHEN** llega `PUT /api/strips/demo/effect` con `{ "effect": "strobe" }`
- **THEN** la API responde `400`
- **AND** la tira sigue con energía

### Requirement: La API se describe en OpenAPI generado de sus esquemas
El motor SHALL servir en `/api/openapi.json` la descripción OpenAPI de su API, generada de los mismos
esquemas con los que valida cada petición. El repositorio MUST guardar esa misma descripción en
`docs/openapi.yaml`, y los tests MUST fallar si las dos no coinciden.

> Traza: *(asumido)*, README §2.1 (*un solo esquema da el tipo, la validación y el OpenAPI*) y el
> README §4 que pide la entrega final (`docs/instructions/course.md` §3). `design.md` de
> `strip-effect-switch`, decisión 6. La ruta de valores: `design.md`, decisión 4.

#### Scenario: El OpenAPI describe la ruta del cambio de efecto (asumido)
- **GIVEN** el motor en marcha
- **WHEN** se pide `/api/openapi.json`
- **THEN** describe `PUT /api/strips/{stripId}/effect`, con su cuerpo y sus respuestas `200`, `400`,
  `404` y `409`

#### Scenario: El OpenAPI describe la ruta de los valores (asumido)
- **GIVEN** el motor en marcha
- **WHEN** se pide `/api/openapi.json`
- **THEN** describe `PUT /api/strips/{stripId}/values`, con su cuerpo, el rango del periodo y sus
  respuestas `200`, `400` y `404`

#### Scenario: El fichero del repositorio está al día (asumido)
- **GIVEN** un cambio en el esquema de la ruta sin regenerar `docs/openapi.yaml`
- **WHEN** se pasan los tests
- **THEN** fallan y dicen cómo regenerarlo

### Requirement: Cada panel recibe el estado de las tiras del motor
El motor SHALL enviar a cada panel, por la conexión del visor, las tiras declaradas con el efecto
activo de cada una y sus valores: al conectarse el panel y, cada vez que cambia el efecto o los
valores de una tira, a todos los paneles conectados, con el formato de
`docs/instructions/viewer-protocol.md`. El mensaje MUST llevar solo lo que muestra el panel.

> Traza: *(asumido)*, README §2.1 (*WebSocket para frames y estado*) y D51. El aviso sale del cambio,
> venga del mando que venga, así que llega a todos los paneles: `design.md` de `strip-effect-switch`,
> decisiones 1 a 3. Los valores en el mismo mensaje: `design.md`, decisión 6. Que otro panel lo vea no
> se promete en `MOO-94` ni en `MOO-95` (non-goal).

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
