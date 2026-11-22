# Spec Delta

## Purpose

Fija la intensidad del instrumento: un máster de brillo para todas las tiras, sea cual sea su efecto.
Cubre cómo cambia los frames, su valor al arrancar, la ruta de la API que la cambia, cómo se entera
cada panel y la zona «Intensidad» del panel, con su fader.

## ADDED Requirements

### Requirement: La intensidad cambia el brillo de todas las tiras a la vez
El motor SHALL aplicar una misma intensidad, de 0 a 1, al frame de cada tira declarada, sea cual sea
su efecto: cada canal de cada LED vale lo que pinta el efecto multiplicado por la intensidad,
redondeado al entero más cercano. Todos los frames de un mismo pulso MUST llevar la misma
intensidad.

> Traza: criterio *El DJ cambia la intensidad de todas las tiras a la vez* de `MOO-97`. El factor:
> `design.md`, decisiones 2 y 3.

#### Scenario: El DJ cambia la intensidad de todas las tiras a la vez
- **GIVEN** que suena música
- **AND** una tira tiene un efecto reactivo y otra uno de ambiente *(asumido en la historia: el caso
  mínimo que prueba «sea cual sea su efecto»)*
- **WHEN** el DJ pone la intensidad al 50 %
- **THEN** desde el pulso siguiente, las dos tiras pintan su efecto con cada canal a la mitad,
  redondeado
- **AND** cada efecto sigue respondiendo a la música como antes *(asumido en la historia)*

#### Scenario: Las tiras de un pulso llevan la misma intensidad (asumido)
- **GIVEN** el motor con dos tiras declaradas
- **WHEN** la intensidad cambia entre dos pulsos
- **THEN** los dos frames de cada pulso están pintados con la misma intensidad

### Requirement: A cero, todas las tiras se apagan
Con la intensidad a cero, el motor MUST pintar todos los LEDs de todas las tiras apagados (los tres
canales a 0), sea cual sea su efecto y suene o no la música.

> Traza: criterio *El DJ baja la intensidad del todo* de `MOO-97`.

#### Scenario: El DJ baja la intensidad del todo
- **GIVEN** que suena música
- **AND** las tiras tienen efectos, reactivos o de ambiente
- **WHEN** el DJ baja la intensidad del todo
- **THEN** se apagan todas las tiras

### Requirement: El motor arranca con la intensidad al máximo
Al arrancar, la intensidad del motor SHALL ser 1, el máximo: cada tira pinta su efecto tal cual, sin
quitarle ni añadirle brillo. Ningún valor de la intensidad da más brillo que el del efecto.

> Traza: criterio *El motor arranca con la intensidad al máximo* de `MOO-97`.

#### Scenario: El motor arranca con la intensidad al máximo
- **GIVEN** que el motor está parado
- **WHEN** el motor arranca
- **THEN** la intensidad está al máximo
- **AND** cada tira pinta su efecto con el brillo que da el efecto, sin quitarle ni añadirle

### Requirement: La intensidad no cambia los efectos ni el nivel
Cambiar la intensidad MUST NOT cambiar el efecto activo de ninguna tira, sus valores ni el estado del
efecto: al volver a subirla, cada efecto sigue por donde iba, también si ha pasado por cero. El nivel
de la fuente de audio que recibe el panel MUST NOT depender de la intensidad.

> Traza: criterio *La intensidad no cambia los efectos ni el nivel* de `MOO-97`.

#### Scenario: La intensidad no cambia los efectos ni el nivel
- **GIVEN** que suena música
- **AND** una tira tiene la respiración a media subida y otra un efecto reactivo
- **WHEN** el DJ cambia la intensidad, también si la baja a cero o la sube desde cero
- **THEN** cada tira sigue con su efecto y sus valores
- **AND** la respiración sigue por donde iba, sin reiniciarse
- **AND** el panel sigue mostrando el nivel

