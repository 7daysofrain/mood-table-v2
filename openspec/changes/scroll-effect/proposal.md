# Proposal

> **Origen:** historia [`MOO-99`](https://linear.app/7daysofrain/issue/MOO-99/elegir-el-efecto-scroll)
> · Elegir el efecto scroll · épica **H2** · expectativas **E3**, **E2**.
> Tareas: `MOO-118` (portar el efecto scroll de la v1, `engine`) y `MOO-123` (ajustar la
> visualización en la tira real, `engine`).

## Why

El MVP incluye tres efectos reactivos de la v1 (PRD §5.1, D20), y hoy el motor solo tiene uno,
*energía*. *Scroll* es el segundo. Hace que la música se vea avanzar por la mesa: cada LED muestra lo
que sonó hace unos instantes, y la luz nace en el centro y se desplaza hacia los dos extremos. Se
porta **tal cual** y sin parámetros, como se hizo con *energía* (D49). Así el DJ tiene una referencia
fiel que ver antes de decidir sus controles, que irán en otra historia.

## What Changes

- **Nuevo efecto *scroll***, reactivo y sin parámetros, que se puede elegir para cualquier tira como
  los demás. Es el `visualize_scroll` de la v1, con su comportamiento:
  - Cada frame, un color nuevo entra por el centro de la tira. El rojo sale de los graves, el verde de
    los medios y el azul de los agudos, cada banda medida frente a su nivel reciente.
  - Lo que ya está en la tira avanza un LED hacia los dos extremos, en espejo, y se apaga un poco en
    cada paso (estela).
- **El movimiento es el del código de la v1:** un LED y ×0,98 por frame. Por eso la luz avanza a
  tantos LEDs por segundo como fps tenga el motor. A 60 fps corre un 20 % más deprisa que la v1, que
  iba a 50. Lo decidió el DJ al explorar el change.
- **En silencio, la tira se apaga al momento**, como *energía*.
- **El panel no le muestra controles**, como a *energía*, porque no tiene parámetros. La zona Efectos
  lo lista entre los efectos de la tira.
- La API y el fichero de configuración aceptan `scroll` como id de efecto, porque se generan del
  catálogo. No cambia ninguna ruta.

**Tras la prueba en la mesa (`MOO-123`, 5-nov).** En la tira física, el *scroll* no se parecía al del
visor: se veía lleno y lento. Había dos causas, ajenas al efecto, que afectan a cualquier tira física:

- **Falta la gamma de la v1.** La v1 corregía cada color con una gamma 2,0 antes de mandarlo a la
  tira. Sin ella, los valores bajos del rastro, que en pantalla casi no se ven, brillan en los LEDs.
  La salida a la tira física pasa a aplicarla.
- **A 115.200 baudios, Adalight solo da 20 fps** con los 173 LEDs de la mesa. El controlador pasa a
  500.000 baudios, con los que da 59 fps. Cambia la documentación del montaje; el motor ya admitía
  esa velocidad.
- **Un WAV de calibración** con golpes limpios (rojo, verde y azul) para comprobar a ojo que la tira
  responde como el visor.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `effects`: nuevo requisito para *scroll*. Los requisitos de los frames dorados y del silencio ganan
  un escenario de *scroll* cada uno.
- `instrument-control`: la zona Efectos lista *scroll* entre los del catálogo, y el escenario del
  efecto sin parámetros vale también para él.
- `physical-strip` (`MOO-123`): la tira física lleva los colores del visor corregidos con la gamma de
  los LEDs, y el escenario de la mesa pasa a 500.000 baudios.

`panel-layout`, `viewer` y `frame-loop` no cambian.

## Non-goals

Tomados de la historia `MOO-99`:

- **Cambiar el análisis de audio común** *(asumido en la historia)*. La elevación al cuadrado y la
  ganancia propias del `visualize_scroll` van dentro del efecto.
- **Detectar golpes o el tempo**: fuera por decisión (PRD §5.4).
- **Crear efectos sin programar**: fuera por decisión (PRD §5.4).
- **Parámetros del scroll**: primero se porta la v1 tal cual. Velocidad y estela irán en otra
  historia, cuando el DJ lo haya visto. Sensibilidad (Q7, para todos los reactivos) y color, más
  adelante.

Fuera también, decidido al explorar el change:

- **Que la velocidad no dependa de los fps.** Es el riesgo aceptado de ser fiel al código
  (`design.md`, decisión 2). Lo resolverá la historia de velocidad y estela.

## Impact

- **Código**:
  - `packages/shared`: `scroll` en el catálogo de efectos (`effects.ts`), con un esquema de
    parámetros vacío y `usesAudio: true`.
  - `packages/engine`: el efecto (`core/effects/scroll.ts`) y su entrada en el registro.
  - `packages/panel`: el nombre visible del efecto en `literals.ts`, que el tipo exige.
- **API**: ninguna ruta nueva. Los esquemas que listan los ids de efecto ganan `scroll`
  (`docs/openapi.yaml`, generado).
- **Dependencias nuevas**: ninguna.
- **Documentación**:
  - `docs/idea-mood-table.md`: una D# nueva (`design.md`, decisión 2).
  - `docs/PRD.md`, en el commit de este change: Q2 queda «*scroll*: sin parámetros por ahora».
  - README §1.2: la frase de *scroll* («entra por un extremo») pasa a la de la historia. §1.3 y §4
    (los efectos que hay hoy).
  - `prompts.md`.
- **Tests**: unitarios del efecto, frames dorados con el fichero de golpes y un E2E del caso feliz.
- **`MOO-123`**:
  - `packages/engine`: la gamma en la codificación Adalight (`adapters/adalight.ts`) y el generador
    del WAV de calibración, junto al de golpes.
  - `config/audio/`: `calibracion.wav` y su fila en el README.
  - Documentación: una D# nueva (`design.md`, decisiones 6 a 8), D46 en lo de los baudios,
    `HARDWARE_SETUP.md` (§4.1, la configuración y la medida), README y `prompts.md`.
