# Design

> Decisiones tomadas con el DJ al refinar `MOO-99` (4-nov) y al explorar el change (5-nov). Las 1 a 5
> son de `MOO-118` (engine), y las 1 y 2 pasan a **D95** en `docs/idea-mood-table.md`. Las 6 a 8 son
> de `MOO-123` (engine), salen de la prueba en la mesa del 5-nov y pasan a **D96**.

## Context

- **El patrón ya existe.** *Energía* (`core/effects/energy.ts`) es el `visualize_energy` de la v1
  portado (D49). Ya resuelve las piezas que *scroll* necesita:
  - la ganancia propia por banda con `follow` y `dt`;
  - el espejo con un número impar de LEDs;
  - el silencio;
  - los frames dorados con el fichero de golpes (`energy-golpes.test.ts`).
- **Referencia de la v1:** `visualize_scroll` en `naztronaut/dancyPi-audio-reactive-led`,
  `python/visualization.py`, commit `0906e77`. Es el mismo commit del que se leyeron las constantes de
  *energía*.
- **Catálogo y registro van juntos.** `registry.test.ts` exige que el registro del motor y
  `EFFECT_CATALOG` de `@moodtable/shared` coincidan. Por eso *scroll* no puede entrar en el catálogo
  en una PR y en el motor en otra.
- **El panel no conoce los efectos.** Genera los controles del esquema, y un esquema vacío deja la
  zona con su título. Solo necesita el nombre visible (`EFFECT_NAMES`, `PARAM_NAMES`), que el tipo
  exige.
- **Cada cambio de efecto crea una memoria nueva** (`createSlot`, `core/control.ts`). En la v1, en
  cambio, *energía* y *scroll* compartían el array `p`.

- **La prueba en la mesa (5-nov, `MOO-123`).** Con el *scroll* en la tira de la mesa, la tira física
  no se parecía al visor. Con dos arreglos provisionales en la Pi (decisiones 6 y 7), el DJ confirmó
  que coincide, también con un WAV de golpes limpios (decisión 8).

Motivación y alcance: `proposal.md`. Requisitos: `specs/effects`, `specs/instrument-control` y
`specs/physical-strip`.

## Goals / Non-Goals

**Goals:**

- Que *scroll* se vea como el de la v1, para que el DJ tenga la referencia antes de decidir sus
  controles.
- Que el efecto quede en un fichero, como *energía*, sin tocar el bucle, el análisis común ni el
  contrato `Effect` (E9: un efecto nuevo es una pieza pequeña).

**Non-Goals:**

- **Preparar la memoria para la velocidad y la estela.** La historia que las traiga decidirá su
  mecanismo. Al explorar quedaron dos hipótesis para ella: la estela medida en LEDs y una rejilla de
  8 celdas por LED para avanzar a cualquier velocidad. No se adelanta nada aquí.
- **Comparar los frames con los de la v1 en Python.** La v1 iba a 50 fps y el motor a 60, así que no
  pueden coincidir.

## Decisions

### 1. *Scroll* es el `visualize_scroll` de la v1, portado tal cual

```
 bandas mel (analisis comun: ya al cuadrado, con ganancia comun y suavizadas)
     --> scroll (por tira):
           al cuadrado otra vez
           ganancia propia por banda (inicial 0,01, sube 0,99, baja 0,001)  --> / ganancia x 255
           color nuevo:  R = max(tercio inferior)   G = max(tercio central)   B = max(tercio superior)
                         truncado a entero, como el int() de la v1
           media tira (3 canales):
             desplazar 1 LED hacia fuera  -->  x 0,98  -->  desenfoque gaussiano, sigma 0,2
             --> el color nuevo, en el LED del centro
           espejo: la media tira se refleja para llenar la tira
```

- **El orden es el de la v1:** primero se desplaza, luego se apaga y se desenfoca, y al final entra
  el color nuevo. Por eso el LED del centro siempre tiene el color del pulso, sin apagar.
- **La ganancia propia tiene las mismas constantes que la de *energía*.** En la v1 era el mismo
  objeto, `gain`. Aquí cada efecto tiene la suya, dentro de su memoria, como pide README §2.2.
- **El desenfoque de sigma 0,2** usa `gaussianKernel` (radio 1). Apenas se nota, pero es el de la v1.
- **La memoria arranca a 1, como el `p` de la v1**, no a 0. No llega a verse: en el primer frame ya
  se ha apagado a 0,98, que se trunca a 0.
- **El espejo y la tira impar, como en *energía*:** la mitad calculada es `ceil(N/2)` y, con un
  número impar de LEDs, el del centro es el primero de la mitad. Se reutiliza el mismo cálculo.
