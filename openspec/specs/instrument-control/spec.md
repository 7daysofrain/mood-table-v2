# instrument-control Specification

## Purpose

Fija cómo el DJ cambia el efecto de cada tira y los valores de ese efecto con el motor en marcha: lo
que ve en las zonas Tiras, Efectos y Controles del panel, las rutas de la API que reciben cada cambio
y cómo se entera cada panel del efecto y los valores con que pinta cada tira.

## Requirements

### Requirement: La zona Tiras lista las tiras declaradas
La zona «Tiras» del panel SHALL mostrar una lista con cada tira declarada en el fichero de
configuración, en su orden, con su nombre, su nº de LEDs y su salida, en solo lectura. Las tiras salen
del motor: sin conexión con él, la zona MUST quedar vacía (requisito *Sin conexión, Tiras y Efectos
se vacían*).

> Traza: criterio *El DJ ve sus tiras* de `MOO-94` y README §1.3 (zona Tiras). La salida Adalight y
> su puerto llegan con H3 (non-goal).

#### Scenario: El DJ ve sus tiras
- **GIVEN** que el motor está en marcha con las tiras declaradas en el fichero de configuración
- **WHEN** el DJ abre el panel
- **THEN** la zona Tiras muestra una lista con cada tira declarada
- **AND** de cada una, su nombre, su nº de LEDs y su salida

### Requirement: Al abrir el panel queda seleccionada la primera tira
Al abrir el panel, la primera tira declarada SHALL quedar seleccionada. El DJ MUST poder seleccionar
cualquier otra en la zona Tiras, y solo una a la vez; lo que elige en la zona Efectos se aplica a la
tira seleccionada.

> Traza: criterio *Al abrir el panel ya hay una tira seleccionada* de `MOO-94` y README §1.3 (*al
> seleccionar una, el resto del panel actúa sobre ella*).

#### Scenario: Al abrir el panel ya hay una tira seleccionada
- **GIVEN** que el motor está en marcha con sus tiras declaradas
- **WHEN** el DJ abre el panel
- **THEN** la primera tira declarada aparece seleccionada
- **AND** la zona Efectos muestra sus efectos, con el activo marcado

### Requirement: La zona Efectos muestra los efectos de la tira seleccionada
La zona «Efectos» SHALL mostrar los efectos disponibles para la tira seleccionada (hoy, todos los del
catálogo: *energía* y *respiración*), cada uno etiquetado como *reactivo* o *de ambiente*, con el
efecto activo de la tira marcado.

> Traza: criterio *El DJ elige una tira y ve sus efectos* de `MOO-94`, README §1.3 (zona Efectos) y
> glosario del PRD (*efecto reactivo* y *de ambiente*).

#### Scenario: El DJ elige una tira y ve sus efectos
- **GIVEN** que el panel está abierto con la música sonando
- **WHEN** el DJ selecciona una tira
- **THEN** la zona Efectos muestra los efectos disponibles para esa tira (hoy, todos)
- **AND** cada efecto aparece como reactivo o de ambiente, con el activo marcado

### Requirement: Elegir un efecto lo pone en la tira al momento, con un corte seco
Cuando el DJ elige un efecto en la zona Efectos, la tira seleccionada SHALL pasar a pintarse con él
en menos de 100 ms desde que lo pulsa, sin fundido con el anterior, y ese efecto MUST quedar marcado
como el activo. El cambio MUST dispararse al pulsar, sin esperar a que el DJ suelte.

> Traza: criterio *El DJ cambia el efecto de la tira* de `MOO-94`. El corte seco: PRD Q3, decisión del
> DJ al crear la historia. Los 100 ms son el umbral de E1 (control → luz) en
> `docs/umbrales-para-specs.md`. Disparar al pulsar es *(asumido)*: decisión del DJ al explorar el
> change, porque quiere poder cuadrar el cambio a mano con un golpe de la música (`design.md`,
> decisión 7).

#### Scenario: El DJ cambia el efecto de la tira
- **GIVEN** que hay una tira seleccionada con el efecto energía activo y la música sonando
- **WHEN** el DJ elige el efecto respiración
- **THEN** el visor pinta esa tira con respiración en menos de 100 ms, sin fundido
- **AND** respiración queda marcado como el efecto activo de la tira

#### Scenario: El efecto cambia al pulsar, no al soltar (asumido)
- **GIVEN** que hay una tira seleccionada con el efecto respiración activo
- **WHEN** el DJ pulsa el efecto energía y todavía no lo ha soltado
- **THEN** la tira ya se pinta con energía

### Requirement: El panel marca el efecto que pinta el motor
El efecto marcado como activo de cada tira SHALL ser el que el motor está pintando en ella, no el
que declara el fichero de configuración ni uno que el DJ haya pulsado y el motor no haya aplicado. El
panel MUST NOT mostrar indicadores de espera mientras se aplica un cambio.

> Traza: criterio *El panel muestra el efecto que pinta la tira, no el del fichero* de `MOO-94`. Que el
> panel no marque lo que el motor no ha aplicado y que no haya indicadores de espera es *(asumido)*:
> decisiones del DJ al explorar el change (`design.md`, decisiones 2 y 7). Qué ve el DJ si un cambio
> no llega es la pregunta abierta Q8 del PRD.

