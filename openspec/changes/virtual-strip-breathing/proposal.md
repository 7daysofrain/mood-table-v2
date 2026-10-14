# Proposal

> **Origen:** historia [`MOO-13`](https://linear.app/7daysofrain/issue/MOO-13/ver-una-tira-virtual-respirando-en-el-visor)
> · Ver una tira virtual respirando en el visor · épica **H1** · expectativa **E7**.
> Tareas: `MOO-16` (motor), `MOO-17` (frames al visor), `MOO-18` (visor en el panel).

## Why

El motor todavía no existe: `packages/engine` solo tiene el esqueleto de la regla de fronteras
(`MOO-28`) y el panel, sus zonas vacías (`MOO-29`). Esta historia es el primer recorrido de punta a
punta (motor → salida virtual → visor) y deja montadas las piezas que reutilizan todas las demás: la
carga del fichero de configuración, el bucle de frames, el contrato de los efectos y el envío de
frames al navegador. Va antes que el audio porque no necesita hardware ni depende del spike de
rendimiento (D42): el coste de CPU está en la FFT, que llega con `MOO-14`.

## What Changes

- **Fichero de configuración mínimo** que declara las tiras (nombre, número de LEDs y salida
  `virtual`). Si no sirve, el instrumento no arranca y dice qué falla en él.
- **Bucle de frames** que calcula, a un ritmo fijo, los colores de cada tira declarada con su efecto
  y los entrega a sus salidas.
- **Efecto *respiración*** (de ambiente), el efecto por defecto de toda tira, y el contrato común de
  los efectos que reutilizarán los reactivos (`MOO-14`).
- **Envío de los frames al navegador** y el motor sirviendo el panel (`MOO-17`).
- **Visor en el panel**: dibuja las tiras con los frames que recibe, avisa si no hay conexión con el
  motor y se recupera solo tras un reinicio (`MOO-18`).
- **Arranque sin hardware** con `pnpm dev` y una configuración de ejemplo de una tira virtual.

## Capabilities

### New Capabilities

- `engine-config`: el fichero de configuración del instrumento: qué declara, dónde se busca y cuándo
  impide arrancar. Crecerá con H3 y H4 (salida Adalight, orden de color, límite de potencia).
- `frame-loop`: el pulso del motor: cuántos frames calcula por segundo, qué hace si va con retraso y
  cómo entrega el frame de cada tira a sus salidas.
- `effects`: el catálogo de efectos y lo que todos cumplen. Esta historia trae la *respiración*; las
  de audio añaden los reactivos.
- `viewer`: lo que ve el maker en el visor: las tiras animándose, el estado de la conexión con el
  motor y la recuperación tras un reinicio.

### Modified Capabilities

- `panel-layout`: con el panel abierto sin motor, la consola puede mostrar el error del navegador al no
  poder conectar con el motor, y ningún otro. Hoy exige que no muestre ninguno, y desde que el panel
  intenta conectar eso no depende del código del panel.

## Non-goals

Tomados de la historia `MOO-13`:

- **Audio**: llega en la historia hermana del fichero de audio (`MOO-14`).
- **Elegir efecto o mover controles**: es H2.
- **Tira física**: es H3.
- **Validación completa del fichero de tiras**: orden de color, límite de potencia y la validación de
  cada campo van en H4 *(asumido en la historia)*.
- **Montaje del repositorio** (monorepo, lint, CI): `MOO-28`, ya integrada.
- **Más zonas del panel que el visor y la conexión**: la fuente de audio, su nivel y los fps llegan
  con `MOO-14` y `MOO-15` *(asumido en la historia)*.
- **Layout del panel**: `MOO-29`, ya integrada.

## Impact

- **Código**: `packages/engine` (núcleo, adaptadores y raíz de composición), `packages/shared`
  (esquema del fichero de configuración y formato de los frames), `packages/panel` (visor y conexión).
- **Dependencias nuevas**: `typebox` 1.x en el catálogo; las del servidor HTTP y WebSocket con
  `MOO-17`.
- **Ficheros nuevos**: `config/demo.json` (versionado) y `config/local.json` (ignorado por git).
- **Documentación**: README §1.4 cambia la ruta de la configuración (`config/local.json` en vez de
  `/etc/moodtable/config.json`, y `config/demo.json` en vez de `deploy/config/demo.json`), la dirección
  del panel en desarrollo (`localhost:5173`) y pasa a una tira virtual en la demo; README §2.1 y §2.2
  si el diseño del puerto de salida cambia lo descrito. Documento nuevo del protocolo del visor en
  `docs/instructions/viewer-protocol.md`, con su fila en el índice de `AGENTS.md` y un enlace desde
  README §4.
- **Tests E2E**: Playwright lo monta la tarea de enablers `MOO-49`, que bloquea a `MOO-18`.
- **Linear**: ninguno más previsto. `MOO-48` (propósito de `docs/instructions/`) y `MOO-49` (E2E)
  salieron de esta exploración.
