# audio-playback Specification

## Purpose

Fija cómo oye el maker en el panel el fichero de audio del instrumento: cómo lo sirve el motor, cómo
sabe el panel por qué punto va, oír y dejar de oír, y la sincronía entre lo que se oye y lo que
muestra el visor.

## Requirements

### Requirement: El maker oye el fichero por el punto al que reacciona la tira
Con un fichero de audio como fuente, el panel SHALL dejar que el maker pida oírlo. Al pedirlo, el maker
MUST oír el fichero por el punto al que está reaccionando la tira en el visor, no desde el principio,
aunque el motor lleve un rato reproduciéndolo. El panel no suena hasta que el maker lo pide.

> Traza: caso feliz de `MOO-22`. Que el audio necesite un gesto del maker es una restricción de los
> navegadores (decisión del usuario al refinar la historia). Sincronizar con lo que muestra el visor:
> `design.md`, decisión 1.

#### Scenario: Oír el fichero de audio mientras la tira virtual reacciona
- **GIVEN** el motor arrancado con un fichero de audio como fuente en el fichero de configuración
- **AND** una tira virtual con el efecto «energía» en el fichero de configuración (asumido)
- **AND** el motor lleva un rato reproduciendo el fichero de audio
- **WHEN** el maker abre el panel y pide oír el fichero de audio
- **THEN** el maker oye el fichero de audio por el punto al que está reaccionando la tira virtual
- **AND** ve en el visor la tira virtual reaccionando al ritmo de lo que oye

#### Scenario: El panel no suena solo (asumido)
- **GIVEN** el motor con un fichero de audio como fuente
- **WHEN** el maker abre el panel y no pide oír el fichero
- **THEN** el panel no suena

### Requirement: Dejar de oír no para el instrumento
El maker SHALL poder dejar de oír el fichero en el panel. Dejar de oír solo calla el panel: el motor
MUST seguir recorriendo el fichero y la tira, reaccionando a él. Al volver a pedir oírlo, el maker oye
el punto al que reacciona la tira en ese momento, no el punto donde dejó de oírlo.

> Traza: escenarios *Dejar de oír el fichero de audio* y *Volver a oír el fichero de audio tras dejar de
> oírlo* de `MOO-22`.

#### Scenario: Dejar de oír el fichero de audio
- **GIVEN** que el maker está oyendo el fichero de audio en el panel
- **WHEN** el maker pide dejar de oírlo
- **THEN** deja de oírlo
- **AND** la tira virtual sigue reaccionando al fichero de audio

#### Scenario: Volver a oír el fichero de audio tras dejar de oírlo
- **GIVEN** que el maker dejó de oír el fichero de audio hace un rato
- **WHEN** el maker pide oírlo de nuevo
- **THEN** oye el punto del fichero al que está reaccionando la tira virtual, no el punto donde dejó de
  oírlo

### Requirement: Lo que se oye va al ritmo de lo que muestra el visor
Mientras el maker oye el fichero, la luz del visor MUST NOT ir más de 45 ms por detrás del sonido ni
más de 125 ms por delante, también tras muchas vueltas del bucle. La diferencia se mide entre el punto
del fichero que suena y el del último frame que ha recibido el visor, teniendo en cuenta el retraso de
salida de audio que declara el navegador.

> Traza: caso feliz (*al ritmo de lo que oye*) y escenario *Lo que se oye sigue al ritmo de la luz
> aunque el fichero se repita* de `MOO-22`. Los números: `docs/umbrales-para-specs.md` (E2, ≤ 45 ms
> con la luz por detrás) e ITU-R BT.1359 para el sentido contrario (125 ms), acordados en la
> exploración. Medir contra el visor y solo con el retraso declarado: `design.md`, decisiones 1 y 5.

#### Scenario: Lo que se oye sigue al ritmo de la luz aunque el fichero se repita
- **GIVEN** que el maker lleva oyendo el fichero de audio en el panel varias vueltas del bucle
- **WHEN** el fichero de audio vuelve a empezar
- **THEN** el maker sigue viendo la tira virtual reaccionando al ritmo de lo que oye

#### Scenario: Tolerancia al oír (asumido)
- **GIVEN** que el maker oye el fichero de audio en el panel
- **WHEN** pasan varias vueltas del bucle
- **THEN** el punto que suena nunca va más de 45 ms por delante del punto del frame que muestra el
  visor, ni más de 125 ms por detrás

### Requirement: Sin fichero como fuente no hay nada que oír
Si la fuente de audio del instrumento no es un fichero, el panel MUST NOT ofrecer oír nada.