### Requirement: El visor y la tira física reciben el mismo frame a cualquier intensidad
El motor SHALL aplicar la intensidad antes de entregar el frame de una tira a sus salidas, de modo que
el visor y la salida Adalight de esa tira reciban el mismo frame, sea cual sea la intensidad.

> Traza: criterio *El visor y la mesa coinciden a cualquier intensidad* de `MOO-97`.

#### Scenario: El visor y la mesa coinciden a cualquier intensidad
- **GIVEN** que suena música y hay una tira física
- **WHEN** el DJ pone la intensidad en cualquier valor, también a cero
- **THEN** el visor pinta esa tira igual que la tira física

### Requirement: La API cambia la intensidad
El motor SHALL ofrecer `PUT /api/intensity`, con la intensidad en el cuerpo, un número de 0 a 1, que
la aplica desde el pulso siguiente y responde `200` con la intensidad aplicada. MUST responder `400`
a cualquier otro cuerpo, sin cambiar la intensidad. El OpenAPI del motor SHALL describir la ruta.

> Traza: *(asumido)*, contexto técnico de `MOO-97` (*una orden nueva, con su ruta y su OpenAPI*).
> `design.md`, decisión 4.

#### Scenario: Cambiar la intensidad por la API (asumido)
- **GIVEN** el motor en marcha con la intensidad al máximo
- **WHEN** llega `PUT /api/intensity` con `{ "intensity": 0.4 }`
- **THEN** la API responde `200` con `{ "intensity": 0.4 }`
- **AND** desde el pulso siguiente, todas las tiras pintan con la intensidad al 40 %

#### Scenario: Una intensidad fuera de rango (asumido)
- **GIVEN** el motor en marcha con la intensidad al 40 %
- **WHEN** llega `PUT /api/intensity` con `{ "intensity": 1.5 }`
- **THEN** la API responde `400`
- **AND** la intensidad sigue al 40 %

#### Scenario: Un cuerpo que no es una intensidad (asumido)
- **GIVEN** el motor en marcha con la intensidad al 40 %
- **WHEN** llega `PUT /api/intensity` con `{ "intensity": "alta" }` o con `{ "intensity": 0.5, "strip": "demo" }`
- **THEN** la API responde `400`
- **AND** la intensidad sigue al 40 %

#### Scenario: El OpenAPI describe la ruta de la intensidad (asumido)
- **GIVEN** el motor en marcha
- **WHEN** se pide `/api/openapi.json`
- **THEN** describe `PUT /api/intensity`, con su cuerpo, el rango de 0 a 1 y sus respuestas `200` y
  `400`

### Requirement: Cada panel recibe la intensidad del motor
El motor SHALL enviar a cada panel, por la conexión del visor, la intensidad con que pinta: al
conectarse el panel y, cada vez que cambia, a todos los paneles conectados, con el formato de
`docs/instructions/viewer-protocol.md`.

> Traza: *(asumido)*, contexto técnico de `MOO-97` (*el panel lee el estado por el WebSocket*, D78).
> Que llegue a todos: `design.md`, decisión 5; que otro panel lo vea no se promete (non-goal).

#### Scenario: Un panel que se conecta recibe la intensidad (asumido)
- **GIVEN** el motor en marcha con la intensidad al 40 %
- **WHEN** se conecta un panel
- **THEN** recibe la intensidad 0,4

#### Scenario: Un cambio de intensidad llega a todos los paneles conectados (asumido)
- **GIVEN** el motor en marcha con dos paneles conectados
- **WHEN** cambia la intensidad
- **THEN** los dos paneles reciben la intensidad nueva

### Requirement: La zona Intensidad muestra la intensidad con que pinta el motor
La zona «Intensidad» SHALL mostrar un fader vertical, con el máximo arriba y el cero abajo, y la
intensidad en porcentaje entero, de 0 % a 100 %. En reposo, MUST mostrar la intensidad con que pinta
el motor, también al abrir o recargar el panel. No depende de la tira seleccionada.

