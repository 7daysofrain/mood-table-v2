# Proposal

> **Origen:** historia [`MOO-98`](https://linear.app/7daysofrain/issue/MOO-98/elegir-el-efecto-espectro)
> · Elegir el efecto espectro · épica **H2** · expectativas **E3**, **E2**.
> Tarea: `MOO-122` (portar el efecto espectro de la v1, `engine`).

## Why

El MVP incluye tres efectos reactivos de la v1 (PRD §5.1, D20). Con *energía* y *scroll* en el
motor, falta el *espectro*: cada zona de la tira representa una banda de frecuencia, así que el DJ ve
en la luz de qué está hecha la música. Se porta **tal cual** y sin parámetros, como *energía* (D49) y
*scroll* (D95), para que el DJ tenga una referencia fiel antes de decidir sus controles.

## What Changes

- **Nuevo efecto *espectro***, reactivo y sin parámetros, que se puede elegir para cualquier tira como
  los demás. Es el `visualize_spectrum` de la v1:
  - Las 24 bandas del análisis común se reparten por media tira y se reflejan: **los graves en el
    centro y los agudos en los dos extremos**, con las dos mitades iguales.
  - En cada zona, el **azul** es el nivel sostenido de su banda, el **rojo** lo que la banda sobresale
    de su nivel reciente y el **verde** cuánto ha cambiado desde el frame anterior. Un bombo es un
    destello rojo y verde en el centro; una nota larga se queda en azul en su zona.
- **Al elegirlo, la tira arranca en rojo y se asienta en unos segundos de música**, como en la v1.
  Lo decidió el DJ al explorar el change: se conserva y se revisa después de verlo en la mesa.
- **En silencio, la tira se apaga al momento**, como *energía* y *scroll*.
- **El panel no le muestra controles**, porque no tiene parámetros. La zona Efectos lo lista entre los
  efectos de la tira.
- La API y el fichero de configuración aceptan `spectrum` como id de efecto, porque se generan del
  catálogo. No cambia ninguna ruta.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `effects`: tres requisitos nuevos para el *espectro* (dónde cae cada banda, qué dice cada color y
  su arranque al elegirlo). Los requisitos de los frames dorados y del silencio ganan un escenario del *espectro*
  cada uno.
- `instrument-control`: la zona Efectos lista el *espectro* entre los del catálogo, con el caso feliz
  de `MOO-98`, y la zona Controles queda con su título para él.

`panel-layout`, `viewer` y `frame-loop` no cambian.

## Non-goals

Tomados de la historia `MOO-98`:

- **Cambiar el análisis de audio común** *(asumido en la historia)*. El suelo, los suavizados del rojo
  y el azul y la diferencia del verde van dentro del efecto.
- **Detectar golpes o el tempo**: fuera por decisión (PRD §5.4).
- **Crear efectos sin programar**: fuera por decisión (PRD §5.4).
- **Parámetros del espectro**: primero se porta la v1 tal cual. Color, número de bandas u otros
  ajustes irán en otra historia, cuando el DJ lo haya visto. La sensibilidad (Q7, para todos los
  reactivos), más adelante.

Fuera también, decidido al explorar el change:

- **Quitar el arranque en rojo al elegirlo** (`design.md`, decisión 2). Si molesta en la mesa, irá a
  otra historia.

## Impact

- **Depende de `MOO-118`** (PR #116, *scroll*) y del archivado de `scroll-effect`: este change se
  escribe encima de sus requisitos y de su código (`design.md`, decisión 6).
- **Código**:
  - `packages/shared`: `spectrum` en el catálogo de efectos (`effects.ts`), con un esquema de
    parámetros vacío y `usesAudio: true`.
  - `packages/engine`: el efecto (`core/effects/spectrum.ts`) y su entrada en el registro.
  - `packages/panel`: el nombre visible del efecto en `literals.ts`, que el tipo exige.
- **API**: ninguna ruta nueva. Los esquemas que listan los ids de efecto ganan `spectrum`
  (`docs/openapi.yaml`, generado).
- **Dependencias nuevas**: ninguna.
- **Documentación**:
  - `docs/idea-mood-table.md`: una D# nueva (`design.md`, decisiones 1 a 3).
  - `docs/PRD.md`, en el commit de este change: Q2 queda «*espectro*: sin parámetros por ahora».
  - README §1.2 (la frase del espectro), §1.3 y §4 (los efectos que hay hoy).
  - `prompts.md`.
- **Tests**: unitarios del efecto, frames dorados con el fichero de golpes y un E2E del caso feliz.
