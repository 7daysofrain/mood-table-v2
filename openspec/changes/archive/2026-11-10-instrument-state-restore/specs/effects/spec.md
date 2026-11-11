# Spec Delta

## MODIFIED Requirements

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
