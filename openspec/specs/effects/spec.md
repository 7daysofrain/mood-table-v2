# effects Specification

## Purpose

Fija el catálogo de efectos y lo que cumplen todos: qué efecto tiene una tira al arrancar, cómo se ve
cada uno y que, con la misma entrada, producen siempre los mismos frames.

## Requirements

### Requirement: La respiración sube y baja el brillo de un color
La respiración SHALL pintar todos los LEDs de la tira del mismo color, con un brillo que sube y baja
de forma suave y continua, de casi apagado al máximo. Sus parámetros son `color` (por defecto, blanco
cálido) y `period`, los segundos de una respiración completa (por defecto, 4).

> Traza: PRD §4 (*un color que sube y baja despacio*). Color, periodo y forma: decisión del DJ sobre
> PRD Q2 (`design.md`, decisión 5). El RGB exacto del blanco cálido se fija al escribir el efecto.

#### Scenario: Toda la tira a la vez
- **GIVEN** la respiración con sus valores por defecto
- **WHEN** se calcula un frame en cualquier instante
- **THEN** todos los LEDs del frame tienen el mismo color

#### Scenario: Una respiración completa
- **GIVEN** la respiración con sus valores por defecto
- **WHEN** se calculan los frames de 4 segundos seguidos
- **THEN** el brillo pasa una vez por casi apagado y una vez por el máximo
- **AND** el frame del segundo 4 es igual al del segundo 0

### Requirement: Un efecto da siempre los mismos frames con la misma entrada
Con los mismos pulsos, el mismo audio, los mismos parámetros y la misma tira, un efecto MUST producir
siempre los mismos frames, sin depender del reloj real ni de frames calculados por otras tiras. Un
efecto puede recordar lo que pasó en los pulsos anteriores de su propia tira.

> Traza: *(asumido)*, README §2.1 (*Testabilidad determinista: frames dorados*), `design.md` de
> `virtual-strip-breathing`, decisión 7, y README §2.2 (*memoria explícita del efecto, por tira*). El
> audio como entrada: `design.md`, decisión 3.

#### Scenario: Frames dorados de la respiración (asumido)
- **GIVEN** la respiración con sus valores por defecto y una tira de 60 LEDs
- **WHEN** se calculan sus frames en los instantes 0, 1, 2 y 3 segundos
- **THEN** los frames son idénticos a los frames de referencia guardados en el repositorio

#### Scenario: Frames dorados de energía (asumido)
- **GIVEN** *energía* en una tira de 60 LEDs, a 60 fps, con el fichero de golpes aislados de los tests
  como fuente de audio
- **WHEN** se calculan sus frames desde el arranque
- **THEN** los frames de los instantes de referencia son idénticos a los guardados en el repositorio

### Requirement: Un efecto de ambiente funciona sin fuente de audio
Un efecto que no usa audio, como la respiración, SHALL animarse aunque el instrumento no tenga ninguna
fuente de audio.

> Traza: caso feliz de `MOO-13` (*sin audio*: non-goal de la historia) y glosario del PRD (*sin fuente
> solo funcionan los efectos de ambiente*).

#### Scenario: Instrumento sin fuente de audio
- **GIVEN** un fichero de configuración sin fuente de audio y una tira con la respiración
- **WHEN** el motor está en marcha
- **THEN** la tira se anima

### Requirement: Cada tira arranca con el efecto que declara el fichero
Al arrancar, cada tira SHALL animarse con el efecto que declara su campo `effect` en el fichero de
configuración, con los valores por defecto de sus parámetros.

> Traza: caso feliz de `MOO-14` (*el fichero de configuración indica el efecto "energía" para la tira
> virtual*, asumido en la historia). Con H5, el estado guardado mandará sobre el fichero (README §2.2,
> reconciliación).

#### Scenario: Una tira con energía
- **GIVEN** un fichero de configuración con un fichero de audio como fuente y una tira con
  `"effect": "energy"`
- **WHEN** el motor arranca
- **THEN** la tira reacciona al audio con *energía*

#### Scenario: Una tira con la respiración (asumido)
- **GIVEN** un fichero de configuración con una tira con `"effect": "breathing"`
- **WHEN** el motor arranca
- **THEN** la tira se anima con la respiración

#### Scenario: Dos tiras con efectos distintos (asumido)
- **GIVEN** un fichero de configuración con un fichero de audio como fuente, una tira con *energía* y
  otra con la respiración
