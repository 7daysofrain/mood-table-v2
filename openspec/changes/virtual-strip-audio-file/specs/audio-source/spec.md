# Spec Delta

## Purpose

Fija la fuente de audio del instrumento: de dónde sale la música que analiza el motor, cómo suena un
fichero, qué formatos acepta, su nivel y cómo ve el maker la fuente y el nivel en el panel.

## ADDED Requirements

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
nombre, sin la ruta. Si el instrumento no tiene fuente de audio, la cabecera MUST decir «Sin fuente
de audio». Sin conexión con el motor, la cabecera no muestra fuente ni nivel.

> Traza: caso feliz de `MOO-14` (*el panel indica que la fuente de audio es un fichero, con su
> nombre*). El caso sin fuente, sin conexión y no dar la ruta son *(asumido)*: `design.md`,
> decisión 5.

#### Scenario: La tira virtual reacciona a un fichero de audio
- **GIVEN** que el instrumento funciona sin hardware, con un fichero de audio como fuente de audio
- **AND** el fichero de configuración indica el efecto «energía» para la tira virtual (asumido)
- **WHEN** el maker abre el panel
- **THEN** ve en el visor cómo la tira reacciona al audio
- **AND** el panel indica que la fuente de audio es un fichero, con su nombre
- **AND** el panel muestra el nivel de la fuente de audio en tiempo real

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

> Traza: *(asumido)*, `design.md`, decisión 5. Extiende el contrato del protocolo del visor (D45).

#### Scenario: Un panel se conecta (asumido)
- **GIVEN** el motor en marcha con un fichero de audio como fuente
- **WHEN** un panel se conecta
- **THEN** recibe un mensaje con el tipo de fuente (fichero) y el nombre del fichero
- **AND** en cada pulso recibe un mensaje de nivel con el mismo `seq` que los frames de ese pulso

#### Scenario: Dos paneles ven el mismo nivel (asumido)
- **GIVEN** dos paneles conectados al motor
- **WHEN** el motor mide el nivel de un pulso
- **THEN** los dos reciben el mismo mensaje de nivel, con el mismo `seq`
