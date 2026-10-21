# Proposal

> **Origen:** historia [`MOO-15`](https://linear.app/7daysofrain/issue/MOO-15/usar-la-tarjeta-de-sonido-como-fuente-de-audio)
> · Usar la tarjeta de sonido como fuente de audio · épica **H1** · expectativa **E2**.
> Tareas: `MOO-23` (tarjeta de sonido como fuente de audio, `engine`) y `MOO-60` (la tarjeta de sonido
> en la cabecera, `panel`).

## Why

El instrumento ya reacciona a un fichero de audio (`MOO-14`) y se oye en el panel (`MOO-22`), pero en
la mesa la música no sale de un fichero: sale del mixer, por la tarjeta de sonido USB de la Pi. Sin
esta fuente, la luz no puede seguir a la música que suena de verdad (E2), que es para lo que existe
la mesa. El puerto `AudioSource` ya está pensado para ella (D2, D50), y la tarjeta de la mesa ya está
conectada a la Pi reinstalada (`MOO-52`).

## What Changes

- **Fuente de audio *tarjeta de sonido***: el fichero de configuración la declara con un nombre
  descriptivo y la cadena de dispositivo de ALSA. El motor la lee con `arecord` y en cada pulso
  analiza lo último que ha llegado.
- **Arranque**: el motor solo se niega a arrancar si no puede abrir el dispositivo (no está conectado,
  no existe o no admite el formato), y dice qué tarjeta, con qué cadena y lo que contesta `arecord`.
  Que no llegue música no es un fallo: la fuente puede estar apagada.
- **Pérdida en plena sesión**: si la tarjeta deja de responder, el motor sigue con silencio y lo
  escribe en el log. No se reconecta (`MOO-59`).
- **Silencio con ruido de fondo**: una tarjeta nunca entrega ceros. Un umbral de silencio en dBFS,
  opcional en la configuración de la tarjeta (−60 por defecto), hace que un efecto reactivo se apague
  cuando solo llega ruido. Con un fichero, la puerta sigue siendo el silencio digital.
- **Panel**: la cabecera dice «Tarjeta de sonido: \<nombre\>», con su vúmetro. El protocolo del visor
  gana una clase de fuente nueva para la tarjeta, que viaja con su nombre y nunca con la cadena de
  ALSA.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `audio-source`: la tarjeta de sonido como segundo tipo de fuente: cuándo no arranca el motor, qué
  pasa si se pierde en plena sesión, el retraso del sonido a la luz y cómo la anuncian la cabecera y
  el protocolo del visor.
- `engine-config`: `audioSource` admite el tipo `soundcard`, con `name`, `device` y
  `silenceThreshold`.
- `effects`: «en silencio, un efecto reactivo se apaga» cubre también el ruido de fondo de la tarjeta
  por debajo de su umbral.

## Non-goals

Tomados de la historia `MOO-15`:

- **La fuente de audio no se elige desde el panel**: se declara en la configuración *(asumido en la
  historia)*.
- **Sin cambiar de fuente de audio en caliente** *(asumido en la historia)*.
- **Sin conexión directa por GPIO** (PRD §5.3).
- **Solo Linux**: en macOS y Windows el simulador usa el fichero de audio. **La demo pública no tiene
  tarjeta de sonido**: solo fichero.
- **Sin reconexión** si la tarjeta se desconecta en plena sesión, ni aviso en el panel: van en
  `MOO-59`.

Fuera también, decidido en la exploración del 21-oct:

- **El motor no toca el mezclador de la tarjeta** (ganancia de grabación, control automático de
  ganancia, entrada): es un ajuste del montaje, en `HARDWARE_SETUP.md`.
- **Sin test automático con una tarjeta real**: el *loopback* de ALSA en la CI es la deuda `MOO-24`.
  El retraso se comprueba a ojo en la mesa (excepción al DoD de la historia).
- **Sin umbral de silencio para el fichero**: un fichero tiene silencio digital, y la puerta actual
  le basta.
- **Dos tarjetas idénticas** (mismo nombre de ALSA, orden de detección variable): se resuelve con una
  regla de udev, que se menciona en `HARDWARE_SETUP.md` y no se automatiza.

## Impact

- **Código**:
  - `packages/shared`: el esquema del fichero de configuración (tipo `soundcard`) y la clase de fuente
    nueva en el mensaje de fuente del protocolo del visor.
  - `packages/engine`: el adaptador de la tarjeta de sonido (`arecord` como proceso hijo, en un
    `*.hardware.ts`, y la parte pura con tests), el umbral de silencio en el análisis y la conexión
    en `main.ts`.
  - `packages/panel`: la cabecera muestra la tarjeta de sonido.
- **Dependencias nuevas**: ninguna en npm. En la Pi, `arecord` (paquete `alsa-utils`, que ya trae
  Raspberry Pi OS).
- **Configuración local**: el `config/local.json` de la Pi declara la tarjeta. No se versiona.
- **Documentación**:
  - `docs/instructions/viewer-protocol.md`: la clase de fuente nueva.
  - README: §2.2 (adaptador *Tarjeta de sonido*), §3 (el campo nuevo de la configuración), §1.3
    (cabecera) y la ficha de la historia en §5 (dice que no hay tarea de panel).
  - `HARDWARE_SETUP.md`: la cadena de ALSA, la ganancia y el control automático de ganancia, y cómo
    elegir el umbral de silencio.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas (D56 en adelante) y el riesgo de `arecord`,
    que pasa a resuelto.
  - `prompts.md`.
- **Tests E2E**: ninguno nuevo. La CI no tiene tarjeta de sonido. Los existentes no cambian.
- **Hardware**: la medición del 21-oct en la Pi (la tarjeta de la mesa, con la entrada vacía) es la
  fuente del umbral por defecto (`design.md`).
