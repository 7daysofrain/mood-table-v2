# Spec Delta

## MODIFIED Requirements

### Requirement: Cada tira arranca con el efecto que declara el fichero
Al arrancar, cada tira SHALL animarse con el efecto que declara su campo `effect` en el fichero de
configuración, con los valores por defecto de sus parámetros. Es solo el efecto de arranque: con el
motor en marcha, el DJ lo puede cambiar (`specs/instrument-control`), y el fichero no vuelve a mandar
hasta que el motor se reinicia.

> Traza: caso feliz de `MOO-14` (*el fichero de configuración indica el efecto "energía" para la tira
> virtual*, asumido en la historia). Con H5, el estado guardado mandará sobre el fichero (README §2.2,
> reconciliación). Que sea solo el de arranque: contexto técnico de `MOO-94` (*el efecto del fichero
> de configuración es solo el de arranque*).

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

## ADDED Requirements

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
