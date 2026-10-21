# Spec Delta

## MODIFIED Requirements

### Requirement: La fuente de audio es opcional y se declara con su tipo
El campo `audioSource` SHALL ser opcional. Si existe, MUST ser un objeto cuyo `type` decide sus demás
campos. `file` lleva `path`: la ruta del fichero, absoluta o relativa a la raíz del repositorio.
`soundcard` lleva `name` (el nombre que muestra el panel), `device` (la cadena de dispositivo de ALSA)
y `silenceThreshold`, opcional: el umbral de silencio en dBFS, entre −120 y 0, −60 por defecto. Sin
`audioSource`, el instrumento no tiene fuente de audio.

> Traza: caso feliz de `MOO-14` (*con un fichero de audio como fuente de audio*), caso feliz de
> `MOO-15` (*el fichero de configuración declara la tarjeta de sonido como fuente de audio*) y
> glosario del PRD (*fuente de audio: opcional*). El tipo como discriminador y la raíz del repositorio
> son *(asumido)*: `design.md` de `virtual-strip-audio-file`, decisiones 8 y 12. Los campos de la
> tarjeta son *(asumido)*: `design.md`, decisiones 3 y 7.

#### Scenario: Fichero de audio con ruta relativa (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "file", "path": "config/audio/bouncer.wav" }`
- **WHEN** el maker arranca el motor desde un directorio de trabajo distinto de la raíz
- **THEN** el motor usa como fuente el `config/audio/bouncer.wav` de la raíz del repositorio

#### Scenario: Fichero de audio con ruta absoluta (asumido)
- **GIVEN** un `config/local.json` cuya fuente de audio es un fichero con ruta absoluta
- **WHEN** el maker arranca el motor
- **THEN** el motor usa como fuente ese fichero

#### Scenario: Tarjeta de sonido sin umbral de silencio (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "soundcard", "name": "Mixer de la mesa", "device": "plughw:CARD=Device,DEV=0" }`
- **WHEN** el maker arranca el motor en la Pi, con esa tarjeta conectada
- **THEN** el motor usa como fuente esa tarjeta, con un umbral de silencio de −60 dBFS

#### Scenario: Un campo de la tarjeta de sonido que falta o no vale (asumido)
- **GIVEN** un `config/local.json` cuya fuente de audio es una tarjeta de sonido sin `name`, sin
  `device`, con alguno de los dos vacío, o con un `silenceThreshold` fuera de −120 a 0
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo (`audioSource.name`, `audioSource.device` o
  `audioSource.silenceThreshold`) y dice qué falla

#### Scenario: Una fuente de audio de un tipo que no existe (asumido)
- **GIVEN** un `config/local.json` con `"audioSource": { "type": "mp3", "path": "musica.mp3" }`
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra el campo `audioSource.type` y dice qué valores admite