> Traza: escenario *Sin fichero de audio como fuente no se puede pedir oír* de `MOO-22`. `MOO-15`
> añadirá el caso de la tarjeta de sonido.

#### Scenario: Sin fichero de audio como fuente no se puede pedir oír
- **GIVEN** un fichero de configuración sin fuente de audio, con tiras solo de efectos de ambiente
- **WHEN** el maker abre el panel
- **THEN** el panel no le ofrece oír el fichero de audio

### Requirement: Al perder la conexión con el motor se deja de oír
Si el panel pierde la conexión con el motor mientras el maker oye el fichero, el panel MUST dejar de
sonar. Cuando la conexión vuelve, el maker tiene que pedir oírlo otra vez.

> Traza: *(asumido)*, `design.md`, decisión 1: sin frames no hay contra qué sincronizar. El candidato
> del poke-holes sobre la conexión se descartó como criterio de la historia; esto es solo el mínimo.

#### Scenario: El motor se para mientras el maker oye (asumido)
- **GIVEN** que el maker oye el fichero de audio en el panel
- **WHEN** el motor se para
- **THEN** el panel deja de sonar
- **AND** al volver el motor, el panel no suena hasta que el maker pide oír otra vez

### Requirement: El panel avisa mientras prepara el audio
Entre que el maker pide oír el fichero y el panel lo tiene listo para sonar, el panel SHALL indicar que
lo está preparando.

> Traza: *(asumido)*, `design.md`, decisión 3: el panel descarga el fichero entero antes de sonar, y
> en la demo pública puede tardar unos segundos.

#### Scenario: El fichero tarda en llegar (asumido)
- **GIVEN** el motor con un fichero de audio como fuente
- **WHEN** el maker pide oírlo y el fichero aún no ha llegado al panel
- **THEN** el panel indica que está preparando el audio
- **AND** cuando lo tiene, suena por el punto al que reacciona la tira

### Requirement: El motor sirve el fichero de audio
Con un fichero como fuente, el motor SHALL servir ese mismo fichero, tal cual, en una dirección propia
(`/audio`): el que leyó al arrancar y analiza, aunque cambie después en el disco. Sin fichero como
fuente, esa dirección MUST responder que no existe. La respuesta MUST NOT revelar la ruta del fichero en
el disco.

> Traza: *(asumido)*, `design.md`, decisión 6. Que no salga la ruta, como el mensaje de fuente (D51).
> Que sea el leído al arrancar: descripción de `MOO-58`.

#### Scenario: El panel descarga el fichero (asumido)
- **GIVEN** el motor con `config/audio/bouncer.wav` como fuente de audio
- **WHEN** se pide `/audio` al motor
- **THEN** la respuesta es el fichero, byte a byte, como audio WAV

#### Scenario: El fichero cambia en disco con el motor en marcha
- **GIVEN** el motor arrancado con un fichero de audio como fuente
- **WHEN** el fichero se sustituye en el disco y se pide `/audio` al motor
- **THEN** la respuesta es el fichero que el motor leyó al arrancar, el mismo que analiza

#### Scenario: Sin fichero como fuente (asumido)
- **GIVEN** el motor sin fuente de audio
- **WHEN** se pide `/audio` al motor
- **THEN** la respuesta dice que no existe (404)

### Requirement: La posición del fichero viaja por la conexión del visor
Con un fichero como fuente, el motor SHALL enviar a cada panel, en cada pulso y por la conexión de los
frames, un mensaje con el `seq` del pulso y el punto del fichero en segundos que ha analizado para ese
pulso, con el formato de `docs/instructions/viewer-protocol.md`. Todos los paneles MUST recibir la
misma posición. Sin fichero, no se envía.

> Traza: *(asumido)*, `design.md`, decisión 2: el motor es la única fuente de verdad de la posición.
> Extiende el protocolo del visor (D45, D51).

#### Scenario: Un panel recibe la posición (asumido)
- **GIVEN** el motor con un fichero de audio como fuente y un panel conectado
- **WHEN** el motor calcula un pulso
- **THEN** el panel recibe un mensaje de posición con el mismo `seq` que los frames de ese pulso

#### Scenario: La posición vuelve a cero con el bucle (asumido)
- **GIVEN** el motor con un fichero de audio de 4 s como fuente
- **WHEN** el bucle pasa del final del fichero al principio
- **THEN** la posición que recibe el panel pasa de casi 4 s a casi 0 s

#### Scenario: Sin fichero, sin posición (asumido)
- **GIVEN** el motor sin fuente de audio y un panel conectado
- **WHEN** el motor calcula un pulso
- **THEN** el panel no recibe ningún mensaje de posición
