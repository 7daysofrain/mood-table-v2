# Proposal

> **Origen:** historia [`MOO-59`](https://linear.app/7daysofrain/issue/MOO-59/recuperar-la-tarjeta-de-sonido-si-se-desconecta-en-plena-sesion)
> · Recuperar la tarjeta de sonido si se desconecta en plena sesión · épica **H1** · expectativas
> **E2** y **E6** *(asumidas en la historia)*.
> Tareas: `MOO-63` (recuperar la tarjeta de sonido y avisar de su estado al panel, `engine`) y
> `MOO-64` (el aviso de tarjeta desconectada en la cabecera, `panel`).

## Why

Desde `MOO-15`, si la tarjeta de sonido se desconecta en plena sesión, el motor sigue con silencio y
lo escribe en el log, pero no vuelve a abrirla y el panel no dice nada. El DJ ve que la luz ha dejado
de seguir la música sin saber por qué, y la única salida es reiniciar la mesa en mitad de la sesión.
En la mesa, un cable USB que se suelta es un fallo real. Además, la prueba del 22-oct en la Pi
confirmó que recuperarla es barato: la tarjeta vuelve con el mismo nombre de ALSA aunque cambie de
puerto, y la misma cadena vuelve a grabar.

## What Changes

- **Reconexión**: si la tarjeta de sonido se pierde con el motor en marcha, el motor la espera todo
  el tiempo que haga falta y, cuando vuelve a estar, la abre otra vez con la misma cadena de
  dispositivo, sin reiniciarse. Los efectos reactivos vuelven a seguir la música. Solo vale la
  tarjeta declarada.
- **Aviso en el panel**: mientras la tarjeta está perdida, la cabecera avisa de que está
  desconectada de forma que salta a la vista. El aviso también aparece en un panel que se abre
  durante el corte, y desaparece al recuperarla. Un silencio nunca lo dispara.
- **Protocolo del visor**: un mensaje nuevo con el estado de la fuente de audio (conectada o
  perdida), que recibe cada panel al conectarse y cada vez que cambia.
- **Log**: una línea al perderla (como hasta ahora) y otra al recuperarla. Los reintentos fallidos no
  escriben nada.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `audio-source`: la pérdida en plena sesión deja de ser definitiva. El motor espera y recupera la
  tarjeta, el panel avisa mientras falta, y el protocolo del visor lleva su estado.

## Non-goals

Tomados de la historia `MOO-59`:

- **Si la tarjeta no está al arrancar, el motor sigue sin arrancar** (`MOO-15`, D57).
- **No cambia de fuente de audio en caliente** ni la elige desde el panel.
- **No reconecta la tira física** (Adalight): es otra pregunta (PRD Q5).
- **No avisa de fallos de la fuente fichero**: el aviso es solo para la tarjeta de sonido.

Fuera también, decidido al refinar y estimar la historia:

- **Otra tarjeta del mismo modelo se toma por la declarada**: la de la mesa no tiene número de serie
  y ALSA le da el mismo nombre (`Device`). Una de otro modelo tiene otro nombre y no se usa.
- **Sin test automático con una tarjeta real**: se prueba con el `arecord` falso de los tests, y la
  desconexión física, a mano en la mesa (deuda `MOO-24`, el *loopback* de ALSA en la CI).

## Impact

- **Código**:
  - `packages/shared`: el mensaje nuevo del protocolo del visor (estado de la fuente de audio).
  - `packages/engine`: el adaptador de la tarjeta de sonido vuelve a lanzar `arecord` tras una
    pérdida y avisa de cada cambio de estado; el servidor lo envía a los paneles; `main.ts` los une.
    El núcleo no cambia.
  - `packages/panel`: la conexión guarda el estado de la fuente y la cabecera muestra el aviso.
- **Dependencias nuevas**: ninguna.
- **Documentación**:
  - `docs/instructions/viewer-protocol.md`: el mensaje nuevo.
  - `docs/umbrales-para-specs.md`: el tiempo del aviso y de la recuperación.
  - README: §2.2 (adaptador *Tarjeta de sonido*), §1.3 (cabecera) y la ficha de la historia en §5
    si procede.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas, y D57 deja de decir «No se reconecta».
  - `prompts.md`.
- **Tests E2E**: ninguno nuevo. La CI no tiene tarjeta de sonido. Los existentes no cambian.
- **Hardware**: la prueba del 22-oct en la Pi es la fuente de cómo termina `arecord` al desconectar
  (`read error: No such device`) y de que el nombre de ALSA se mantiene en otro puerto.
