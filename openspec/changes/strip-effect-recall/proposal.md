# Proposal

> **Origen:** historia [`MOO-96`](https://linear.app/7daysofrain/issue/MOO-96/recuperar-los-valores-de-un-efecto-al-volver-a-el)
> · Recuperar los valores de un efecto al volver a él · épica **H2** · expectativa **E3**.
> Tarea: `MOO-110` (recordar los valores de cada efecto en cada tira, `engine`).

## Why

Desde `MOO-95` el DJ ajusta los valores del efecto activo de cada tira, pero al cambiar de efecto y
volver los pierde: el búfer de control crea la ranura nueva con los valores por defecto. Para ir y
venir entre efectos en directo (E3) sin rehacer el ajuste, cada tira tiene que recordar los valores
de cada efecto, también de los que no están activos. Es lo que ya describe el modelo de datos del
README (§3.2, `strip_effects`), que hasta ahora no tenía historia en el PRD.

## What Changes

- **Volver a un efecto recupera sus valores**: al cambiar una tira a un efecto que ya había tocado,
  pinta con los valores con que lo dejó, desde el primer frame, y los paneles los reciben como
  siempre, por el estado de las tiras. Vale para cualquier efecto con parámetros; hoy, la respiración.
- **La primera vez, valores por defecto**: un efecto que nunca se ha elegido en una tira empieza con
  sus valores por defecto, aunque otra tira tenga otros.
- **Cada tira recuerda los suyos**: los valores guardados son por tira y por efecto.
- **El efecto empieza de nuevo**: vuelven los valores, no la memoria del efecto (p. ej. la
  respiración puede empezar desde casi apagado). Es un non-goal de la historia.
- La API y el protocolo del visor **no cambian**: la respuesta del cambio de efecto y el mensaje de
  las tiras ya llevan los valores, que ahora son los recuperados en vez de los de por defecto.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `instrument-control`: volver a un efecto recupera los valores con que lo dejó la tira, y cada tira
  guarda los valores de cada efecto.

`effects` no cambia: su requisito *Cada tira arranca con el efecto que declara el fichero* habla del
arranque, con los valores por defecto, y sigue igual. `panel-layout` y `viewer` tampoco.

## Non-goals

Tomados de la historia `MOO-96`:

- **Que los valores sobrevivan a un reinicio del motor**, también los de los efectos no activos: es
  H5 (`MOO-25`).
- **Compartir valores entre tiras**: cada tira guarda los suyos.
- **Un botón para volver a los valores por defecto** *(asumido en la historia)*.
- **Recuperar por dónde iba el efecto**: al volver, vuelven sus valores, pero el efecto puede
  empezar de nuevo.

Fuera también, decidido al explorar el change:

- **No perder un valor que va de camino al cambiar de efecto**: si el DJ suelta un control y cambia
  de efecto en la misma fracción de segundo, el último valor puede llegar con el efecto nuevo ya
  activo, y se rechaza como hasta ahora. Riesgo aceptado (`design.md`, decisión 3).

## Impact

- **Código**:
  - `packages/engine`: el búfer de control (`core/control.ts`) guarda los valores de cada efecto en
    cada tira y crea la ranura nueva con ellos.
  - `packages/panel`: solo un comentario desfasado en `controls/use-draft-values.ts`. El panel ya
    pinta los valores que manda el motor y descarta el borrador al cambiar de efecto.
- **API**: ninguna ruta nueva ni cambio de esquema. La respuesta `200` de
  `PUT /api/strips/{stripId}/effect` lleva los valores recuperados.
- **Dependencias nuevas**: ninguna.
- **Documentación**:
  - `docs/PRD.md`, en el commit de este change: E3 (al volver a un efecto, la tira recupera sus
    valores) y el glosario (*Valor* y *Estado del instrumento*: los valores de todos los efectos de
    cada tira, también los no activos), decisión del DJ al refinar `MOO-96`.
  - README §2.2 (*Búfer de control*) y §4 (la respuesta del cambio de efecto ya no son siempre los
    valores por defecto).
  - `prompts.md`.
- **Tests E2E**: uno nuevo con el caso feliz y el panel vuelto a abrir. Los existentes no cambian.
