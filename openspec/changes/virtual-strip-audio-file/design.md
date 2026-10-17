# Design

> Decisiones tomadas en la exploración del 17-oct con el usuario (`/opsx:explore MOO-14`). Por tarea:
> `MOO-19` (fichero WAV) 3, 7, 8, 10, 12 y 13 · `MOO-20` (análisis y *energía*) 1, 2, 4, 6, 9 y 11 ·
> `MOO-21` (panel) 5 y 14. La 5 la empieza `MOO-20` (el motor envía) y la acaba `MOO-21` (el panel
> muestra).

## Context

El motor de `MOO-13` ya tiene lo que esta historia necesita: el bucle es una función pura del instante
(`tick(now)`, decisión 7 de `virtual-strip-breathing`), el contrato `Effect` lleva `usesAudio` y
`FrameContext.audio` (hoy siempre `null`), y el WebSocket del visor ya admite otros tipos de mensaje
(D45). El fichero de configuración se valida con TypeBox en `packages/shared` y rechaza los campos que
no declara.

El spike `MOO-12` midió unos 0,46 ms por frame en la Pi con dos tiras de 300 LEDs, análisis incluido
(D48), y validó `fft.js`. Su prototipo (commit `9d0005a`) sirve de referencia de coste, **no** de
efecto: su *energía* era una aproximación que no se porta.

Motivación y alcance: `proposal.md`.

## Goals / Non-Goals

**Goals:**

- Que *energía* se vea como en la v1: la referencia es el efecto `energy` de dancyPi
  (`naztronaut/dancyPi-audio-reactive-led`, `python/visualization.py`), que la mesa usó de 2021 a 2024.
- Que todo lo que depende del audio se pueda testear sin temporizadores ni esperas: mismo audio y
  mismos pulsos, mismos frames.
- Que `MOO-15` (tarjeta de sonido) solo tenga que añadir un adaptador y su tipo en la configuración, y
  `MOO-22` (oír el fichero en el panel) pueda saber por dónde va el fichero.

**Non-Goals:**

- **Rendimiento:** no se optimiza nada más allá de no crear objetos en el bucle. Si el motor real rinde
  peor que el prototipo, se compara con las cifras del spike (`docs/spikes/moo-12-rendimiento-pi.md`).
- **El ruido de fondo de una tarjeta de sonido** en silencio: la puerta de silencio de la decisión 1
  solo reconoce el silencio digital. Lo resuelve `MOO-15`.
- **Qué pasa si una tira cambia a un efecto reactivo en caliente sin fuente de audio:** es H2. La regla
  del silencio del núcleo (se apaga) ya lo cubre si llega a pasar.

## Decisions

### 1. *Energía* es la `energy` de la v1, portada tal cual

Se porta el algoritmo de dancyPi, con sus constantes:

```
 ventana de audio (~40 ms) --> Hamming --> FFT --> 24 bandas mel, de 200 Hz a 12 kHz
     --> al cuadrado --> ganancia automatica comun --> suavizado
     --> energia (por tira):
           ganancia automatica por banda (sube al instante, baja muy despacio)
           graves = 1/3 inferior de las bandas --> ROJO  } cada color se enciende desde el centro
           medios = 1/3 central                --> VERDE } hasta (media de su tercio ^ 0,9) x
           agudos = 1/3 superior               --> AZUL  } (mitad de la tira - 1) LEDs
           suavizado de los LEDs (sube 0,99, baja 0,1 por frame a 50 fps)
           desenfoque gaussiano, sigma 4 LEDs, en cada color
           espejo: la mitad calculada se refleja para llenar la tira
```

- **Sin detector de golpes.** Cada golpe se marca solo: la luz sube casi al instante y baja en unos
  0,2-0,4 s. Ningún efecto del MVP necesita un rasgo de golpe aparte (*espectro* y *scroll* de la v1
  tampoco lo usan), así que el análisis no lo calcula. README §2.2 y el ticket `MOO-20` del §6 se
  corrigen.
- **Puerta de silencio** como la de la v1: si la ventana entera está por debajo de 1e-7 en valor
  absoluto (silencio digital), la tira se apaga y sus filtros no se actualizan.
- **Sin parámetros:** la v1 no tenía ninguno. Su esquema es un objeto vacío, y la sensibilidad llega
  con H2.
