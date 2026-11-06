# Design

> Decisiones tomadas con el DJ al refinar `MOO-98` y al explorar el change (5-nov). Todas son de
> `MOO-122` (engine). Las decisiones 1 a 3 pasan a una **D#** nueva en `docs/idea-mood-table.md`:
> **D97** (la D96 la tomó `MOO-123`, la gamma y los baudios).

## Context

- **El patrón ya existe, dos veces.** *Energía* (D49) y *scroll* (D95, `MOO-118`) son efectos de la
  v1 portados tal cual. Ya resuelven las piezas que el *espectro* necesita:
  - los suavizados con `follow` y `dt` (`core/audio/dsp.ts`);
  - el espejo con un número impar de LEDs (`core/effects/mirror.ts`, `halfLength` y `mirrorOf`);
  - el silencio: LEDs a 0 y la memoria congelada;
  - los frames dorados con el fichero de golpes (`golpes.test.ts`).

  `mirror.ts` y `golpes.test.ts` llegan con *scroll*: ver la decisión 6.
- **Referencia de la v1:** `visualize_spectrum` en `naztronaut/dancyPi-audio-reactive-led`,
  `python/visualization.py`, commit `0906e77`, el mismo del que salieron *energía* y *scroll*. Se leyó
  al explorar el change.
- **El *espectro* no tiene ganancia propia.** A diferencia de *energía* y *scroll*, trabaja con las
  bandas tal como salen del análisis común (ya al cuadrado, con la ganancia común y suavizadas). Su
  memoria es más simple.
- **Catálogo y registro van juntos.** `registry.test.ts` exige que el registro del motor y
  `EFFECT_CATALOG` de `@moodtable/shared` coincidan.
- **Cada cambio de efecto crea una memoria nueva** (`createSlot`, `core/control.ts`). Por eso lo que
  la v1 hacía al arrancar el programa aquí pasa cada vez que el DJ elige el *espectro* (decisión 2).

Motivación y alcance: `proposal.md`. Requisitos: `specs/effects` y `specs/instrument-control`.

## Goals / Non-Goals

**Goals:**

- Que el *espectro* se vea como el de la v1, para que el DJ tenga la referencia antes de decidir sus
  controles.
- Que el efecto quede en un fichero, como *energía* y *scroll*, sin tocar el bucle, el análisis común
  ni el contrato `Effect` (E9).

**Non-Goals:**

- **Comparar los frames con los de la v1 en Python.** La v1 iba a 50 fps y el motor a 60.
- **Preparar la memoria para parámetros futuros** (color, número de bandas). Los decidirá su historia.

## Decisions

### 1. El *espectro* es el `visualize_spectrum` de la v1, portado tal cual

```
 bandas mel (24, del analisis comun: al cuadrado, con ganancia comun y suavizadas)
     --> espectro (por tira):
           interpolar linealmente a media tira (24 --> ceil(N/2) valores)       = y
           suelo = follow(suelo, y)       sube 0,01 / baja 0,99   (common_mode)
           R = follow(R, y - suelo)       sube 0,99 / baja 0,2    (r_filt)
           G = |y - y del frame anterior|  sin suavizar
           B = follow(B, y)               sube 0,5  / baja 0,1    (b_filt)
           espejo: indice 0 de la mitad (banda mas grave) en el centro
           x 255 --> recorte a 0-255 --> truncado

   extremo                centro                extremo
   agudos <---- medios <-- GRAVES --> medios ----> agudos
```

- **Las constantes son las de la v1**, por frame a 50 fps, y valen 0,01 al arrancar (suelo, rojo, azul
  y la banda anterior), como los `np.tile(0.01, …)` de la v1.
- **La interpolación es la de la v1** (`interpolate`, con `np.interp` sobre dos `linspace(0, 1)`): el
  primer LED de la mitad es la banda 0 y el último la 23, con interpolación lineal entre medias. Con
  una mitad de un solo LED, es la banda 0.
- **El verde no se suaviza.** La v1 declara un `g_filt`, pero `visualize_spectrum` no lo usa.
  Portado tal cual, el verde es la diferencia sin filtrar.
- **El rojo puede salir negativo** (la banda por debajo de su suelo antes de que este baje). La
  memoria lo guarda sin recortar, como la v1, y la salida se recorta a 0-255 y se trunca, como el
  `astype(int)` de la v1 (y como hacen *energía* y *scroll*).