#### Scenario: El panel muestra el efecto que pinta la tira, no el del fichero
- **GIVEN** que el motor está en marcha con una tira que arrancó con energía (fichero de
  configuración)
- **AND** el DJ le ha cambiado el efecto a respiración
- **WHEN** se abre el panel
- **THEN** el efecto activo de esa tira en el panel es respiración

#### Scenario: Tras reiniciar el motor, el panel abierto vuelve al efecto del fichero (asumido)
- **GIVEN** el panel abierto, con una tira que arrancó con energía y a la que el DJ ha cambiado a
  respiración
- **WHEN** el motor se reinicia y el panel se reconecta solo
- **THEN** el efecto activo de esa tira en el panel es energía, el que pinta el motor

### Requirement: Cambiar el efecto de una tira no toca las demás
El cambio de efecto de una tira MUST NOT cambiar ni reiniciar el efecto de ninguna otra tira: las
demás SHALL seguir pintando los mismos frames que pintarían sin el cambio.

> Traza: criterio *Cambiar el efecto de una tira no toca las demás* de `MOO-94`, *(asumido)* en la
> historia, y E4 (*cada tira, su efecto*).

#### Scenario: Cambiar el efecto de una tira no toca las demás (asumido)
- **GIVEN** que hay dos tiras, A con energía y B con respiración, y la música sonando
- **WHEN** el DJ cambia el efecto de A a respiración
- **THEN** B sigue pintando respiración en el visor, sin reiniciarse

### Requirement: Elegir el efecto activo no lo reinicia
Si el DJ elige el efecto que la tira ya tiene activo, la tira MUST seguir con él como si no lo
hubiera elegido, sin volver a su principio.

> Traza: *(asumido)*, pregunta para el change del contexto técnico de `MOO-94` (*elegir el efecto que
> ya está activo no lo reinicia*). `design.md`, decisión 1.

#### Scenario: Elegir otra vez la respiración (asumido)
- **GIVEN** una tira con respiración desde hace 3 s
- **WHEN** el DJ elige respiración
- **THEN** la tira sigue la respiración por donde iba, sin volver a casi apagado

### Requirement: De varias elecciones seguidas queda la última
Si el DJ elige varios efectos seguidos para la misma tira, sin esperar entre uno y otro, la tira
SHALL acabar con el último que eligió, y ese MUST quedar marcado como activo.

> Traza: *(asumido)*, pregunta para el change del contexto técnico de `MOO-94` (*varias elecciones
> seguidas muy rápidas acaban en la última*). `design.md`, decisiones 1 y 7.

#### Scenario: El DJ elige dos efectos muy seguidos (asumido)
- **GIVEN** una tira con respiración
- **WHEN** el DJ elige energía y, enseguida, respiración
- **THEN** la tira acaba pintando respiración
- **AND** respiración queda marcado como el efecto activo

### Requirement: Sin fuente de audio, los efectos reactivos no se pueden elegir
Si el instrumento no tiene fuente de audio, la zona Efectos SHALL mostrar los efectos reactivos
desactivados, con el motivo a la vista, y la API MUST rechazar el cambio de una tira a un efecto
reactivo, sin tocar la tira.

> Traza: *(asumido)*, glosario del PRD (*sin fuente solo funcionan los efectos de ambiente*) y la regla
> del arranque de `engine-config` (una tira reactiva sin fuente no arranca), que vale igual en marcha.
> Desactivados y no ocultos, para que el DJ vea todo el catálogo: decisión del DJ al explorar el
> change (`design.md`, decisión 5).

#### Scenario: El panel sin fuente de audio (asumido)
- **GIVEN** un fichero de configuración sin fuente de audio y una tira con respiración
- **WHEN** el DJ abre el panel
- **THEN** energía aparece desactivado, con el motivo «Necesita una fuente de audio»
- **AND** respiración se puede elegir

#### Scenario: La API rechaza un efecto reactivo sin fuente de audio (asumido)
- **GIVEN** el motor sin fuente de audio y una tira con respiración
- **WHEN** llega un cambio de esa tira a energía por la API
- **THEN** la API responde `409` con un mensaje que nombra la tira y dice que el efecto necesita una
  fuente de audio
- **AND** la tira sigue con respiración

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

### Requirement: Sin conexión, Tiras y Efectos se vacían
Sin conexión con el motor, las zonas Tiras y Efectos MUST quedar vacías, solo con su título. Al
volver la conexión, el panel SHALL seleccionar la misma tira que tenía seleccionada si sigue
declarada, y la primera si no.

> Traza: *(asumido)*, requisito *Las zonas vacías no inventan datos* de `panel-layout` y lo que ya
> hace la cabecera sin conexión (README §1.3). `design.md`, decisión 8.

#### Scenario: Se pierde la conexión con el motor (asumido)
- **GIVEN** el panel abierto con la segunda tira seleccionada
- **WHEN** se pierde la conexión con el motor
- **THEN** las zonas Tiras y Efectos solo muestran su título

#### Scenario: Vuelve la conexión con el motor (asumido)
- **GIVEN** el panel sin conexión, que tenía seleccionada la segunda tira
- **WHEN** el motor vuelve con las mismas tiras declaradas
- **THEN** la segunda tira vuelve a estar seleccionada

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