- **La salida se recorta a 0-255 y se trunca**, como el `astype(int)` de la v1. El color nuevo puede
  pasar de 255 (p. ej., en el primer pulso, cuando la ganancia aún arranca), pero en la memoria se
  guarda sin recortar, como en la v1.

**Alternativa descartada:** portarlo ya con velocidad y estela. Era lo que pedía la historia al
refinarla, pero el DJ la dividió al explorar: decidir el mecanismo y los rangos sin haber visto el
efecto era adivinar.

### 2. El movimiento va por frame; la ganancia, con `dt`

La v1 avanzaba 1 LED y multiplicaba por 0,98 **en cada frame**, a 50 fps. Al explorar se vieron dos
formas de portarlo:

| | Movimiento por frame (elegida) | Movimiento con `dt` |
|---|---|---|
| Código | Idéntico al de la v1 | Necesita avanzar fracciones de LED (acumulador a saltos, o una rejilla fina) |
| Velocidad | La de los fps: a 60 fps, 60 LEDs/s | 50 LEDs/s con cualquier fps |
| Longitud del rastro | Igual que la v1 en LEDs (34 hasta la mitad) | Igual que la v1 |

El DJ eligió **por frame**: es la referencia más fiel, y el mecanismo fraccionario es justo lo que
decidirá la historia de velocidad y estela. Los efectos de esta decisión son:

- La velocidad es la de los fps, y la longitud del rastro no cambia con ellos, porque el ×0,98 va
  ligado a cada paso.
- Cada pulso con audio es un paso, aunque el bucle se haya saltado alguno (`dt` mayor que un frame).
  También el primero, con `dt` = 0: la v1 desplazaba en cada llamada. En ese pulso la ganancia sigue
  en su valor inicial, y entra el destello de arranque que *energía* ya conserva (D49).

La **ganancia** sí va con `dt`, como en *energía* (D49, `follow`). No se ve directamente: solo decide
cuánto brilla cada color. Además, hacerla por frame obligaría a escribir otra versión del mismo
suavizado. *Scroll* se aparta de D49 solo en el movimiento.

**Alternativa descartada:** todo por frame, ganancia incluida. Sería la copia exacta del código, pero
a 60 fps la ganancia reaccionaría un 20 % más deprisa sin que se vea la diferencia, y duplicaría
`follow`.

→ **Proponer como D95**, junto con la decisión 1: «*Scroll* es el `visualize_scroll` de la v1
portado tal cual, sin parámetros. Se mueve por frame (1 LED y ×0,98) y su ganancia va con `dt`».

### 3. En silencio, a negro y con la memoria congelada, como *energía*

Si `ctx.audio` es `null` o está en silencio, el frame va a 0 y la memoria no cambia: ni se desplaza,
ni se apaga, ni se actualiza la ganancia. Es lo que hacía la v1, que en silencio no llamaba al
efecto, y lo que ya hace *energía*. Al volver la música, el rastro reaparece donde estaba y sigue
avanzando.

**Alternativa descartada:** dejar que el rastro siga hasta los extremos y se desvanezca. Se ve más
suave, pero se aparta de la v1 y de *energía*, y obligaría a tocar la puerta de silencio común, que
es un non-goal. El DJ lo descartó al refinar.

### 4. Frames dorados con el fichero de golpes, en el mismo test que *energía*

Igual que *energía*: tira de 60 LEDs, 60 fps, el bucle real y `golpes.wav`, con los frames de los
instantes de referencia guardados en `core/effects/__golden__/scroll-60-leds.json`. El montaje que hoy
está en `energy-golpes.test.ts` sirve para los dos efectos, así que el fichero pasa a
`golpes.test.ts`, con un bloque `describe` por efecto, en lugar de copiar su `run()`.

Son frames **de regresión**: congelan lo que hace nuestro motor. La fidelidad a la v1 se comprueba
de dos formas:
- con los tests unitarios de la mecánica: 10 frames son 10 LEDs y el brillo es 0,98¹⁰ veces el
  inicial;
- con el DJ mirándolo en el visor, que es para lo que se porta.

### 5. Catálogo, registro y panel en la misma PR

- `@moodtable/shared`: `ScrollParamsSchema = Type.Object({}, CLOSED)` y la entrada
  `{ id: 'scroll', usesAudio: true, … }` en `EFFECT_CATALOG`. Los esquemas que listan los ids
  (fichero, API y protocolo del visor) se generan del catálogo.
- Motor: `scroll` en `EFFECTS`, en el orden del catálogo.
- Panel: `EFFECT_NAMES.scroll = 'Scroll'` y `PARAM_NAMES.scroll = {}`. El orden de la zona Efectos
  es el del catálogo: Respiración, Scroll, Energía, decidido con el DJ al aplicar (`MOO-118`).
- `docs/openapi.yaml`, regenerado con `pnpm openapi`.

### 6. La gamma 2,0 de la v1, fija en la salida Adalight

