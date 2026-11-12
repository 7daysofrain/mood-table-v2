# Design

> Decisiones del maker al refinar `MOO-136` y al explorar este change el 12-nov. Motivación:
> `proposal.md` (Why).

## Context

- **El catálogo de chips** (`packages/shared/src/chips.ts`, D109) tiene hoy una entrada,
  `{ id: 'WS2812B', channelMilliamps: 20 }`, y lo usan la validación de la configuración y el límite de
  potencia (`chipOf`). La salida `adalight` de cada tira física declara `chip`.
- **La salida Adalight** (`packages/engine/src/adapters/adalight.ts`) codifica cada frame en
  `encodeAdalight`: copia los bytes del frame (RGB, 3 por LED) detrás de la cabecera, cada uno pasado
  por la respuesta del LED (gamma 2,0, D108). Recibe de su tira lo que necesita en `AdalightStrip`
  (`name`, `ledCount`, `port`, `baudRate`), que arma `openAdalightStrips` a partir de la configuración.
- **El sketch Adalight-FastLED** de la mesa reordena a GRB (`COLOR_ORDER`, `HARDWARE_SETUP.md` §4.1).
- **El orden de color va en el adaptador** porque el visor no debe recibirlo (D100).
- **El esquema de la configuración es cerrado** (`additionalProperties: false`): un campo que no existe
  impide arrancar, con un mensaje que nombra el campo y la tira (specs/engine-config).

## Goals / Non-Goals

**Goals:**

- Que la tira física pinte los colores del frame con cualquier chip del catálogo, sin que el
  controlador reordene.
- Que un chip nuevo con otro orden solo añada su fila al catálogo.

**Non-Goals:**

- Reordenar en el núcleo o en el bucle: el frame sigue siendo RGB hasta la salida.
- Un orden distinto por segmento de una misma tira.

## Decisions

### 1. El orden de color sale del chip, no del fichero de configuración (D111)

El orden de color es una propiedad del chip: un `WS2812B` siempre espera GRB. Así que va en el catálogo,
junto a lo que consume cada canal, y el maker no lo declara. Pasa lo mismo que con el consumo en D109:
el maker copia de la tira lo que pone en ella (el chip) y el motor sabe el resto. Un `colorOrder` en
el fichero es un campo que no existe y el motor no arranca.

- **Descartado, un campo `colorOrder` en la tira:** pide un dato que el chip ya da y puede contradecirlo
  (`WS2812B` con `RGB`). Era lo que anunciaban la H4 y el README, de antes de que la tira declarara su
  chip.
- **Descartado, el orden del chip con un `colorOrder` opcional que lo sobrescriba:** cubre los chips
  cuyo orden depende del fabricante de la tira (WS2811) y los clones con otro orden, pero añade
  superficie y validaciones para algo que hoy no existe. Se añade si entra un chip que lo necesite
  (non-goal de la historia).

**D#:** sí, **D111**, en el commit de este change (D110 la usa el change `table-install`, aún sin
integrar). D29, que lista el orden de color entre lo que se declara, se marca con un enlace a D111;
no se borra.

### 2. Un tipo con las seis permutaciones, aunque el catálogo solo use `GRB`

`ColorOrder` en `@moodtable/shared` es la unión `'RGB' | 'RBG' | 'GRB' | 'GBR' | 'BRG' | 'BGR'`, y cada
chip del catálogo lleva el suyo (`colorOrder`). Es un conjunto cerrado y pequeño en el que todas las
permutaciones tienen sentido, así que un chip nuevo solo añade su fila: no toca el tipo ni la función
que reordena. El nombre en código, `colorOrder`, es el del glosario.

- **Descartado, solo `'GRB'`:** menos tipo hoy, pero el primer chip distinto obligaría a ampliar el
  tipo y la función de reordenar.

**D#:** no, es un detalle de la decisión 1.

### 3. La salida recibe el orden ya resuelto, y reordena al codificar

