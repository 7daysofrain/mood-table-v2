# Proposal

> **Origen:** historia [`MOO-94`](https://linear.app/7daysofrain/issue/MOO-94/cambiar-el-efecto-de-una-tira-mientras-suena-la-musica)
> · Cambiar el efecto de una tira mientras suena la música · épica **H2** · expectativas **E3** y
> **E1**.
> Tareas: `MOO-101` (el contrato de tiras, efectos y cambio de efecto, `shared`), `MOO-102` (cambiar
> el efecto de una tira por la API y avisar a los paneles, `engine`) y `MOO-103` (las zonas Tiras y
> Efectos y el cambio desde el panel, `panel`).

## Why

Hoy cada tira se queda con el efecto del fichero de configuración mientras el motor corre: para
cambiarlo hay que editar el fichero y reiniciar. El DJ no puede cambiar el carácter de la luz en
directo, que es lo primero que pide H2, y las zonas Tiras y Efectos del panel siguen vacías desde
`MOO-29`. Es también el primer mando del instrumento: las primeras rutas HTTP del motor, con el
OpenAPI que pide el README §4 para la entrega final.

## What Changes

- **Zona Tiras**: lista las tiras declaradas, en solo lectura, con su nombre, su nº de LEDs y su
  salida. Al abrir el panel queda seleccionada la primera; lo que se elige en Efectos se aplica a la
  seleccionada.
- **Zona Efectos**: los efectos de la tira seleccionada (hoy, *energía* y *respiración*), etiquetados
  como *reactivo* o *de ambiente*, con el activo marcado. Elegir uno cambia el efecto de la tira al
  momento, con un **corte seco** (PRD Q3, decisión del DJ), y se dispara **al pulsar**, como un pad.
  Sin indicadores de espera. Sin fuente de audio, los reactivos aparecen desactivados con el motivo.
- **API HTTP**: la primera ruta de mando, `PUT /api/strips/{stripId}/effect`, validada con TypeBox,
  con su OpenAPI generado de los esquemas, servido en `/api/openapi.json` y guardado en
  `docs/openapi.yaml`.
- **Búfer de control** en el núcleo: guarda el efecto activo de cada tira, recibe los cambios de
  cualquier mando y el bucle los recoge al empezar el pulso siguiente. Elegir el efecto activo no lo
  reinicia, cambiar una tira no toca las demás y, de varias elecciones seguidas, queda la última.
- **Protocolo del visor**: un mensaje nuevo con las tiras y el efecto activo de cada una, que recibe
  cada panel al conectarse y todos los paneles cada vez que cambia. El panel marca el efecto que pinta
  el motor, no el del fichero ni el que acaba de pulsar.
- **Análisis de audio**: con fuente de audio, el motor lo calcula en todos los pulsos, aunque ninguna
  tira tenga un efecto reactivo. Así una tira puede pasar a *energía* en cualquier momento.
  **Matiza D28**: el análisis ya no se omite cuando ninguna tira lo usa, solo cuando no hay fuente.

## Capabilities

### New Capabilities

- `instrument-control`: cómo el DJ cambia el efecto de una tira con el motor en marcha. El búfer de
  control, la ruta HTTP y su OpenAPI, el mensaje del estado de las tiras y las zonas Tiras y Efectos
  del panel. Crecerá con los controles de `MOO-95` y `MOO-96`.

### Modified Capabilities

- `effects`: el efecto del fichero de configuración pasa a ser solo el de arranque, y el análisis de
  audio corre siempre que hay fuente. Se fija el calentamiento de *energía* al elegirla en marcha.

`panel-layout` no cambia: sus requisitos siguen siendo ciertos. Sin motor, Tiras y Efectos se ven
vacías, que es lo que ya pide *Las zonas vacías no inventan datos*.

## Non-goals

Tomados de la historia `MOO-94`:

- **Mover los controles del efecto**: es `MOO-95`.
- **Fundir un efecto con otro al cambiar**: el cambio es un corte seco.
- **Que el efecto elegido vuelva tras reiniciar el motor**: es H5 (`MOO-25`). Recargar el panel con el
  motor en marcha sí entra.
- **Mostrar la salida Adalight y su puerto**: llega con H3.
- **Editar las tiras desde el panel**: fuera por decisión (PRD §5.4).
- **Los efectos *espectro* y *scroll***: llegan con `MOO-98` y `MOO-99`.
- **Que varios paneles abiertos vean el cambio que hace otro**: irá en otra historia. Con este diseño
  el aviso llega a todos los paneles sin trabajo extra, y un test del servidor lo comprueba. No se
  promete aquí ni lleva escenario en el panel.

Fuera también, decidido al explorar el change:

- **Avisar al DJ si un cambio no llega al motor**: es la pregunta abierta nueva del PRD (Q8). El panel
  nunca muestra un efecto que el motor no pinta.
- **Recuperar los valores de un efecto al volver a él**: es `MOO-96`. Hasta entonces, volver a un
  efecto lo devuelve con sus valores por defecto.
- **Evitar el calentamiento de *energía*** al elegirla en marcha: la tira tarda hasta 2 s en ajustarse,
  como al arrancar el motor. Cambiar su ganancia inicial tocaría la portación de la v1 (`MOO-20`).
- **Rutas de lectura** (`GET` de tiras o de efectos): el panel lee el estado por el WebSocket y el
  catálogo de `@moodtable/shared`.
- **Pasar el panel al inglés**: es `MOO-104`. Los textos nuevos van en castellano, en un módulo de
  literales.

## Impact

- **Código**:
  - `packages/shared`: el esquema y el codec del mensaje de las tiras, los esquemas de la ruta y sus
    errores, y una sola regla de qué efectos necesitan fuente de audio, que también usa la
    configuración.
  - `packages/engine`: el búfer de control (núcleo), el bucle lo lee al empezar cada pulso y analiza el
    audio siempre que hay fuente, la ruta y el OpenAPI en el servidor, el mensaje de las tiras, y
    `main.ts` crea el búfer antes que el servidor y el bucle.
  - `packages/panel`: la conexión guarda las tiras, las zonas Tiras y Efectos, el envío del cambio,
    el módulo de literales y el proxy de `/api` en Vite.
- **API**: `PUT /api/strips/{stripId}/effect` y `GET /api/openapi.json`. Es la primera ruta de la API
  HTTP.
- **Dependencias nuevas** (en el catálogo de pnpm): `@fastify/swagger` y
  `@fastify/type-provider-typebox` 5.x, que admite `typebox` 1.x (comprobado el 28-oct).
- **Documentación**:
  - `docs/PRD.md`, en el commit de este change: Q3 resuelta (corte seco, decisión del DJ), E3 pasa a
    «sin que la luz se pare» y la pregunta nueva Q8 (qué ve el DJ si el cambio no llega al motor).
  - `docs/instructions/viewer-protocol.md`: el mensaje nuevo.
  - `docs/openapi.yaml`: generado.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas, y D28 matizada.
  - README: §1.3 (zonas Tiras y Efectos), §2.1 (el análisis no se omite con fuente), §2.2 (búfer de
    control, adaptador *API HTTP*, visor y análisis de audio) y §4 (la API).
  - `prompts.md`.
- **Tests E2E**: uno nuevo con el caso feliz (ver las tiras, elegir otro efecto y verlo en el visor).
  Los existentes no cambian.
