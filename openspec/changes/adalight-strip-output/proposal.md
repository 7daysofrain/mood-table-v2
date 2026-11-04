# Proposal

> **Origen:** historia [`MOO-111`](https://linear.app/7daysofrain/issue/MOO-111/pintar-en-la-tira-de-la-mesa-lo-mismo-que-en-el-visor)
> · Pintar en la tira de la mesa lo mismo que en el visor · épica **H3** · expectativas **E1** y
> **E5**. Tareas: `MOO-113` (la salida Adalight en el contrato compartido, `shared`), `MOO-114` (pintar
> la tira física por el puerto serie Adalight, `engine`) y `MOO-115` (la salida Adalight y su puerto en
> la zona Tiras, `panel`).

## Why

El instrumento ya se toca en directo (H2), pero solo en el visor: la tira de la mesa sigue apagada.
H3 es la razón de ser de la mesa: que la luz real pinte lo mismo que el DJ ve en el panel, para tocarla
desde el mismo sitio (E1, E5). El hueco ya está preparado: `LightOutput` es el puerto de salida de una
tira, la raíz de composición da a cada tira sus salidas (D43) y el controlador Adalight de la mesa, un
Arduino Uno con su sketch, está montado (D46, `HARDWARE_SETUP.md`).

## What Changes

- **Salida `adalight` en el fichero de configuración**: una tira física declara su puerto serie
  (`port`) y sus baudios (`baudRate`), que solo admiten velocidades estándar, de 9.600 a 2.000.000. Si
  falta alguno o no vale, el motor no arranca y dice qué tira y qué campo fallan.
- **El motor pinta la tira física**: cada tira con salida `adalight` recibe los mismos frames que su
  fila del visor, codificados con el protocolo Adalight y escritos por su puerto serie con
  `serialport`. Pinta con o sin paneles abiertos.
- **Sin quedarse atrás**: mientras el frame anterior no ha salido por el cable, el nuevo se descarta.
  La tira física va a menos frames por segundo que el visor si los baudios no dan para más (unos 20 en
  la mesa), pero cada frame que pinta es el del pulso en curso.
- **Puerto que no se abre al arrancar**: el motor no arranca y dice qué tira, qué puerto y por qué.
  Es un estado de paso: `MOO-112` lo cambia por «arranca y lo espera» (PRD Q5).
- **Medida en la mesa**: el log dice cuánto tarda en salir cada frame de cada tira física y a cuántos
  frames por segundo va, para comprobar E1 (≤ 100 ms) y cerrar Q1 y A2 del PRD.
- **Panel**: la zona Tiras dice qué tira es la física, con su salida («Adalight») y la ruta de su
  puerto serie entera. El estado de las tiras que reciben los paneles lleva el puerto, pero no los
  baudios.

## Capabilities

### New Capabilities

- `physical-strip`: la tira física y su controlador Adalight: cómo le llegan los frames, qué pasa
  cuando el puerto va más lento que el motor, cuándo no arranca el motor por ella y qué dice el log.
  `MOO-112` (desconexión y reconexión) crecerá aquí.

### Modified Capabilities

- `engine-config`: la tira admite la salida `adalight`, con `port` y `baudRate`.
- `frame-loop`: una tira con salida `adalight` tiene dos salidas, el visor y la Adalight.
- `instrument-control`: la zona Tiras muestra la salida Adalight y el puerto, y el estado de las tiras
  que recibe cada panel lleva el puerto.

## Non-goals

Tomados de la historia `MOO-111`:

- **Orden de color y límite de potencia**: van en H4. Mientras tanto, el sketch reordena los colores y
  topa el brillo (D46).
- **Desconexión del controlador Adalight, o que falte al arrancar**: es `MOO-112`. Tampoco un puerto
  que existe pero no se puede abrir (ocupado o sin permisos): con este change, el motor no arranca.
- **Medir con instrumentos el retardo entre sonido y luz** (E2): se comprueba a ojo y oído en la mesa
  *(asumido en la historia)*.
- **Ni segunda tira física (S1), ni firmware propio (S2), ni GPIO** (PRD §6.2).
- **Baudios distintos de los del sketch, o un sketch distinto**: Adalight no confirma nada y el motor no
  puede detectarlo. Se diagnostica con `HARDWARE_SETUP.md`.

Fuera también, decidido en la exploración del 29-oct:

- **El ejemplo de configuración de la mesa y el instalador** (`deploy/`, README §1.4): van con el
  despliegue. Aquí, el ejemplo de una salida Adalight va en el README §3.
- **Varios controladores para una tira** (segmentos): es la visión (PRD §5.3, punto 3).
- **Validar en el fichero que los LEDs caben en E1 a esos baudios**: la medida en la mesa manda sobre
  la cuenta; la cuenta queda en `design.md` como referencia.

## Impact

- **Código**:
  - `packages/shared`: la salida `adalight` en el esquema del fichero de configuración y en el estado
    de las tiras del mensaje `6`.
  - `packages/engine`: el adaptador Adalight, en dos piezas: la codificación y la política de descarte
    con tests, y la apertura del puerto con `serialport` en `adalight.hardware.ts`; su conexión en
    `main.ts`.
  - `packages/panel`: la zona Tiras muestra la salida Adalight y la ruta del puerto.
- **Dependencias nuevas**: `serialport` 13 en `engine`, la **primera dependencia nativa** del motor.
  Trae binarios precompilados para linux-arm64 (la Pi) y macOS, así que no compila nada al instalar.
- **Configuración local**: el `config/local.json` de la Pi declara la tira de la mesa. No se versiona.
- **Documentación**:
  - `docs/instructions/viewer-protocol.md`: la salida `adalight` en el mensaje `6`.
  - README: §2.2 (adaptador *Adalight serie*), §3 (`output` con `port` y `baudRate`, con un ejemplo),
    §1.3 (zona Tiras) y la ficha de la historia en §5.
  - `HARDWARE_SETUP.md`: cómo declarar la tira en el fichero y cómo leer la medida del log.
  - `docs/PRD.md`: Q1 y A2, con lo medido en la mesa.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas que lo piden (`design.md`).
  - `prompts.md`.
- **Tests E2E**: ninguno nuevo. La CI no tiene puerto serie, y con este change el motor no arranca sin
  él (`design.md`). Los existentes no cambian.
- **Hardware**: la prueba en la mesa, con el Arduino de D46, es parte del change.
