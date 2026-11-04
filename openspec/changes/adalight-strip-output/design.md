# Design

> Decisiones tomadas en la exploración del 29-oct con el usuario (`/opsx:explore MOO-111`). Por tarea:
> `MOO-113` (shared) 6 y 7 (el contrato) · `MOO-114` (engine) 1 a 5 y 9 · `MOO-115` (panel) 7 (lo que
> muestra la zona Tiras). La 8 (sin E2E) afecta a las tres.

## Context

- **El hueco ya está preparado.** `LightOutput` (`packages/engine/src/core/frame-loop.ts`) es el puerto
  de salida de una tira: `write(frame, tick)`, síncrono y sin bloquear, con un `frame` que es del
  bucle y se reutiliza en el pulso siguiente. La raíz de composición da a cada tira
  `[server.viewerOutput(index)]` y su comentario dice que la salida Adalight llega con H3 (D43).
- **El contrato solo conoce `virtual`.** `OutputSchema` (`packages/shared/src/config.ts`) y la salida
  de `STRIP_FIELDS` (`viewer-protocol.ts`) son uniones con un solo miembro. El comentario de
  `STRIP_FIELDS` ya avisa de que el puerto de una salida Adalight llega con H3, y de que lo que se
  añada al fichero no sale al panel sin decidirlo. El panel nombra la salida con `OUTPUT_NAMES`
  (`literals.ts`), un `Record` sobre el tipo de salida: deja de compilar si la unión crece.
- **La mesa** (D46, `HARDWARE_SETUP.md` §4.1 y §7): un Arduino Uno con el sketch Adalight-FastLED, 173
  LEDs, 115.200 baudios y brillo topado al 25 %. Aparece como
  `/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0`, que es la ruta que se recomienda declarar.
- **La aritmética del puerto.** Un frame Adalight de 173 LEDs son 6 + 519 = 525 bytes. En modo 8N1
  cada byte son 10 bits en el cable, así que 5.250 bits a 115.200 baudios tardan **45,6 ms**: como
  mucho unos 22 frames por segundo, frente a los 60 pulsos del motor. La misma cuenta da los «unos 19
  fps con 200 LEDs» del README §2.1. Es el mínimo teórico, no una medida.
- **No hay dependencias nativas** en el motor: la tarjeta de sonido usa `arecord` como proceso hijo.
  `pnpm-workspace.yaml` exige un día de antigüedad a cada versión (`minimumReleaseAge`) y no deja
  ejecutar scripts de instalación salvo los que aparecen en `allowBuilds`.

Motivación y alcance: `proposal.md`. Requisitos: `specs/physical-strip`, `specs/engine-config`,
`specs/frame-loop` y `specs/instrument-control`.

## Goals / Non-Goals

**Goals:**

- Que el adaptador quede en dos piezas: un `adalight.hardware.ts` mínimo (abrir el puerto con
  `serialport`) y una parte pura que cubre todo lo decidido (codificación, descarte, medida, pérdida)
  con tests y sin puerto.
- Que el retraso de la tira física esté acotado **por construcción**, no por vigilancia: nunca hay
  cola (decisiones 2 y 3).
- Que las tiras virtuales, el visor y los E2E se comporten exactamente igual que ahora.

**Non-Goals:**

- **Esperar el saludo `Ada` del sketch** antes de escribir: lo puede usar `MOO-112` para saber que el
  controlador está vivo (decisión 9).
- **Ajustar los fps del motor a los de la tira física**: el motor sigue a 60 y el visor también; la
  tira física toma los que le caben.
- **Apagar la tira física al parar el motor**: no está en la historia (se descartó al refinarla).

## Decisions

### 1. `serialport`, y solo en `adalight.hardware.ts`

El motor necesita tres cosas del puerto: abrirlo a unos baudios, escribir sin bloquear el bucle y
saber **cuándo los bytes han salido por el cable** (decisión 2). `serialport` (13.0.0) hace las tres:
`open` con `baudRate` y `lock`, `write` y `drain()`, que espera a que el sistema operativo vacíe su
búfer (`tcdrain`).

- `adalight.hardware.ts` abre el puerto y lo envuelve en un enlace mínimo: escribir unos bytes y
  avisar cuando han salido, avisar si el puerto falla o se cierra, y cerrarlo. Es lo único que importa
  `serialport`.
- `adalight.ts` (puro, con tests) recibe ese enlace: codifica, decide si escribe o descarta, mide y
  reacciona a la pérdida. Los tests le dan un enlace falso que controla cuándo «sale» cada frame.