> Traza: *(asumido)*, contexto técnico de `MOO-97` (*cambiar de tira no la mueve ni la esconde*). El
> fader y el porcentaje: decisiones del DJ (`design.md`, decisiones 6 y 7).

#### Scenario: El panel se abre con la intensidad al máximo (asumido)
- **GIVEN** el motor recién arrancado
- **WHEN** el DJ abre el panel
- **THEN** la zona Intensidad muestra el fader arriba del todo y «100 %»

#### Scenario: El panel muestra la intensidad con que pinta el motor (asumido)
- **GIVEN** el motor en marcha
- **AND** el DJ ha bajado la intensidad al 40 %
- **WHEN** se recarga el panel
- **THEN** la zona Intensidad muestra «40 %», no «100 %»

#### Scenario: Cambiar de tira no mueve la intensidad (asumido)
- **GIVEN** el panel abierto con dos tiras y la intensidad al 40 %
- **WHEN** el DJ selecciona la otra tira
- **THEN** la zona Intensidad sigue mostrando «40 %»

### Requirement: Las tiras responden mientras el DJ arrastra la intensidad
Mientras el DJ arrastra el fader de intensidad, todas las tiras SHALL pintarse con cada nueva
intensidad en menos de 100 ms desde que la marca el fader, sin esperar a que lo suelte, a la vez y
sin tirones.

> Traza: criterio *Las tiras responden mientras el DJ arrastra la intensidad* de `MOO-97`. Los 100 ms
> son el umbral de E1 (control → luz) en `docs/umbrales-para-specs.md`, que rige en directo con el
> panel ya usado (D98).

#### Scenario: Las tiras responden mientras el DJ arrastra la intensidad
- **GIVEN** que suena música y hay varias tiras, una de ellas física *(asumido en la historia)*
- **WHEN** el DJ arrastra la intensidad
- **THEN** todas las tiras cambian su brillo mientras arrastra, a la vez, en menos de 100 ms y sin
  tirones

### Requirement: Mientras el DJ arrastra, el fader sigue al dedo
Mientras el DJ arrastra el fader de intensidad, el fader SHALL seguir al dedo, aunque el motor
confirme intensidades que el DJ ya ha dejado atrás. Si una intensidad no llega a aplicarse, al soltar
el fader vuelve a la intensidad con que pinta el motor.

> Traza: *(asumido)*, el requisito *Mientras el DJ arrastra, el control sigue al dedo* de
> `instrument-control` (`MOO-95`), aplicado al fader. Qué más debe ver el DJ si un cambio no llega es
> la pregunta abierta Q8 del PRD.

#### Scenario: El fader no tiembla bajo el dedo (asumido)
- **GIVEN** que el DJ arrastra la intensidad del 100 % al 20 %
- **WHEN** el motor confirma el 70 % mientras el dedo ya marca el 40 %
- **THEN** el fader sigue marcando «40 %»

#### Scenario: Una intensidad que no llega al motor (asumido)
- **GIVEN** la intensidad al 100 % y un motor que no aplica los cambios de intensidad
- **WHEN** el DJ arrastra la intensidad hasta el 30 % y la suelta
- **THEN** el fader vuelve a «100 %», la intensidad con que pinta el motor

### Requirement: Sin conexión, la zona Intensidad se vacía
Sin conexión con el motor, la zona «Intensidad» MUST quedar vacía, solo con su título, como Tiras,
Efectos y Controles. Al volver la conexión, SHALL mostrar el fader con la intensidad con que pinta el
motor.

> Traza: *(asumido)*, requisitos *Sin conexión, Tiras y Efectos se vacían* y *Sin conexión, Controles
> se vacía* de `instrument-control`, y *Las zonas vacías no inventan datos* de `panel-layout`.

#### Scenario: Se pierde la conexión con el motor y vuelve (asumido)
- **GIVEN** el panel abierto con la intensidad al 40 %
- **WHEN** se pierde la conexión con el motor
- **THEN** la zona Intensidad solo muestra su título
- **AND** al volver la conexión, muestra el fader y «40 %»
