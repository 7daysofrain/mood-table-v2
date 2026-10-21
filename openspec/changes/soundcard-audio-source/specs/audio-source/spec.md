# Spec Delta

## ADDED Requirements

### Requirement: La tarjeta de sonido declarada es la fuente de audio
Con una tarjeta de sonido como fuente, el motor SHALL analizar en cada pulso el audio más reciente que
le llega a la tarjeta declarada, y solo a esa, aunque haya otras conectadas. La tarjeta solo funciona
en Linux.

> Traza: escenarios *La tira virtual reacciona a la tarjeta de sonido* y *Con varias tarjetas de
> sonido, usa la declarada* de `MOO-15`. Que el motor tome lo más reciente, sin mirar el instante del
> pulso, es D50.

#### Scenario: La tira virtual reacciona a la tarjeta de sonido
- **GIVEN** que el fichero de configuración declara la tarjeta de sonido como fuente de audio
- **AND** a la tarjeta de sonido le llega música
- **AND** la tira virtual tiene el efecto «energía»
- **WHEN** el maker abre el panel
- **THEN** ve en el visor cómo la tira reacciona a la música
- **AND** el panel indica que la fuente de audio es la tarjeta de sonido
- **AND** el panel muestra el nivel de la fuente de audio en tiempo real

#### Scenario: Con varias tarjetas de sonido, usa la declarada
- **GIVEN** que hay varias tarjetas de sonido conectadas
- **AND** el fichero de configuración declara una de ellas como fuente de audio
- **WHEN** el maker abre el panel
- **THEN** el panel indica qué tarjeta de sonido se usa
- **AND** la tira reacciona solo a la música que llega a esa tarjeta

### Requirement: El motor no arranca si no puede abrir la tarjeta de sonido
Si el motor no puede abrir la tarjeta de sonido declarada, MUST NOT arrancar. El mensaje SHALL dar el
nombre de la tarjeta, su cadena de dispositivo y el motivo que da el sistema. Que la tarjeta no
entregue música no impide arrancar: el motor arranca en cuanto la tarjeta empieza a entregar audio,
aunque sea silencio.

> Traza: esquema del escenario *El instrumento no arranca si la tarjeta de sonido declarada no está*
> de `MOO-15`. Que el único fallo sea no poder abrirla, y no la falta de música, es *(asumido)*:
> `design.md`, decisión 4.

#### Scenario: El instrumento no arranca si la tarjeta de sonido declarada no está
- **GIVEN** que el fichero de configuración declara una tarjeta de sonido como fuente de audio
- **AND** esa tarjeta de sonido no está conectada, o no existe con esa cadena de dispositivo
- **WHEN** el maker arranca el instrumento
- **THEN** el instrumento no arranca
- **AND** dice qué tarjeta de sonido no encuentra, con su nombre y su cadena de dispositivo

#### Scenario: Arranca aunque no llegue música (asumido)
- **GIVEN** que la tarjeta de sonido declarada está conectada y no le llega nada por su entrada
- **WHEN** el maker arranca el instrumento
- **THEN** el instrumento arranca
- **AND** el panel muestra el nivel de la fuente de audio al mínimo

#### Scenario: Una tarjeta de sonido en un sistema sin ALSA (asumido)
- **GIVEN** un equipo sin `arecord`, como macOS o Windows
- **AND** un fichero de configuración que declara una tarjeta de sonido como fuente de audio
- **WHEN** el maker arranca el instrumento
- **THEN** el instrumento no arranca
- **AND** el mensaje dice que la tarjeta de sonido necesita Linux con ALSA y que en ese equipo se
  usa un fichero de audio

### Requirement: La luz no llega tarde a la música de la tarjeta de sonido
Con la tarjeta de sonido como fuente, la tira SHALL iluminarse con cada golpe sin que se note retraso.
El umbral de referencia es el de E2: 45 ms del sonido a la luz. Se comprueba a ojo en la mesa.

> Traza: escenario *La tira no llega tarde a la música* de `MOO-15`. Umbral de E2 en
> `docs/umbrales-para-specs.md` (ITU-R BT.1359). La comprobación a ojo es la excepción al DoD de la
> historia; el reparto de los 45 ms está en `design.md`, decisión 1.

#### Scenario: La tira no llega tarde a la música
- **GIVEN** que a la tarjeta de sonido le llega música con golpes marcados
- **AND** la tira virtual tiene el efecto «energía»
- **WHEN** suena un golpe
- **THEN** la tira se ilumina con el golpe, sin que se note retraso (umbral de referencia: 45 ms, E2)

### Requirement: La tarjeta no hace destellar la tira al arrancar
El motor MUST NOT usar el audio de los primeros 300 ms tras abrir la tarjeta de sonido: hasta
entonces, la fuente entrega silencio.

> Traza: *(asumido)*, `design.md`, decisión 6. Medido el 21-oct en la tarjeta de la mesa: al abrirla,
> llega un chasquido de unos 250 ms, hasta −36 dBFS, aunque no tenga nada conectado.

#### Scenario: Arrancar sin destello (asumido)
- **GIVEN** que la tarjeta de sonido declarada no recibe nada
- **AND** una tira con el efecto «energía»
- **WHEN** el maker arranca el instrumento
- **THEN** la tira sigue apagada durante el arranque

