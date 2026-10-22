# Design

> Decisiones tomadas al proponer el change, a partir del refinamiento de `MOO-59` y de la prueba del
> 22-oct en la Pi. Por tarea: `MOO-63` (engine) 1, 2, 3 y 4 · `MOO-64` (panel) 5. El umbral (6) lo
> fija `MOO-63`, y `MOO-64` cumple la mitad del aviso.

## Context

- **Cómo se pierde hoy.** `soundcard.ts` lanza `arecord` una vez. Si termina después del primer
  bloque, la fuente pasa a `lost`, `read` entrega ceros desde entonces y se escribe una línea en el
  log. No hay nada más: ni reintento ni aviso a nadie (D57, decisión 5 de `soundcard-audio-source`).
- **El núcleo no se entera.** El bucle solo ve el puerto `AudioSource` (D50): pide la ventana de cada
  pulso y recibe ceros. Así, los efectos reactivos se apagan por la puerta de silencio y los de
  ambiente siguen. Eso ya es el comportamiento que se quiere durante el corte.
- **El panel sabe la fuente, no su estado.** El mensaje de fuente (tipo `2`) se envía una vez al
  conectarse: «la fuente no cambia mientras el motor corre». La conexión del panel ignora los tipos
  que no conoce (`viewer-protocol.md`).
- **La tarjeta de la mesa** (prueba del 22-oct): al desenchufarla, `arecord` termina en el acto con
  `read error: No such device`. Al enchufarla en otro puerto USB (de `1.4` a `1.2`), ALSA la vuelve a
  llamar `Device` (`card 1`, `usbid 08bb:2902`, sin número de serie), y
  `arecord -D plughw:CARD=Device,DEV=0` vuelve a grabar. Entre el enchufe y la aparición de la tarjeta
  en el sistema pasa lo que tarde el USB, no el motor.

Motivación y alcance: `proposal.md`. Requisitos: `specs/audio-source`.

## Goals / Non-Goals

**Goals:**

- Que la reconexión viva entera en el adaptador de la tarjeta, en su parte pura y con tests con el
  `arecord` falso y un reloj falso. El núcleo y el `*.hardware.ts` no cambian.
- Que el panel sepa el estado de la tarjeta por el motor, que es la única fuente de verdad, y nunca lo
  deduzca del nivel.

**Non-Goals:**

- **Vigilar el sistema** (udev, `/dev/snd`, `/proc/asound`) para enterarse antes de que la tarjeta ha
  vuelto: ver la decisión 1.
- **Distinguir dos tarjetas del mismo modelo**: sin número de serie no hay con qué (`proposal.md`,
  non-goals).
- **Un aviso genérico de hardware para Q5**: el componente del panel admite otro texto sin cambios
  (decisión 5), pero el protocolo solo lleva el estado de la fuente de audio.

## Decisions

### 1. Reintentar cada segundo, lanzando `arecord` de nuevo, sin límite

Tras una pérdida, el adaptador vuelve a lanzar `arecord` con la misma cadena **cada segundo**. Cada
intento se juzga igual que el arranque: **el primer bloque** de audio confirma que la tarjeta ha
vuelto, y si `arecord` termina antes, se espera otro segundo y se vuelve a intentar. Nunca se rinde.

- **Por qué un segundo:** es la cadencia con la que el panel ya reintenta su conexión con el motor
  (decisión 15 de `virtual-strip-breathing`), y deja la recuperación por debajo de los 3 s (decisión
  6). Lanzar un `arecord` que falla al abrir cuesta milisegundos: en una sesión de horas sin tarjeta
  son miles de procesos efímeros, nada para la Pi 4 (D48).
- **Por qué la misma cadena:** la prueba del 22-oct confirma que, declarada por nombre (D56), ALSA la
  encuentra en cualquier puerto. Con una tarjeta de otro modelo, la cadena no la encuentra y se sigue
  esperando: así se cumple *Se conecta otra tarjeta distinta* sin código propio.
