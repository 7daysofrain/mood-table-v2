# Design

> Decisiones tomadas en la exploración del 21-oct con el usuario (`/opsx:explore MOO-15`), con una
> medición en la Pi de la mesa. Por tarea: `MOO-23` (engine) 1, 3, 4, 5, 6, 7, 8 y 9 · `MOO-60`
> (panel) 2 y 3 (lo que muestra la cabecera). La 9 la empieza `MOO-23` (el motor envía la clase
> nueva) y la acaba `MOO-60` (el panel la muestra).

## Context

- **El puerto ya está preparado.** `AudioSource` es *pull* (D50): en cada pulso el bucle pide la
  ventana que acaba en el instante del pulso. Su comentario ya prevé que la tarjeta la saque «de su
  búfer circular, sin mirar el instante», y `positionAt` es opcional: sin él, el motor no envía la
  posición (tipo `4`) y el panel no ofrece oír la fuente (`App.tsx` solo pinta `AudioControl` con
  un fichero).
- **La puerta de silencio solo reconoce ceros.** `analysis.ts` da una ventana por silencio si todas
  sus muestras están por debajo de 1e-7 en valor absoluto (la de la v1). El design de
  `virtual-strip-audio-file` dejó el ruido de fondo de la tarjeta como deuda de esta historia.
- **El protocolo del visor solo conoce dos clases de fuente**: `0` sin fuente y `1` fichero
  (`viewer-protocol.md`, D51). La cabecera escribe «Fichero: \<nombre\>» para cualquier fuente que no
  sea «sin fuente» (`AudioSourceIndicator.tsx`).
- **La tarjeta de la mesa** (comprobado en la Pi el 21-oct): C-Media «USB PnP Sound Device», id de
  ALSA `Device`, `card 1`. Un solo dispositivo de grabación (`device 0`), una sola entrada (micro, sin
  línea), y graba de forma nativa en 16 bits, mono, a 48 o 44,1 kHz. En el mezclador, la ganancia de
  grabación (`Mic`) está a 0 de 16 y el control automático de ganancia (`Auto Gain Control`),
  encendido.
- **Su ruido**, medido con 3 s de `arecord` y la entrada vacía, en ventanas de 40 ms: un chasquido al
  abrirla (−36,5 dBFS en la primera ventana, hasta 620 LSB, y unos 250 ms hasta asentarse) y luego un
  ruido estable de unos **−80 dBFS** RMS, con picos de 9 a 14 LSB. La puerta actual no daría por
  silencio **ninguna** de las 72 ventanas.

Motivación y alcance: `proposal.md`. Requisitos: `specs/audio-source`, `specs/engine-config` y
`specs/effects`.

## Goals / Non-Goals

**Goals:**

- Que el adaptador quede en dos piezas: un `*.hardware.ts` mínimo (lanzar el proceso) y una parte pura
  que cubre todo lo decidido (arranque, pérdida, búfer, silencio) con tests y sin tarjeta.
- Que el diseño apunte a los 45 ms de E2 aunque no se midan (decisión 1).
- Que los ficheros de audio se comporten exactamente igual que ahora: los frames dorados no cambian.

**Non-Goals:**

- **Medir el retraso con instrumentos** (cámara lenta, osciloscopio): se juzga a ojo (decisión 1).
- **Elegir la tarjeta o el dispositivo por su número** (`hw:1`): la cadena es libre, pero la
  documentación recomienda el nombre (decisión 3).
- **Matar `arecord` de forma explícita al parar el motor**: con Ctrl+C la señal llega a todo el grupo
  de procesos, y systemd para todo el *cgroup* del servicio. Si aparece un `arecord` huérfano, se
  añade.

## Decisions

### 1. Umbral de retraso: 45 ms (E2), juzgado a ojo

La historia decía «menos de 100 ms (asumido; la spec fija el umbral)», pero 100 ms es el umbral de E1
(control → luz). Para el sonido → luz, `docs/umbrales-para-specs.md` fija **45 ms** (ITU-R BT.1359), y
D53 ya lo usa. Ese número es el **umbral de detección**: el punto a partir del cual una persona nota
que la imagen va por detrás del sonido. Por eso el usuario lo comprueba **a ojo**, que es justo lo que
pide E2 («no se nota que llegue tarde»). La PR dice «verificado visualmente», sin cifra, y la spec no
dice «medido».

