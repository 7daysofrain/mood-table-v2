# Design

> Decisiones tomadas en la exploración del 19-oct con el usuario (`/opsx:explore`, tras refinar
> `MOO-22`). Por tarea: `MOO-56` (engine) 2, 6 y 9 · `MOO-57` (panel) 1, 3, 4, 5, 7 y 8. La 2 la
> empieza `MOO-56` (el motor envía) y la acaba `MOO-57` (el panel la usa). Los detalles marcados
> *(asumido)* se propusieron por defecto al cerrar la exploración y se revisan con este change.

## Context

- **La posición del fichero ya es una cuenta.** `MemoryAudioSource.read(time, out)` lee la ventana que
  acaba en la muestra `round(time × frecuencia) mod longitud`, y el bucle le pasa `time = seq / fps`
  desde el arranque (D50). Cada frame ya corresponde a un punto exacto del fichero, pero nadie lo dice
  fuera del motor.
- **El panel no conoce los `fps`** y hoy ignora el `seq` de los frames y del nivel
  (`packages/panel/src/engine/connection.ts`): pinta el último frame que llega en cada
  `requestAnimationFrame`.
- **El protocolo del visor admite tipos nuevos** (D45, D51): el panel descarta lo que no entiende.
- **El fichero de la demo pesa 16,5 MB** (`bouncer.wav`: WAV PCM de 16 bits, estéreo, 44,1 kHz,
  93,8 s), y el de los tests (`golpes.wav`), unos 350 KB y 4 s.
- **La pausa del bucle de la demo sin paneles** (README §2.4) no está implementada.

Motivación y alcance: `proposal.md`. Requisitos: `specs/audio-playback/spec.md`.

## Goals / Non-Goals

**Goals:**

- Que lo que se oye y lo que se ve vayan a la par también en la demo pública, con retraso de red, no
  solo en local.
- Que la lógica de sincronía se pueda testear sin navegador ni reloj: una función pura de las
  posiciones recibidas y del reloj de audio.
- Que el panel no copie ninguna regla del motor: si mañana cambia cómo avanza el fichero (la pausa de la
  demo, H5), el panel no se toca.

**Non-Goals:**

- **Compensar retrasos que el navegador no declara** (proposal, *Non-goals*).
- **Ajustar la velocidad de reproducción** para absorber la deriva sin saltos (D2 de la exploración):
  queda abierta si el salto de la decisión 4 se nota.
- **Comprimir el fichero** para que la demo descargue menos: el WAV se sirve tal cual.

## Decisions

### 1. Se sincroniza contra lo que muestra el visor, no contra el reloj del motor

El panel hace sonar **el punto del fichero del último frame que ha recibido**, no el punto por el que
va el motor ahora mismo:

```
  MOTOR                       RED              PANEL
  pulso seq
  audio[seq/fps] --> frame ---(latencia)--->   llega el frame --> rAF --> LUZ
                --> posición ---(misma)--->    llega la posición
                                               |
                                               v
                                               reproductor --> outputLatency --> SONIDO
```

La luz y la referencia del sonido llegan por la misma conexión y con el mismo retraso, así que **la
latencia de la red se cancela**: en local es ~1 ms, pero en la demo pública serían 20-100 ms, y con la
referencia en el motor la luz iría por detrás del sonido por encima de los 45 ms de E2. Lo que queda
por compensar es local: el retraso de salida de audio (decisión 5) y el del pintado (0-17 ms, que no se
compensa porque va en el sentido que se tolera hasta 45 ms).

Consecuencia: **sin conexión no hay referencia**, así que al perderla el panel deja de sonar
*(asumido)*, y al volver no suena solo, porque el navegador exige otro gesto.

**Alternativa descartada:** seguir el reloj del motor (el panel estima "el motor va por X" y reproduce
X). Es más complejo (hay que estimar la latencia de la red) y peor en la demo.

→ **Proponer como D53** en `docs/idea-mood-table.md`, junto con la decisión 2.

### 2. El motor dice la posición del fichero en cada pulso (mensaje tipo `4`)