- **Al recuperarla**, la fuente vacía su búfer y vuelve a descartar los primeros 300 ms (el chasquido
  al abrir, decisión 6 de `soundcard-audio-source`), como al arrancar. Así no se cuela audio de antes
  del corte ni el chasquido. Es el mismo objeto `AudioSource`: el bucle no se entera de que el
  proceso ha cambiado.
- **El reloj se inyecta** (una función para programar el siguiente intento, por defecto `setTimeout`),
  como el `spawn`. Los tests avanzan el tiempo sin esperar. `stop()` cancela el intento pendiente.

**Alternativas descartadas:** vigilar `/dev/snd` o udev para reintentar justo al aparecer la tarjeta.
Es más rápido, pero añade código que depende del sistema y no se puede probar sin hardware, y el nodo
aparece antes de que ALSA esté listo, así que haría falta reintentar igualmente. También se descarta
un reintento con espera creciente (*backoff*): retrasaría la recuperación tras un corte largo, que es
justo el caso normal en la mesa.

**→ D60** en `docs/idea-mood-table.md`, junto con la decisión 2. En D57, «No se reconecta (`MOO-59`)»
se tacha y apunta a D60 (las decisiones no se borran).

### 2. El log dice la pérdida y la recuperación, y nada más

Una línea al perderla (la de ahora) y una al recuperarla: `Se ha recuperado la tarjeta de sonido
«<nombre>» (<cadena>).`. Los intentos fallidos no escriben nada. Si un cable flojo la pierde y la
recupera muchas veces, cada vez escribe sus dos líneas, y eso es información útil para el maker. Un
reintento por segundo que escribiera cada fallo llenaría el log en una sesión larga.

### 3. Un mensaje nuevo del protocolo del visor: estado de la fuente (tipo `5`)

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `5` (estado de la fuente) |
| 1 | 1 | Estado | `0` conectada, `1` perdida |

- **Cuándo:** a cada panel al conectarse, justo después del mensaje de fuente, y a todos los paneles
  cada vez que cambia. **Solo con la tarjeta de sonido**: un fichero no se pierde, y sin fuente no hay
  nada que perder.
- **Por qué un tipo nuevo y no ampliar el de fuente (tipo `2`):** el de fuente dice *qué* fuente hay
  y no cambia mientras el motor corre, y eso lo usa el panel. Mezclar el estado obligaría a reenviar
  la identidad en cada cambio y a romper esa regla. Un tipo nuevo es compatible: un panel anterior lo
  ignora.
- **Por qué no deducirlo del nivel:** un silencio también da nivel cero, y el criterio *Un silencio
  no es una desconexión* lo prohíbe.
- **Por qué no un mensaje genérico de «pieza de hardware» pensando en Q5:** hoy solo hay una pieza
  que se pierda. Q5 está abierta y puede pedir otra cosa (p. ej., qué tira). Si llega, tendrá su
  propio tipo; el coste de no anticiparlo es un tipo más.

En el motor, el servidor guarda el último estado para enviarlo a cada panel que se conecta. El
adaptador avisa de cada cambio, y `main.ts` une los dos. Si la tarjeta se pierde entre que se abre y
el servidor empieza a escuchar, el servidor arranca con el estado de ese momento (el adaptador da el
estado actual al suscribirse).

**→ D61** en `docs/idea-mood-table.md` (amplía el contrato del protocolo, como D51).

### 4. La pieza pura sigue siendo `soundcard.ts`

`openSoundcard` mantiene su firma de arranque. Lo que devuelve con `ok: true` añade la forma de
suscribirse a los cambios de estado. El bucle de reintentos y el reinicio del búfer viven en el mismo
fichero, porque son la misma máquina de estados que ya tiene (abriendo → grabando → perdida →
abriendo…). `soundcard.hardware.ts` no cambia: lanzar `arecord` sigue siendo lo mismo.

```
  arranque --primer bloque--> grabando --arecord termina--> perdida
                                  ^                           |
                                  |                       cada 1 s
                                  +----primer bloque---- reintento
                                                  (termina antes: perdida)
```