- **La v1 la aplicaba.** dancyPi (`0906e77`, `python/led.py`) pasa cada valor por `gamma_table.npy`
  antes de enviarlo, con `SOFTWARE_GAMMA_CORRECTION = True` en la Raspberry. La tabla es exactamente
  `round(255 · (v/255)²)`: comprobado valor a valor, sin ninguna diferencia.
- **Sin ella, la tira se ve llena y lenta.** Un LED da una luz proporcional al valor, y la pantalla no:
  un 30 de 255 en pantalla casi no se ve y en el LED es un 12 % de su luz. Los valores bajos del rastro
  del *scroll* (×0,98 por frame, aún un 17 % al final de media tira) brillan en la tira.
- **Dónde:** en la codificación Adalight (`adapters/adalight.ts`), la parte pura y con tests, con una
  fórmula aplicada a cada byte. Sin tabla: indexarla obliga, por el tipado estricto, a ramas que no
  pueden darse, y SonarQube las cuenta como código nuevo sin cubrir. El visor sigue recibiendo los
  valores sin corregir.
- **Consecuencia:** lo que vale menos de 12 se apaga, como en la v1.
- **Descartado:** un campo `gamma` por tira en el fichero de configuración, como el flag por
  dispositivo de la v1. Hoy solo hay un controlador, que no corrige nada. Se añadirá si llega uno con
  su propia gamma (el firmware propio, S2).

### 7. El controlador de la mesa, a 500.000 baudios

- **A 115.200 baudios, 20 fps.** Un frame de 173 LEDs son 525 bytes: 45 ms en el cable, que ocupan 3
  pulsos (D93). El *scroll*, que avanza un LED por frame, se veía a saltos de 3 LEDs.
- **A 500.000, 59 fps** medidos en la mesa: 11 ms por frame, que caben en un pulso.
- **Por qué 500.000:** es exacta para el Uno a 16 MHz. 230.400 se desvía un 3,5 %, demasiado para un
  clon con CH340. 1.000.000 no da más fps, porque el motor ya va a 60, y exige más al clon y al cable.
- **Solo cambia la documentación.** El motor ya admitía la velocidad (D94). La configuración de la mesa
  (`config/local.json`) no está en el repo y el sketch tampoco (D46): `HARDWARE_SETUP.md` §4.1 dice
  qué valores poner.

### 8. Un WAV de golpes limpios para calibrar la tira

- **`config/audio/calibracion.wav`:** 9 s en bucle, mono, PCM de 16 bits a 44,1 kHz. Un golpe de
  30 ms (un seno con ventana de Hann) en los segundos 1, 4 y 7, a 400 Hz, 2 kHz y 8 kHz. Con *scroll*,
  cada uno es un pulso de un solo color (rojo, verde y azul) que nace en el centro.
- **Entre golpes, ruido de ±1 LSB y no silencio digital.** Para un fichero, el motor solo cuenta como
  silencio el digital, y en silencio *scroll* apaga la tira y congela el rastro. Con el ruido, el
  pulso recorre la tira entera y el fondo queda en negro.
- **El generador** va junto al de golpes (`packages/engine/test/fixtures/`), con su script de pnpm.
  Es determinista (semilla fija), como el de golpes.
- **Sin test**, decidido con el DJ: es una herramienta para mirar la tira, no un requisito.

## Risks / Trade-offs

- **[Con menos fps, el scroll se frena]**: es la consecuencia de la decisión 2. La mesa va a 60 fps,
  pero si Adalight no da para 60 fps con 300 LEDs (A2, sin comprobar), habrá que bajarlos. →
  Mitigación: está escrito en el spec (*A 30 fps, la mitad de deprisa*), y la historia de velocidad y
  estela lo resuelve.
- **[Con música continua, el scroll puede verse casi blanco]**: cada banda se mide frente a su propio
  nivel reciente, así que, con un tema que suena parejo, los tres colores tienden a estar altos a la
  vez. Es lo que hacía la v1, y es lo que el DJ quiere ver antes de decidir. → Mitigación: ninguna en
  este change. Si molesta, irá a la historia de los controles (sensibilidad, Q7).
- **[Un salto de frames del bucle se ve como un parón de un frame]**: un pulso es un paso. → Aceptado:
  el bucle va holgado en la Pi (0,46 ms por frame frente a 16,6 ms, D48).
- **[A 500.000 baudios, el Arduino va justo]** (`MOO-123`): mientras FastLED pinta los 173 LEDs
  (~5 ms) no recibe nada, y entre un frame y el siguiente quedan ~6 ms. Si un frame llega antes,
  se pierde y se ve un tirón suelto. → Mitigación: no se ha visto en la mesa. Si aparece, 1.000.000
  baudios dejan ~11 ms.
