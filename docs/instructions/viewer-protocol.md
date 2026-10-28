# Protocolo del visor

> Fuente de verdad del **formato** de los mensajes que el motor envía al panel por WebSocket. El
> **comportamiento** (quién recibe qué y cuándo) está en la spec `viewer`; el **código** que codifica
> y decodifica, en `packages/shared/src/viewer-protocol.ts`, que usan el motor y el panel. Si cambia
> el formato, cambian este documento y ese código en la misma PR.
>
> Origen: change `virtual-strip-breathing`, `design.md` decisiones 10 y 11 (`MOO-17`). Los mensajes
> de fuente y de nivel: change `virtual-strip-audio-file`, `design.md` decisión 5 (`MOO-20`). El de
> posición del fichero: change `panel-audio-playback`, `design.md` decisión 2 (`MOO-56`). El de estado
> de la fuente: change `soundcard-reconnect`, `design.md` decisión 3 (`MOO-63`). El de las tiras:
> change `strip-effect-switch`, `design.md` decisión 3 (`MOO-101`).

## Conexión

- **Una sola conexión WebSocket por navegador**, en la ruta `/ws` del motor (la misma dirección que
  sirve el panel). Por ella viajan los frames de todas las tiras, la fuente de audio, su nivel, la
  posición del fichero de audio, el estado de la tarjeta de sonido y las tiras con su efecto activo.
- Los mensajes van en **binario**. El primer byte dice de qué tipo es el mensaje.
- Solo van del motor al panel: el panel no envía nada por esta conexión. Lo que el panel pide hacer
  (cambiar el efecto de una tira) va por la API HTTP (decisión 2 del change `strip-effect-switch`).
- El panel no necesita saber nada de antemano: cada mensaje dice de qué tira es y cuántos LEDs tiene.

## Mensaje de frame (tipo `1`)

Un mensaje por cada frame de cada tira: en cada pulso del motor, un mensaje por tira.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `1` (frame) |
| 1-4 | 4 | `seq` | Número del pulso, entero sin signo de 32 bits, **big-endian**. Es el mismo para todas las tiras de un pulso y para todos los navegadores. Tras 2³² − 1 vuelve a 0 |
| 5 | 1 | Índice de la tira | Posición de la tira en el fichero de configuración: `0`, `1`… (como mucho 255) |
| 6… | 3 × LEDs | Colores | RGB, 3 bytes por LED, en el orden de la tira. El número de LEDs es (longitud − 6) ÷ 3 |

Ejemplo: el frame con `seq` 260 de la primera tira, con dos LEDs, rojo y azul:

```
01  00 00 01 04  00  ff 00 00  00 00 ff
```

- Los colores van siempre en **RGB**, sea cual sea el orden de color de la tira física (eso lo
  resuelve su salida Adalight).
- Un hueco en los `seq` que recibe un navegador son pulsos que el motor se ha saltado.
- El índice no se queda desfasado: las tiras solo cambian al reiniciar el motor, y un reinicio obliga
  al panel a reconectar.

## Mensaje de fuente de audio (tipo `2`)

Uno al conectarse cada panel: la fuente no cambia mientras el motor corre. Si el motor se reinicia con
otra, el panel reconecta y la recibe de nuevo. También se envía si no hay fuente.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `2` (fuente) |
| 1 | 1 | Clase de fuente | `0` sin fuente de audio, `1` fichero, `2` tarjeta de sonido |
| 2… | resto | Nombre | Con un fichero, su nombre en UTF-8, **sin la ruta**. Con una tarjeta de sonido, el nombre que le da el fichero de configuración, en UTF-8, **sin la cadena de dispositivo de ALSA**. Nunca vacío. Sin fuente, el mensaje acaba en el byte 1 |

Ejemplo: la fuente es el fichero `golpes.wav`:

```
02  01  67 6f 6c 70 65 73 2e 77 61 76
```

La fuente es la tarjeta de sonido llamada «Mixer de la mesa»:

```
02  02  4d 69 78 65 72 20 64 65 20 6c 61 20 6d 65 73 61
```

Sin fuente de audio: `02 00`.

## Mensaje de nivel (tipo `3`)

Uno en cada pulso, solo si hay fuente de audio: el nivel de la fuente (su RMS, antes de que el motor la
ajuste), el mismo para todos los paneles.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `3` (nivel) |
| 1-4 | 4 | `seq` | El pulso al que pertenece, como el de los frames: entero sin signo de 32 bits, **big-endian** |
| 5-8 | 4 | Nivel | Número en coma flotante de 32 bits (IEEE 754), **big-endian**, de 0 a 1 |

Ejemplo: el nivel 0,5 del pulso 260:

```
03  00 00 01 04  3f 00 00 00
```

