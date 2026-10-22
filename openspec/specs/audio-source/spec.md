# audio-source Specification

## Purpose
Fija la fuente de audio del instrumento: de dónde sale la música que analiza el motor, cómo suena un
fichero, qué formatos acepta, su nivel y cómo ve el maker la fuente y el nivel en el panel.

## Requirements

### Requirement: El fichero de audio suena en bucle al ritmo del motor
Con un fichero como fuente de audio, el motor SHALL tomar en cada pulso el audio que corresponde a ese
instante, contado desde que arrancó: el ritmo lo marca el motor, no el fichero. Al llegar al final, el
fichero MUST volver a empezar desde el principio, sin pausa.

> Traza: escenario *El fichero de audio vuelve a empezar al acabarse* de `MOO-14`. Que el ritmo lo
> marque el motor es *(asumido)*: `design.md`, decisión 3.

#### Scenario: El fichero de audio vuelve a empezar al acabarse
- **GIVEN** que la tira virtual reacciona al fichero de audio
- **WHEN** el fichero de audio llega al final
- **THEN** el fichero vuelve a empezar desde el principio
- **AND** la tira sigue reaccionando al audio

#### Scenario: El audio empieza con el motor (asumido)
- **GIVEN** un fichero de audio con un golpe en el segundo 1 y silencio en el resto
- **WHEN** el motor arranca con ese fichero como fuente y una tira con *energía*
- **THEN** la tira está apagada durante el primer segundo y se ilumina con el golpe del segundo 1

### Requirement: El fichero de audio es un WAV PCM de 16 bits
El motor SHALL aceptar como fichero de audio un WAV PCM de 16 bits, mono o estéreo, con cualquier
frecuencia de muestreo. Con cualquier otro fichero, el motor MUST NOT arrancar: el mensaje nombra el
fichero, dice que su formato no es válido y dice qué formato acepta.

> Traza: *(asumido)*, `design.md`, decisión 7. El motor no arranca, igual que con un fichero de
> configuración que no sirve (`specs/engine-config`).

#### Scenario: Un WAV estéreo a 48 kHz (asumido)
- **GIVEN** un fichero de configuración cuya fuente de audio es un WAV PCM de 16 bits, estéreo, a
  48 kHz
- **WHEN** el maker arranca el motor
- **THEN** el motor arranca y la tira reacciona al audio

#### Scenario: Un fichero con otro formato (asumido)
- **GIVEN** un fichero de configuración cuya fuente de audio es un WAV de 24 bits, o un fichero que no
  es WAV
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el fichero, dice que su formato no es válido y que se acepta WAV PCM de
  16 bits, mono o estéreo

### Requirement: El motor no arranca si no encuentra el fichero de audio
Si el fichero de audio declarado no existe o no se puede leer, el motor MUST NOT arrancar. El mensaje
SHALL dar la ruta tal como la ha resuelto el motor, para que se vea dónde lo ha buscado.

> Traza: *(asumido)*, `design.md`, decisión 8.

#### Scenario: El fichero de audio no existe (asumido)
- **GIVEN** un fichero de configuración cuya fuente de audio es `config/no-existe.wav`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje dice que no encuentra el fichero de audio y da su ruta completa

### Requirement: El motor mide el nivel de la fuente de audio
Mientras haya fuente de audio, el motor SHALL medir su nivel en cada pulso: cuánta señal llega, antes
de que el motor la ajuste. Lo mide aunque ninguna tira use el audio.

> Traza: caso feliz de `MOO-14` (*el panel muestra el nivel de la fuente de audio en tiempo real*).
> Que sea la señal sin ajustar y que se mida sin tiras reactivas es *(asumido)*: `design.md`,
> decisión 4. Glosario del PRD: *nivel*.

#### Scenario: Nivel sin ninguna tira reactiva (asumido)
- **GIVEN** un fichero de audio como fuente y una sola tira, con la *respiración*
- **WHEN** suena el fichero
- **THEN** el panel muestra un nivel que sube y baja con el audio

#### Scenario: Nivel en silencio (asumido)
- **GIVEN** un fichero de audio como fuente
- **WHEN** el fichero llega a un tramo en silencio
- **THEN** el panel muestra el nivel al mínimo

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
como si la fuente estuviera en silencio hasta recuperarla, y SHALL escribir una sola vez en el log qué
tarjeta se ha perdido y el motivo que da el sistema.

> Traza: non-goal de `MOO-15` (*el motor sigue con silencio*). Seguir en marcha en lugar de terminar:
> `design.md` de `soundcard-audio-source`, decisión 5, validado por el DJ al refinar `MOO-59`. La
> recuperación y el aviso en el panel son los requisitos siguientes (`MOO-59`).

#### Scenario: Se desconecta la tarjeta en plena sesión
- **GIVEN** el motor en marcha con la tarjeta de sonido como fuente, una tira con «energía» y otra con
  la «respiración»
- **WHEN** se desconecta la tarjeta de sonido
- **THEN** el motor sigue en marcha
- **AND** la tira con «energía» se apaga y la de la «respiración» sigue animándose
- **AND** el log dice qué tarjeta de sonido se ha perdido

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