El diseño apunta al número con este reparto (local, en la mesa):

```
 periodo de captura de arecord          ~10 ms   (decisión 6)
 espera al siguiente pulso (60 fps)      0-17 ms
 ventana del análisis (40 ms)            0-40 ms  (un golpe fuerte se nota al entrar)
 WebSocket + rAF del panel             ~16 ms
 ------------------------------------------------
 total                                 ~30-60 ms
```

El tramo que más pesa y menos se controla es la ventana: un golpe se ve en cuanto su energía domina
la ventana, no cuando la llena. Si a ojo se nota retraso, lo primero es acortar el periodo de
captura, y lo segundo, revisarlo con el usuario (la ventana afecta a toda la reacción al audio, no
solo a la tarjeta). Con Adalight es otra cadena y otra medición (H3).

**Alternativa descartada:** mantener 100 ms. Más fácil de cumplir, pero un criterio más flojo que la
expectativa del PRD. **Descartada también:** medir con el móvil a cámara lenta (240 fps): el usuario
lo considera excesivo para un umbral de detección que se puede juzgar mirando.

### 2. El panel, en su propia tarea (`MOO-60`)

La historia decía que no había trabajo de panel, pero hay un poco: la clase de fuente nueva y la
cabecera. `linear.md` §3 pide **una área por tarea**, y `MOO-14` ya siguió ese patrón (el protocolo
en la tarea del motor, `MOO-20`; la cabecera en la del panel, `MOO-21`). Así que:

- **`MOO-23` (engine)** lleva también el cambio en `packages/shared` (esquema y protocolo), porque el
  motor es quien lo usa primero.
- **`MOO-60` (panel)** está bloqueada por `MOO-23`. La estimación de la historia (3) no cambia.

**Estado intermedio:** entre las dos PR, con una tarjeta como fuente, la cabecera diría «Fichero:
\<nombre\>» (la rama que no es «sin fuente»). Solo se ve en la Pi y dura lo que tarde `MOO-60`.
Comprobar el caso feliz completo, con la cabecera, va al final de `MOO-60`.

**Alternativa descartada:** todo en `MOO-23`, como excepción a la regla. Una PR menos, pero con tres
áreas, y el precedente de `MOO-14` era el contrario.

### 3. La tarjeta se declara con su cadena de ALSA y un nombre

```json
"audioSource": {
  "type": "soundcard",
  "name": "Mixer de la mesa",
  "device": "plughw:CARD=Device,DEV=0",
  "silenceThreshold": -60
}
```

- **`device`** es la cadena de dispositivo de ALSA tal cual, la que recibe `arecord -D`. El usuario
  prefiere la flexibilidad de la cadena completa a un campo con solo el nombre de la tarjeta.
  Cualquier cadena no vacía es válida en el esquema: si existe o no lo dice `arecord` al abrirla
  (decisión 4).
- **`name`** es obligatorio, como el de cada tira: el texto legible del panel. La cabecera y el
  mensaje de fuente del protocolo llevan **solo el nombre**, nunca la cadena, igual que con el fichero
  se envía el nombre y no la ruta. Los mensajes de error llevan **los dos**: el nombre dice cuál es, y
  la cadena, qué se intentó abrir.
- **La documentación recomienda `plughw:CARD=<nombre>,DEV=0`**: el nombre de ALSA (el que sale entre
  corchetes en `arecord -l`) no cambia entre arranques, mientras que el número (`hw:1`) depende del
  orden de detección. Y `plughw` convierte en ALSA el formato que pide el motor (decisión 6) si la
  tarjeta no lo graba de forma nativa. La de la mesa sí lo graba, pero muchas USB baratas solo graban
  en estéreo.
- **`silenceThreshold`**: decisión 7.

