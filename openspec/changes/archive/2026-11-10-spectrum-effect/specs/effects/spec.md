# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