- **El corte en 200 Hz se queda**, aunque deja fuera la fundamental del bombo: lo eligió el usuario
  («tal cual»). Si en la mesa el bombo no se nota, se vuelve a hablar.
- El desenfoque va en LEDs, no proporcional a la longitud: la densidad de LEDs es física, así que en
  una tira del mismo tipo se ve igual sea cual sea su longitud.
- Las constantes que no se leyeron en la exploración (los suavizados del análisis común) se comprueban
  en el código de la v1 al portarlo, y los frames dorados las congelan.

**Alternativa descartada:** la *energía* del prototipo del spike (energía total, destello en cada golpe
y ámbar). Era una aproximación para medir coste, no un efecto con historia, y D20 pide los de la v1.

→ **Proponer como D49** en `docs/idea-mood-table.md`, junto con la decisión 2.

### 2. Los suavizados se calculan con `dt`, calibrados a 50 fps

La v1 suaviza con factores por frame a 50 fps. Aquí `fps` va de 1 a 60, así que cada factor `α` se
convierte para el `dt` del pulso: `α(dt) = 1 − (1 − α)^(dt × 50)`. A 50 fps da exactamente el de la
v1, y a cualquier otro ritmo la luz sube y baja igual de deprisa en segundos.

**Alternativa descartada:** los factores tal cual, por frame. *Energía* se vería distinta según el
`fps` del fichero (a 30 fps, la caída tardaría casi el doble que a 60).

### 3. `AudioSource` es *pull*: el ritmo lo marca el motor

El puerto, en el núcleo:

```ts
interface AudioSource {
  /** Frecuencia de muestreo de lo que entrega, en Hz. */
  sampleRate: number;
  /**
   * Escribe en `out` las últimas `out.length` muestras (mono, de -1 a 1) que acaban en `time`,
   * los segundos del pulso desde el arranque. No crea objetos.
   */
  read(time: number, out: Float32Array): void;
}
```

- **El bucle pide; la fuente responde.** En cada pulso, el bucle lee la ventana que acaba en el
  instante del pulso (`tick.time`), el mismo que ya usa la *respiración*.
- **Fichero:** el adaptador lee y decodifica el WAV entero al arrancar (mono, `Float32Array`). La
  posición es `round(time × sampleRate) mod longitud`, así que el bucle del fichero sale del `mod`, y
  una ventana que cruza el final lee el final y el principio. Después de arrancar no hay E/S.
- **Tarjeta (`MOO-15`):** su adaptador guarda el búfer circular que llena `arecord` y devuelve las
  últimas muestras sin mirar `time`. El búfer circular pasa del núcleo (README §2.2) a ese adaptador.
- **Tests sin temporizadores:** una fuente en memoria (un tono, el fichero de golpes) y los instantes
  pasados a mano dan siempre los mismos frames.
- **`MOO-22` queda preparado:** el motor sabe en todo momento por dónde va el fichero (`time mod
  duración`).
- Si un día el bucle se pausa sin paneles (despliegue de la demo), al volver el fichero estará más
  adelante, como una radio. Para un instrumento en vivo es lo esperado.

**Alternativa descartada:** *push* (la fuente empuja bloques a un búfer del núcleo, como describe hoy
README §2.2). El fichero necesitaría un temporizador propio que deriva respecto al del bucle, y los
tests, dos relojes falsos coordinados.

→ **Proponer como D50** en `docs/idea-mood-table.md`, con la frase del usuario: *el ritmo lo marca el
motor*. Impacto: README §2.1 (fila de `AudioSource`) y §2.2 (*Análisis de audio*).

### 4. El nivel es la señal sin ajustar y se mide siempre que haya fuente

- **Qué mide:** el RMS de la ventana del pulso, de 0 a 1, antes de cualquier ganancia. Dice cuánta
  señal entra. El normalizado estaría casi siempre «a tope», que es lo que hace la ganancia automática,
  y en `MOO-15` el nivel sin ajustar es lo que dice si la tarjeta recibe poco o satura.
- **Cuándo:** el nivel, en cada pulso mientras haya fuente, aunque ninguna tira use audio (cuesta casi
  nada: un recorrido de unas 2 000 muestras). La FFT y las bandas, solo si alguna tira tiene un efecto
  con `usesAudio`, como pide README §2.2.

