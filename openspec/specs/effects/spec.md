# effects Specification

## Purpose

Fija el catálogo de efectos y lo que cumplen todos: qué efecto tiene una tira al arrancar, cómo se ve
cada uno y que, con la misma entrada, producen siempre los mismos frames.

## Requirements

### Requirement: La respiración sube y baja el brillo de un color
La respiración SHALL pintar todos los LEDs de la tira del mismo color, con un brillo que sube y baja
de forma suave y continua, de casi apagado al máximo. Sus parámetros son `color` (por defecto, blanco
cálido) y `period`, los segundos de una respiración completa (por defecto, 4), que MUST estar entre 1
y 20.

> Traza: PRD §4 (*un color que sube y baja despacio*). Color, periodo y forma: decisión del DJ sobre
> PRD Q2 (`design.md` de `virtual-strip-breathing`, decisión 5). El RGB exacto del blanco cálido se
> fija al escribir el efecto. El rango de 1 a 20 s: decisión del DJ al explorar `strip-effect-values`
> (`design.md`, decisión 1).

#### Scenario: Toda la tira a la vez
- **GIVEN** la respiración con sus valores por defecto
- **WHEN** se calcula un frame en cualquier instante
- **THEN** todos los LEDs del frame tienen el mismo color

#### Scenario: Una respiración completa
- **GIVEN** la respiración con sus valores por defecto
- **WHEN** se calculan los frames de 4 segundos seguidos
- **THEN** el brillo pasa una vez por casi apagado y una vez por el máximo
- **AND** el frame del segundo 4 es igual al del segundo 0

#### Scenario: Los límites del periodo (asumido)
- **GIVEN** la respiración
- **WHEN** se le da un periodo de 0,5 s o de 25 s
- **THEN** el valor se rechaza por estar fuera del rango de 1 a 20 s

### Requirement: Cambiar el periodo a media respiración no da un salto de brillo
Cuando cambia el periodo de una respiración en marcha, la tira SHALL seguir desde el brillo que
tenía en ese instante, en el mismo punto de la subida o de la bajada, y desde ahí respirar con el
periodo nuevo. El cambio MUST NOT producir un salto de brillo entre un frame y el siguiente.

> Traza: criterio *Cambiar el periodo a media respiración no da un salto de brillo* de `MOO-95` y E1
> (*sin saltos ni tirones*). `design.md`, decisión 7.

#### Scenario: Cambiar el periodo a media respiración no da un salto de brillo
- **GIVEN** que una tira respira con un periodo de 4 s y está a media subida
- **WHEN** el DJ cambia el periodo
- **THEN** la respiración sigue desde el brillo en que estaba, con el nuevo ritmo

#### Scenario: El ritmo nuevo se cumple (asumido)
- **GIVEN** una respiración de 4 s que, en el segundo 1, pasa a 8 s
- **WHEN** se calculan sus frames desde el segundo 1
- **THEN** el frame del segundo 9, una respiración completa de 8 s después, es igual al del segundo 1

### Requirement: Un efecto da siempre los mismos frames con la misma entrada
Con los mismos pulsos, el mismo audio, los mismos parámetros y la misma tira, un efecto MUST producir
siempre los mismos frames, sin depender del reloj real ni de frames calculados por otras tiras. Un
efecto puede recordar lo que pasó en los pulsos anteriores de su propia tira.

> Traza: *(asumido)*, README §2.1 (*Testabilidad determinista: frames dorados*), `design.md` de
> `virtual-strip-breathing`, decisión 7, y README §2.2 (*memoria explícita del efecto, por tira*). El
> audio como entrada: `design.md`, decisión 3. Los frames dorados de *scroll*: `design.md` de
> `scroll-effect`, decisión 4. Los del *espectro*: `design.md` de `spectrum-effect`, decisión 4.

#### Scenario: Frames dorados de la respiración (asumido)
- **GIVEN** la respiración con sus valores por defecto y una tira de 60 LEDs
- **WHEN** se calculan sus frames en los instantes 0, 1, 2 y 3 segundos
- **THEN** los frames son idénticos a los frames de referencia guardados en el repositorio

#### Scenario: Frames dorados de energía (asumido)
- **GIVEN** *energía* en una tira de 60 LEDs, a 60 fps, con el fichero de golpes aislados de los tests
  como fuente de audio