### Requirement: Si la tarjeta de sonido se pierde en plena sesión, el motor sigue con silencio
Si la tarjeta de sonido deja de entregar audio con el motor en marcha, el motor MUST seguir en marcha
como si la fuente estuviera en silencio, y SHALL escribir una sola vez en el log qué tarjeta se ha
perdido y el motivo que da el sistema. No vuelve a abrirla.

> Traza: non-goal de `MOO-15` (*no se reconecta sola: el motor sigue con silencio*). Seguir en marcha
> en lugar de terminar es *(asumido)*: `design.md`, decisión 5. La reconexión y el aviso en el panel
> son `MOO-59`.

#### Scenario: Se desconecta la tarjeta en plena sesión (asumido)
- **GIVEN** el motor en marcha con la tarjeta de sonido como fuente, una tira con «energía» y otra con
  la «respiración»
- **WHEN** se desconecta la tarjeta de sonido
- **THEN** el motor sigue en marcha
- **AND** la tira con «energía» se apaga y la de la «respiración» sigue animándose
- **AND** el log dice qué tarjeta de sonido se ha perdido

## MODIFIED Requirements

### Requirement: El panel dice cuál es la fuente de audio
La cabecera del panel SHALL decir cuál es la fuente de audio: si es un fichero, lo dice y da su
nombre, sin la ruta; si es una tarjeta de sonido, lo dice y da el nombre que le da el fichero de
configuración, sin su cadena de dispositivo. Si el instrumento no tiene fuente de audio, la cabecera
MUST decir «Sin fuente de audio». Sin conexión con el motor, la cabecera no muestra fuente ni nivel.

> Traza: caso feliz de `MOO-14` (*el panel indica que la fuente de audio es un fichero, con su
> nombre*) y de `MOO-15` (*el panel indica que la fuente de audio es la tarjeta de sonido*). El caso
> sin fuente, sin conexión y no dar la ruta son *(asumido)*: `design.md` de
> `virtual-strip-audio-file`, decisión 5. El nombre de la tarjeta, y no su cadena, es *(asumido)*:
> `design.md`, decisión 3.

#### Scenario: La tira virtual reacciona a un fichero de audio
- **GIVEN** que el instrumento funciona sin hardware, con un fichero de audio como fuente de audio
- **AND** el fichero de configuración indica el efecto «energía» para la tira virtual (asumido)
- **WHEN** el maker abre el panel
- **THEN** ve en el visor cómo la tira reacciona al audio
- **AND** el panel indica que la fuente de audio es un fichero, con su nombre
- **AND** el panel muestra el nivel de la fuente de audio en tiempo real

#### Scenario: La cabecera nombra la tarjeta de sonido (asumido)
- **GIVEN** un fichero de configuración cuya fuente de audio es la tarjeta de sonido
  `plughw:CARD=Device,DEV=0`, con el nombre «Mixer de la mesa»
- **WHEN** el maker abre el panel
- **THEN** la cabecera dice «Tarjeta de sonido: Mixer de la mesa» y muestra su nivel
- **AND** no muestra la cadena de dispositivo ni ofrece oír la fuente

#### Scenario: Instrumento sin fuente de audio (asumido)
- **GIVEN** un fichero de configuración sin fuente de audio y una tira con la *respiración*
- **WHEN** el maker abre el panel
- **THEN** la cabecera dice «Sin fuente de audio» y no muestra ningún nivel

#### Scenario: Sin conexión con el motor (asumido)
- **GIVEN** que el motor no está en marcha
- **WHEN** el maker abre el panel
- **THEN** la cabecera dice «Sin conexión con el motor» y no muestra fuente ni nivel

### Requirement: La fuente y el nivel viajan por la conexión del visor
El motor SHALL enviar a cada panel, por la misma conexión que los frames y con el formato de
`docs/instructions/viewer-protocol.md`, un mensaje con la fuente de audio al conectarse y, en cada
pulso, un mensaje con el nivel y el `seq` de ese pulso. Todos los paneles MUST recibir el mismo nivel.

> Traza: *(asumido)*, `design.md` de `virtual-strip-audio-file`, decisión 5. Extiende el contrato del
> protocolo del visor (D45). La clase de fuente de la tarjeta de sonido es *(asumido)*: `design.md`,
> decisión 3.

#### Scenario: Un panel se conecta (asumido)
- **GIVEN** el motor en marcha con un fichero de audio como fuente
- **WHEN** un panel se conecta
- **THEN** recibe un mensaje con el tipo de fuente (fichero) y el nombre del fichero
- **AND** en cada pulso recibe un mensaje de nivel con el mismo `seq` que los frames de ese pulso

#### Scenario: Un panel se conecta con la tarjeta de sonido como fuente (asumido)
- **GIVEN** el motor en marcha con una tarjeta de sonido como fuente
- **WHEN** un panel se conecta
- **THEN** recibe un mensaje con el tipo de fuente (tarjeta de sonido) y el nombre de la tarjeta
- **AND** en cada pulso recibe un mensaje de nivel, y ninguno con la posición de un fichero

#### Scenario: Dos paneles ven el mismo nivel (asumido)
- **GIVEN** dos paneles conectados al motor
- **WHEN** el motor mide el nivel de un pulso
- **THEN** los dos reciben el mismo mensaje de nivel, con el mismo `seq`
