# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Un efecto da siempre los mismos frames con la misma entrada
Con los mismos pulsos, el mismo audio, los mismos parámetros y la misma tira, un efecto MUST producir
siempre los mismos frames, sin depender del reloj real ni de frames calculados por otras tiras. Un
efecto puede recordar lo que pasó en los pulsos anteriores de su propia tira.

> Traza: *(asumido)*, README §2.1 (*Testabilidad determinista: frames dorados*), `design.md` de
> `virtual-strip-breathing`, decisión 7, y README §2.2 (*memoria explícita del efecto, por tira*). El
> audio como entrada: `design.md`, decisión 3. Los frames dorados de *scroll*: `design.md` de
> `scroll-effect`, decisión 4.

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

### Requirement: En silencio, un efecto reactivo se apaga y uno de ambiente sigue
Cuando la fuente de audio llega a un tramo en silencio, una tira con un efecto reactivo SHALL apagarse
(todos sus LEDs a 0) y seguir apagada mientras dure el silencio. Una tira con un efecto de ambiente
MUST seguir animándose igual. Con una tarjeta de sonido, también es silencio el ruido de fondo cuyo
nivel queda por debajo del umbral de silencio de la tarjeta.

> Traza: esquema del escenario *En silencio, cada efecto hace lo suyo* de `MOO-14` y PRD Q4 (resuelta
> el 24-sep). El ruido de fondo de la tarjeta es *(asumido)*: deuda que `MOO-14` dejó a `MOO-15`
> (`design.md` de `virtual-strip-audio-file`) y `design.md`, decisión 7. *Scroll*: criterio *La
> música se para con el scroll activo* de `MOO-99`. Que el rastro siga al volver la música es la v1,
> que en silencio no llamaba al efecto (`design.md` de `scroll-effect`, decisión 3).

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