## Mensaje de posición del fichero (tipo `4`)

Uno en cada pulso, solo si la fuente de audio es un fichero: el punto del fichero en el que acaba la
ventana que ha analizado el motor en ese pulso, el mismo para todos los paneles. El motor es la única
fuente de verdad de esa posición: el panel no la calcula. Con ella, el panel hace sonar el fichero por
el punto que muestra el visor.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `4` (posición) |
| 1-4 | 4 | `seq` | El pulso al que pertenece, como el de los frames: entero sin signo de 32 bits, **big-endian** |
| 5-12 | 8 | Posición | Segundos desde el principio del fichero, en coma flotante de 64 bits (IEEE 754), **big-endian**. Va de 0 hasta justo antes de la duración del fichero, que nunca alcanza, y vuelve a 0 con el bucle |

Ejemplo: la posición 1,5 s del pulso 260:

```
04  00 00 01 04  3f f8 00 00 00 00 00 00
```

- **64 bits** para que un fichero largo no pierda precisión: con 32, a una hora la resolución bajaría a
  unos 0,25 ms.

## Mensaje de estado de la fuente (tipo `5`)

Solo si la fuente de audio es la tarjeta de sonido: si entrega audio o se ha perdido. Lo recibe cada
panel al conectarse, justo después del mensaje de fuente, y todos los paneles cada vez que cambia. Con
un fichero o sin fuente no se envía: un fichero no se pierde. El panel no deduce el estado del nivel,
porque un silencio también da nivel cero.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `5` (estado de la fuente) |
| 1 | 1 | Estado | `0` conectada, `1` perdida |

Ejemplo: la tarjeta de sonido, perdida:

```
05 01
```

- **Un tipo aparte del de fuente:** el de fuente dice *qué* fuente hay y no cambia mientras el motor
  corre; el estado sí cambia. Un panel que no conoce el tipo `5` lo ignora.

## Mensaje de las tiras (tipo `6`)

Las tiras declaradas, con el efecto que el motor pinta en cada una. Lo recibe cada panel al
conectarse, después del mensaje de fuente (y del de estado de la fuente, si lo hay), y todos los
paneles conectados cada vez que cambia el efecto de una tira, venga el cambio de donde venga.

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `6` (tiras) |
| 1… | resto | Tiras | Un objeto JSON en UTF-8 con la lista `strips` |

Es el **primer mensaje JSON** del protocolo: un texto de longitud variable por tira, en un mensaje poco
frecuente y de unos cientos de bytes. Cada tira lleva solo estos campos, y ninguno más:

| Campo | Valor |
|---|---|
| `id` | El de la tira en el fichero de configuración |
| `name` | Su nombre, para mostrarlo |
| `ledCount` | Su nº de LEDs, entero, al menos 1 |
| `output` | Su salida: hoy solo `{ "type": "virtual" }` |
| `effect` | El id del efecto activo, uno del catálogo: `breathing` o `energy` |

Ejemplo: una tira virtual de 60 LEDs con *energía*:

```
06  {"strips":[{"id":"demo","name":"Tira de prueba","ledCount":60,"output":{"type":"virtual"},"effect":"energy"}]}
```

- **Siempre la foto completa**, en el orden del fichero: la posición de cada tira en la lista es su
  índice en los frames (tipo `1`). Recibirla dos veces da igual, y al reconectarse el panel recibe la
  misma que el motor está pintando.
- El efecto es el que pinta el motor, no el del fichero: el del fichero es solo el de arranque.
- No lleva el resto del fichero: lo que se añada a una tira (orden de color, límites de potencia,
  puerto) no sale al panel sin decidirlo, como la ruta del fichero de audio en el tipo `2`.

## Qué hace el panel con un mensaje que no entiende

Lo ignora, también si es de un tipo que todavía no conoce. Se rechaza:

- un frame cuyo tipo no es `1`, más corto que la cabecera (6 bytes) o cuyos colores no son un número
  entero de LEDs (al menos uno);
- un mensaje de fuente con una clase que no es `0`, `1` ni `2`, sin fuente pero con nombre, de un
  fichero o una tarjeta de sonido sin nombre o con un nombre que no es UTF-8 válido;
- un mensaje de nivel que no mide 9 bytes o cuyo nivel no es un número de 0 a 1;
- un mensaje de posición que no mide 13 bytes o cuya posición no es un número finito mayor o igual
  que 0;
- un mensaje de estado de la fuente que no mide 2 bytes o cuyo estado no es `0` ni `1`;
- un mensaje de las tiras que no es UTF-8 válido, que no es JSON o que no cumple su esquema
  (`StripsMessageSchema`): le falta un campo, tiene uno que no está en la tabla, el efecto no está en el
  catálogo o el nº de LEDs no es un entero de 1 o más.