```
 hay fuente?
   no --> ni nivel ni analisis
   si --> leer la ventana del pulso --> nivel (RMS) ............ siempre
          alguna tira con usesAudio?
            si --> FFT + bandas mel --> FrameContext.audio
            no --> FrameContext.audio = null
```

- `FrameContext.audio` lleva las 24 bandas ya normalizadas y si la ventana es silencio. Un efecto de
  ambiente no lo mira.

**Alternativa descartada:** nivel solo con la FFT. Con fuente y solo *respiración*, el panel mostraría
la fuente con el vúmetro quieto, que parece una avería.

### 5. Fuente y nivel viajan por el WebSocket del visor, como mensajes del protocolo

Por la misma conexión que los frames (D45), dos tipos nuevos:

| Tipo | Cuándo | Contenido |
|---|---|---|
| `2` · fuente | Al conectarse cada panel | Clase de fuente en 1 byte (`0` sin fuente, `1` fichero) y, si es un fichero, su nombre en UTF-8, **sin la ruta** |
| `3` · nivel | En cada pulso, solo si hay fuente | `seq` del pulso (4 bytes, big-endian, como el frame) y el nivel (`float32`, big-endian, de 0 a 1) |

- **La fuente, al conectar:** no cambia mientras el motor corre (cambiarla en caliente es un
  non-goal). Si el motor se reinicia con otro fichero, el panel reconecta y la recibe sola.
- **Sin fuente también se avisa** (clase `0`): así la cabecera puede decir «Sin fuente de audio» en vez
  de quedarse sin saber.
- **El nivel, con su `seq`:** sin otro temporizador (el ritmo lo marca el motor). Son 9 bytes por
  pulso frente a los 906 de un frame de 300 LEDs. El `seq` le servirá a `MOO-22`.
- **Nunca la ruta del fichero:** en la demo pública, la ruta del disco de la instancia no tiene por qué
  verse.
- **El documento sigue siendo `docs/instructions/viewer-protocol.md`:** la conexión es la del visor. Se
  añaden los dos mensajes, la regla de qué hace el panel con un tipo que no conoce (lo ignora, como
  ahora) y se actualiza su fila en el índice de `AGENTS.md`.
- **En el motor:** `main.ts` pasa al servidor la fuente (clase y nombre) al arrancarlo, y el servidor
  la envía en cada conexión. El nivel sale del bucle por un puerto de salida como `LightOutput`, pero
  de un número por pulso (`LevelOutput.write(level, tick)`), y el servidor da una que lo envía a todos
  los paneles.

**Alternativa descartada:** la fuente por un endpoint HTTP, como primer endpoint del OpenAPI. README
§2.1 ya reparte los canales («HTTP para comandos, WebSocket para frames y estado»), y la fuente es
estado. La plantilla del §4 admite como mucho tres endpoints, que enseñan mejor la API con tiras,
efectos y cambios. Y por HTTP, el panel tendría que volver a pedirla en cada reconexión.

→ **Proponer como D51** en `docs/idea-mood-table.md`: amplía D45.

### 6. Una tira reactiva sin fuente de audio es un error de configuración

Al arrancar, una tira con un efecto reactivo y sin `audioSource` solo puede ser un olvido. El motor no
arranca y lo dice (`specs/engine-config`). Si se dejara arrancar con la tira apagada, se escondería el
error.

- **Dónde se valida:** en `parseConfig` (`packages/shared`), que ya hace las comprobaciones entre
  campos (el `id` repetido). Necesita saber qué efectos son reactivos: lo da el catálogo de la
  decisión 10.
- **En caliente es otra cosa (H2):** si el DJ elige *energía* sin fuente, rige la regla del silencio
  (se apaga), o el panel no ofrece los reactivos. Lo decide H2.
- **Nota para H5:** la reconciliación puede restaurar *energía* en una tira de una instalación que
  después quitó su fuente de audio. El fichero es válido, pero el estado no. Lo resuelve la spec de H5.

**Alternativa descartada:** arrancar con la tira apagada y un aviso en el log, por tener una sola regla
para el arranque y para el cambio en caliente. Es la que proponía el agente. El usuario la descartó:
el fichero lo escribe una persona y un error suyo se dice, no se esconde.

### 7. Solo WAV PCM de 16 bits

