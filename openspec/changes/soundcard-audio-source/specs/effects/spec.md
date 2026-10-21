# Spec Delta

## MODIFIED Requirements

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