Un mensaje nuevo del protocolo del visor, con el patrón del nivel (tipo `3`):

```
byte:  0      1  2  3  4      5 ... 12
      +----+-------------+------------------+
      | 4  |  seq (u32)  | posición (f64)   |   13 bytes, big-endian
      +----+-------------+------------------+
```

- **La posición** es el punto del fichero, en segundos desde su principio, en el que acaba la ventana
  que ha analizado el motor en ese pulso. Va de 0 a la duración del fichero y vuelve a 0 con el bucle.
- **`float64`** para que un fichero largo no pierda precisión (con `float32`, a una hora la resolución
  bajaría a ~0,25 ms; con 13 bytes por pulso, unos 780 B/s, el coste no importa).
- **Solo con un fichero como fuente**: sin fuente, o con la tarjeta de sonido (`MOO-15`), no se envía.
- **El mismo `seq` que los frames**, para que el panel sepa a qué frame corresponde.

**Alternativa descartada:** enviar los `fps` en el mensaje de fuente y que el panel calcule
`seq / fps mod duración`. Copia en el panel la regla con la que el motor recorre el fichero: si el
motor la cambia (la pausa de la demo), el panel se desincroniza en silencio. El usuario quiere una
única fuente de verdad en el protocolo.

→ **Proponer como D53**, con la decisión 1. Amplía D45 y D51.

### 3. El panel reproduce con Web Audio, con el fichero entero en memoria

El panel descarga el fichero (`/audio`, decisión 6), lo decodifica con `decodeAudioData` y lo
reproduce con un `AudioBufferSourceNode` en bucle (`loop = true`), arrancado en el punto exacto con
`start(cuando, desde)`.

- **Precisión:** el salto al punto del motor es exacto, a la muestra, y el bucle no tiene costura,
  igual que el `mod longitud` del motor. Dos escenarios de la historia dependen de ello (*oye el punto
  al que reacciona la tira* y *el bucle*).
- **El reloj de audio** (`AudioContext.currentTime`) es el del hardware de salida, y
  `getOutputTimestamp()` lo relaciona con `performance.now()`, el reloj con el que el panel marca la
  llegada de cada posición.
- **Dejar de oír** para y suelta el nodo; **volver a oír** crea uno nuevo en el punto del momento (un
  `AudioBufferSourceNode` solo se puede arrancar una vez). Es la misma operación que corrige la deriva
  (decisión 4).
- **El buffer se guarda** mientras dure la conexión: volver a oír no vuelve a descargar. Se suelta al
  perderla (el motor puede volver con otro fichero).
- **Mientras se descarga y decodifica**, el control indica que está preparando el audio *(asumido)*.
  En local es inmediato; en la demo, unos segundos.

**Alternativa descartada:** `<audio loop>`. Empieza a sonar antes (descarga por partes), pero el
salto con `currentTime` es aproximado y distinto en cada navegador, el bucle puede tener un pequeño
hueco y no da el retraso de salida. El motivo de la elección es la precisión, no que la API sea más
moderna: las dos son estándar.

→ **Proponer como D54** en `docs/idea-mood-table.md`, junto con la decisión 4.

### 4. La deriva se corrige con un salto cuando el error pasa de 20 ms

El reloj de audio del navegador y el del motor se separan unas decenas de partes por millón (~3 ms por
minuto). El panel mide el **error** entre el punto que suena y el del visor y, cuando su valor absoluto
pasa de **20 ms**, para el nodo y arranca otro en el punto correcto:

```
error = punto que suena - punto del visor        (circular, filtrado)

  +20 ms - - - - - - - - - - - - - - - - -/- - - umbral
                                       /
                                  /           ~3 ms/min
     0 -----------------------/------------------------> tiempo
         ^                                  ^
         oír: arranca en el punto exacto    salto: arranca otro nodo
```

- **Circular:** con un fichero de duración `D`, el error es la diferencia más corta en el círculo
  (93,7 s frente a 0,1 s es +0,2 s, no −93,6 s). Sin esto, el panel saltaría en cada vuelta del bucle.
