# table-install Specification

## Purpose

Fija cómo se instala y se reinstala el instrumento en una Raspberry: con un solo comando, con un
usuario propio sin permisos de administrador, con un fichero de configuración base que funciona sin
hardware y decidiendo qué pasa con el fichero de configuración de una instalación existente.

## Requirements

### Requirement: El instrumento se instala con un solo comando
En una Raspberry Pi con el sistema operativo recién instalado y acceso a internet, el maker SHALL
poder instalar el instrumento con un solo comando que descarga el script de instalación de su URL,
sin clonar antes el repositorio. Al terminar, el motor MUST estar funcionando y el panel MUST poder
abrirse desde otro equipo de la red local.

> Traza: escenario *Instalar el instrumento en una Pi recién instalada* de `MOO-137`. Internet al
> instalar: PRD §6.2, precisado en este change.

#### Scenario: Instalar el instrumento en una Pi recién instalada
- **GIVEN** una Raspberry Pi con el sistema operativo recién instalado, a la que el maker se conecta
  por SSH y con acceso a internet
- **WHEN** el maker ejecuta con un solo comando el script de instalación, descargándolo de su URL sin
  clonar antes el repositorio
- **THEN** el panel se abre desde otro equipo de la red local y se conecta al motor

### Requirement: Recién instalado, el instrumento funciona sin hardware
Una instalación nueva SHALL dejar un fichero de configuración base con una tira virtual y un fichero
de audio de ejemplo como fuente de audio, para que el motor arranque aunque no haya tiras físicas ni
tarjeta de sonido enchufadas.

> Traza: escenario *Arranca sin hardware* de `MOO-137`.

#### Scenario: Arranca sin hardware
- **GIVEN** una Pi recién instalada, sin tiras físicas ni tarjeta de sonido enchufadas
- **WHEN** el maker ejecuta el script de instalación
- **THEN** el motor arranca con un fichero de configuración base, con una tira virtual y un fichero de
  audio de ejemplo como fuente de audio
- **AND** el panel muestra esa tira en el visor

### Requirement: Al reinstalar, el script pregunta antes de tocar nada
Si la Pi ya tiene el instrumento instalado, con el script o con la instalación anterior de la mesa, el
script SHALL preguntar si conservar o sobrescribir el fichero de configuración antes de cambiar nada.
Sin una respuesta que elija una de las dos, MUST terminar sin haber cambiado nada.

> Traza: escenario *Pregunta qué hacer con la configuración al reinstalar* de `MOO-137`. Lo que pasa
> sin respuesta es *(asumido)*: decisión del maker al explorar el change.

#### Scenario: Pregunta qué hacer con la configuración al reinstalar
- **GIVEN** una Pi con una instalación existente (hecha con el script o la anterior de la mesa)
- **WHEN** el maker vuelve a ejecutar el script de instalación
- **THEN** antes de tocar nada, el script pregunta si conservar o sobrescribir el fichero de
  configuración

#### Scenario: Sin respuesta, no cambia nada (asumido)
- **GIVEN** una Pi con una instalación existente
- **WHEN** el script de instalación no recibe una respuesta que elija conservar o sobrescribir (una
  respuesta vacía, otra cosa o ninguna terminal desde la que preguntar)
- **THEN** el script termina diciendo por qué
- **AND** la instalación existente sigue como estaba: su fichero de configuración, el estado del
  instrumento y el servicio

### Requirement: Reinstalar conserva o sobrescribe el fichero de configuración
Tras la respuesta del maker, el script SHALL reinstalar el instrumento con el fichero de configuración
que tenía, si eligió conservar, o con el fichero base, si eligió sobrescribir, guardando en ese caso
una copia de seguridad del anterior. En los dos casos el estado del instrumento MUST empezar de cero.

> Traza: esquema *Reinstalar según lo elegido* de `MOO-137`. La extensión `.bck` de la copia:
> decisión del maker al refinar.

#### Scenario: Reinstalar conservando la configuración
- **GIVEN** una Pi con una instalación existente (hecha con el script o la anterior de la mesa)
- **WHEN** el maker elige conservar
- **THEN** el instrumento queda reinstalado con su fichero de configuración
- **AND** sin el estado del instrumento anterior

#### Scenario: Reinstalar sobrescribiendo la configuración
- **GIVEN** una Pi con una instalación existente (hecha con el script o la anterior de la mesa)
- **WHEN** el maker elige sobrescribir
- **THEN** el instrumento queda reinstalado con el fichero de configuración base y una copia de
  seguridad del anterior, con extensión `.bck`
- **AND** sin el estado del instrumento anterior

### Requirement: La instalación anterior de la mesa queda fuera de uso, sin borrarse
Al reinstalar sobre la instalación anterior de la mesa, el script SHALL dejar de usarla para arrancar
el instrumento, de modo que no haya dos motores a la vez, y MUST NOT borrarla. Al terminar, MUST decir
dónde está y que ya no la usa el servicio.

> Traza: *(asumido)*, decisión del maker al explorar el change: el clon de `/home/pi` se sigue usando
> para desarrollar. Que no compitan dos motores: contexto técnico de `MOO-137`.

#### Scenario: El clon anterior se queda y deja de arrancar (asumido)
- **GIVEN** una Pi con la instalación anterior de la mesa
- **WHEN** el maker reinstala con el script, conservando o sobrescribiendo
- **THEN** el servicio arranca el instrumento desde la instalación nueva
- **AND** la instalación anterior sigue en su sitio, y el script dice que el servicio ya no la usa

### Requirement: El motor llega al hardware sin permisos de administrador
El motor instalado SHALL ejecutarse con un usuario propio que puede abrir el puerto serie de las tiras
físicas y la tarjeta de sonido, y que MUST NOT tener permisos de administrador.

> Traza: escenario *El usuario propio llega al hardware* de `MOO-137`, y el «para» de la historia: no
> darle al motor más permisos de los que necesita.

#### Scenario: El usuario propio llega al hardware
- **GIVEN** el instrumento instalado, con una tira física y la tarjeta de sonido declaradas en el
  fichero de configuración y enchufadas
- **WHEN** el motor arranca
- **THEN** la tira física pinta lo mismo que el visor
- **AND** los efectos reactivos responden a la tarjeta de sonido
- **AND** el motor funciona sin permisos de administrador