- `serialport` va al catálogo de `pnpm-workspace.yaml`. Sus binarios (`@serialport/bindings-cpp`)
  traen precompilados para linux-arm64 y macOS, y se cargan al ejecutar; su script de instalación
  solo compila si no hay precompilado. Se declara en `allowBuilds` como `false`, como `esbuild`, y la
  prueba en la Pi comprueba que carga el precompilado. Si no lo cargara, se pasa a `true`.

Descartado: **`stty` y escribir en `/dev/tty…` como en un fichero**, sin dependencia nativa, al estilo
de `arecord`. Sin `tcdrain` desde Node, «ha salido» habría que **calcularlo** con la aritmética del
Context, que es justo lo que no sabemos si se cumple en la mesa. Además `stty -F` solo existe en Linux
(en macOS es `-f`), y `serialport` deja probar con el Arduino conectado al portátil.

→ **Proponer como D90** en `docs/idea-mood-table.md`: la primera dependencia nativa del motor, y por
qué.

### 2. Mientras un frame no ha salido por el cable, el siguiente se descarta

La salida tiene un estado, *ocupada*, desde que escribe un frame hasta que su `drain()` confirma que
ha salido. Si llega un frame con la salida ocupada, lo descarta. Cuando el `drain()` termina, la
salida queda libre y escribe el frame del pulso siguiente.

- **Por qué el `drain()` y no el final del `write`.** En `serialport`, el `write` termina cuando los
  bytes llegan al búfer del sistema operativo (unos 4 KB en un tty), no al cable. Si «ocupada»
  acabara ahí, cabrían unos 8 frames en cola, **unos 365 ms** de retraso: el escenario *La tira física
  no se va quedando atrás* fallaría.
- **El búfer de la salida es suyo.** La salida guarda un búfer de 6 + 3 × LEDs bytes con la cabecera
  ya escrita (decisión de formato, `specs/physical-strip`). En cada escritura copia los colores del
  frame del bucle, que se reutiliza en el pulso siguiente. Como no escribe mientras está ocupada, el
  búfer no cambia mientras sale.

```
 pulsos (ms):   0     16,7   33,3   50    66,7   83,3   100
                |      |      |      |      |      |      |
 salida:        [=====envio 0=====]  [=====envio 3=====]  [envio 6...
                 1 y 2 descartados    4 y 5 descartados
                -> 20 fps en la mesa, siempre 3 pulsos entre frames
```

Descartado: **guardar el último frame en un hueco y mandarlo en cuanto el puerto queda libre**. Da
unos 22 fps en lugar de 20, pero el frame sale hasta 16,7 ms más viejo, los saltos entre frames
alternan 2 y 3 pulsos (un tembleque en un *scroll*) y necesita una copia y su estado. Descartar es lo
que ya decía el README §2.2.

→ **Proponer como D91** en `docs/idea-mood-table.md`, junto con la decisión 3.

### 3. «A la vez» es ≤ 100 ms, y el log lo mide

Con la decisión 2, la salida solo escribe cuando está libre, y lo que escribe es el frame del pulso en
curso. El retraso no puede crecer: no hay que vigilarlo durante «un rato», como decía la historia,
porque es una propiedad de cada pulso. El escenario *La tira física no se va quedando atrás* lo
comprueba con un enlace falso a lo largo de 1.000 pulsos.

El peor caso, desde un pulso hasta que su frame ha salido por el cable, es lo que tarda un frame en
salir más un pulso (lo que espera un frame si el puerto queda libre justo después de un pulso). En la
mesa: 45,6 + 16,7 ≈ **62 ms**, más unos 5 ms del sketch pintando. El umbral es el de E1, **≤ 100 ms**
(`docs/umbrales-para-specs.md`, Nielsen).

Para comprobarlo en la mesa sin instrumentos, la salida mide lo que tarda cada envío (del `write` al
final del `drain()`). Cuando lleva 50, escribe una sola línea en el log con la mediana y los fps:

```
Tira «Mesa»: 46 ms por frame, 20 fps (115200 baudios, 173 LEDs)
```

Una sola línea, para no llenar el log de la Pi. La mediana, porque el primer envío tras abrir el
puerto puede ser raro (decisión 9). Esa cifra es la que se lleva a Q1 y A2 del PRD.

