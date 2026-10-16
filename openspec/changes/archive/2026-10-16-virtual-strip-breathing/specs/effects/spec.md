# Spec Delta

## Purpose

Fija el catálogo de efectos y lo que cumplen todos: qué efecto tiene una tira al arrancar, cómo se ve
cada uno y que, con la misma entrada, producen siempre los mismos frames.

## ADDED Requirements

### Requirement: Toda tira arranca con la respiración
Toda tira declarada SHALL arrancar con el efecto *respiración*. El efecto inicial no se declara en el
fichero de configuración ni se guarda en la base de datos.

> Traza: caso feliz de `MOO-13` (*la tira tiene el efecto "respiración"*). Que sea el efecto por
> defecto en código es *(asumido)* en la historia (contexto técnico).

#### Scenario: Una tira recién declarada
- **GIVEN** un fichero de configuración con una tira virtual, sin ningún efecto declarado
- **WHEN** el motor arranca
- **THEN** la tira se anima con la respiración

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
Con el mismo instante, los mismos parámetros y la misma tira, un efecto MUST producir siempre el mismo
frame, sin depender del reloj real ni de frames calculados antes por otras tiras.

> Traza: *(asumido)*, README §2.1 (*Testabilidad determinista: frames dorados*) y `design.md`,
> decisión 7.

#### Scenario: Frames dorados de la respiración (asumido)
- **GIVEN** la respiración con sus valores por defecto y una tira de 60 LEDs
- **WHEN** se calculan sus frames en los instantes 0, 1, 2 y 3 segundos
- **THEN** los frames son idénticos a los frames de referencia guardados en el repositorio

### Requirement: Un efecto de ambiente funciona sin fuente de audio
Un efecto que no usa audio, como la respiración, SHALL animarse aunque el instrumento no tenga ninguna
fuente de audio.

> Traza: caso feliz de `MOO-13` (*sin audio*: non-goal de la historia) y glosario del PRD (*sin fuente
> solo funcionan los efectos de ambiente*).

#### Scenario: Instrumento sin fuente de audio
- **GIVEN** un fichero de configuración sin fuente de audio y una tira con la respiración
- **WHEN** el motor está en marcha
- **THEN** la tira se anima