- Se acepta `WAVE_FORMAT_PCM` (y `WAVE_FORMAT_EXTENSIBLE` con subformato PCM, que algunos editores
  escriben para el mismo contenido) de 16 bits, con 1 o 2 canales y cualquier frecuencia de muestreo.
  El estéreo se mezcla a mono con la media de los dos canales. Los bloques que no son `fmt ` ni
  `data` (por ejemplo, `LIST`) se saltan.
- Con cualquier otro fichero, el motor no arranca: «formato no válido» y lo que acepta. **Sin**
  explicar cómo convertirlo: decisión del usuario.
- La decodificación es una función pura (bytes → muestras mono y frecuencia), testeada sin disco. La
  lectura del fichero va aparte, en el adaptador.
- La ventana de la FFT y el banco mel se calculan para la frecuencia del fichero (decisión 11).

**Alternativa descartada:** aceptar también 24 bits y `float32`. Son pocas líneas, pero también
formatos que testear y casos raros de cabecera, y los dos ficheros que importan (la demo y el de los
tests) son nuestros. Se puede ampliar sin romper nada.

### 8. Todas las rutas relativas se resuelven desde la raíz del repositorio

- `audioSource.path` es absoluta o relativa a la raíz del repositorio, como se busca hoy
  `config/local.json` (D44). No es relativa al fichero de configuración.
- **`MOODTABLE_CONFIG` también:** hoy se resuelve desde el directorio de trabajo
  (`resolve(override)` en `config-file.ts`), y pasa a resolverse desde la raíz. Los E2E le pasan
  rutas absolutas, así que no cambian.
- El mensaje de un fichero que no existe da la ruta ya resuelta, para que se vea dónde lo buscó.

**Alternativa descartada:** relativa al fichero de configuración, la convención de `tsconfig` o ESLint,
que propuso el agente. El usuario prefirió una sola regla para todo el repositorio.

→ **Matiz de D44**, sin D# propia.

### 9. La demo suena con *Bouncer*, un loop CC0