- **WHEN** se calculan sus frames desde el arranque
- **THEN** los frames de los instantes de referencia son idénticos a los guardados en el repositorio

#### Scenario: Frames dorados de scroll (asumido)
- **GIVEN** *scroll* en una tira de 60 LEDs, a 60 fps, con el fichero de golpes aislados de los tests
  como fuente de audio
- **WHEN** se calculan sus frames desde el arranque
- **THEN** los frames de los instantes de referencia son idénticos a los guardados en el repositorio

#### Scenario: Frames dorados del espectro (asumido)
- **GIVEN** el *espectro* en una tira de 60 LEDs, a 60 fps, con el fichero de golpes aislados de los
  tests como fuente de audio
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
Al arrancar sin estado guardado de una tira, la tira SHALL animarse con el efecto que declara su campo
`effect` en el fichero de configuración, con los valores por defecto de sus parámetros. Con estado
guardado, manda lo que dejó el DJ (`specs/instrument-state`). Es solo el efecto de arranque: con el
motor en marcha, el DJ lo puede cambiar (`specs/instrument-control`).

> Traza: caso feliz de `MOO-14` (*el fichero de configuración indica el efecto "energía" para la tira
> virtual*, asumido en la historia). Que sea solo el de arranque: contexto técnico de `MOO-94` (*el
> efecto del fichero de configuración es solo el de arranque*). Que el estado guardado mande: criterio
> *Lo que dejó el DJ manda sobre el efecto del fichero* de `MOO-25`.

#### Scenario: Una tira con energía
- **GIVEN** un fichero de configuración con un fichero de audio como fuente y una tira con
  `"effect": "energy"`
- **AND** ningún estado guardado de esa tira
- **WHEN** el motor arranca
- **THEN** la tira reacciona al audio con *energía*

#### Scenario: Una tira con la respiración (asumido)
- **GIVEN** un fichero de configuración con una tira con `"effect": "breathing"`
- **AND** ningún estado guardado de esa tira
- **WHEN** el motor arranca
- **THEN** la tira se anima con la respiración

#### Scenario: Dos tiras con efectos distintos (asumido)
- **GIVEN** un fichero de configuración con un fichero de audio como fuente, una tira con *energía* y
  otra con la respiración
- **AND** ningún estado guardado de esas tiras
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
> (`design.md` de `virtual-strip-audio-file`) y `design.md`, decisión 7. *Scroll*: criterio *La
> música se para con el scroll activo* de `MOO-99`. Que el rastro siga al volver la música es la v1,
> que en silencio no llamaba al efecto (`design.md` de `scroll-effect`, decisión 3). *Espectro*:
> criterio *La música se para con el espectro activo* de `MOO-98`.

#### Scenario: En silencio, energía se apaga
- **GIVEN** que la tira virtual tiene el efecto «energía»
- **WHEN** el fichero de audio llega a un tramo en silencio
- **THEN** la tira se apaga

#### Scenario: En silencio, la respiración sigue animándose
- **GIVEN** que la tira virtual tiene el efecto «respiración»
- **WHEN** el fichero de audio llega a un tramo en silencio
- **THEN** la tira sigue animándose

#### Scenario: La música se para con el scroll activo
- **GIVEN** una tira que pinta *scroll* con la música sonando
- **WHEN** la música se para
- **THEN** la tira se apaga al momento

#### Scenario: Al volver la música, el rastro del scroll sigue donde estaba (asumido)
- **GIVEN** una tira que pinta *scroll* y se ha apagado por un tramo en silencio
- **WHEN** vuelve la música
- **THEN** el rastro que había antes del silencio reaparece en el mismo sitio y sigue avanzando hacia
  los extremos

#### Scenario: La música se para con el espectro activo
- **GIVEN** una tira que pinta el *espectro* con la música sonando
- **WHEN** la música se para
- **THEN** la tira se apaga al momento

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

### Requirement: Con fuente de audio, una tira puede pasar a un efecto reactivo en cualquier momento
Si el instrumento tiene fuente de audio, el motor SHALL analizarla en cada pulso, aunque ninguna tira
tenga en ese momento un efecto reactivo. Una tira que pasa a un efecto reactivo con el motor en marcha
MUST reaccionar a la música igual que si hubiera arrancado con él.

