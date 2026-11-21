# Montaje del hardware

> Describe el montaje de referencia de Mood Table, el de la mesa del autor: una Raspberry Pi, una tira
> LED por Adalight con un Arduino Uno y una tarjeta de sonido USB. Lo marcado con ✅ se ha comprobado en
> el aparato real; lo marcado con ⏳ está **pendiente** y no debe darse por bueno.
> **Un error de cableado puede quemar la tira, el Arduino o la Pi:** sigue el orden y no te saltes las
> comprobaciones.

Este documento cubre el **hardware**. La instalación del software (clonar, `deploy/install.sh`, el
fichero de configuración y el servicio) está en el [README §1.4](readme.md#3-en-la-mesa-raspberry-pi-con-tira-real).

## 1. Piezas

| Pieza | Montaje de referencia | Estado |
|---|---|---|
| **Ordenador** | Raspberry Pi 4 Model B, 8 GB de RAM | ✅ |
| **Alimentación de la Pi** | Su propio transformador USB-C a la red, **separado** del de la tira | ✅ |
| **Sistema** | Raspberry Pi OS Lite **de 64 bits** (Debian 13 *trixie*, `arm64`), sin escritorio (§4.2). Node.js 24 no tiene versión oficial para ARM de 32 bits | ✅ |
| **Red** | WiFi | ✅ |
| **Controlador de la tira** | Arduino Uno (clon con chip USB CH340, `1a86:7523`) con el sketch [Adalight-FastLED](https://github.com/dmadison/Adalight-FastLED) (§4.1; decisión D46 de la ficha) | ✅ |
| **Tira** | BTF-LIGHTING WS2812B de 5 V, 60 LEDs/m, IP65 (funda de silicona): **153 LEDs**, unos 2,55 m, contados en la mesa (§4.1). Orden de color GRB; pistas `+5V`, `Din` y `GND`, y una flecha marca el sentido de los datos | ✅ |
| **Fuente de la tira** | Mean Well LRS-100-5: **5 V · 18 A**, con bornes de tornillo (`+V` y `−V` a la tira; `L`, `N` y tierra `⏚` a la red). La tira toma la corriente por un solo extremo, así que la configuración declara **8 A** a propósito (§3, D123) | ✅ |
| **Audio** | Tarjeta de sonido USB C-Media "USB PnP Sound Device" (`08bb:2902`), captura **mono**, 44,1/48 kHz | ✅ |
| **Mixer** | Pioneer XDJ-AZ: salida **Booth** (dos jacks de 6,35 mm TRS balanceados, L y R, con su propio mando de nivel) | ✅ |
| **Cable de audio** | Minijack **de 3 contactos (TRS)** a dos jacks mono de 6,35 mm; solo el **izquierdo**, a *Booth L*. No uno de auriculares con micrófono (4 contactos, TRRS): §8 | ✅ |

**Cualquier controlador Adalight sirve.** El primer montaje usaba un kit "Dream Color": una tira de 173
LEDs, un adaptador de barril YU0508 de 5 V · 8 A y el **Light Box**, un controlador Adalight con el
mismo chip CH340 que **se averió** (§6) y que sustituyó el Uno. El 21-nov, la tira y el adaptador se
cambiaron por los de esta tabla. Un Arduino Nano con CH340 funciona igual que el Uno y ocupa menos.

**La red de la fuente.** El lado de 230 V de la LRS-100-5 va a la red por sus bornes, y este documento
**no** explica cómo cablearlo: si hay que hacerlo, que lo haga alguien con experiencia. Va con la tierra
(`⏚`) conectada, los bornes tapados y la fuente ventilada: se calienta, y nunca debe ir encerrada sin
aire. ⏳ En la mesa faltan la tierra (el cable de red es de dos hilos) y la tapa de los bornes (§9).

## 2. Conexiones

```mermaid
flowchart LR
  red1["🔌 Red 230 V"] --> trafoPi["Transformador USB-C<br/>de la Pi"]
  red2["🔌 Red 230 V"] --> fuente["Mean Well LRS-100-5<br/>5 V · 18 A"]
  trafoPi -->|USB-C| pi["Raspberry Pi 4"]
  mixer["🎚️ XDJ-AZ · Booth L"] -->|jack mono → minijack| tarjeta["Tarjeta de sonido USB"]
  tarjeta -->|USB| pi
  pi -->|USB| uno["Arduino Uno<br/>(CH340 · Adalight)"]
  uno -->|"pin 6 → Din<br/>GND → GND<br/>(conector de clip)"| din["Tira LED 5 V<br/>extremo Din"]
  din --- do["extremo DO"]
  fuente -->|"+V y −V<br/>(cables de alimentación)"| do
```

- **El Arduino no alimenta la tira:** se alimenta del USB de la Pi y solo manda los datos.
- **La tira se alimenta directamente de su fuente**, por los dos cables de alimentación de su extremo
  `DO`, atornillados a los bornes `+V` y `−V`.
- **La Pi no se alimenta de la fuente de la tira.** Los saltos de consumo de la tira (de negro a blanco)
  bajan la tensión y la Pi 4 se reinicia o se ralentiza; con fuentes separadas, un fallo en la tira no
  se lleva la Pi.
- **Los datos entran por el extremo `Din`.** Las flechas impresas apuntan en el sentido de los datos,
  así que se alejan de `Din`. Por el otro extremo la tira no enciende, sin ningún error (§6).
- **La corriente puede entrar por cualquiera de los dos extremos**, o por los dos: las pistas `+5V` y
  `GND` recorren la tira entera. En la mesa entra por `DO` porque es donde la tira trae sus cables.
- **Masa común:** la masa del Arduino y la de la fuente tienen que estar unidas para que la señal tenga
  referencia. Aquí las une la pista `GND` de la tira, de punta a punta: si esa pista se rompe, la tira
  no enciende aunque llegue la corriente (§6).

### Los cables de la tira

La tira de la mesa no trae los cables en su extremo `Din`, sino en el `DO`:

| Extremo | Qué trae | Qué se conecta |
|---|---|---|
| **`Din`** (inicio) | Nada: viene cortado a tijera, con las pistas bajo la silicona | Un **conector de clip** de 3 pines para tira de 10 mm: `Din` al **pin 6** del Arduino y `GND` a su **`GND`**. El `+5V` del clip no se usa: aísla su punta |
| **`DO`** (final) | Un conector JST de 3 pines, para enlazar otra tira, y **dos cables sueltos de alimentación** | Los de alimentación, a la fuente: el de `+5V` a `+V` y el de `GND` a `−V`. El JST no se usa |

- **El clip muerde las pistas a través de la silicona:** hay que rascarla antes en las tres pistas,
  justo antes de un corte, y cerrar el clip con la flecha de la tira alejándose de él. Compruébalo con
  el polímetro antes de enchufar nada (§5, medida 7).
- **El cable de datos no lleva `+5V`.** El cable del `+5V` del clip no debe tocar nada: en el `5V` del
  Arduino uniría la fuente de la tira con el USB de la Pi, y en el pin 6 metería 5 V en su salida.
- **Arduino ↔ clip**, con pines Dupont metidos directamente en los conectores del Uno. ⏳ Sujetan
  regular; queda mejorar esta conexión (§9).

### Proteger el primer LED

El primer LED recibe la señal directamente del controlador y es el que más sufre: en la tira anterior
**los LEDs 1 y 2 murieron** tras desenchufar y volver a enchufar los cables (§6). Para que no vuelva a
pasar:

- **Orden al conectar:** primero la **corriente** de la tira y los **datos al final**. Al desconectar,
  al revés: los datos primero. Nunca metas datos en una tira sin alimentación.
- ⏳ **Resistencia de unos 330 Ω (220-470) en serie con `Din`**, lo más cerca posible de la tira. Limita
  la corriente que entra al primer LED si algo va mal. Es la protección habitual en tiras WS2812B; **en
  este montaje no está puesta** (riesgo asumido por el autor).

## 3. Potencia: la fuente manda

A blanco total, cada LED WS2812B consume unos **60 mA**, 20 mA por canal (la cifra que usa la ficha:
5 V · 18 A ≈ 300 LEDs). Con 153 LEDs son unos **9,2 A**: caben de sobra en los 18 A de la LRS-100-5.

- **Mood Table protege la fuente.** El fichero de configuración declara, en cada tira física, su chip
  y los amperios de su fuente (`"chip": "WS2812B"`, `"power": { "supplyAmps": 8 }`; README §3.2). El
  motor baja cada frame que pediría más del **80 %** de esos amperios (E8, README §2.2). Al arrancar, el
  log lo dice; en la mesa (21-nov):
  `Tira «Mesa»: fuente de 8 A, usará como mucho 6,4 A; en blanco total pide 9,18 A: bajará los frames que se pasen`.
  ✅ Con la tira anterior (173 LEDs, mismo límite) se comprobó el 12-nov, con el sketch a `255`: la
  respiración en blanco con la intensidad al máximo pasa por el blanco total sin que la fuente corte,
  la tira parpadee ni el Arduino se reinicie, y con el *espectro* y graves fuertes los LEDs tenues no
  se apagan. ⏳ Falta repetirlo con la tira de 153 y medir la tensión al final de la tira en un pico
  (§5).
- **En la mesa se declaran 8 A, no 18 (D123).** La corriente entra solo por el extremo `DO`, por dos
  cables finos y las pistas de cobre de la tira. Con 18 A declarados, el límite no bajaría nada y el
  blanco total pasaría sus 9,2 A por ahí, con la tensión cayendo hacia el otro extremo. Con 8 A, el
  motor no pasa de 6,4 A. Cuando la tira se alimente **por los dos extremos**, se vuelve a los 18 A de
  la etiqueta. Si la misma fuente alimenta **dos tiras**, se reparten los amperios a mano en sus
  `supplyAmps`, sin pasar entre las dos de los 18 A: cada tira solo conoce los suyos.
- **Copia los amperios de OUTPUT, no los de INPUT**, salvo que declares menos a propósito, como en la
  mesa. La etiqueta de la fuente lleva las dos cifras: INPUT es lo que toma de la red, y OUTPUT lo que
  da a la tira (18 A en la LRS-100-5).
- **Si cambias de fuente, cambia el fichero de configuración.** El motor no puede medir la fuente:
  se fía de lo declarado. Con una fuente más pequeña y el fichero sin cambiar, la sobrecargaría.
- **Por eso el sketch ya no limita el brillo** (`Brightness = 255`, §4.1). Antes lo dejaba en el 25 %
  (`64`), porque el programa que mandaba los colores no tenía límite propio.
- **Mood Table solo limita lo que pinta él.** Si la tira vuelve a recibir colores de otro programa sin
  límite propio, como Hyperion en la SD de la v1, la fuente queda sin proteger: vuelve a cargar antes
  el sketch con `64`. Si el límite debe cubrir también eso es una pregunta abierta (Q11 del PRD).
- **Un fusible o una fuente con protección contra sobrecorriente** (recomendado): el límite depende
  de que lo declarado sea cierto. Un fusible en el `+5V` de la tira, de no más amperios que la fuente,
  o una fuente que se corte sola al pasarse. La LRS-100-5 se corta sola ante una sobrecarga o un
  cortocircuito, según su ficha; ⏳ no se ha provocado en la mesa. Ojo: protege la fuente, no los
  cables finos de la tira, que es lo que cubre declarar 8 A.
- ⏳ En tiras largas, la tensión cae hacia el final (los últimos LEDs se ven más rojizos o tenues). Se
  mide con el polímetro en §5; si cae mucho, se alimenta también por el otro extremo.

## 4. Montaje paso a paso

Haz todo **con todo desenchufado de la red** y enchufa solo cuando lo diga el paso.

1. **Pi.** Graba Raspberry Pi OS Lite de 64 bits en la tarjeta SD con Raspberry Pi Imager, que deja
   configurados la WiFi, el usuario y el acceso por SSH (§4.2). Alimenta la Pi con su transformador.
2. **Arduino.** Cárgale el sketch Adalight (§4.1) y conéctalo por USB a la Pi.
3. **Tira, alimentación.** Antes de conectar la tira, enchufa la fuente a la red y comprueba con el
   polímetro sus bornes `+V` y `−V` (§5, medidas 1 y 2). Desenchúfala, atornilla los cables de
   alimentación del extremo `DO` (§2) y vuelve a enchufarla: se enciende su LED verde.
4. **Tira, datos (lo último).** Pon el conector de clip en el extremo `Din` y compruébalo (§5, medida
   7). Después conecta su `Din` al pin 6 del Arduino y su `GND` al `GND`. Va después de la alimentación
   para proteger el primer LED (§2).
5. **Audio.** Conecta la tarjeta de sonido por USB a la Pi, y el jack mono **izquierdo** del cable a
   la salida *Booth L* del mixer y su minijack a la **entrada** de la tarjeta, hasta el fondo. El
   izquierdo va por la punta del minijack, que es lo que lee la entrada de micro; el anillo (el
   derecho) lleva la alimentación de los micros *electret* y se queda sin conectar.
6. **Comprueba** que la Pi ve todo (§7) y sigue con la instalación del software (README §1.4).

### 4.1. Cargar Adalight en el Arduino

Se usa el sketch [Adalight-FastLED](https://github.com/dmadison/Adalight-FastLED) (licencia GPL-3, de
un tercero: no se copia al repositorio). Desde un ordenador con el Arduino conectado por USB:

```bash
brew install arduino-cli
arduino-cli core install arduino:avr
arduino-cli lib install FastLED
git clone https://github.com/dmadison/Adalight-FastLED.git
```

En `Adalight-FastLED/Arduino/LEDstream_FastLED/LEDstream_FastLED.ino`, cambia estos valores:

| Valor | En este montaje | Por qué |
|---|---|---|
| `Num_Leds` | `173` | Al menos los LEDs reales de la tira. Si pones más, sobran sin problema: cada frame dice cuántos LEDs trae. Si pones menos, los últimos no se encienden. Se quedó en 173, el valor de la tira anterior: con la de 153 no hubo que volver a cargar el sketch |
| `Brightness` | `255` | Sin tope: protege la fuente el límite de Mood Table (§3). Con otro programa sin límite propio, `64` (el 25 %) |
| `PIN_DATA` | `6` | El pin donde va el rojo de datos |
| `SerialSpeed` | `500000` | A 115.200, Adalight solo da 20 fps con 173 LEDs; a 500.000, 59 (D96), y 60 con los 153 de ahora. Es exacta para el Uno a 16 MHz. Con Hyperion se usaba 115.200 |
| `COLOR_ORDER` | `RGB` | El sketch pasa los canales tal como le llegan, porque Mood Table ya los manda en el orden de color del chip de la tira (D111). Con el `GRB` que trae el sketch, el orden se aplica dos veces y el rojo y el verde salen cambiados, sin ningún error. Con otro programa que mande los canales en RGB (Hyperion), `GRB` |

`LED_TYPE` (`WS2812B`) ya viene bien para esta tira. Compila y carga (el puerto aparece como
`/dev/cu.usbserial-…` en macOS):

```bash
cd Adalight-FastLED/Arduino/LEDstream_FastLED
arduino-cli compile --fqbn arduino:avr:uno .
arduino-cli upload --fqbn arduino:avr:uno -p /dev/cu.usbserial-XXXX .
```

**Desde la Pi, sin mover el Arduino** ✅. En la mesa, el Arduino ya va por USB a la Pi, así que se
puede cargar desde ella. arduino-cli se instala en el usuario `pi`, sin `sudo` (unos 520 MB con el
core y FastLED). Las versiones son las del montaje: sketch `3286d02`, core `arduino:avr` 1.8.8 y
FastLED 3.10.7.

```bash
cd /tmp
curl -fsSLO https://downloads.arduino.cc/arduino-cli/arduino-cli_1.5.1_Linux_ARM64.tar.gz
curl -fsSL https://downloads.arduino.cc/arduino-cli/1.5.1-checksums.txt | grep Linux_ARM64.tar.gz | sha256sum -c -
mkdir -p ~/.local/bin && tar -xzf arduino-cli_1.5.1_Linux_ARM64.tar.gz -C ~/.local/bin arduino-cli
arduino-cli core update-index
arduino-cli core install arduino:avr@1.8.8
arduino-cli lib install FastLED@3.10.7
cd ~ && git clone https://github.com/dmadison/Adalight-FastLED.git
cd Adalight-FastLED && git checkout 3286d02
```

Cambia los valores de la tabla de arriba y compila igual. Para cargar, el motor tiene que soltar el
puerto: para el servicio antes y arráncalo después.

```bash
sudo systemctl stop moodtable
arduino-cli upload --fqbn arduino:avr:uno -p /dev/ttyUSB0 ~/Adalight-FastLED/Arduino/LEDstream_FastLED
sudo systemctl start moodtable
```

**Orden de color en Mood Table:** no se declara en el fichero de configuración. Lo fija el chip de la
tira (`"chip": "WS2812B"`, que es GRB), y el motor reordena los canales antes de mandarlos. Por eso el
sketch tiene que llevar `COLOR_ORDER` en `RGB`, y el motor y el sketch se actualizan juntos: con un
motor anterior a `MOO-146` y el sketch en `RGB`, el rojo y el verde también salen cambiados.

**Contar los LEDs sin contarlos uno a uno** (✅ 21-nov): con el motor parado (`sudo systemctl stop
moodtable`) y el sketch cargado con más LEDs de los que hay, manda al puerto, a sus baudios, un frame
Adalight con el LED 1 en **blanco**, uno **verde** cada 10, uno **rojo** cada 50 y el resto apagado.
Repítelo cada décima de segundo y espera 2,5 s antes del primero: al abrir el puerto, el Uno se
reinicia. El frame va directo al sketch, sin pasar por el motor, así que nadie reordena los canales:
mándalos ya en GRB, el orden de la `WS2812B`, o el rojo y el verde saldrán cambiados. La cuenta sale de
lo que se ve al final de la tira: en la mesa, tres LEDs después del tercer rojo (el 150) = **153**. Al
acabar, arranca otra vez el motor.

### 4.2. Grabar el sistema de la Pi

Con [Raspberry Pi Imager](https://www.raspberrypi.com/software/) (en macOS, `brew install --cask
raspberry-pi-imager`) y un lector de tarjetas SD. Elige **Raspberry Pi 4**, luego **Raspberry Pi OS
(other) → Raspberry Pi OS Lite (64-bit)**, y como destino la tarjeta: comprueba el tamaño para no
borrar otro disco. Lite no trae escritorio: la mesa no tiene pantalla y así no compite con el motor.

En la personalización:

| Pantalla | Valor en este montaje | Por qué |
|---|---|---|
| Hostname | `moodtable` | Se llega a la Pi como `moodtable.local`, aunque el router le cambie la IP |
| Localisation | Zona `Europe/Madrid`, teclado `es`, país de la WiFi `ES` | El país fija los canales de WiFi que puede usar |
| User | `pi`. Se recomienda una contraseña **propia** en lugar de la antigua de fábrica; en este montaje se mantiene la de fábrica | `sudo` la pide; por SSH no se usa, porque solo se entra con clave |
| Wi-Fi | La red de casa | La mesa se conecta por WiFi (§1) |
| Remote access | SSH **solo con clave pública** | Sin contraseñas por la red |
| Raspberry Pi Connect | Desactivado | Es acceso remoto por internet; la mesa no lo necesita |

**En Remote access se pega la clave, no la ruta del fichero.** Imager guarda tal cual lo que hay en el
campo: si escribes `~/.ssh/id_ed25519.pub`, la Pi apunta ese texto como clave y rechaza la conexión. En
macOS, copia la clave con:

```bash
pbcopy < ~/.ssh/id_ed25519.pub
```

y pégala: es una sola línea que empieza por `ssh-ed25519 AAAA`.

**El primer arranque tarda unos 3 minutos** (amplía la partición, aplica la configuración y se reinicia
una vez). Después, desde el ordenador:

```bash
ssh pi@moodtable.local
```

**Si algo de la personalización salió mal, vuelve a grabar la tarjeta.** La configuración se aplica
una sola vez, en el primer arranque. Corregir después los ficheros de la partición de arranque
(`user-data`, `meta-data`) no la vuelve a aplicar: se probó en este montaje y la Pi siguió igual.

**Para comprobar que la tarjeta se ha grabado de verdad**, vuelve a meterla en el lector (Imager la
expulsa al terminar): en una tarjeta recién grabada la partición de Linux ocupa unos 2-3 GB (`diskutil
list` en macOS) y crece al tamaño de la tarjeta en el primer arranque. Si ocupa toda la tarjeta, no se
ha regrabado.

## 5. Comprobaciones con el polímetro

Basta un polímetro digital básico con tensión continua y continuidad (el de este montaje es un
autorrango, así que no hay que elegir escala). **Cable negro en `COM`, rojo en `VΩmA`; nunca en `10A`**,
que es para medir corriente. Todas las medidas son de 5 V: no hay peligro, pero **no acerques las puntas
a bornes de 230 V**.

| # | Qué | Cómo | Valor esperado | Medido |
|---|---|---|---|---|
| 1 | La fuente da 5 V | Rueda en `V⎓`. Fuente enchufada, sin tira. Punta roja en el borne `+V`, negra en `−V` | Entre 4,9 y 5,3 V | — |
| 2 | Polaridad | Misma medida | **Positiva.** Si sale negativa, **no conectes la tira** | — |
| 3 | Llega corriente a la tira | Rueda en `V⎓`, tira conectada. Roja en `+5V`, negra en `GND`, en el extremo **contrario** al de la fuente | ≈ 5 V | ✅ 5 V en el extremo `Din`, con la tira apagada (21-nov). Con la tira anterior, 5,36 V |
| 4 | Caída al final | Igual que la 3, con la tira en blanco y brillo bajo | ⏳ umbral por fijar | ⏳ |
| 5 | Llegan datos | Rueda en `V⎓`, **con la Pi encendida y enviando**. Roja en `Din`, negra en `GND` | Algo por encima de 0 que baila (es la media de los pulsos) | ✅ unos 2 V con el Uno (21-nov); 1,2-1,3 V con el Light Box sano |
| 6 | Sin cruces entre pistas | Rueda en continuidad (`·)))`), **todo desenchufado**. Puntas en dos pistas o soldaduras vecinas | **No pita** | ✅ |
| 7 | El clip hace contacto | Continuidad, **todo desenchufado**. Cada pin del clip con la pista de la tira que muerde; los de `+5V` y `GND`, también con su pista en el **otro extremo** | `+5V` y `GND` **pitan** de punta a punta; `Din` solo con su pista, no hasta el otro extremo (pasa por los chips) | ✅ (21-nov) |
| 8 | `GND` entera | Continuidad, **todo desenchufado**. `GND` de un extremo con `GND` del otro | **Pita.** Si no, la pista está rota: tramos cortos pitan y de punta a punta no (§6) | ✅ en la tira de la mesa; ❌ en el primer rollo |

- Con la fuente en el extremo `DO`, la medida 3 se toma en el `Din`: es el punto más lejano, y donde
  más cae la tensión. Con la tira apagada no hay caída; con LEDs encendidos baja, y eso es la medida
  4. No debe pasar de 5,3 V, el máximo recomendado para WS2812B.
- **La medida 5 solo vale con la Pi encendida:** el controlador se alimenta de su USB, y sin ella no
  manda nada y siempre sale 0. Un valor **fijo cerca de 5 V** tampoco es bueno: es una línea clavada en
  alto, no datos (§6).
- Entre el `Din` de un LED y el del siguiente **no hay continuidad**: la señal pasa por dentro del chip
  del LED. Es normal que no pite.

**Primer encendido:** brillo bajo y pocos LEDs encendidos; sube poco a poco.

## 6. Diagnóstico: la tira no enciende

Una tira WS2812B con corriente pero **sin datos válidos se queda apagada del todo**, así que "apagada"
no dice si falla la alimentación o los datos. El orden que funcionó en este montaje:

1. **El efecto:** mira en el panel qué efecto tiene la tira. La *energía* y el *scroll* reaccionan al
   audio y **se apagan en silencio**: sin música, la tira se queda negra aunque todo funcione. Pon la
   *respiración*, que pinta siempre. Fue la causa de "no se enciende" dos veces el 21-nov.
2. **Software** (desde la Pi): el controlador aparece en `lsusb` y el programa que manda los datos tiene
   el puerto abierto y escribe en él (§7).
3. **Extremo:** los datos tienen que entrar por `Din`, el extremo del que se **alejan** las flechas.
   Conectados al `DO`, la tira no enciende y no hay ningún error.
4. **Alimentación:** medida 3. Si no hay 5 V, el problema es la fuente, los bornes o el cable. Si hay
   corriente y datos y no enciende nada, mira que la pista `GND` esté entera (medida 8).
5. **Datos tras el primer LED:** medida 5 en el `Din` entre el LED 1 y el LED 2.
6. **Datos en la entrada:** medida 5 en las soldaduras de entrada (hay que abrir el termorretráctil del
   empalme). Si hay datos en la entrada y no después del LED 1, **el LED 1 está muerto**.
7. **Puente de prueba:** con un trozo de cable pelado solo en las puntas, une la soldadura `Din` de la
   entrada con el `Din` de un LED más adelante. Si la tira se enciende a partir de ese LED, el anterior
   está muerto. Con calma: si el cable resbala a `+5V`, metes 5 V en la salida del controlador.
8. **Controlador:** compara la medida 5 **con el cable de datos conectado y sin él**. Sin él sale 0; si
   con él sale un valor **fijo cerca de 5 V** y el puente a otros LEDs tampoco enciende nada, el
   controlador tiene la línea clavada en alto. Desenchufarle el USB 10 segundos lo reinicia; si sigue
   igual, está averiado.

**Software conocido para comparar.** Si la tira no enciende con Mood Table, saber si falla el hardware o
el código nuevo es más fácil con un programa que ya funcionaba. En este montaje, al instalar el sistema
de 64 bits se usó **una tarjeta SD nueva** y se guardó la anterior (Raspbian de 32 bits con Hyperion, el
software de la v1): cambiar de tarjeta vuelve a Hyperion en un minuto. Cada tarjeta tiene su propia
identidad SSH, así que tras cambiarla el ordenador avisa de que la clave del equipo ha cambiado. Es
esperado; se borra la antigua con:

```bash
ssh-keygen -R moodtable.local
```

**Lo que se encontró** en este montaje:

- **LEDs 1 y 2 muertos** (5-oct-2026, tira anterior): 5,36 V en la entrada, datos en la entrada del LED 1 y nada
  después; con el puente al LED 3 la tira se encendía, y al LED 2 no. **Reparado** cortando la tira entre
  el LED 2 y el LED 3 y soldando los cables a la entrada del LED 3 (16-oct). La tira pasa de 175 a 173
  LEDs.
- **Light Box averiado** (16-oct): tras la reparación, con el Light Box conectado `Din` marcaba 4-6 V
  fijos (0 V sin él), y ni el puente al segundo LED encendía nada. Reiniciarlo no lo arregló. Con un
  Arduino Uno con Adalight en su lugar, la tira se enciende entera.
- **Datos por el extremo equivocado** (21-nov, tira nueva): la tira trae su conector y sus cables en el
  extremo `DO` (las flechas apuntan hacia él), y con los datos ahí no encendía nada. El extremo `Din`
  venía cortado y sin conector: se resolvió con el conector de clip (§2).
- **Pista `GND` rota en el primer rollo** (21-nov): con la corriente por un extremo y los datos por el
  otro, nada. La continuidad de `GND` pitaba en tramos cortos y no de punta a punta (medida 8): la
  pista estaba cortada a mitad de la tira y la masa del Arduino no llegaba a la de la fuente. Se apartó
  y se usó un segundo rollo del mismo modelo, que pita entero.
- **Tira negra por el efecto** (21-nov, dos veces): con todo bien conectado, el panel tenía la tira en
  un efecto reactivo y sin música (paso 1).
- **Arduino desenchufado en caliente** (21-nov): al volver a enchufarlo, la tira no vuelve hasta
  reiniciar el motor (§7, `MOO-112`).

**Cómo se reparó la tira anterior** (hace falta soldador; el estaño sin plomo funde mejor con flux):

1. Desenchufa la corriente de la tira y los datos del controlador.
2. Corta la tira por la línea blanca entre el último LED muerto y el siguiente, por el medio de las
   pistas de cobre.
3. Desuelda los cables del trozo que sobra: una gota de flux, la punta del soldador sobre la soldadura y
   un tirón suave del cable.
4. Estaña las tres pistas del nuevo primer LED y suelda: los dos negros a `GND`, el rojo de datos a
   `Din` y el rojo de corriente a `+5V` (§2).
5. Medida 6 entre soldaduras vecinas y, con el polímetro en continuidad, cada cable con su soldadura
   antes de enchufar; después cubre el empalme con termorretráctil o cinta aislante.

## 7. Comprobar que la Pi ve el hardware

Desde la Pi (por SSH, `ssh pi@moodtable.local`). Primero, que el sistema sea de 64 bits:

```bash
dpkg --print-architecture
```

Tiene que decir `arm64`. Con `armhf`, el sistema es de 32 bits aunque `uname -m` diga `aarch64` (el
kernel sí es de 64 bits): era el caso de esta Pi antes de reinstalarla. Con ese sistema, Node.js 24 no
se puede instalar.

```bash
lsusb
```

Deben aparecer `QinHeng Electronics CH340 serial converter` (el Arduino) y
`Texas Instruments PCM2902 Audio Codec` (la tarjeta de sonido; se anuncia como C-Media).

```bash
ls -l /dev/serial/by-id/
```

El Arduino aparece como `usb-1a86_USB2.0-Ser_-if00-port0 -> ../../ttyUSB0` (el Light Box se llamaba
`usb-1a86_USB2.0-Serial-if00-port0`: el nombre depende de cada placa). **En la configuración usa la ruta
`/dev/serial/by-id/…`**: `ttyUSB0` puede cambiar de número al reiniciar o enchufar otro dispositivo
serie.

```bash
arecord -l
```

La tarjeta aparece como `card N: Device [USB PnP Sound Device], device 0: …`. La cadena que va en el
`device` de la fuente de audio (`audioSource`, README §3) se arma con el nombre que sale antes de los
corchetes y el número de `device`: `plughw:CARD=Device,DEV=0`.

- **El nombre, no el número `N`**, que puede cambiar: en este montaje pasó de la `card 2` a la `card 1`
  al reinstalar la Pi sin la pantalla de la v1.
- **`plughw`, no `hw`**: el motor pide 16 bits, mono, a 48 kHz, y `plughw` convierte en ALSA si la
  tarjeta no lo graba así. La de la mesa sí, pero muchas USB baratas solo graban en estéreo, y con
  `hw` el motor no arrancaría.
- **Dos tarjetas iguales** se llaman igual, y ALSA renombra la segunda (`Device_1`) según el orden en
  que las detecta, que puede cambiar. Para fijarlo, una regla de udev que dé a cada una un nombre por
  el puerto USB en el que está (atributo `id` del dispositivo de sonido). No está automatizado.

Para comprobar que el motor podrá leerla, graba 3 segundos con los mismos parámetros que usa:

```bash
arecord -D plughw:CARD=Device,DEV=0 -t raw -f S16_LE -c 1 -r 48000 -d 3 > /dev/null
```

Si no dice nada, la tarjeta se abre. Si dice `audio open error`, la cadena no existe o la tarjeta no
está conectada: es lo mismo que dirá el motor al no arrancar.

**Permisos:** el usuario que ejecuta el motor tiene que estar en los grupos `dialout` (puerto serie) y
`audio` (tarjeta de sonido).

**Puerto ocupado:** si en la Pi sigue instalado Hyperion (la v1), tiene abierto el puerto del Arduino y
el motor no puede usarlo. Con el sistema nuevo del paso 1 (§4.2) no está.

**¿Se están mandando datos?** Mientras un programa escribe en el puerto, su fecha de modificación avanza:

```bash
stat -c %y /dev/ttyUSB0; sleep 12; stat -c %y /dev/ttyUSB0
```

Si las dos horas son distintas, se está escribiendo.

### La tira en el motor

La tira física se declara en `config/local.json` con salida `adalight` (campos en el README §3). La de
la mesa:

```json
{
  "id": "mesa",
  "name": "Mesa",
  "output": {
    "type": "adalight",
    "port": "/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0",
    "baudRate": 500000,
    "chip": "WS2812B",
    "power": { "supplyAmps": 8 }
  },
  "ledCount": 153,
  "effect": "breathing"
}
```

- **`baudRate` tiene que ser el `SerialSpeed` del sketch** (§4.1), y `ledCount`, los LEDs reales de la
  tira, nunca más que su `Num_Leds`. Adalight no confirma nada, así que el motor no puede comprobarlo:
  con otros baudios, la tira no enciende o pinta basura, sin ningún mensaje.
- **En la mesa, el fichero que lee el servicio es `/opt/moodtable/config/local.json`**, del usuario
  `moodtable`: se edita con `sudo -u moodtable` y se reinicia el servicio (`sudo systemctl restart
  moodtable`). Un clon del repositorio en la carpeta de `pi` tiene su propio `config/local.json`, que el
  servicio no lee.
- **Al arrancar el motor, la tira tarda un segundo o dos en encenderse.** Al abrir el puerto, el Uno se
  reinicia (la línea DTR), y mientras arranca el sketch los frames se pierden sin hacer daño. Al parar
  el motor, el Uno se vuelve a reiniciar y la tira se queda como estaba o se apaga.
- **La medida del log.** Tras los primeros 50 frames, el motor dice una vez cuánto tarda cada uno en
  salir por el puerto y a cuántos frames por segundo va la tira. ✅ En la mesa (21-nov):

  ```
  Tira «Mesa»: 10 ms por frame, 60 fps (500000 baudios, 153 LEDs)
  ```

  Con la tira anterior de 173 LEDs eran 11 ms y 59 fps (5-nov), y a 115.200 baudios, 45 ms y 20 fps
  (4-nov).

  Esos milisegundos más un pulso del motor (16,7 ms a 60 fps) es lo que tarda la tira física, como
  mucho, en pintar lo que ya pinta el visor: tiene que quedar por debajo de 100 ms. Con más LEDs o
  menos baudios sube, y los fps bajan a saltos (20, 15, 12…), porque cada frame ocupa un número
  entero de pulsos.
- **Si el motor no arranca** con «no se puede abrir el puerto serie», el motivo va al final: el puerto
  no existe (el Arduino no está conectado o la ruta está mal escrita), el usuario no está en
  `dialout`, o lo tiene **bloqueado** otro programa (`Cannot lock port`, por ejemplo otro motor). ✅
  Comprobado en la mesa (4-nov).
- **Un programa que abre el puerto sin bloquearlo no se detecta**: un `cat`, un script o un monitor
  serie sencillo. El motor arranca, los dos escriben a la vez y la tira pinta una mezcla. ✅
  Comprobado en la mesa (4-nov) con un script de Python. Antes de arrancar, mira que nadie tenga el
  puerto:

  ```bash
  fuser /dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0
  ```

  Si no dice nada, está libre.
- **Si se desenchufa el Arduino con el motor en marcha**, el motor sigue: el visor y las demás tiras
  siguen pintando, y el log lo dice una vez (`… se ha perdido el puerto … deja de pintar`). Al volver
  a enchufarlo, la tira no vuelve hasta reiniciar el motor: la reconexión llega con
  [MOO-112](https://linear.app/7daysofrain/issue/MOO-112). ✅ Comprobado en la mesa (4-nov).

## 8. Audio: nivel de entrada

El motor no toca el mezclador de la tarjeta (D59): se ajusta una vez, al montar la mesa, con el
vúmetro de la cabecera del panel como medidor.

1. **Mira sus controles.** Cada tarjeta tiene los suyos; la de la mesa, `Mic` (la ganancia de
   grabación, de 0 a 16) y `Auto Gain Control`:

   ```bash
   amixer -c Device scontents
   ```

2. **Apaga el control automático de ganancia.** Sube lo flojo y baja lo fuerte: aplana justo la
   dinámica que tiene que mostrar *energía*. ✅ En la de la mesa, comprobado el 21-oct, no cambia el
   nivel de la grabación (`amixer` lo lista como control de reproducción); se apaga igualmente.

   ```bash
   amixer -c Device sset 'Auto Gain Control' off
   ```

3. **Ajusta el nivel** con música real: primero el mando *booth* del mixer, y luego la ganancia de
   grabación, por ejemplo `amixer -c Device sset Mic 5 cap` (cada paso son unos 1,5 dB). El vúmetro
   mide el nivel medio (RMS) cada 40 ms, y los picos de la música quedan bastante por encima: lo
   seguro es mirar los picos de verdad con el motor parado, grabando unos segundos con `arecord`
   (§7), y dejar 5 dB de margen hasta 0 dBFS. ✅ En la mesa (21-oct), la salida *booth* de la XDJ-AZ
   es de línea profesional: con el mando a medio recorrido **recortaba incluso con `Mic` a 0**. Con
   el mando **a un tercio** y **`Mic` a 5** (+7,4 dB), la música queda en unos −33 dBFS de mediana y
   −17 de máximo en el vúmetro; con `Mic` a 6, los picos de muestra llegaban a −4,1 dBFS sin
   recortar, así que con 5 quedan hacia −5,6. El
   mando es muy progresivo: de medio recorrido a un tercio baja unos 16 dB.
4. **Guárdalo**, para que sobreviva a un reinicio: `sudo alsactl store`.
5. **Elige el umbral de silencio** con el mixer conectado y en silencio. El vúmetro empieza en −60 dBFS,
   el umbral por defecto (`silenceThreshold`, README §3): si con el mixer en silencio el vúmetro se
   mueve, el ruido pasa del umbral y una tira con *energía* parpadearía. Sube `silenceThreshold` en
   `config/local.json` (por ejemplo, a −50) y reinicia el motor hasta que la tira se quede apagada.
   Si el ruido queda muy por debajo, puedes **bajar** el umbral para no perder los pasajes suaves de
   la música: déjalo unos 6 dB por encima del ruido. Con la entrada vacía, la tarjeta de la mesa da
   unos −80 dBFS de ruido. ✅ En la mesa (21-oct), con la XDJ-AZ en pausa, el *booth* a un tercio y
   `Mic` a 5, el ruido es de **−72 dBFS**, muy estable (no se mueve más de 1,5 dB), y no depende del
   mando *booth*. La música más floja de un tema rondaba −61: con −60, *energía* se apagaba en ella.
   Elegido **`silenceThreshold: −65`**: con la música, *energía* enciende el 92-97 % de los frames
   (el resto son los huecos entre golpes), y en pausa, ninguno.

- **Si el vúmetro se mueve con la música parada y cambia al tocar el cable, es el cable, no el
  umbral.** No subas `silenceThreshold` para taparlo: quedaría por encima de los pasajes suaves de
  la música y la tira se apagaría con ellos. En una prueba con un reproductor FiiO M21 y un cable
  con soporte de micrófono (jack de 4 contactos, TRRS) en la entrada de micro de la tarjeta (3
  contactos), el fondo con la música parada iba de −77 a −44 dBFS según cómo asentaba el jack: un
  zumbido de 100 Hz con sus armónicos, y chasquidos de hasta −2 dBFS al moverlo. Con el cable de
  la mesa (TRS), al moverlo hay chasquidos, pero al soltarlo vuelve al mismo fondo. El jack de 4
  contactos cruza la masa con la línea del micro, que además lleva la alimentación de los micros
  *electret*. Usa un cable de 3 contactos o mono, encajado hasta el fondo. Si con él sigue un
  zumbido estable de 100 Hz, es un lazo de masa: enchufa la Pi y el mixer a la misma regleta o
  pon un aislador de masa en la salida booth.

- Estas tarjetas suelen tener **entrada de micrófono**, y la salida booth es de **nivel de línea**:
  satura, y los efectos reaccionarían a tope todo el rato. Si satura con la ganancia al mínimo, baja
  el mando *booth*, y si no basta, usa un cable atenuador. ✅ En la mesa satura con el *booth* a medio
  recorrido; a un tercio, no (paso 3, [MOO-53](https://linear.app/7daysofrain/issue/MOO-53)).
- La tarjeta captura en **mono**: solo se usa el canal izquierdo del *booth*. Para analizar la música
  basta.
- **El mando booth del mixer cambia cuánto reaccionan los efectos.** Ajústalo una vez y no lo toques
  durante la sesión.

## 9. Pendientes

- ⏳ Tierra de la fuente: un cable de red de tres hilos, con la tierra en el borne `⏚` (§1). El de ahora
  es de dos hilos.
- ⏳ Tapa de los bornes de la LRS-100-5, y un sitio ventilado para la fuente (§1).
- ⏳ Resistencia de 330 Ω en serie con `Din` (§2).
- ⏳ Conexión fija entre el Arduino y el clip, sin pines Dupont sueltos (§2).
- ⏳ Alimentar la tira por los dos extremos y volver a declarar los 18 A de la fuente (§3, D123).
- ⏳ Blanco total con la intensidad al máximo en la tira de 153 (§3).
- ⏳ Medidas 1, 2 y 4 de §5.
- ⏳ Protección contra sobrecorriente: la LRS-100-5 la trae según su ficha, sin probar en la mesa (§3).
- ✅ ~~Nivel de audio con música real~~: comprobado el 21-oct (§8),
  [MOO-53](https://linear.app/7daysofrain/issue/MOO-53).
- ✅ ~~Cable de audio de 3 contactos (TRS) en lugar del de micrófono (TRRS)~~: con la XDJ-AZ, el fondo
  es estable (§8).