**Alternativas descartadas:** un campo `card` con solo el nombre, del que el motor construye la cadena
(más cómodo, pero menos flexible, y el usuario lo prefiere así); admitir los dos campos (dos formas
de decir lo mismo, con su validación cruzada y sus escenarios); `name` opcional, con la cadena si
falta (dos reglas para la cabecera).

→ **Proponer como D56** en `docs/idea-mood-table.md`.

### 4. El motor solo no arranca si `arecord` termina con error

`main.ts` ya abre la fuente antes de abrir el servidor, «para no arrancar a medias». Con la tarjeta:

```
 lanzar arecord
     |
     +-- arecord termina con error --> no arranca (único fallo):
     |                                 nombre, cadena y la última línea de error de arecord
     |
     +-- llega el primer bloque -----> arranca
```

- **El único fallo es no poder abrir el dispositivo**: no existe, no está conectado o no admite el
  formato (con `hw:`). `arecord` lo intenta nada más arrancar, así que el error llega en
  milisegundos.
- **El primer bloque es la confirmación, no una exigencia de música**: la tarjeta entrega muestras
  siempre, también si no le llega nada por su entrada (medido: ruido de fondo). En la mesa llega en
  unos 10-20 ms.
- **Sin temporizador.** El usuario lo pidió así: que la fuente esté apagada no es un fallo. El único
  hueco es una tarjeta que se abre pero nunca entrega nada, que dejaría el arranque esperando en
  silencio. Es muy improbable en una USB y queda *(asumido)* sin código para ese caso.
- **Sin `arecord`** (macOS, Windows, o Linux sin `alsa-utils`): lanzar el proceso falla con `ENOENT`,
  y el mensaje dice que la tarjeta de sonido necesita Linux con ALSA y que en ese equipo se usa un
  fichero de audio.
- **Las líneas de `stderr` no son fallos por sí solas**: `arecord` avisa de un *overrun* y sigue. Solo
  cuenta su final (decisión 5). De `stderr` se guarda la última línea, para el mensaje.

**Alternativas descartadas:** esperar a la primera música, o a un tiempo fijo sin terminar (un número
arbitrario, y la fuente apagada no es un fallo); comprobar antes `arecord -l` o `/proc/asound` (no
valida cadenas como `plughw:…`); no esperar a nada (el error llegaría con el servidor ya abierto y el
log de arranque escrito).

→ **Proponer como D57** en `docs/idea-mood-table.md`, junto con la decisión 5.

### 5. Si se pierde la tarjeta en plena sesión, silencio y una línea de log

Si `arecord` termina con el motor en marcha, el adaptador escribe una línea en el log («se ha perdido
la tarjeta de sonido «Mixer de la mesa» (`plughw:CARD=Device,DEV=0`): \<línea de arecord\>») y a
partir de ahí `read` entrega ceros. No relanza `arecord`.

- **Es coherente con la decisión 4**: una vez en marcha, que no llegue audio es lo mismo que una
  fuente apagada.
- **La mesa sigue haciendo algo**: las tiras de ambiente no dependen del audio, y en plena sesión es
  mejor perder la reacción a la música que toda la luz.
- **Terminar el motor sería una reconexión a escondidas**: con `Restart=on-failure` del despliegue, el
  motor volvería a arrancar, no encontraría la tarjeta, no arrancaría, y así en bucle, con la mesa a
  oscuras.
- **El panel no avisa**: el vúmetro cae al mínimo, como con la fuente apagada. Distinguir los dos
  casos (y reconectar) es `MOO-59`.

**Alternativa descartada:** terminar con código ≠ 0. Es una señal más clara, pero castiga a las tiras
de ambiente y, con el despliegue, acaba en el bucle de reinicios.

### 6. El adaptador: `arecord` → búfer circular, con el proceso inyectable

```
 soundcard.hardware.ts   (fuera de la cobertura, como el puerto serie)
   spawn('arecord', args) y nada más

 soundcard.ts            (puro, con tests)
   args a partir de la configuración
   bytes s16le -> muestras de -1 a 1, también con un bloque que parte una muestra
   descarte de los primeros 300 ms
   búfer circular + read(): las últimas out.length muestras, ceros si aún no hay
   arranque (decisión 4) y pérdida (decisión 5)
   umbral de silencio de la fuente (decisión 7)
```