> Traza: *(asumido)*, `design.md`, decisión 4. Matiza D28 (*el análisis se omite si ninguna tira lo
> usa*): ahora solo se omite cuando no hay fuente de audio, y el motor sigue funcionando sin ella.

#### Scenario: Todas las tiras con ambiente y una pasa a energía (asumido)
- **GIVEN** un fichero de configuración con un fichero de audio como fuente y todas sus tiras con la
  respiración
- **WHEN** el DJ cambia una de ellas a *energía*
- **THEN** esa tira reacciona a la música

### Requirement: Al elegir energía con el motor en marcha, la tira tarda hasta 2 s en ajustarse
Una tira que pasa a *energía* con el motor en marcha SHALL empezar como al arrancar el motor, con la
ganancia de cada banda en su valor inicial: durante como mucho 2 s puede encender los tres colores
aunque la música no los pida, y después MUST reaccionar a la música como en el requisito *Energía
enciende la tira desde el centro con los graves, medios y agudos*.

> Traza: *(asumido)*, límite conocido decidido con el DJ al explorar el change (`design.md`, decisión
> 4). Los 2 s son los del primer pulso con audio de *energía*, que ya fija este spec (*los tonos duran
> dos segundos*, decisión del usuario al implementar `MOO-20`).

#### Scenario: Elegir energía entre golpes aislados (asumido)
- **GIVEN** un fichero de audio con golpes aislados, separados por silencio, como fuente y una tira
  con la respiración
- **WHEN** el DJ cambia la tira a *energía*
- **THEN** pasados 2 s, la tira se apaga en el silencio y se ilumina con cada golpe

### Requirement: Scroll hace nacer la música en el centro y la lleva hacia los extremos
En cada frame, *scroll* SHALL poner un color nuevo en el centro de la tira y desplazar lo que había
hacia los dos extremos, en espejo, apagándolo un poco. Rojo de los graves, verde de los medios, azul
de los agudos. Es reactivo y no tiene parámetros.

> Traza: caso feliz y non-goals de `MOO-99`; D20. La v1: `design.md`, decisión 1.

#### Scenario: La música avanza desde el centro
- **GIVEN** *scroll* con el fichero de golpes aislados de los tests como audio
- **WHEN** llega un golpe y pasan los frames siguientes
- **THEN** la luz del golpe aparece en el centro de la tira y se aleja hacia los dos extremos, igual
  por los dos lados
- **AND** se va apagando a medida que avanza

#### Scenario: Al elegir scroll no queda nada del efecto anterior
- **GIVEN** una tira con *energía*, encendida con la música
- **WHEN** el DJ cambia la tira a *scroll*
- **THEN** desde el primer frame no queda nada de *energía*: la luz entra por el centro y se extiende
  desde ahí hacia los extremos

#### Scenario: Un tono grave pinta un rastro rojo (asumido)
- **GIVEN** *scroll* con un tono continuo de 400 Hz como audio
- **WHEN** se calculan sus frames durante dos segundos
- **THEN** los LEDs encendidos son rojos, simétricos respecto al centro, y su brillo baja del centro
  hacia los extremos

#### Scenario: Un tono agudo pinta un rastro azul (asumido)
- **GIVEN** *scroll* con un tono continuo de 8 kHz como audio
- **WHEN** se calculan sus frames durante dos segundos
- **THEN** los LEDs encendidos son azules, simétricos respecto al centro, y su brillo baja del centro
  hacia los extremos

### Requirement: Scroll avanza un LED por frame, como la v1
La luz de *scroll* SHALL avanzar exactamente un LED por frame hacia cada extremo, y su brillo MUST
quedarse en 0,98 veces el que tenía en cada paso. Así, la velocidad en LEDs por segundo es la de los
fps del motor, y la longitud del rastro en LEDs no depende de ellos.