- **El espejo y la tira impar, como en *energía* y *scroll*:** la mitad calculada es `ceil(N/2)` y,
  con un número impar de LEDs, el del centro es el primero de la mitad. La v1 usaba `N // 2` y con un
  número impar se quedaba un LED corto; aquí se reutiliza `mirrorOf`, que ya lo resuelve. La
  orientación de la v1 (`concatenate((r[::-1], r))`) pone el índice 0 en el centro, igual que
  `mirrorOf`.
- **La memoria por tira:** suelo, rojo, azul y la banda anterior (media tira cada uno), un búfer para
  la interpolación y el espejo. `render` no crea objetos.

**Alternativa descartada:** suavizar el verde con el `g_filt` declarado. Es una lectura del código que
la v1 nunca ejecutó.

### 2. Al elegir el *espectro*, la tira arranca en rojo, como la v1

El suelo arranca en 0,01 y sube con 0,01 por frame a 50 fps: con un sonido sostenido llega al 40 %
en 1 s, al 63 % en 2 s y al 99 % en unos 9 s. Mientras sube, «lo que la banda sobresale de su suelo»
es casi toda la banda, así que la tira sale muy roja unos segundos y se asienta. En el primer frame
hay además un destello verde, porque la banda anterior arranca en 0,01.

En la v1 eso solo pasaba al arrancar el programa. Aquí pasa cada vez que el DJ elige el *espectro*,
porque cada cambio de efecto estrena memoria. Al explorar se vieron dos opciones:

| | Tal cual (elegida) | Suelo caliente |
|---|---|---|
| Al elegirlo | Rojo unos segundos, luego se asienta | Se ve asentado desde el primer frame |
| Fidelidad a la v1 | Total | Se aparta en la inicialización |
| Coste de cambiarlo luego | Poner el suelo y la banda anterior al nivel del primer frame con audio | — |

El DJ eligió **tal cual**: es el criterio que ya siguió con *energía* (D49 conserva su destello de
arranque; su calentamiento de hasta 2 s quedó en el spec al explorar `MOO-94`) y con *scroll*
(primero la v1, se ajusta después de verlo). Cambiarlo después cuesta poco, y así lo decide viéndolo
en la mesa.

Como la memoria se congela en silencio (decisión 1, y el requisito del silencio), **el suelo solo
sube mientras suena la música**: el arranque se mide en segundos de música, no de reloj. Con el
fichero de golpes, que tiene 50 ms de sonido por segundo, el *espectro* apenas sale del arranque.

**Alternativa descartada:** suelo caliente (el primer frame con audio pone el suelo y la banda
anterior a su nivel). Queda para otra historia si el arranque molesta.

### 3. El verde va por frame; el suelo, el rojo y el azul, con `dt`

El verde es la diferencia entre la banda de un frame y la del anterior, así que depende de cada cuánto
hay un frame:

| | Por frame (elegida) | Con `dt` (escalada a 50 fps) |
|---|---|---|
| Ataque (un bombo) | El análisis sube con 0,99, así que la banda salta casi entera en un frame: verde igual a 20, 30 o 60 fps | A 30 fps, ×1,67; a 20 fps, ×2,5: el verde se satura |
| Caída | Algo más tenue que la v1 a 60 fps (unos 0,83) | Igual que la v1 |
| Duración del destello | Un frame: 16 ms a 60 fps, 50 ms a 20 fps | Igual |

El DJ eligió **por frame**: en los ataques, que es lo que se ve, el verde es el mismo con cualquier
fps, y escalarlo los saturaría con pocos fps. Es el mismo criterio que el movimiento de *scroll*
(D95).

El **suelo, el rojo y el azul** van con `dt`, con `follow`, como las ganancias de *energía* y *scroll*
(D49): así suben y bajan igual de deprisa en segundos con cualquier fps, y ninguna constante se
interpreta dos veces. El primer pulso con audio, con `dt` = 0, no mueve los suavizados, pero sí da su
verde (la diferencia con 0,01), como la primera llamada de la v1.

**Alternativa descartada:** todo por frame, suavizados incluidos. Sería la copia exacta, pero a 60 fps
el suelo subiría un 20 % más deprisa y duplicaría `follow`.

→ **Proponer como D#**, junto con las decisiones 1 y 2: «El *espectro* es el `visualize_spectrum` de
la v1 portado tal cual, sin parámetros: graves en el centro y en espejo, azul el nivel, rojo lo que
sobresale del suelo, verde el cambio por frame. Los suavizados van con `dt`; el verde, por frame. Se
conserva el arranque en rojo al elegirlo».