### 5. El aviso en la cabecera: «Desconectada», en rojo y parpadeando

Junto a «Tarjeta de sonido: \<nombre\>», una etiqueta roja con el texto **«Desconectada»** que
parpadea **una vez por segundo**. Es la indicación de diseño de la historia (rojo, parpadeando, arriba
a la izquierda, donde ya está la tarjeta desde `MOO-60`). El vúmetro se queda, al mínimo.

- **Accesible:** la etiqueta se anuncia a los lectores de pantalla cuando aparece (región *live*). Con
  `prefers-reduced-motion` no parpadea: queda fija en rojo. A 1 Hz está muy lejos del límite de tres
  destellos por segundo (WCAG 2.3.1).
- **Reutilizable sin esfuerzo:** la etiqueta es un componente que recibe su texto. Si Q5 decide avisar
  de la tira física, puede usarlo tal cual (indicación de la historia: «si sale gratis»).
- **Estado en la conexión del panel:** `EngineConnection` guarda si la fuente está perdida, avisa a
  la cabecera cuando cambia y lo olvida al perder la conexión con el motor, como la fuente.

### 6. Umbrales: aviso en menos de 1 s y recuperación en menos de 3 s

- **Aviso, < 1 s desde la pérdida:** el límite de Nielsen para que una respuesta no corte el hilo del
  usuario, del mismo artículo que ya cita E1 en `docs/umbrales-para-specs.md`. En la práctica son
  decenas de ms: `arecord` termina en el acto y el mensaje sale enseguida.
- **Recuperación, < 3 s desde que el sistema ve la tarjeta.** Medido en la Pi el 22-oct, en tres
  desconexiones: la tarjeta aparece en `/proc/asound` y durante unos 100-140 ms ALSA aún contesta
  `No such device`; después, `arecord` tarda unos 275 ms en entregar el primer bloque. Desde que
  aparece hasta el primer audio: 394, 414 y 434 ms. El peor caso con un reintento por segundo es un
  intento que cae en esos ~100 ms, más 1 s hasta el siguiente, la apertura y los 300 ms descartados:
  unos **1,6 s**. El DJ fija el umbral en 3 s, con margen. No cuenta lo que tarda el USB en presentar
  la tarjeta (1,1-2,1 s en la prueba, con las manos incluidas), que no depende del motor.
- **Descartado:** reintentar cada 0,5 s para bajar a unos 1,1 s. Medio segundo menos tras un corte
  que ya dura varios no se nota.

Los dos se añaden a `docs/umbrales-para-specs.md`.

## Risks / Trade-offs

- **[Una tarjeta del mismo modelo se toma por la declarada]** → aceptado en la historia: sin número de
  serie no hay forma de distinguirlas. Queda escrito en los non-goals.
- **[Un intento pendiente mantiene vivo el proceso al parar el motor]** → `stop()` lo cancela, y hay un
  test que lo comprueba.
- **[`arecord` abre la tarjeta pero aún no entrega audio]** → no cuenta como recuperada hasta el primer
  bloque. Si termina antes, es un intento fallido más.
- **[Un `arecord` de reintento se queda colgado: ni entrega audio ni termina]** → la tarjeta no se
  recuperaría nunca, porque el siguiente intento solo se programa cuando `arecord` termina. Aceptado
  sin código: no se ha visto en la medición del 22-oct ni en la prueba en la mesa (siempre falla o
  graba), y el arranque tiene el mismo hueco desde `MOO-23`. Si se ve en la mesa, la salida es un
  límite de tiempo por intento (p. ej., parar el `arecord` que no entrega nada en 2 s). Lo vio la
  code review de `MOO-63`.
- **[Un panel antiguo, en caché, no entiende el tipo `5`]** → lo ignora (regla del protocolo) y se
  queda sin aviso hasta recargar. No hay riesgo de que falle.
- **[La prueba física solo se hace a mano]** → los escenarios se cubren con el `arecord` falso. La
  desconexión real se comprueba en la mesa antes de integrar `MOO-63` (deuda `MOO-24`).
