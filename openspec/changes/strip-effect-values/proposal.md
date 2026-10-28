# Proposal

> **Origen:** historia [`MOO-95`](https://linear.app/7daysofrain/issue/MOO-95/mover-los-controles-del-efecto-y-que-la-luz-responda-mientras-arrastro)
> · Mover los controles del efecto y que la luz responda mientras arrastro · épica **H2** ·
> expectativa **E1**.
> Tareas: `MOO-105` (los parámetros de la respiración y el contrato de cambio de valor, `shared`),
> `MOO-106` (cambiar los valores de una tira por la API y avisar a los paneles, `engine`) y `MOO-107`
> (la zona Controles generada desde el esquema, `panel`).

## Why

Desde `MOO-94` el DJ cambia el efecto de cada tira en directo, pero no puede tocar sus valores: la
respiración pinta siempre blanco cálido cada 4 s, y la zona Controles del panel sigue vacía desde
`MOO-29`. Es la otra mitad de H2 y lo que mide E1: *al mover un control, la luz responde mientras
arrastras, sin saltos ni tirones*. La respiración es el primer efecto con parámetros (PRD Q2, resuelta
para ella), así que es el que estrena la zona.

## What Changes

- **Zona Controles**: muestra un control por cada parámetro del efecto activo de la tira
  seleccionada, generado a partir de su esquema y sin que el panel conozca el efecto: un número con
  rango es un slider, un color es un selector de color. Para la respiración, un selector para el
  color y un slider para el periodo.
- **Respuesta mientras se arrastra**: cada movimiento de un control llega a la tira en menos de
  100 ms (umbral de E1). Mientras el DJ arrastra, el control sigue al dedo; en reposo, muestra los
  valores con que pinta el motor, también al abrir o recargar el panel.
- **Periodo de 1 a 20 s, en escala logarítmica**: decisión del DJ al explorar el change. Resuelve el
  rango que faltaba en PRD Q2. Cambiar el periodo a media respiración no da un salto de brillo: la
  respiración sigue desde el brillo en que estaba, con el nuevo ritmo.
- **API HTTP**: una segunda ruta de mando, `PUT /api/strips/{stripId}/values`, con todos los valores
  del efecto activo, validada con su esquema y descrita en el OpenAPI. **Matiza D81** (*una sola
  ruta*).
- **Esquemas de parámetros cerrados**: un valor con campos que el efecto no declara se rechaza. La
  energía, sin parámetros, deja de aceptar cualquier objeto.
- **Protocolo del visor**: el mensaje de las tiras lleva, además del efecto activo, sus valores. La
  respuesta del cambio de efecto también.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `instrument-control`: la zona Controles, la ruta de valores (que rechaza los valores que el efecto
  activo no declara) y su OpenAPI, los valores en el estado de las tiras y en la respuesta del cambio
  de efecto, y que sin conexión también se vacía Controles.
- `effects`: el rango del periodo de la respiración y que cambiarlo no da un salto de brillo.

`panel-layout` no cambia: la zona Controles ya existe y sigue sin inventar datos. `viewer` tampoco:
el mensaje de las tiras lo fija `instrument-control`.

## Non-goals

Tomados de la historia `MOO-95`:

- **Parámetros de los efectos reactivos**: siguen abiertos en Q2 (historias de espectro y scroll).
  La energía sigue sin parámetros, y su zona Controles queda vacía.
- **Recordar los valores al cambiar de efecto**: es `MOO-96`. Hasta entonces, volver a un efecto lo
  devuelve con sus valores por defecto.
- **Recordar los valores tras reiniciar el motor**: es H5 (`MOO-25`).
- **Escenas y presets**: fuera por decisión (PRD §5.4).
- **Un desplegable**: ningún parámetro lo usa todavía.
- **Que otros paneles abiertos a la vez vean moverse los controles**: irá en otra historia, como el
  cambio de efecto en `MOO-94`. El aviso llega a todos los paneles sin trabajo extra, pero no se
  promete aquí.

Fuera también, decidido al explorar el change:

- **Avisar al DJ si un cambio de valor no llega al motor**: se amplía la pregunta abierta Q8 del
  PRD. Al soltar, el control vuelve al valor que pinta el motor.
- **Que la orden de valores nombre su efecto** (`409` si no es el activo): protegería de dos efectos
  futuros con un parámetro del mismo nombre y valores que llegan desordenados. Riesgo aceptado
  (`design.md`, decisión 3).

## Impact

- **Código**:
  - `packages/shared`: el rango y las pistas de control del esquema de la respiración, los esquemas
    cerrados, el esquema de la ruta de valores y los valores en el estado de las tiras.
  - `packages/engine`: la respiración sigue su fase al cambiar el periodo, el búfer de control cambia
    los valores de una ranura sin rehacerla, la ruta nueva en el servidor y su OpenAPI.
  - `packages/panel`: la zona Controles y sus controles, el envío de los valores y los textos nuevos
    en el módulo de literales.
- **API**: `PUT /api/strips/{stripId}/values`. La respuesta `200` de `PUT /api/strips/{stripId}/effect`
  pasa a llevar los valores de la tira.
- **Dependencias nuevas**: ninguna. El slider y el selector de color son de `@mantine/core`.
- **Documentación**:
  - `docs/PRD.md`, en el commit de este change: Q2 resuelta también en el rango del periodo (1-20 s,
    escala logarítmica) y Q8 ampliada al cambio de un valor.
  - `docs/instructions/viewer-protocol.md`: los valores en el mensaje de las tiras.
  - `docs/openapi.yaml`: generado.
  - `docs/idea-mood-table.md` §10: las decisiones nuevas, y D81 matizada.
  - README: §1.3 (zona Controles; el ejemplo del recorrido pasa de la sensibilidad al periodo), §2.2
    (búfer de control, adaptador *API HTTP* y panel de control) y §4 (la ruta nueva).
  - `prompts.md`.
- **Tests E2E**: uno nuevo con el caso feliz (mover el periodo y ver la tira en el visor). Los
  existentes no cambian.
