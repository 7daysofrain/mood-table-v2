# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
