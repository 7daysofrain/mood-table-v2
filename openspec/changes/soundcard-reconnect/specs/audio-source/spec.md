# Spec Delta

## MODIFIED Requirements

### Requirement: Si la tarjeta de sonido se pierde en plena sesión, el motor sigue con silencio
Si la tarjeta de sonido deja de entregar audio con el motor en marcha, el motor MUST seguir en marcha
como si la fuente estuviera en silencio hasta recuperarla, y SHALL escribir una sola vez en el log qué
tarjeta se ha perdido y el motivo que da el sistema.

> Traza: non-goal de `MOO-15` (*el motor sigue con silencio*). Seguir en marcha en lugar de terminar:
> `design.md` de `soundcard-audio-source`, decisión 5, validado por el DJ al refinar `MOO-59`. La
> recuperación y el aviso en el panel son los requisitos siguientes (`MOO-59`). El título del
> escenario aún dice «(asumido)» porque un MODIFIED no puede renombrar escenarios: la marca se quita
> en la spec principal al archivar el change.

#### Scenario: Se desconecta la tarjeta en plena sesión (asumido)
- **GIVEN** el motor en marcha con la tarjeta de sonido como fuente, una tira con «energía» y otra con
  la «respiración»
- **WHEN** se desconecta la tarjeta de sonido
- **THEN** el motor sigue en marcha
- **AND** la tira con «energía» se apaga y la de la «respiración» sigue animándose
- **AND** el log dice qué tarjeta de sonido se ha perdido

## ADDED Requirements

### Requirement: El motor recupera la tarjeta de sonido declarada cuando vuelve
Mientras la tarjeta de sonido está perdida, el motor SHALL intentar abrirla de nuevo con la misma
cadena de dispositivo, sin límite de tiempo ni de intentos y sin reiniciarse. Al recuperarla, la luz
vuelve a seguir la música en menos de 3 s desde que el sistema ve la tarjeta, y el log lo dice una
vez. Los intentos fallidos MUST NOT escribir en el log.

> Traza: caso feliz de `MOO-59` (*cuando se vuelva a conectar se recuperen los efectos reactivos*;
> *da igual cuánto tiempo*) y criterio *La tarjeta declarada vuelve por otro puerto*. Los 3 s son el
> peor caso medido en la Pi el 22-oct más un margen que decidió el DJ (`design.md`, decisión 6). La
> línea del log al recuperarla y el silencio de los intentos fallidos, validados por el DJ al revisar
> el change: `design.md`, decisión 2. Recuperarla sin destello (el chasquido al abrirla, medido el
> 21-oct), también validado: `design.md`, decisión 1.

#### Scenario: Se vuelve a conectar la tarjeta de sonido
- **GIVEN** la tarjeta de sonido desconectada en plena sesión, da igual cuánto tiempo, y el panel
  avisando
- **WHEN** se vuelve a conectar la tarjeta de sonido
- **THEN** los efectos reactivos vuelven a seguir la música, sin reiniciar el motor
- **AND** el aviso desaparece del panel

#### Scenario: La tarjeta declarada vuelve por otro puerto
- **GIVEN** la tarjeta de sonido declarada, desconectada en plena sesión
- **WHEN** se vuelve a conectar en otro puerto USB
- **THEN** los efectos reactivos vuelven a seguir la música

#### Scenario: Recuperarla sin destello
- **GIVEN** la tarjeta de sonido desconectada en plena sesión y una tira con el efecto «energía»
- **WHEN** se vuelve a conectar la tarjeta de sonido sin nada en su entrada
- **THEN** la tira sigue apagada al recuperarla

#### Scenario: El log no se llena mientras falta la tarjeta
- **GIVEN** la tarjeta de sonido desconectada en plena sesión durante varios minutos
- **WHEN** se vuelve a conectar la tarjeta de sonido
- **THEN** el log tiene una línea de la pérdida y otra de la recuperación, y ninguna más de la
  tarjeta

### Requirement: El panel avisa mientras la tarjeta de sonido está perdida
Mientras la tarjeta de sonido está perdida, la cabecera del panel MUST avisar de que está
desconectada, de forma que salta a la vista y en menos de 1 s desde la pérdida, también en un panel
que se abre durante el corte. Al recuperarla, el aviso desaparece. Un silencio MUST NOT disparar el
aviso.

> Traza: caso feliz de `MOO-59` (*quiero ver el mensaje desconectado*) y criterios *Se abre el panel
> con la tarjeta ya desconectada*, *Un silencio no es una desconexión* y *Se conecta otra tarjeta
> distinta de la declarada*. El 1 s es el límite de Nielsen para que la respuesta no corte el hilo
> del usuario (`docs/umbrales-para-specs.md`). Cómo se ve el aviso: `design.md`, decisión 5.

#### Scenario: Se desconecta la tarjeta de sonido en plena sesión
- **GIVEN** el motor en marcha con la tarjeta de sonido como fuente de audio y el panel abierto
- **WHEN** se desconecta la tarjeta de sonido
- **THEN** el panel avisa de que la tarjeta de sonido está desconectada, de forma que salta a la vista

#### Scenario: Se abre el panel con la tarjeta ya desconectada
- **GIVEN** la tarjeta de sonido desconectada en plena sesión
- **WHEN** el DJ abre el panel
- **THEN** el panel avisa de que la tarjeta de sonido está desconectada

#### Scenario: Un silencio no es una desconexión
- **GIVEN** el motor en marcha con la tarjeta de sonido conectada como fuente de audio
- **WHEN** la música se queda en silencio
- **THEN** el panel no avisa de que la tarjeta de sonido esté desconectada

#### Scenario: Se conecta otra tarjeta distinta de la declarada
- **GIVEN** la tarjeta de sonido declarada, desconectada en plena sesión
- **WHEN** se conecta otra tarjeta de sonido distinta
- **THEN** el panel sigue avisando de que la tarjeta declarada está desconectada

### Requirement: El estado de la tarjeta de sonido viaja por la conexión del visor
Con la tarjeta de sonido como fuente, el motor SHALL enviar a cada panel, por la misma conexión que
los frames y con el formato de `docs/instructions/viewer-protocol.md`, un mensaje con su estado
(conectada o perdida) al conectarse y otro a todos los paneles cada vez que cambia. Con un fichero o
sin fuente de audio, el motor MUST NOT enviarlo.

> Traza: validado por el DJ al revisar el change (`design.md`, decisión 3). Extiende el contrato del
> protocolo del visor (D45).

#### Scenario: Un panel se conecta con la tarjeta perdida
- **GIVEN** el motor en marcha con la tarjeta de sonido perdida
- **WHEN** un panel se conecta
- **THEN** recibe el mensaje de fuente con la tarjeta de sonido y, después, uno de estado que dice que
  está perdida

#### Scenario: Dos paneles ven la recuperación
- **GIVEN** dos paneles conectados y la tarjeta de sonido perdida
- **WHEN** el motor recupera la tarjeta
- **THEN** los dos reciben un mensaje de estado que dice que está conectada

#### Scenario: Con un fichero no hay estado
- **GIVEN** el motor en marcha con un fichero de audio como fuente
- **WHEN** un panel se conecta
- **THEN** no recibe ningún mensaje de estado de la fuente