- **Filtrado:** las posiciones llegan con *jitter* de red (despreciable en local, 5-30 ms en la demo).
  El visor pinta lo que llega y tiembla con él, pero el sonido no puede: se oirían saltos. La
  referencia es la **mediana** de las estimaciones de la última ventana (~1 s de mensajes), en
  aritmética circular.
- **20 ms** deja margen dentro de los 45 ms para el pintado (hasta 17 ms), y con ~3 ms/min de deriva
  salta como mucho cada 6-7 minutos: un saltito de unos ms en música con bombo apenas se nota.
- **La comprobación** se hace unas pocas veces por segundo, no en cada mensaje; el valor exacto se fija
  al implementar.

**Alternativas descartadas:** ajustar `playbackRate` (±0,1 %, inaudible) hasta absorber el error, que
evita el salto pero es un controlador más que probar; y programar cada vuelta del fichero como un nodo
nuevo, que exige precisión en cada costura. El usuario prefiere la simplicidad; si el salto se nota, se
pasa a `playbackRate` reutilizando el mismo error filtrado.

→ **Proponer como D54**, con la decisión 3.

### 5. Se compensa el retraso de salida que declara el navegador, y solo ese

Lo que el panel programa ahora suena dentro de `outputLatency` (+ `baseLatency`): el punto de arranque
y el error de la decisión 4 lo tienen en cuenta, así que el maker oye en cada instante el punto que
muestra el visor. La tolerancia de la spec (luz como mucho 45 ms por detrás y 125 ms por delante)
sale de `docs/umbrales-para-specs.md` y de ITU-R BT.1359.

Si el navegador no conoce el retraso real del dispositivo (algunos auriculares Bluetooth, 150-250 ms),
la luz irá adelantada: queda fuera (proposal, *Non-goals*). Si `outputLatency` no existe en el
navegador, se toma 0.

→ **Proponer como D55** en `docs/idea-mood-table.md`.

### 6. El motor sirve el fichero en `/audio` *(asumido)*

- `GET /audio` devuelve el fichero de la configuración tal cual, con `Content-Type: audio/wav`. Sin
  fichero como fuente, 404.
- La dirección es fija y no lleva el nombre ni la ruta: el nombre ya llega en el mensaje de fuente, y
  la ruta en disco no sale del motor (D51).
- Lo sirve el adaptador del servidor (`packages/engine/src/adapters/server.ts`); `main.ts` le pasa la
  ruta ya resuelta, igual que hoy le pasa la fuente.
- Sin rangos ni caché especial: Web Audio lo pide entero, una vez por conexión (decisión 3).

### 7. El control de oír va en la cabecera, junto a la fuente *(asumido)*

El control es parte de la fuente de audio, así que va a su lado, en la cabecera (README §1.3), y solo
existe cuando la fuente es un fichero. Es un botón con tres estados:

| Estado | Muestra | Al pulsarlo |
|---|---|---|
| Callado | Icono de *play*, nombre accesible «Oír el fichero de audio» | Prepara el audio (si hace falta) y suena |
| Preparando | Indicador de carga, «Preparando el audio» | Nada |
| Sonando | Icono de *pause*, «Dejar de oír el fichero de audio» | Deja de sonar |

La zona *Controles* no sirve: es la de los parámetros del efecto de la tira seleccionada (H2).

### 8. La sincronía es un módulo puro del panel, y el E2E lee su estado

```
packages/panel/src/audio/
  sync.ts         puro: posiciones recibidas + reloj de audio -> punto de arranque, error, ¿saltar?
  player.ts       Web Audio: descargar, decodificar, sonar en un punto, parar
  AudioControl.tsx el botón de la decisión 7
```

- **`sync.ts`** no toca el navegador: recibe las posiciones con su instante de llegada, la duración del
  fichero, el reloj de audio y la latencia declarada, y devuelve el punto en que arrancar, el error
  circular filtrado y si toca saltar. Se prueba con Vitest a mano, sin temporizadores (filtro del
  *jitter*, error circular en el bucle, umbral, compensación de latencia).