- **Argumentos**: `arecord -q -D <device> -t raw -f S16_LE -c 1 -r 48000 --period-time=10000
  --buffer-time=40000`. Mono a 48 kHz porque es lo que la tarjeta de la mesa graba sin conversión y
  porque el análisis ya funciona con cualquier frecuencia. Periodos de 10 ms para el reparto de la
  decisión 1; el búfer de ALSA, de 4 periodos, para absorber algún retraso del proceso sin *overrun*.
  Si en la Pi aparecen *overruns* a menudo, se sube el búfer antes que el periodo.
- **Búfer circular de 0,5 s** (24 000 muestras): de sobra para la ventana de 40 ms y para un bloque
  grande de `stdout`. `read(time, out)` ignora `time` (D50) y copia las últimas muestras; mientras no
  haya bastantes, completa con ceros por delante. No crea objetos.
- **Descarte de 300 ms**: el chasquido que se midió al abrir la tarjeta dura unos 250 ms. Durante los
  primeras 14 400 muestras (28 800 bytes), el adaptador no escribe en el búfer. El primer bloque sigue
  confirmando el arranque (decisión 4): el descarte no lo retrasa.
- **El proceso es una interfaz mínima** (`onData`, `onStderr`, `onExit` con el código, la señal o el
  error al lanzarlo, y `stop`; la última línea de `stderr` la guarda la parte pura), que
  `soundcard.hardware.ts` implementa con `child_process.spawn` y los tests con un falso
  en memoria. El test decide cuándo llegan los bloques y cuándo termina el proceso, sin temporizadores
  ni un guion de shell en el `PATH`. Lo que no cubre (que `arecord` acepte esos argumentos y entregue
  ese formato) se comprueba en la mesa, y algún día en la CI con `MOO-24`.

**Alternativa descartada:** un `arecord` falso como ejecutable en el `PATH` de los tests. Prueba
también el `spawn`, pero con dos procesos que coordinar, más lento y frágil en la CI, y no aporta nada
que no cubra el proceso en memoria.

### 7. Umbral de silencio por nivel, configurable en la tarjeta

Con la tarjeta, la ventana cuenta como silencio si su **nivel RMS en dBFS** (el mismo que muestra el
vúmetro) queda por debajo de `silenceThreshold`. En silencio, igual que ahora, el análisis no se
actualiza y un efecto reactivo se apaga (`specs/effects`). Sin esto, *energía* nunca se apagaría con
la tarjeta, y su ganancia automática (la `mel_gain` de la v1) **subiría el ruido** hasta hacer
parpadear la tira.

- **En la configuración de la tarjeta**, no como constante: el ruido depende de cada instalación (el
  mixer, el cable, la ganancia). Lo pidió el usuario; ajustarlo en la mesa es editar el fichero y
  reiniciar.
- **−60 dBFS por defecto**: 20 dB por encima del ruido medido con la entrada vacía (−80) y muy por
  debajo de cualquier música (por encima de −30 a nivel de línea). Con el mixer conectado el ruido
  subirá; si pasa de −60, el maker lo ve en el vúmetro (que empieza a −60) y sube el umbral.
  `HARDWARE_SETUP.md` explica cómo.
- **Rango de −120 a 0**: por debajo de −120 no hay ruido real en 16 bits, y por encima de 0 no hay
  señal posible.
- **Los ficheros no cambian**: la puerta de silencio digital se queda tal cual, y el umbral por nivel
  se añade solo si la fuente lo declara. El puerto `AudioSource` gana un `silenceThreshold` opcional
  (dBFS); el fichero no lo tiene. Los frames dorados no se tocan.

**Alternativas descartadas:** una constante en el código, fijada tras medir en la mesa (cada
instalación tendría que tocar código); el mismo umbral para el fichero (una opción sin caso real que
la pida, y cambiaría la puerta que validan los frames dorados); dejarlo para otra historia (rompe un
requisito ya especificado: «en silencio, un efecto reactivo se apaga»).

