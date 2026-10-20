# Proposal

> **Origen:** historia [`MOO-22`](https://linear.app/7daysofrain/issue/MOO-22/oir-el-fichero-de-audio-en-el-panel-mientras-la-tira-reacciona)
> · Oír el fichero de audio en el panel mientras la tira reacciona · épica **H1** · expectativas **E7**
> y **E2**. Tareas: `MOO-56` (servir el fichero de audio y el punto por el que va el motor) y `MOO-57`
> (oír el fichero de audio en el panel al ritmo del motor).

## Why

Con `MOO-14` la tira virtual ya reacciona a un fichero de audio, pero el maker solo la *ve*: el
fichero suena en el motor, no en el panel. E7 pide que el instrumento se vea **y se oiga** sin
hardware, y sin oír la música no hay forma de juzgar si la luz la sigue (E2). Esta historia cierra
H1 en lo que toca al fichero: el maker oye en el panel el mismo fichero que analiza el motor, por el
punto al que reacciona la tira.

## What Changes

- **El motor sirve el fichero de audio** que analiza, para que el panel lo descargue. Nunca da su ruta
  en disco, igual que el mensaje de fuente (D51).
- **Mensaje nuevo en el protocolo del visor: la posición del fichero** (tipo `4`). En cada pulso, el
  motor dice por qué punto del fichero va, con el `seq` del pulso. El motor es la única fuente de
  verdad de esa posición: el panel no la calcula.
- **Oír y dejar de oír en el panel.** Con un fichero como fuente, el maker pide oírlo y lo oye por el
  punto al que está reaccionando la tira en el visor; puede dejar de oírlo y volver a oírlo, siempre
  por el punto del motor. Dejar de oír no para el motor: la tira sigue reaccionando.
- **Sincronía con lo que muestra el visor**, no con el reloj del motor: así el retraso de la red afecta
  igual a la luz y al sonido. El panel compensa el retraso de salida de audio que declara el navegador
  y corrige la deriva entre los dos relojes con un salto cuando supera un umbral. Tolerancia: la luz
  no va más de 45 ms por detrás del sonido ni más de 125 ms por delante (`docs/umbrales-para-specs.md`,
  E2; ITU-R BT.1359).
- **Sin fichero como fuente, el panel no ofrece oír nada.**

## Capabilities

### New Capabilities

- `audio-playback`: oír en el panel el fichero de audio del instrumento: cómo lo sirve el motor, la
  posición del fichero en el protocolo del visor, oír y dejar de oír, y la sincronía con lo que
  muestra el visor.

### Modified Capabilities

Ninguna: `audio-source` (qué analiza el motor, la fuente y el nivel en la cabecera) no cambia.

## Non-goals

Tomados de la historia `MOO-22`:

- **Sin más control que oír y dejar de oír**: nada de saltar a otro punto de la pista, de pausar el
  fichero en el motor ni de ajustar el volumen.
- **No se oye la tarjeta de sonido**: en la mesa la música ya suena por el mixer *(asumido en la
  historia)*. Cuando llegue `MOO-15`, añade su caso al escenario *sin fichero como fuente*.
- **El fichero no se elige desde el panel**: se declara en la configuración.
- **Se oye desde el panel en escritorio**: el móvil no se cubre *(asumido en la historia; PRD §6.2)*.

Fuera también, decidido en la exploración:

- **Auriculares o altavoces cuyo retraso no declara el navegador** (p. ej. Bluetooth en algunos
  sistemas): se compensa solo el `outputLatency` que da el navegador. Un ajuste manual del desfase
  sería un control más, y la historia no lo quiere.
- **Pausar el bucle de la demo sin paneles conectados** (README §2.4): sigue sin implementarse. Cuando
  se haga, el panel no cambia, porque sigue la posición que diga el motor.
- **Qué hace el audio del panel ante otros fallos** (PRD Q5): solo se fija lo mínimo, dejar de oír al
  perder la conexión, porque sin frames no hay contra qué sincronizar.

## Impact

- **Código**:
  - `packages/shared`: el mensaje de posición del fichero (tipo `4`) en el protocolo del visor.
  - `packages/engine`: la fuente de fichero sabe en qué punto está para cada instante; el bucle
    entrega esa posición a un puerto de salida, y el servidor la envía a los paneles y sirve el
    fichero.
  - `packages/panel`: el reproductor (Web Audio), su lógica de sincronía como módulo puro y el control
    de oír y dejar de oír.
- **Dependencias nuevas**: ninguna.
- **Documentación**:
  - `docs/instructions/viewer-protocol.md`: el mensaje tipo `4`, byte a byte.
  - README §2.2 (*Reproductor* y adaptador *Visor*), §1.3 (*Cabecera*, si el control va en ella) y el
    índice de `AGENTS.md` si cambia la descripción del protocolo.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas que el usuario apruebe (D53-D55).
  - `prompts.md`.
- **Tests E2E**: escenarios nuevos con el fichero de golpes (4 s), que da varias vueltas del bucle en
  pocos segundos. Riesgo por comprobar al empezar `MOO-57`: que Chromium sin pantalla avance el reloj
  de Web Audio sin dispositivo de salida.
- **Linear**: sin cambios previstos en la historia; el README §2.2 ya avisa de que la sincronía se
  decide en esta spec.