> Traza: *(asumido)*, decisión del DJ al explorar el change: fiel al código de la v1, que iba a
> 50 fps (`design.md`, decisión 2, que pasa a D#). Es un riesgo aceptado: con menos fps, el scroll se
> frena.

#### Scenario: Diez frames, diez LEDs (asumido)
- **GIVEN** *scroll* en una tira de 60 LEDs, con un solo golpe como audio
- **WHEN** pasan 10 frames desde que la luz del golpe entra por el centro
- **THEN** la luz del golpe está a 10 LEDs del centro, por los dos lados
- **AND** su brillo es 0,98¹⁰ veces el que tenía al entrar, con como mucho 1 de diferencia por el
  redondeo

#### Scenario: A 30 fps, la mitad de deprisa que a 60 (asumido)
- **GIVEN** *scroll* con un solo golpe como audio, una vez a 30 fps y otra a 60 fps
- **WHEN** pasan 0,2 s desde que la luz del golpe entra por el centro
- **THEN** la luz del golpe está a 6 LEDs del centro a 30 fps y a 12 LEDs a 60 fps

### Requirement: El espectro pinta cada banda en su zona, con los graves en el centro
El *espectro* SHALL repartir las bandas de frecuencia por la tira, de los graves en el centro a los
agudos en los dos extremos, con las dos mitades iguales. Es reactivo y no tiene parámetros.

> Traza: escenario *Cada banda de frecuencia se enciende en su zona de la tira* de `MOO-98`; D20.
> Estaba *(asumido)* en la historia y se comprobó en la v1 (`design.md`, decisión 1).

#### Scenario: Un tono grave enciende el centro
- **GIVEN** el *espectro* en una tira de 60 LEDs, con un tono continuo de 400 Hz como audio
- **WHEN** se calculan sus frames durante 10 segundos
- **THEN** los LEDs encendidos están en torno al centro, simétricos, y ninguno del cuarto exterior de
  cada lado está encendido *(asumido: el cuarto exterior)*
- **AND** su color es sobre todo azul

#### Scenario: Un tono agudo enciende los extremos
- **GIVEN** el *espectro* en una tira de 60 LEDs, con un tono continuo de 8 kHz como audio
- **WHEN** se calculan sus frames durante 10 segundos
- **THEN** los LEDs encendidos están cerca de los dos extremos, simétricos, y ninguno de la mitad
  central de la tira está encendido *(asumido: la mitad central)*
- **AND** su color es sobre todo azul

### Requirement: En el espectro, el azul es el nivel, el rojo lo que sobresale y el verde el cambio
En cada zona del *espectro*, el azul SHALL seguir el nivel sostenido de su banda, el rojo lo que la
banda sobresale de su nivel reciente y el verde MUST ser cuánto ha cambiado la banda desde el frame
anterior, sin suavizar.

> Traza: *(asumido)*, la v1 (`design.md`, decisión 1). El verde por frame: decisión del DJ al
> explorar el change (`design.md`, decisión 3).

#### Scenario: Con un tono quieto no hay verde (asumido)
- **GIVEN** el *espectro* con un tono continuo de 400 Hz como audio
- **WHEN** se calculan sus frames durante 10 segundos
- **THEN** pasado el primer medio segundo, el verde de ningún LED pasa de 5

#### Scenario: Un cambio de tono enciende el verde (asumido)
- **GIVEN** el *espectro* con un tono continuo de 400 Hz como audio, durante 10 segundos
- **WHEN** el tono pasa de golpe a 8 kHz
- **THEN** en el frame del cambio hay verde en torno al centro, donde baja el tono grave, y cerca de
  los dos extremos, donde sube el agudo

### Requirement: Al elegir el espectro, la tira arranca en rojo y se asienta con la música
Una tira que pasa al *espectro* SHALL empezar como la v1 al arrancar, con el nivel reciente de cada
banda casi a cero: el rojo sale alto y MUST ir bajando hasta desaparecer con un sonido sostenido. El
nivel reciente solo sube mientras suena la música.

> Traza: *(asumido)*, decisión del DJ al explorar el change (`design.md`, decisión 2). Los 10 s
> salen de las constantes de la v1: unos 9 s de música para llegar al 99 %.

#### Scenario: Un tono sostenido pasa de rojo a azul (asumido)
- **GIVEN** una tira con otro efecto y un tono continuo de 400 Hz como audio
- **WHEN** el DJ cambia la tira al *espectro*
- **THEN** durante el primer medio segundo, el LED más brillante tiene rojo por encima de 128
- **AND** a los 10 segundos, el rojo de ningún LED pasa de 5 y el azul sigue encendido en torno al
  centro
