# Design

> Decisiones tomadas con el DJ al explorar `MOO-96` (28-oct). Todas son de `MOO-110` (engine). Ninguna
> pasa a D#: son detalle del búfer de control, y la decisión de producto (el efecto puede empezar de
> nuevo) ya está en los non-goals de la historia.

## Context

- **Los valores viven dentro de la ranura.** `createSlot` (`core/control.ts`) crea la memoria del
  efecto y los valores por defecto (`defaultParams`), y `setEffect` sustituye la ranura entera, así
  que los valores del efecto anterior se pierden. Un comentario lo anticipa: *volver a un efecto lo
  devuelve con sus valores por defecto (MOO-96)*. Hay un test que lo fija:
  *cambiar de efecto sigue empezando con los valores por defecto* (`control.test.ts`).
- **`setValues` sustituye la referencia** a los valores de la ranura por una copia, sin rehacerla
  (decisión 8 de `strip-effect-values`). Los valores nunca se modifican por dentro.
- **El panel ya pinta lo que dice el motor.** El mensaje de las tiras (`StripState`) y la respuesta
  del cambio de efecto llevan los valores de la ranura, y `watch()` avisa de cada cambio. El borrador
  de `use-draft-values.ts` va ligado a la pareja tira + efecto y se descarta en cuanto cambia el
  efecto.
- **Las colas de efecto y de valores del panel son independientes** (D86): un valor que llega cuando
  la tira ya tiene otro efecto no cumple su esquema y se rechaza.

Motivación y alcance: `proposal.md`. Requisitos: `specs/instrument-control`.

## Goals / Non-Goals

**Goals:**

- Que el cambio quede dentro del búfer de control: ni la API, ni el protocolo, ni el panel cambian.
- Que lo que guarda el búfer tenga la forma de `strip_effects` (README §3.2), para que H5 lo persista
  sin rediseñarlo.

**Non-Goals:**

- **Persistir los valores guardados**: siguen en la memoria del motor (H5, `MOO-25`). `watch()` sigue
  siendo el punto donde se enganchará `StateStore`.
- **Conservar la memoria del efecto al salir de él**.

## Decisions

### 1. El búfer guarda los valores por tira y por efecto, y la ranura nueva se crea con ellos

Cada tira tiene, en el búfer, un mapa de efecto a valores. La ranura sigue siendo la del efecto
activo, pero sus valores salen del mapa:

```
 setEffect(tira, efecto)                      setValues(tira, valores)
   valores = guardados[tira][efecto]            ranura.valores = copia(valores)
             ?? defaultParams(efecto)           guardados[tira][ranura.efecto] = ranura.valores
   ranura  = createSlot(tira, efecto, valores)
             (memoria nueva)
   guardados[tira][efecto] = valores
```

Al crear una ranura, sus valores se apuntan en el mapa; al cambiarlos, también. Así el mapa siempre
tiene los valores del efecto activo de cada tira, igual que en `strip_effects` la clave foránea de
`strip_state` obliga a que el efecto activo tenga su fila. El arranque no cambia: cada tira empieza
con el efecto del fichero y sus valores por defecto, que quedan apuntados.

La memoria del efecto se crea de nuevo cada vez: con una memoria de hace minutos, la energía
volvería con un suavizado congelado y sus primeros frames darían un salto, y la respiración no tiene
nada que valga la pena conservar.

Los demás casos de `setEffect` no cambian: `unchanged` (el efecto ya activo, que no se reinicia),
`unknown-strip` y `needs-audio-source` no tocan el mapa.

Alternativas descartadas:

- **Cachear la ranura entera por efecto** y cambiar solo cuál es la activa: el efecto seguiría por
  donde iba, en contra del non-goal, con el salto de la energía, y obligaría a H5 a separar después
  los valores de la memoria.
- **Recordar los valores en el panel**: no cumple el escenario del panel vuelto a abrir, y otro
  mando (la F1) no los tendría.

### 2. El primer frame ya lleva los valores recuperados

La ranura nueva se construye entera, con los valores recuperados, **antes** de dejarla en el sitio
de la tira (decisión 1 de `strip-effect-switch`), y el bucle la recoge al inicio del pulso
siguiente. No hay ningún pulso con la ranura nueva y los valores por defecto, así que no hay destello.
Lo comprueba el escenario *(asumido)* del primer frame, a nivel de búfer: el primer `render` de la
ranura nueva ya pinta con los valores recuperados.

### 3. Un valor que va de camino al cambiar de efecto se pierde

Si el DJ suelta un control y elige otro efecto en la misma fracción de segundo, el último `PUT` de
valores puede llegar al motor con el efecto nuevo ya activo. Como hasta ahora (D86), no cumple el
esquema del efecto activo y se rechaza, así que tampoco llega al mapa: al volver, la tira recupera
el penúltimo valor. Hace falta un gesto casi simultáneo, y el error es de un paso de slider.

Alternativa descartada: que la orden de valores nombre su efecto y el búfer los guarde aunque no sea
el activo. Cambia la API y el panel para un caso que casi no se da; es la misma salida que ya apunta
D86 si algún día hace falta.

### 4. El panel no cambia

El panel recibe los valores recuperados por el mensaje de las tiras, como cualquier otro cambio, y el
borrador del control se descarta al cambiar de efecto, así que nunca enseña los valores del efecto
anterior. Solo se corrige el comentario de `use-draft-values.ts` que dice que el efecto *vuelve con sus
valores por defecto*, en la misma PR de motor: una línea de comentario no justifica una tarea `panel`.

## Risks / Trade-offs

- [Un valor que va de camino al cambiar de efecto se pierde] → riesgo aceptado (decisión 3).
- [Hoy solo la respiración tiene parámetros: no se puede comprobar con dos efectos de la misma tira
  que cada uno guarda los suyos] → los tests del búfer usan un efecto de prueba con parámetros además
  de los del registro, y las historias de espectro y scroll (`MOO-98`, `MOO-99`) lo comprueban con
  efectos reales si llegan con parámetros.
- [Reiniciar el motor borra todos los valores guardados] → es H5 (`MOO-25`), fuera de alcance.

## Migration Plan

Nada que migrar: los valores viven en memoria y el motor arranca como hasta ahora.