**Referencia para A2, sin validarla:** a 115.200 baudios, en 100 ms caben unos 1.150 bytes, unos 380
LEDs; con un pulso de margen, unos 315. El fichero de configuración no lo comprueba: la medida manda
sobre la cuenta.

### 4. Si el puerto no se abre al arrancar, el motor no arranca (estado de paso)

`main.ts` abre el puerto de cada tira física después de cargar la fuente de audio y antes del servidor,
como la tarjeta de sonido: así el motor no arranca a medias. Si alguno falla, el motor no arranca y
dice qué tira, qué puerto y el motivo que da el sistema (no existe, permiso denegado, ocupado). Con
`lock: true`, que es el valor por defecto de `serialport`, un puerto que tiene abierto otro programa
(un Hyperion de la v1, el monitor serie del IDE) da error y no se comparte.

Es un estado de paso. El PRD (Q5) pide lo contrario: *si falta al arrancar, el motor arranca
igualmente y lo espera*, y eso llega con `MOO-112`. Mientras tanto, el fallo ruidoso es mejor que el
silencioso: una tira apagada sin aviso no se distingue de una ruta mal escrita.

Descartado: **arrancar sin la tira física y decirlo solo en el log**. Coincide más con Q5, pero sin el
aviso de `MOO-112` el DJ ve la tira apagada sin ninguna pista en el panel.

No se propone como D#: `MOO-112` la sustituye.

### 5. Si el puerto falla en plena sesión, el resto sigue (asumido)

Si el puerto da un error o se cierra con el motor en marcha (el cable USB se suelta), la salida lo
escribe en el log una sola vez, con la tira y el puerto, y deja de escribir: cada frame que le llega lo
descarta. El motor, el visor y las demás tiras siguen.

No se habló en la exploración y **se plantea en la revisión de la spec**. Sale de dos cosas:

- Q5 del PRD: *si se desconecta el controlador Adalight, el resto del instrumento sigue*.
- Hay que decidir algo: `serialport` emite `error` y `close`, y un `error` sin escuchar **tira el
  proceso de Node**. Sin esta decisión, un cable flojo pararía el motor entero.

El aviso en el panel y la reconexión son de `MOO-112`, que crecerá sobre esta misma salida.

### 6. `baudRate` solo admite velocidades estándar

`baudRate` es obligatorio y solo admite las velocidades estándar de Linux (`termios`) hasta 2.000.000:
9.600, 19.200, 38.400, 57.600, 115.200, 230.400, 460.800, 500.000, 576.000, 921.600, 1.000.000,
1.500.000 y 2.000.000. Va en el esquema compartido como una unión de literales, así que el mensaje de
error dice cuáles admite.

Unos baudios que no coinciden con los del sketch el motor no los puede detectar (non-goal): la tira
pinta basura o no enciende, sin ningún mensaje. Lo único que puede atrapar la validación son las
**erratas** (`11520`, `1152000`), y la lista las atrapa. Cubre el Arduino de hoy, el ESP32 de S2 a
921.600 y una placa con USB nativo. 2.000.000 es el máximo del chip CH340 del Arduino de la mesa;
`termios` sigue hasta 4.000.000 y se añade si algún día hace falta.

Descartado: **cualquier entero positivo**, lo que decía el criterio de la historia *(asumido)*: deja
pasar las erratas. El ejemplo del criterio pasa a ser «unos baudios que no son una velocidad
estándar».

→ **Proponer como D92** en `docs/idea-mood-table.md`.

### 7. El panel recibe el puerto pero no los baudios, y muestra la ruta entera

- **El contrato.** La salida de una tira en el mensaje `6` es `{ "type": "virtual" }` o
  `{ "type": "adalight", "port": "<ruta>" }`. El puerto sale al panel porque el criterio lo pide (*la
  zona Tiras la muestra con su puerto serie*). Los baudios no salen: el panel no los muestra y, como
  dice el comentario de `STRIP_FIELDS`, lo que se añade al fichero no sale sin decidirlo.
- **Lo que se ve.** La línea de detalle de la tira dice «173 LEDs · Adalight» (`OUTPUT_NAMES`) y,
  debajo, la ruta del puerto **entera**, con el mismo estilo pequeño y atenuado y partiéndose donde
  haga falta (`word-break: break-all`). Una tira virtual no tiene esa línea.
- **Para que nada se rompa entre tareas.** `MOO-113` amplía la unión en `shared`. En la misma PR añade
  `adalight: 'Adalight'` a `OUTPUT_NAMES` y hace que `stripsMessage` copie el puerto, como hizo
  `MOO-105` con los valores: la línea del puerto llega con `MOO-115`.