- **WHEN** el fichero llega a un tramo en silencio
- **THEN** la tira con *energía* se apaga y la de la respiración sigue animándose

### Requirement: Energía enciende la tira desde el centro con los graves, medios y agudos
*Energía* SHALL encender la tira desde su centro hacia los dos extremos, igual por los dos lados: el
rojo llega tan lejos como la energía de los graves, el verde como la de los medios y el azul como la
de los agudos, medidas frente a su nivel reciente. Es reactiva y no tiene parámetros.

> Traza: PRD §4 y README §1.2 (*el brillo y la extensión de la luz siguen la energía del audio*); D20
> (*los de la v1, reescritos*). El reparto en tres bandas y el espejo son el efecto *energy* de la v1:
> `design.md`, decisión 1. Glosario del PRD: *golpe*. Los tonos duran dos segundos porque, como en
> la v1, el primer pulso con audio enciende los tres colores (las bandas arrancan en 0,1 y la
> ganancia de cada banda en 0,01) y tardan cerca de 1,5 s en apagarse: se porta tal cual, decisión
> del usuario al implementar `MOO-20`.

#### Scenario: La tira marca cada golpe
- **GIVEN** que el fichero de audio tiene golpes aislados, separados por silencio
- **AND** la tira virtual tiene el efecto «energía»
- **WHEN** llega un golpe
- **THEN** la tira se ilumina con el golpe
- **AND** vuelve a apagarse antes del siguiente

#### Scenario: Un tono grave enciende el rojo (asumido)
- **GIVEN** *energía* con un tono continuo de 400 Hz como audio
- **WHEN** se calculan sus frames durante dos segundos
- **THEN** los LEDs encendidos son rojos y forman un tramo centrado en la mitad de la tira

#### Scenario: Un tono agudo enciende el azul (asumido)
- **GIVEN** *energía* con un tono continuo de 8 kHz como audio
- **WHEN** se calculan sus frames durante dos segundos
- **THEN** los LEDs encendidos son azules y forman un tramo centrado en la mitad de la tira

#### Scenario: La caída no depende de los fps (asumido)
- **GIVEN** *energía* con un único golpe aislado como audio, una vez a 30 fps y otra a 60 fps
- **WHEN** termina el golpe
- **THEN** en los dos casos la tira queda apagada en el mismo instante, con como mucho un pulso de 30
  fps de diferencia

### Requirement: En silencio, un efecto reactivo se apaga y uno de ambiente sigue
Cuando la fuente de audio llega a un tramo en silencio, una tira con un efecto reactivo SHALL apagarse
(todos sus LEDs a 0) y seguir apagada mientras dure el silencio. Una tira con un efecto de ambiente
MUST seguir animándose igual. Con una tarjeta de sonido, también es silencio el ruido de fondo cuyo
nivel queda por debajo del umbral de silencio de la tarjeta.

> Traza: esquema del escenario *En silencio, cada efecto hace lo suyo* de `MOO-14` y PRD Q4 (resuelta
> el 24-sep). El ruido de fondo de la tarjeta es *(asumido)*: deuda que `MOO-14` dejó a `MOO-15`
> (`design.md` de `virtual-strip-audio-file`) y `design.md`, decisión 7.

#### Scenario: En silencio, energía se apaga
- **GIVEN** que la tira virtual tiene el efecto «energía»
- **WHEN** el fichero de audio llega a un tramo en silencio
- **THEN** la tira se apaga

#### Scenario: En silencio, la respiración sigue animándose
- **GIVEN** que la tira virtual tiene el efecto «respiración»
- **WHEN** el fichero de audio llega a un tramo en silencio
- **THEN** la tira sigue animándose

#### Scenario: Con la tarjeta sin música, energía se apaga (asumido)
- **GIVEN** que la tira virtual tiene el efecto «energía» y la fuente de audio es la tarjeta de
  sonido, con el umbral de silencio por defecto
- **WHEN** a la tarjeta solo le llega ruido de fondo, a −80 dBFS
- **THEN** la tira se apaga y sigue apagada

#### Scenario: Con la tarjeta, la música por encima del umbral se ve (asumido)
- **GIVEN** que la tira virtual tiene el efecto «energía» y la fuente de audio es la tarjeta de
  sonido, con un umbral de silencio de −60 dBFS
- **WHEN** a la tarjeta le llega música a −30 dBFS
- **THEN** la tira reacciona a la música