- **Tema:** *Bouncer*, de Of Far Different Nature, CC0
  ([OpenGameArt](https://opengameart.org/node/107501)). Electro con un beat muy marcado, elegido por el
  usuario frente a *Access* (dub techno de cinameng, golpes más suaves) y a un loop solo de batería
  (sin medios, el verde de *energía* apenas saldría).
- **Formato:** un loop de 30-60 s (16 o 32 compases) que enlace bien el final con el principio, PCM de
  16 bits, mono, 44,1 kHz. Son 2,6-5 MB en git, sin LFS. Lo corta el usuario, que es quien oye si el
  enlace es limpio, o el agente con `ffmpeg` en los compases que el usuario diga.
- **Dónde:** `config/audio/bouncer.wav`, con `config/audio/README.md`: autor, enlace, licencia y qué
  tramo se cortó. CC0 no lo exige, pero así queda trazado.
- **La versión en loop de *Loop Box #4*:** si se usa en lugar del WAV original, hay que comprobar su
  licencia al descargarla. El autor publica temas CC0 y CC-BY en las mismas colecciones.
- **Descargarlo pide permiso al usuario** (fichero, origen y tamaño).

**Alternativas descartadas:** un loop propio del usuario (no le encajaba ahora), un tema CC-BY
(arrastra atribución) y uno sintético (con `MOO-22` se oirá, y sonaría a pitidos).

### 10. `effect` es obligatorio y se valida contra un catálogo en `shared`

- **Obligatorio en cada tira**, con el id en inglés (`breathing`, `energy`), como el resto de campos
  del fichero y como `effect_id` en el modelo de datos (README §3). El glosario del PRD hace de puente
  con los nombres en español.
- **Sin compatibilidad hacia atrás:** no hay instalaciones fuera de la máquina del desarrollo, y un
  campo obligatorio deja cada tira explícita. El `config/local.json` de esa máquina se actualiza como
  paso de las tareas (decisión 13).
- **Sin parámetros en el fichero:** los valores son del DJ y se guardan (H2, H5).
- **Catálogo en `packages/shared`:** la lista de efectos con su id y si usan audio. La usan
  `parseConfig` (validar el id y la decisión 6) y, con H2, el panel (etiquetar reactivo o ambiente).
  El render sigue en el motor, que tiene un registro de efectos por id. Un test del motor comprueba que
  el registro y el catálogo tienen los mismos ids y el mismo `usesAudio`.
- **El esquema de `effect`** es una unión de literales generada del catálogo. El mensaje de un id
  desconocido lista los válidos.

**Alternativa descartada:** `effect` opcional con *respiración* por defecto, para que los ficheros
existentes sigan valiendo. Lo propuso el agente; el usuario no quiere restricciones de compatibilidad
en pleno desarrollo.

→ **Proponer como D52** en `docs/idea-mood-table.md`.

### 11. El análisis vive en el núcleo y se calcula una vez por pulso

- **Dónde:** `packages/engine/src/core/audio/` (el puerto `AudioSource` y el análisis). `fft.js` es una
  librería pura, sin E/S, así que el núcleo puede importarla; la regla de fronteras solo prohíbe los
  adaptadores.
- **Ventana:** unos 40 ms de audio, como la v1 (2 bloques de 960 muestras a 48 kHz), fijados en
  segundos y no en muestras: `round(0,04 × frecuencia)` muestras, rellenadas con ceros hasta la
  siguiente potencia de 2 (2 048 a 44,1 y a 48 kHz).
- **Una vez por pulso, compartido:** el bucle pide la ventana, calcula el nivel y, si hace falta, las
  bandas, y pasa lo mismo a todas las tiras en `FrameContext.audio`.
- **Sin crear objetos en el bucle:** la ventana, los arrays de `fft.js` y las bandas se reservan al
  arrancar.
- **El banco de filtros mel** se calcula al arrancar para la frecuencia de la fuente.

### 12. `audioSource` se discrimina por `type`, como `output`

```json
{
  "audioSource": { "type": "file", "path": "config/audio/bouncer.wav" },
  "strips": [
    { "id": "demo", "name": "Tira de prueba", "output": { "type": "virtual" },
      "ledCount": 60, "effect": "energy" }
  ]
}
```

En este change solo existe `file`, y `MOO-15` añade la tarjeta. Se cierra a campos no declarados, como
el resto del fichero.

### 13. Reparto entre las tareas y el `config/local.json` del desarrollo

| Tarea | Lleva |
|---|---|
| `MOO-19` · engine | Catálogo de efectos en `shared` (solo `breathing`); `effect` obligatorio; `audioSource` (`file`); rutas desde la raíz, también `MOODTABLE_CONFIG`; puerto `AudioSource`; decodificador WAV y fuente de fichero en bucle; fichero de golpes de los tests y su script; el bucle usa el efecto de cada tira |
| `MOO-20` · engine | `fft.js`; análisis (nivel y bandas); *energía* en el catálogo y en el registro; regla de la decisión 6; mensajes de fuente y de nivel (`shared`, documento del protocolo y envío desde el motor); demo con *Bouncer* y *energía*; glosario del PRD |
| `MOO-21` · panel | Decodificar los mensajes nuevos; fuente y nivel en la cabecera; E2E de la historia |

- **En `MOO-19` la regla de la decisión 6 no tiene caso real** (no hay efectos reactivos). Se escribe en
  `MOO-20`, con *energía*, para no dejar código que nadie ejerce.
- **El audio de la demo va en `MOO-20`:** en `MOO-19` la fuente funciona, pero nada la escucha
  (*respiración* ignora el audio). *Bouncer* llega cuando se ve.
- **`config/local.json`** (no versionado): `MOO-19` le añade `"effect": "breathing"` en el mismo paso
  en que el campo pasa a ser obligatorio, y `MOO-20` lo cambia a *energía* con la fuente de la demo. No
  produce commit: el `tasks.md` lo dice y la PR lo avisa, para quien tenga otro `local.json`.
- `MOO-20` es la tarea más grande (era el «ticket adicional» del §6 y el motivo del 8). Pasar el
  protocolo a `MOO-21` la aligeraría, pero mezclaría `engine` y `panel` en una PR.

### 14. La cabecera: la fuente a la izquierda de la conexión, con su vúmetro

```
+-----------------------------------------------------------------------------+
| Mood Table                    [Fichero: bouncer.wav  |######----| ]  (*) Conectado |
+-----------------------------------------------------------------------------+
  sin fuente:                   [Sin fuente de audio]                (*) Conectado
  sin conexion:                                                      ( ) Sin conexion con el motor
```

- **El texto:** «Fichero: bouncer.wav» o «Sin fuente de audio». Sin conexión, la cabecera no muestra
  fuente ni nivel: no se sabe cuál es.
- **El vúmetro:** una barra horizontal con nombre accesible «Nivel de la fuente de audio» (para los
  tests y los lectores de pantalla). Escala en decibelios, de −60 dB (vacía) a 0 dB (llena), que es
  como se lee un nivel. El −60 es una elección visual, no una cifra de las specs.
- **Se pinta con el último nivel recibido**, en cada `requestAnimationFrame`, como el visor. No se
  guardan los intermedios.
- Componentes de Mantine (D40), sin librería nueva.

### 15. Los tests: fichero de golpes, tonos en memoria y frames dorados

- **Fichero de golpes aislados** (`packages/engine/test/fixtures/golpes.wav`): 4 s, mono, 16 bits,
  44,1 kHz, con un golpe corto en los segundos 1, 2 y 3 (ruido con caída rápida, unos 50 ms) y
  silencio digital entre ellos. Lo genera un script versionado y determinista (sin `Math.random` sin
  semilla), y el WAV también se versiona (unos 350 KB). Es el *fichero de golpes aislados incluido en
  el repo* de la historia.
- **Tonos de 400 Hz y 8 kHz** para los escenarios de rojo y azul: se generan en memoria en el propio
  test, con una fuente en memoria.
- **Frames dorados de *energía*:** una tira de 60 LEDs a 60 fps con el fichero de golpes, en instantes
  fijos (antes, durante y después de un golpe). Se guardan como los de la *respiración*.
- **E2E (`MOO-21`):** el motor arranca con el fichero de golpes y *energía* (`MOODTABLE_CONFIG`). Se
  comprueba que el visor cambia con los golpes, que la cabecera dice «Fichero: golpes.wav» y que el
  vúmetro se mueve. Los E2E de `MOO-13` declaran `"effect": "breathing"`.

## Risks / Trade-offs

- **[Los frames dorados de *energía* dependen de cálculos en coma flotante]** → Con la misma versión
  de Node y de `fft.js`, el resultado es el mismo en local y en la CI. Si un cambio de plataforma
  mueve un redondeo, se compara con una tolerancia de ±1 por canal en lugar de byte a byte.
- **[La ganancia automática amplifica el ruido de un *fade out*]** → Con el ruido que no es silencio
  digital, la v1 acaba encendiendo la tira. El loop de la demo se corta sin *fades*, y el fichero de
  los tests tiene silencio digital. El caso real (la tarjeta) es de `MOO-15`.
- **[El bombo no se nota por el corte en 200 Hz]** → Decisión del usuario («tal cual»). Si pasa en la
  mesa, se baja el corte: es una constante, no un cambio de diseño.
- **[Constantes de la v1 recordadas y no leídas]** → Las de *energía* se leyeron en la exploración; las
  del análisis común se comprueban en el código de la v1 al portarlo (decisión 1).
- **[`MOO-20` es grande]** → Asumido (decisión 13). Cada paso es un commit que deja los tests en verde.
- **[El motor real rinde peor que el prototipo]** → El análisis es parecido al del spike (FFT de 2 048
  y bandas). Si en la Pi se aleja de 0,5 ms por frame, se compara con el commit `9d0005a`.
- **[Un WAV de 2,6-5 MB en git]** → Aceptable para un fichero que no cambia. Si hiciera falta otro, se
  revisaría Git LFS.

## Migration Plan

- Cada fichero de configuración del repositorio declara `effect`: `config/demo.json`,
  `e2e/config.json` y el que escribe `e2e/engine.ts` (`MOO-19`).
- El `config/local.json` de la máquina del desarrollo se actualiza en `MOO-19` y en `MOO-20`
  (decisión 13). Otra persona con su propio `local.json` verá al arrancar «la tira «x», campo
  `effect`: falta y es obligatorio», que dice exactamente qué añadir. La PR lo avisa.
- Sin vuelta atrás especial: cada tarea es una PR que se puede revertir.

## Open Questions

- **Qué compases de *Bouncer* forman el loop:** los elige el usuario al escucharlo. No cambia nada más.
- **La posición exacta del vúmetro y sus colores** en la cabecera: se ajustan al verlo.