→ **Proponer como D58** en `docs/idea-mood-table.md`.

### 8. El motor no toca el mezclador de la tarjeta

La ganancia de grabación, el control automático de ganancia y la entrada se ajustan una vez al montar
la mesa, con `amixer`, y se guardan con `sudo alsactl store`. `HARDWARE_SETUP.md` lo explica, con el
vúmetro del panel como medidor: apagar el control automático, subir la ganancia hasta que los picos
de la música queden cerca del máximo sin tocarlo, guardar, y elegir el umbral de silencio con el
mixer conectado y en silencio.

- **Cada tarjeta tiene sus controles** (`Mic` y `Auto Gain Control` en la de la mesa; `Capture`,
  `Line` o un selector de entrada en otras): el motor tendría que conocer cada modelo.
- **Necesita root** (`alsactl store`), y el motor no corre como root.
- **El control automático de ganancia va en contra de *energía***: sube lo flojo y baja lo fuerte, así
  que aplana la dinámica que el efecto tiene que mostrar. En la mesa hay que comprobar que de verdad
  actúa sobre la grabación (`amixer` lo lista como control de reproducción).

→ **Proponer como D59** en `docs/idea-mood-table.md`.

### 9. Clase de fuente `2`: tarjeta de sonido, con su nombre

El mensaje de fuente (tipo `2`) gana la clase `2` («tarjeta de sonido»), con el mismo formato que el
fichero: el nombre en UTF-8 desde el byte 2, que no puede estar vacío. `SourceMessage` pasa a
`{ kind: 'none' } | { kind: 'file'; name } | { kind: 'soundcard'; name }`. Un panel antiguo descarta
el mensaje (D45: lo que no entiende, lo ignora) y no muestra fuente; no hace falta compatibilidad.

La cabecera (`MOO-60`) escribe «Tarjeta de sonido: \<nombre\>» con el vúmetro, y sigue sin control de
oír, porque `App.tsx` solo lo pinta con un fichero. Con la tarjeta tampoco hay mensajes de posición
(la fuente no tiene `positionAt`) ni `/audio` (404, como sin fuente).

## Risks / Trade-offs

- **[El servicio arranca antes de que el sistema detecte la tarjeta USB]** → Con la decisión 4, el
  motor no arranca, y la mesa se queda sin luz (choca con E6). Se resuelve en el despliegue con
  `Restart=on-failure` en la unidad de systemd. Queda como nota para esa historia, no aquí.
- **[A ojo no es una medida]** → Es la decisión 1, consciente: el umbral es de detección, y lo que se
  juzga es si se nota. Si se nota, el reparto de la decisión 1 dice por dónde empezar.
- **[Ruido del mixer por encima de −60 dBFS]** → Con el umbral por defecto, la tira parpadearía con el
  mixer apagado. El maker lo ve en el vúmetro y sube `silenceThreshold`; la verificación en la mesa
  incluye este paso.
- **[Ruido por debajo de −60 dBFS invisible en el vúmetro]** → El vúmetro empieza a −60, así que un
  ruido de −70 no se ve. Con el umbral por defecto da igual (ya cuenta como silencio); solo afecta a
  quien quiera bajar el umbral, que tendrá que probar.
- **[Periodos de 10 ms en la Pi]** → Más despertares del proceso y riesgo de *overrun* con la CPU
  ocupada por el bucle. `arecord` sigue tras un *overrun* (se pierde un trozo de audio, no la
  fuente). Si es frecuente, se sube el búfer de ALSA (decisión 6).
- **[Dos tarjetas idénticas]** → Las dos se llaman `Device` y ALSA renombra la segunda a `Device_1`
  según el orden de detección. Fuera de alcance; `HARDWARE_SETUP.md` apunta a una regla de udev.
- **[Estado intermedio entre las dos PR]** → La cabecera diría «Fichero: …» con la tarjeta (decisión
  2). Solo en la Pi y por poco tiempo.

## Migration Plan

Nada que migrar: `audioSource` sigue siendo opcional y `file` no cambia. En la Pi, el
`config/local.json` declara la tarjeta tras integrar `MOO-23`; no se versiona.