Descartado: **recortar la ruta con «…» y mostrarla entera al pasar el ratón**, más limpio, pero esconde
justo la parte que distingue un puerto de otro y no funciona en la pantalla táctil de la visión (E5);
y **solo el último tramo de la ruta**, que con `/dev/ttyUSB0` deja `ttyUSB0`, sin contexto.

### 8. Sin E2E nuevo

La CI no tiene puerto serie y, con la decisión 4, el motor no arranca con una tira física sin él. Un
E2E necesitaría el `MockBinding` de `serialport` y una rama solo para tests en `main.ts`, que no está
cubierta por nada más. En su lugar:

- **Motor:** tests de `adalight.ts` con un enlace falso (codificación, descarte, 1.000 pulsos,
  medida, pérdida) y de `engine.ts` (las salidas de cada tira, el mensaje `6`).
- **Panel:** tests con Testing Library de la zona Tiras con una tira Adalight.
- **Mesa:** la prueba con el Arduino de D46 cubre el caso feliz y los escenarios «a la vez».

Es el mismo criterio que con la tarjeta de sonido (`MOO-60`). La tarea `MOO-115` dice en Linear «con
su E2E»: **hay que corregirla**, con permiso del usuario.

### 9. El Arduino se reinicia al abrir el puerto

Un Uno se reinicia cuando se abre su puerto serie (la línea DTR), y tarda 1-2 s en arrancar el sketch.
Mientras tanto, la tira física sigue apagada y los frames que llegan se pierden sin hacer daño: el
sketch busca la cabecera `Ada` en cada frame. La salida no espera nada, empieza a escribir en cuanto
abre el puerto, y el primer frame que el sketch reconoce se pinta. `hupcl` se queda en su valor por
defecto (`true`): al cerrar el puerto, el Arduino se reinicia.

Se documenta en `HARDWARE_SETUP.md` para que el segundo de tira apagada al arrancar no parezca un
fallo.

## Risks / Trade-offs

- **[La tira física no cumple E2]** Solo el envío (45,6 ms) ya supera el umbral de sonido a luz de
  `docs/umbrales-para-specs.md` (≤ 45 ms). El visor sí lo cumple. → No se mide en esta historia
  (non-goal). Las salidas son el firmware propio (S2: un ESP32 a 921.600 baudios tarda unos 5,7 ms),
  una placa con USB nativo, o menos LEDs (A2). Se apunta en A2 al cerrar la historia.
- **[Subir los baudios en el Uno puede perder bytes]** *(hipótesis)* Mientras FastLED pinta (unos 5
  ms con 173 LEDs) corta las interrupciones, y lo que llega por el serie en ese hueco se puede perder.
  A 115.200 baudios caben pocos bytes; a más, más pérdidas. → La prueba en la mesa empieza a 115.200.
  Si se prueba más, se mira a ojo si hay parpadeos y si cae la cifra de fps del log.
- **[Los fps de la tira física van a saltos]** Con la decisión 2, un envío que dura 2,7 pulsos ocupa 3
  (20 fps), pero uno que dura 3,1 ocupa 4 (15 fps). Con otros LEDs o baudios, la cifra del log puede
  bajar más de lo que dice la cuenta. → Se explica en el README §2.2; no es un fallo.
- **[El precompilado de `serialport` no carga en la Pi]** Entonces el motor no arranca con una tira
  física. → La prueba en la Pi lo comprueba (tarea 2). Si falla, `allowBuilds` pasa a `true` y la Pi
  necesita las herramientas de compilación (`build-essential`), que se documentan.
- **[El cargador del Arduino recibe los primeros bytes]** Tras el reinicio, el cargador del Uno escucha
  el serie un momento por si llega un programa nuevo, y los frames que llegan entonces no lo son. Hasta
  ahora no ha dado problemas: es lo mismo que hacía Hyperion. → Si en la mesa el sketch no arranca al
  abrir el puerto, se añade una espera antes del primer frame.
- **[La ruta `by-id` es larga en el panel]** Ocupa dos líneas en la zona Tiras. → Aceptado (decisión
  7): el dato solo sirve si es exacto.

## Migration Plan

Sin migración. Las tiras virtuales no cambian. En la Pi, `config/local.json` añade la tira de la mesa
(un ejemplo en el README §3). Para volver atrás, se quita esa tira del fichero.
