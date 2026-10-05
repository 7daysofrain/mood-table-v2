# Montaje del hardware

> **Borrador.** Describe el montaje de referencia de Mood Table: una Raspberry Pi, una tira LED por
> Adalight con un Light Box y una tarjeta de sonido USB. Los datos marcados con ✅ se han comprobado en
> el aparato real; los marcados con ⏳ están **pendientes de verificar** y no deben darse por buenos.
> **Un error de cableado puede quemar la tira, el Light Box o la Pi:** sigue el orden y no te saltes las
> comprobaciones.

Este documento cubre el **hardware**. La instalación del software (clonar, `deploy/install.sh`, el
fichero de configuración y el servicio) está en el [README §1.4](readme.md#3-en-la-mesa-raspberry-pi-con-tira-real).

## 1. Piezas

| Pieza | Montaje de referencia | Estado |
|---|---|---|
| **Ordenador** | Raspberry Pi 4 Model B, 8 GB de RAM | ✅ |
| **Alimentación de la Pi** | Su propio transformador USB-C a la red, **separado** del de la tira | ✅ |
| **Sistema** | Raspberry Pi OS **de 64 bits** (Node.js 24 no tiene versión oficial para ARM de 32 bits) | ⏳ hoy tiene Raspbian de 32 bits: hay que reinstalar |
| **Red** | WiFi | ✅ |
| **Salida de luz** | Light Box Dream Color: conversor USB-serie CH340 (`1a86:7523`) que habla Adalight | ✅ |
| **Tira** | LEDs direccionables de 5 V tipo WS2812B (pistas `+5V`, `Din`, `GND`; una flecha marca el sentido de los datos). Vino en un kit "Dream Color" junto al Light Box y su adaptador | ✅ 5 V · ⏳ chip exacto y número de LEDs |
| **Fuente de la tira** | Adaptador AC/DC YU0508: **5 V · 8 A**, clavija de barril con el **positivo en el centro**. Mide 5,36 V en la entrada de la tira, con la tira apagada | ✅ |
| **Audio** | Tarjeta de sonido USB C-Media "USB PnP Sound Device" (`08bb:2902`), captura **mono**, 44,1/48 kHz | ✅ |
| **Cable de audio** | RCA → minijack, desde la salida **booth** del mixer | ✅ |

**Alternativa de fuente para tiras más largas:** Mean Well LRS-100-5 (5 V · 18 A), con bornes de
tornillo. Su lado de 230 V va cableado de fábrica a la red en el montaje actual; este documento **no**
explica cómo cablear la red: si hay que hacerlo, que lo haga alguien con experiencia, con la tierra
(`⏚`) conectada y los bornes tapados. ⏳ Sin verificar para este montaje.

## 2. Conexiones

```mermaid
flowchart LR
  red1["🔌 Red 230 V"] --> trafoPi["Transformador USB-C<br/>de la Pi"]
  red2["🔌 Red 230 V"] --> fuente["Adaptador 5 V · 8 A"]
  trafoPi -->|USB-C| pi["Raspberry Pi 4"]
  mixer["🎚️ Mixer · salida booth"] -->|RCA → minijack| tarjeta["Tarjeta de sonido USB"]
  tarjeta -->|USB| pi
  pi -->|USB| lightbox["Light Box<br/>(CH340 · Adalight)"]
  lightbox -->|"cable DATA<br/>(datos + masa)"| tira["Tira LED 5 V<br/>extremo Din"]
  fuente -->|"clavija de barril<br/>(+5V y GND)"| tira
```

- **El Light Box no alimenta la tira:** solo tiene los conectores `USB` y `DATA`. Se alimenta del USB de
  la Pi y manda los datos a la tira.
- **La tira se alimenta directamente de su fuente**, por la clavija de barril hembra que sale del mismo
  empalme que el cable de datos.
- **La Pi no se alimenta de la fuente de la tira.** Los saltos de consumo de la tira (de negro a blanco)
  bajan la tensión y la Pi 4 se reinicia o se ralentiza; con fuentes separadas, un fallo en la tira no
  se lleva la Pi.
- **Los datos entran por el extremo `Din`** de la tira (la flecha impresa apunta en el sentido de los
  datos). Por el otro extremo no funciona.
- **Masa común:** la masa del cable `DATA` y la de la fuente tienen que estar unidas en la tira para
  que la señal tenga referencia. ✅ En este montaje lo están: los datos del Light Box llegan a la tira
  con la referencia buena (§6).
- **Cables en la entrada de la tira:** **negro → `GND`**, **rojo claro → `Din`**, **rojo oscuro →
  `+5V`**. Ojo: hay **dos cables rojos** y el del centro es el de **datos**, no el de corriente.

### Proteger el primer LED

El primer LED recibe la señal directamente del Light Box y es el que más sufre: en este montaje **los
LEDs 1 y 2 murieron** tras desenchufar y volver a enchufar los cables (§6). Para que no vuelva a pasar:

- **Orden al conectar:** primero la **masa** (o la tira con su alimentación), y los **datos al final**.
  Al desconectar, al revés: los datos primero. Nunca metas datos en una tira sin alimentación.
- ⏳ **Resistencia de unos 330 Ω en serie con `Din`**, soldada lo más cerca posible de la tira. Limita
  la corriente que entra al primer LED si algo va mal. Es la protección habitual en tiras WS2812B; aún
  no está puesta en este montaje.

## 3. Potencia: la fuente manda

A blanco total, cada LED WS2812B consume unos **60 mA** (la cifra que usa la ficha: 5 V · 18 A ≈ 300
LEDs). Con el adaptador de 8 A:

| LEDs en la tira | Consumo a blanco total | ¿Cabe en 8 A? |
|---|---|---|
| 100 | ≈ 6 A | Sí |
| 133 | ≈ 8 A | Justo, sin margen |
| 200 | ≈ 12 A | **No** |

- ⏳ **Cuenta los LEDs reales de la tira** antes de declararla. La configuración heredada de la v1 dice
  200, y tras la reparación de §6 la tira tiene **dos menos**. Midiendo los metros y contando los LEDs
  de 10 cm (3 = 30/m, 6 = 60/m) sale la cuenta.
- Declara en el fichero de configuración el **límite de potencia** de la fuente de cada tira; el motor
  baja el brillo de cada frame para no superarlo (E8). Con 200 LEDs y este adaptador, ese límite es lo
  único que impide pedirle más de lo que da.
- ⏳ En tiras largas, la tensión cae hacia el final (los últimos LEDs se ven más rojizos o tenues). Se
  mide con el polímetro en §5; si cae mucho, se alimenta también por el otro extremo.

## 4. Montaje paso a paso

Haz todo **con todo desenchufado de la red** y enchufa solo cuando lo diga el paso.

1. **Pi.** Graba Raspberry Pi OS de 64 bits en la tarjeta SD (con Raspberry Pi Imager: WiFi, usuario y
   SSH se configuran ahí). Alimenta la Pi con su transformador.
2. **Light Box.** Conéctalo por USB a la Pi.
3. **Tira, alimentación.** Antes de conectar la tira, comprueba con el polímetro la salida de la fuente
   (§5, medidas 1 y 2). Después conecta la clavija de barril a la tira y enchufa la fuente.
4. **Tira, datos (lo último).** Conecta el cable de datos de la tira (el extremo `Din`) al conector
   `DATA` del Light Box, hasta el fondo. Va después de la alimentación para proteger el primer LED (§2).
5. **Audio.** Conecta la tarjeta de sonido por USB a la Pi y el cable RCA → minijack desde la salida
   **booth** del mixer a la **entrada** de la tarjeta.
6. **Comprueba** que la Pi ve todo (§7) y sigue con la instalación del software (README §1.4).

## 5. Comprobaciones con el polímetro

Basta un polímetro digital básico con tensión continua y continuidad (el de este montaje es un
autorrango, así que no hay que elegir escala). **Cable negro en `COM`, rojo en `VΩmA`; nunca en `10A`**,
que es para medir corriente. Todas las medidas son de 5 V: no hay peligro, pero **no acerques las puntas
a bornes de 230 V**.

| # | Qué | Cómo | Valor esperado | Medido |
|---|---|---|---|---|
| 1 | La fuente da 5 V | Rueda en `V⎓`. Fuente enchufada, sin tira. Punta roja dentro de la clavija (centro), negra fuera | Entre 4,9 y 5,3 V | — |
| 2 | Polaridad | Misma medida | **Positiva.** Si sale negativa, **no conectes la tira** | — |
| 3 | Llega corriente a la tira | Rueda en `V⎓`, tira conectada. Roja en `+5V`, negra en `GND`, en las pistas de entrada | ≈ 5 V | ✅ 5,36 V |
| 4 | Caída al final | Igual, en el último LED, con la tira en blanco y brillo bajo | ⏳ umbral por fijar | ⏳ |
| 5 | Llegan datos | Rueda en `V⎓`, **con la Pi encendida y enviando**. Roja en `Din`, negra en `GND` | Algo por encima de 0 (es la media de los pulsos) | ✅ 1,2-1,3 V en la entrada |
| 6 | Sin cruces entre pistas | Rueda en continuidad (`·)))`), **todo desenchufado**. Puntas en dos soldaduras vecinas | **No pita** | ✅ `Din`-`+5V` no pita |

- La medida 3 sale algo por encima de 5,3 V (el máximo recomendado para WS2812B) porque se toma con la
  tira apagada; con LEDs encendidos baja.
- **La medida 5 solo vale con la Pi encendida:** el Light Box se alimenta de su USB, y sin ella no manda
  nada y siempre sale 0.

**Primer encendido:** brillo bajo y pocos LEDs encendidos; sube poco a poco.

## 6. Diagnóstico: la tira no enciende

Una tira WS2812B con corriente pero **sin datos válidos se queda apagada del todo**, así que "apagada"
no dice si falla la alimentación o los datos. El orden que funcionó en este montaje:

1. **Software** (desde la Pi): el Light Box aparece en `lsusb` y el programa que manda los datos tiene el
   puerto abierto y escribe en él (§7).
2. **Alimentación:** medida 3. Si no hay 5 V, el problema es la fuente, la clavija o el cable.
3. **Datos tras el LED 1:** medida 5, en el `Din` entre el LED 1 y el LED 2.
4. **Datos en la entrada:** medida 5 en las soldaduras de entrada (hay que abrir el termorretráctil del
   empalme). Si hay datos en la entrada y no después del LED 1, **el LED 1 está muerto**.
5. **Puente de prueba:** con un trozo de cable pelado solo en las puntas, une la soldadura `Din` de la
   entrada con el `Din` de un LED más adelante. Si la tira se enciende a partir de ese LED, el anterior
   está muerto. Con calma: si el cable resbala a `+5V`, metes 5 V en la salida del Light Box.

**Lo que se encontró (5-oct-2026):** 5,36 V en la entrada, datos en la entrada del LED 1 y nada después;
con el puente al LED 3 la tira se enciende, y al LED 2 no. **Los LEDs 1 y 2 están muertos**; el Light
Box, su cable y la fuente funcionan.

**Reparación** (⏳ pendiente; hace falta soldador):

1. Desenchufa la corriente de la tira y el cable de datos del Light Box.
2. Corta la tira por la línea blanca entre el LED 2 y el LED 3, por el medio de las pistas de cobre.
3. Desuelda los tres cables del trozo que sobra.
4. Suéldalos a las pistas de entrada del LED 3: **negro → `GND`**, **rojo claro → `Din`**, **rojo oscuro
   → `+5V`**. Es buen momento para poner la resistencia de 330 Ω en `Din` (§2).
5. Medida 6 entre soldaduras vecinas antes de enchufar; después cubre el empalme con termorretráctil.

## 7. Comprobar que la Pi ve el hardware

Desde la Pi (por SSH):

```bash
lsusb
```

Deben aparecer `QinHeng Electronics CH340 serial converter` (el Light Box) y
`Texas Instruments PCM2902 Audio Codec` (la tarjeta de sonido; se anuncia como C-Media).

```bash
ls -l /dev/serial/by-id/
```

El Light Box aparece como `usb-1a86_USB2.0-Serial-if00-port0 -> ../../ttyUSB0`. **En la configuración
usa la ruta `/dev/serial/by-id/…`**: `ttyUSB0` puede cambiar de número al reiniciar o enchufar otro
dispositivo serie.

```bash
arecord -l
```

La tarjeta aparece como `card N: Device [USB PnP Sound Device]`. Usa su nombre,
`plughw:CARD=Device,DEV=0`, no el número `N`, que también puede cambiar.

**Permisos:** el usuario que ejecuta el motor tiene que estar en los grupos `dialout` (puerto serie) y
`audio` (tarjeta de sonido).

**Puerto ocupado:** si en la Pi sigue instalado Hyperion (la v1), tiene abierto el puerto del Light Box
y el motor no puede usarlo. Con la reinstalación del paso 1 desaparece.

**¿Se están mandando datos?** Mientras un programa escribe en el puerto, su fecha de modificación avanza:

```bash
stat -c %y /dev/ttyUSB0; sleep 12; stat -c %y /dev/ttyUSB0
```

Si las dos horas son distintas, se está escribiendo.

## 8. Audio: nivel de entrada

- Estas tarjetas suelen tener **entrada de micrófono**, y la salida booth es de **nivel de línea**:
  puede saturar y los efectos reaccionarían a tope todo el rato. ⏳ Comprobar con música real y, si
  satura, bajar la ganancia de captura con `alsamixer` (tecla `F4`) o usar un cable atenuador.
- La tarjeta captura en **mono**: del RCA solo se usa un canal (normalmente el izquierdo). Para analizar
  la música basta.
- **El mando booth del mixer cambia cuánto reaccionan los efectos.** Ajústalo una vez y no lo toques
  durante la sesión.

## 9. Pendientes

- ⏳ Reparar la tira: saltarse los LEDs 1 y 2 soldando la entrada al LED 3 (§6), y ver la tira entera
  encendida con Hyperion.
- ⏳ Resistencia de 330 Ω en serie con `Din` (§2).
- ⏳ Número real de LEDs (tras la reparación) y chip exacto de la tira.
- ⏳ Medidas 1, 2 y 4 de §5.
- ⏳ Reinstalar la Pi con Raspberry Pi OS de 64 bits, **después** de ver la tira encendida con Hyperion.
- ⏳ Nivel de audio con música real.
- ⏳ Montaje alternativo con Arduino y el sketch Adalight: no forma parte del montaje de referencia.