`AdalightStrip` gana `colorOrder`. `openAdalightStrips` lo resuelve con
`chipOf(output.chip).colorOrder`, junto a `name`, `ledCount`, `port` y `baudRate`. `encodeAdalight`
recibe el orden y escribe, para cada LED, los tres canales en ese orden, cada uno pasado por la
respuesta del LED. Da igual reordenar antes o después de la gamma, porque la gamma se aplica a cada
canal por separado.

```
config: output.chip = 'WS2812B'
   |
   v
openAdalightStrips --chipOf--> AdalightStrip { name, ledCount, port, baudRate, colorOrder: 'GRB' }
                                    |
                                    v
frame RGB --> encodeAdalight: por LED, canales en el orden de colorOrder, con la gamma --> puerto serie
```

El orden se traduce una vez, al crear la salida, a los índices de origen de cada byte (`GRB` lee el
canal 1, luego el 0 y luego el 2), para no interpretar la cadena en cada frame.

- **Descartado, pasarle el chip a la salida y que lo resuelva ella:** ahorra una línea en
  `openAdalightStrips`, pero ata la salida al catálogo, y sus tests tendrían que pasar por él. Si un día
  se puede sobrescribir el orden, con esta decisión solo cambia la línea que lo resuelve.
- **Descartado, reordenar en el núcleo** (un paso más del bucle, como la intensidad): el frame llega
  igual al visor y a la tira física, y el visor debe recibirlo en RGB (D100).

**D#:** no, sigue D100 (el orden de color vive en el adaptador).

### 4. El motor y el sketch llegan juntos a la mesa

Con el motor nuevo y el sketch antiguo, el orden se aplica dos veces. Con el sketch nuevo y el motor
antiguo, no se aplica ninguna. En los dos casos el rojo y el verde salen cambiados, sin ningún error:
el motor solo ve el puerto serie (Q5). Por eso:

1. Se integra `MOO-146` (motor). La Pi sigue con el motor antiguo y el sketch antiguo, que es una
   combinación coherente.
2. En la Pi, en un solo paso y a mano (`sudo` pide contraseña: lo hace el maker): actualizar a `main`,
   recargar el sketch con `COLOR_ORDER` en `RGB` y reiniciar el servicio.
3. Probar en la mesa rojo, verde y azul puros.
4. `MOO-147` lleva `HARDWARE_SETUP.md` §4.1 y el resultado de la prueba.

Es el mismo patrón que `MOO-141` (el tope del sketch, en `power-limit`).

- **Descartado, la documentación del sketch en la PR del motor:** llegaría a `main` a la vez que el
  código, pero mezcla dos áreas en una PR (una tarea = una PR).

**D#:** no, es cómo se despliega este change.

## Risks / Trade-offs

- [La Pi se actualiza a `main` sin recargar el sketch: el rojo y el verde salen cambiados] → La
  decisión 4 lo hace en un solo paso, y `HARDWARE_SETUP.md` §4.1 dice qué `COLOR_ORDER` necesita el
  sketch y por qué.
- [Un controlador que reordena por su cuenta (el Light Box, otro sketch, la SD de la v1) saca los
  colores cambiados] → Non-goal: el controlador tiene que pasar los canales tal como llegan, y lo dice
  `HARDWARE_SETUP.md`.
- [Lo que el sketch pinta sin el motor sale con el rojo y el verde cambiados en una `WS2812B`: el
  destello de arranque, si lo tiene (sin comprobar), y los frames del procedimiento para contar LEDs]
  → Es cosmético y no lo pinta el instrumento. `MOO-147` lo comprueba en la mesa y revisa el
  procedimiento de §4.1.
- [Un chip futuro cuyo orden depende del fabricante de la tira (WS2811)] → El catálogo no puede
  darlo; entonces se añade la sobrescritura descartada en la decisión 1.

## Migration Plan

- **Configuración:** ningún fichero cambia. El `config/local.json` de la Pi ya declara `chip`.
- **Despliegue:** la secuencia de la decisión 4.
- **Vuelta atrás:** volver a la versión anterior de `main` en la Pi y recargar el sketch con
  `COLOR_ORDER` en `GRB`. Las dos cosas van juntas, igual que al desplegar.
