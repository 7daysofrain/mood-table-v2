# table-service Specification

## Purpose
Fija cómo arranca el instrumento en la mesa al encenderla: sin que nadie lo lance, después de los
dispositivos enchufados, sin esperar a la red y sin rearrancarse solo si se cae.

## Requirements

### Requirement: El instrumento arranca solo al encender la mesa
Con el instrumento instalado y su servicio registrado, al encender la Raspberry de la mesa el motor
SHALL arrancar sin que nadie lo lance, con el fichero de configuración de la mesa, y pintar las tiras
aunque nadie abra el panel. Registrar el servicio es un paso que se hace una vez y sobrevive a los
reinicios.

> Traza: escenario *La mesa arranca sola al enchufarla* de `MOO-131`. Sin portátil ni internet: E6.

#### Scenario: La mesa arranca sola al enchufarla
- **GIVEN** una mesa con el instrumento ya instalado y su servicio registrado (asumido)
- **AND** apagada, sin portátil ni internet
- **WHEN** el DJ la enchufa
- **THEN** el instrumento empieza a funcionar sin que haga nada más: las tiras pintan su efecto,
  aunque nadie abra el panel
- **AND** si suena música por la tarjeta de sonido, los efectos reactivos reaccionan a ella
- **AND** el panel se puede abrir desde la red local

#### Scenario: El servicio sigue registrado tras apagar y encender
- **GIVEN** que el servicio se registró una vez y la mesa ya ha arrancado sola
- **WHEN** el DJ la apaga y la vuelve a enchufar
- **THEN** el instrumento vuelve a arrancar solo, sin registrar nada otra vez (asumido)

### Requirement: El servicio arranca después de los dispositivos enchufados al encender
El servicio SHALL lanzar el motor después de que el sistema haya terminado de reconocer los
dispositivos que estaban enchufados al encender, para que el motor encuentre el puerto serie del
controlador Adalight y la tarjeta de sonido. Sin ellos, el motor no arranca, como hasta ahora.

> Traza: contexto técnico de `MOO-131` (carrera de arranque). Sin ellos no arranca: `audio-source`,
> `physical-strip` y los non-goals de `MOO-131`.

#### Scenario: El motor encuentra el controlador y la tarjeta enchufados (asumido)
- **GIVEN** una mesa con el controlador Adalight y la tarjeta de sonido enchufados
- **WHEN** el DJ la enchufa
- **THEN** el motor arranca y abre los dos, sin fallar por haber llegado antes que ellos

#### Scenario: Sin la tarjeta de sonido, el motor no arranca y dice por qué (asumido)
- **GIVEN** una mesa con el fichero de configuración apuntando a la tarjeta de sonido
- **AND** la tarjeta de sonido desenchufada
- **WHEN** el DJ la enchufa
- **THEN** el motor no arranca
- **AND** su registro dice qué tarjeta no ha podido abrir

### Requirement: El arranque no espera a la red
El servicio SHALL lanzar el motor sin esperar a que haya red. El motor de la mesa SHALL escuchar en
todas las interfaces, de forma que el panel se pueda abrir desde la red local en cuanto esta llegue,
sin reiniciar el motor.

> Traza: escenario *La red local no está al enchufar la mesa* de `MOO-131`.

#### Scenario: La red local no está al enchufar la mesa
- **GIVEN** una mesa con el instrumento ya instalado y apagada
- **AND** la red local todavía no está disponible al arrancar
- **WHEN** el DJ la enchufa
- **THEN** el instrumento arranca igualmente y las tiras pintan su efecto
- **AND** en cuanto la red local está disponible, el panel se puede abrir, sin volver a enchufar

### Requirement: El servicio no rearranca el motor
Si el motor termina o falla después de arrancar, el servicio SHALL dejarlo parado, sin volver a
lanzarlo. El DJ lo recupera apagando y encendiendo la mesa.

> Traza: non-goal de `MOO-131` (decisión del DJ al refinar): sin rearranque automático.

#### Scenario: El motor se cae y el servicio no lo relanza
- **GIVEN** una mesa que ha arrancado sola
- **WHEN** el motor termina por un fallo
- **THEN** el servicio no lo vuelve a lanzar, y las tiras dejan de recibir frames
- **AND** al apagar y encender la mesa, el instrumento vuelve a arrancar solo
