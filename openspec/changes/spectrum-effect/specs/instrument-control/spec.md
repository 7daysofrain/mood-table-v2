# Spec Delta

## MODIFIED Requirements

### Requirement: La zona Efectos muestra los efectos de la tira seleccionada
La zona «Efectos» SHALL mostrar los efectos disponibles para la tira seleccionada (hoy, todos los del
catálogo: *energía*, *scroll*, *espectro* y *respiración*), cada uno etiquetado como *reactivo* o *de
ambiente*, con el efecto activo de la tira marcado.

> Traza: criterio *El DJ elige una tira y ve sus efectos* de `MOO-94`, README §1.3 (zona Efectos) y
> glosario del PRD (*efecto reactivo* y *de ambiente*). *Scroll*: caso feliz de `MOO-99`.
> *Espectro*: caso feliz de `MOO-98`; su sitio en la lista, decisión del DJ al revisar el change
> (`design.md` de `spectrum-effect`, decisión 5).

#### Scenario: El DJ elige una tira y ve sus efectos
- **GIVEN** que el panel está abierto con la música sonando
- **WHEN** el DJ selecciona una tira
- **THEN** la zona Efectos muestra los efectos disponibles para esa tira (hoy, todos)
- **AND** cada efecto aparece como reactivo o de ambiente, con el activo marcado

#### Scenario: El DJ elige el efecto scroll para una tira
- **GIVEN** el motor pinta una tira con otro efecto
- **AND** suena música desde la fuente de audio *(asumido en la historia)*
- **WHEN** el DJ elige el efecto *scroll* para esa tira
- **THEN** la tira deja de pintar el efecto anterior al momento
- **AND** la tira pinta el *scroll* de la v1: la luz nace en el centro y se desplaza hacia los dos
  extremos
- **AND** *scroll* queda marcado como el efecto activo, etiquetado como reactivo

#### Scenario: El DJ elige el efecto espectro para una tira
- **GIVEN** el motor pinta una tira con otro efecto *(asumido en la historia)*
- **AND** suena música desde la fuente de audio *(asumido en la historia)*
- **WHEN** el DJ elige el efecto *espectro* para esa tira
- **THEN** la tira deja de pintar el efecto anterior al momento
- **AND** la tira pinta el *espectro* de la v1: cada zona de la tira representa una banda de
  frecuencia
- **AND** el *espectro* queda marcado como el efecto activo, etiquetado como reactivo

### Requirement: La zona Controles muestra los controles del efecto activo
La zona «Controles» SHALL mostrar un control por cada parámetro del efecto activo de la tira
seleccionada, generado a partir del esquema del efecto: un número con rango es un slider y un color es
un selector de color. Si el efecto activo no tiene parámetros, la zona MUST quedar solo con su título.

> Traza: criterio *El panel muestra los controles de la respiración* de `MOO-95` y README §1.3 (zona
> Controles). El efecto sin parámetros es *(asumido)*: requisito *Las zonas vacías no inventan datos*
> de `panel-layout`. `design.md`, decisión 5. *Scroll* sin controles: caso feliz de `MOO-99`.
> *Espectro* sin controles: caso feliz de `MOO-98`.

#### Scenario: El panel muestra los controles de la respiración
- **GIVEN** que una tira tiene activa la respiración
- **WHEN** el DJ selecciona esa tira
- **THEN** la zona Controles muestra un control por cada parámetro de la respiración: un selector
  para el color y un slider para el periodo

#### Scenario: Un efecto sin parámetros no tiene controles (asumido)
- **GIVEN** que una tira tiene activa la energía
- **WHEN** el DJ selecciona esa tira
- **THEN** la zona Controles solo muestra su título

#### Scenario: El scroll no tiene controles
- **GIVEN** que el DJ ha elegido el efecto *scroll* para una tira
- **WHEN** el panel muestra esa tira
- **THEN** la zona Controles solo muestra su título, como para la energía

#### Scenario: El espectro no tiene controles
- **GIVEN** que el DJ ha elegido el efecto *espectro* para una tira
- **WHEN** el panel muestra esa tira
- **THEN** la zona Controles solo muestra su título, como para la energía