- **La conexión** (`engine/connection.ts`) decodifica el mensaje tipo `4` y avisa a quien escuche de
  cada posición con su instante de llegada (`performance.now()`), en lugar de guardar solo la última:
  el filtro necesita la serie.
- **El E2E no puede oír**, así que el panel expone, de solo lectura, el error de sincronía estimado y el
  estado del reproductor *(asumido)*: un objeto en `window` que el test lee con `page.evaluate`. Es una
  concesión a la testabilidad; la alternativa, no probar la sincronía en el E2E, deja la integración
  real sin probar.
- **El fichero de los E2E** es `golpes.wav` (4 s): varias vueltas del bucle en unos 10 s, sin fichero
  nuevo.
- **El juicio a oído** (*al ritmo de lo que oye*) lo hace el usuario con `bouncer.wav`, como último
  paso de `MOO-57`.

### 9. La posición la calcula la fuente de fichero, y el bucle la entrega a un puerto

- El puerto `AudioSource` gana un método opcional, `positionAt(time)`: el punto del fichero, en
  segundos, en el que acaba la ventana de `read(time, …)`. La fuente de fichero lo implementa con la
  misma cuenta que `read`; la tarjeta de sonido (`MOO-15`) no lo tendrá. Así la regla de recorrido del
  fichero vive en un solo sitio.
- El bucle, si la fuente tiene `positionAt`, la entrega en cada pulso a un puerto `PositionOutput`
  (como `LevelOutput`, síncrono y sin crear objetos), y el servidor la envía con el mensaje tipo `4`.
- El núcleo no importa adaptadores: el puerto vive en `core/frame-loop.ts` y la salida que envía por
  WebSocket, en `adapters/server.ts`, conectada en `main.ts`.

### 10. Reparto entre las tareas

- **`MOO-56` · engine**: el mensaje tipo `4` en `packages/shared` (codificar, decodificar,
  `viewer-protocol.md`), `positionAt` y el puerto en el núcleo, el envío en el servidor y la ruta
  `/audio`. Como en `MOO-20`, el mensaje del protocolo va con quien lo envía.
- **`MOO-57` · panel**: la conexión decodifica la posición, `sync.ts`, el reproductor, el control y
  los E2E de los escenarios de la historia.

`MOO-57` parte de `MOO-56` ya integrada.

## Risks / Trade-offs

- **[Chromium sin pantalla no avanza el reloj de Web Audio sin dispositivo de salida]** → Es lo primero
  que comprueba `MOO-57`, antes de construir nada encima. Si fallara, el E2E de sincronía se ejecuta
  con el navegador con pantalla (`xvfb` en la CI) o se reduce a lo que se pueda comprobar sin reloj.
- **[16,5 MB antes de sonar en la demo]** → El control indica que está preparando (decisión 7).
  Comprimir el fichero queda fuera (*Non-Goals*).
- **[El salto de la corrección se oye]** → Cada 6-7 minutos como mucho y de unos ms. Si molesta, se
  pasa a `playbackRate` (decisión 4), sin cambiar la spec.
- **[`outputLatency` miente o no existe]** → Se toma 0 si no existe; el Bluetooth no declarado queda
  fuera (decisión 5).
- **[El objeto de solo lectura en `window` queda en producción]** → Solo lee estado ya calculado; no
  permite controlar nada. Aceptado por testabilidad (decisión 8).
- **[El *jitter* de la demo pasa de lo que absorbe la mediana de 1 s]** → Se ajusta la ventana al
  implementar; no cambia la spec.

## Migration Plan

Sin migración: el fichero de configuración no cambia, y un panel antiguo ignora el mensaje tipo `4`.
`MOO-56` se puede integrar sola: el motor envía la posición y sirve `/audio`, y el panel aún no los usa.

## Open Questions

- Cada cuánto se comprueba el error (decisión 4) y el tamaño exacto de la ventana del filtro: se fijan
  al implementar, con los tests de `sync.ts`.