### 4. Frames dorados con el fichero de golpes, en `golpes.test.ts`

Igual que *energía* y *scroll*: tira de 60 LEDs, 60 fps, el bucle real y `golpes.wav`, con los frames
de los instantes de referencia en `core/effects/__golden__/spectrum-60-leds.json`, en un `describe`
nuevo de `golpes.test.ts`. Los golpes son ruido, así que encienden todas las bandas: la tira entera,
igual por los dos lados, y a negro en el silencio entre ellos.

Son frames **de regresión**. La fidelidad a la v1 se comprueba con los tests unitarios (dónde cae cada
tono, el verde de un cambio, el arranque en rojo) y con el DJ mirándolo en el visor.

### 5. Catálogo, registro y panel en la misma PR; el *espectro*, detrás de la *respiración*

- `@moodtable/shared`: `SpectrumParamsSchema = Type.Object({}, CLOSED)` y la entrada
  `{ id: 'spectrum', usesAudio: true, … }` en `EFFECT_CATALOG`. Los esquemas que listan los ids
  (fichero, API y protocolo del visor) se generan del catálogo.
- Motor: `spectrum` en `EFFECTS`, en el orden del catálogo.
- Panel: `EFFECT_NAMES.spectrum = 'Espectro'` y `PARAM_NAMES.spectrum = {}`.
- `docs/openapi.yaml`, regenerado con `pnpm openapi`.

**El sitio en la lista:** el orden de la zona Efectos es el del catálogo, que hoy es *respiración*,
*scroll* y *energía* (decidido con el DJ al aplicar `MOO-118`). El *espectro* va **detrás de la
*respiración*** y delante de *scroll* y *energía*: el reactivo más nuevo, el primero tras el de
ambiente, como entró *scroll*. Queda Respiración, Espectro, Scroll, Energía.

Al revisar el change, el DJ lo había puesto detrás de *energía* y *scroll* y delante de
*respiración*, pero sobre el orden anterior a `MOO-118`; al aplicar, con el orden ya cambiado, eligió
este (la IA lo recomendó porque es lo que pedía el paso 1.1 y sigue el patrón de *scroll*). Ningún
comportamiento depende del orden: el efecto inicial de cada tira lo declara el fichero (D52).

### 6. Se escribe encima de *scroll*, que se integra y se archiva antes

`scroll-effect` (`MOO-118`, PR #116) aún no está integrado ni archivado, y modifica cuatro requisitos
que el *espectro* también toca: los frames dorados y el silencio en `effects`, y las zonas Efectos y
Controles en `instrument-control`. Los bloques MODIFIED de este change parten del texto de
`scroll-effect` y le añaden el *espectro*; si se archivara este primero, al archivar *scroll* se
perdería el *espectro* de esos requisitos.

Por eso, **antes de `/opsx:apply`**:
1. se integra la PR #116 y se archiva `scroll-effect`;
2. se trae `main` a esta rama (sincronizar con la rama base) y se resuelven los conflictos, si los
   hay;
3. se comprueba con `openspec validate spectrum-effect` que los deltas aplican sobre los specs ya
   archivados.

El código también lo necesita: `mirror.ts` y `golpes.test.ts` llegan con *scroll*.

## Risks / Trade-offs

- **[Cada vez que el DJ elige el *espectro*, la tira sale roja unos segundos]**: es la decisión 2. →
  Mitigación: está en el spec (*Un tono sostenido pasa de rojo a azul*). Si molesta en la mesa, el
  suelo caliente es un cambio pequeño en otra historia.
- **[Con música continua, la tira puede verse casi toda azul]**: el azul es el nivel sostenido, y el
  rojo y el verde solo salen en los cambios. Es lo que hacía la v1, y lo que el DJ quiere ver antes de
  decidir. → Mitigación: ninguna aquí; irá a la historia de los controles.
- **[El verde parpadea con material ruidoso]**: va sin suavizar, por frame. → Aceptado: es la v1.
- **[Con una tira de menos de 48 LEDs, algunas bandas no se ven]**: la interpolación toma muestras de
  las 24 bandas para menos de 24 LEDs por mitad, y se salta las de en medio. → Aceptado: es la v1; la
  mesa tiene 173 LEDs.
- **[Las ramas de *scroll* y *espectro* chocan]**: decisión 6. → Mitigación: el orden está escrito
  aquí y en `tasks.md`.
