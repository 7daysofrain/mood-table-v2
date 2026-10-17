# Proposal

> **Origen:** historia [`MOO-14`](https://linear.app/7daysofrain/issue/MOO-14/la-tira-virtual-reacciona-a-un-fichero-de-audio)
> · La tira virtual reacciona a un fichero de audio · épica **H1** · expectativas **E7** y **E2**.
> Tareas: `MOO-19` (fichero WAV como fuente de audio), `MOO-20` (análisis del audio y efecto
> *energía*), `MOO-21` (fuente de audio y nivel en el panel).

## Why

El motor ya pinta tiras virtuales en el visor, pero solo con la *respiración*, que no usa audio
(`MOO-13`). Falta la mitad que hace de Mood Table un instrumento: que la luz siga a la música (E2).
Esta historia trae la primera fuente de audio, el análisis del audio y el primer efecto reactivo, y lo
hace con un fichero para que se pueda probar sin tarjeta de sonido ni mesa (E7) y con resultados
deterministas. Ya no está bloqueada: el spike de rendimiento confirmó TypeScript y `fft.js` en la Pi
(D48).

## What Changes

- **Fuente de audio *fichero***: un WAV local declarado en el fichero de configuración, que el motor
  reproduce en bucle al ritmo de su propio pulso. Si el fichero no existe o su formato no es el que
  acepta, el motor no arranca y dice por qué.
- **Efecto inicial declarado en el fichero**: cada tira dice con qué efecto arranca. **BREAKING**: el
  campo `effect` es obligatorio, así que un fichero de configuración sin él deja de arrancar (incluido
  el `config/local.json` de cada uno, que esta historia actualiza en la máquina del desarrollo).
- **Efecto *energía***, el primero reactivo: el de la v1 portado. Graves, medios y agudos encienden
  rojo, verde y azul desde el centro de la tira, que se ilumina con cada golpe y se apaga en
  silencio.
- **Análisis del audio**: una vez por pulso y compartido por todas las tiras. Solo se calcula si
  alguna tira lo usa.
- **Fuente y nivel en el panel**: la cabecera dice qué fuente de audio hay (o que no hay ninguna) y
  muestra su nivel en tiempo real. Viajan por el mismo WebSocket que los frames, como mensajes nuevos
  del protocolo.
- **Demo con música**: `config/demo.json` declara una tira con *energía* y un loop de techno con
  licencia CC0 como fuente, así que `pnpm dev` muestra la parte reactiva sin preparar nada.

## Capabilities

### New Capabilities

- `audio-source`: la fuente de audio del instrumento: qué tipos hay, el fichero en bucle, qué formatos
  acepta, su nivel y cómo lo ve el maker en el panel. `MOO-15` añadirá la tarjeta de sonido.

### Modified Capabilities

- `engine-config`: el fichero declara la fuente de audio (opcional) y el efecto de cada tira
  (obligatorio). No arranca con un efecto que no existe ni con un efecto reactivo sin fuente de audio.
  Las rutas relativas, incluida la de `MOODTABLE_CONFIG`, se resuelven desde la raíz del repositorio.
  La demo pasa a tener audio y *energía*.
- `effects`: una tira arranca con el efecto que declara el fichero, no siempre con la *respiración*.
  Entra *energía*. En silencio, un efecto reactivo se apaga y uno de ambiente sigue (PRD Q4). Los
  frames dorados cubren también los efectos que dependen del audio.

## Non-goals

Tomados de la historia `MOO-14`:

- **Solo el efecto *energía***: *espectro* y *scroll* van con H2 *(asumido en la historia)*.
- **Sin tarjeta de sonido**: es la historia hermana (`MOO-15`).
- **Sin sincronía con el tempo** (PRD §5.4).
- **Sin controles de sensibilidad**: es H2. *Energía* no declara parámetros (la de la v1 no los
  tenía).
- **Sin subir ficheros desde el panel**: el fichero es local y se declara en la configuración.
- **El audio no se oye en el panel**: va en `MOO-22`.
- **Sin controles de reproducción** (pausar o saltar a otro punto de la pista).
- **Sin cambiar de fichero en caliente.**

Fuera también, decidido en la exploración:

- **Pausar el bucle cuando no hay ningún panel conectado**: es una optimización del despliegue de la
  demo pública (README §2.4), no del instrumento. En la mesa, el bucle no se para nunca.
- **Detector de golpes**: *energía* marca cada golpe con su subida rápida y su caída suave, como en la
  v1. Ningún efecto del MVP necesita un rasgo de golpe aparte.
- **Silencio con la tarjeta de sonido**: la puerta de silencio de esta historia apaga con silencio
  digital, que es lo que tiene un fichero. El ruido de fondo de una tarjeta es cosa de `MOO-15`.

## Impact

- **Código**: `packages/shared` (esquema del fichero, catálogo de efectos y mensajes nuevos del
  protocolo), `packages/engine` (puerto `AudioSource`, lector WAV, análisis, *energía*, envío de la
  fuente y del nivel) y `packages/panel` (cabecera con fuente y nivel).
- **Dependencias nuevas**: `fft.js` en el catálogo (validada en el spike `MOO-12`, D48).
- **Ficheros nuevos**: el loop de la demo (*Bouncer*, de Of Far Different Nature, CC0) junto a
  `config/demo.json` con una nota de origen y licencia, y un WAV de golpes aislados para los tests,
  generado por un script.
- **Configuración local**: el `config/local.json` de la máquina del desarrollo se actualiza en
  `MOO-19` (`effect`) y en `MOO-20` (*energía* y fuente). No se versiona, así que la PR lo avisa.
- **Documentación**:
  - `docs/instructions/viewer-protocol.md`: los mensajes de fuente y de nivel, y su descripción en el
    índice de `AGENTS.md`.
  - README: §2.1 y §2.2 (puerto `AudioSource` *pull*, análisis sin golpes), el ticket `MOO-20` del §6
    (sin parámetros de sensibilidad ni detector de golpes) y §1.4 (la demo con música).
  - PRD §8: «golpe» y «nivel» en el glosario.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas que el usuario apruebe.
  - `prompts.md`.
- **Tests E2E**: los ficheros de configuración de `e2e/` declaran `effect`. Los E2E nuevos comprueban
  que la tira reacciona al audio y que la cabecera muestra la fuente y el nivel.
- **Linear**: el contexto técnico de `MOO-14` dice que, si el fichero no declara efecto, la tira
  arranca con *respiración*. Deja de ser cierto y se corrige con permiso del usuario. Quedan notas para
  H5 (la reconciliación puede restaurar un efecto reactivo en una instalación sin fuente de audio) y
  para el despliegue de la demo (pausar el bucle sin paneles).
