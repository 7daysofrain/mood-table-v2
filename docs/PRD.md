# Mood Table · PRD (Product Requirements Document)

**Versión:** 1.0 · **Fecha:** 23-sep-2026 · **Autor:** Joseba Alonso
**Estado:** cerrado. Los cambios posteriores se anotan con fecha.

> **Qué es este documento.** La fuente de verdad **de alto nivel** del producto: qué se quiere, para
> quién, qué valor aporta y qué experiencia debe dar. **No** contiene requisitos detallados ni
> criterios de aceptación en GIVEN/WHEN/THEN: esos viven en el **backlog** y en las **specs de
> OpenSpec**, que parten de aquí (PRD → backlog → spec → código). **No** contiene arquitectura: el
> diseño está en el `readme.md` (§2-§3). Si el README y este documento discrepan, **manda el PRD**.

---

## 1. Problema

### 1.1 De dónde viene

Mood Table nace de un problema real del autor. Su mesa de DJ tuvo luz reactiva entre 2021 y 2024,
montada con piezas de terceros (Hyperion para el ambiente, dancyPi para la parte reactiva) unidas por
un orquestador propio. Funcionaba, pero como instrumento se quedaba corta:

- **No se podía probar sin la mesa** *(el principal bloqueo)*: cualquier cambio exigía tener el
  hardware montado.
- **No se podía ampliar:** un efecto nuevo obligaba a meterse en el código de otro proyecto.
- **No se podía entender ni mantener:** la configuración estaba repartida en cuatro sitios, cada pieza
  tenía su ciclo de vida y cada una contaba los LEDs a su manera.

Lo que da valor al aparato es **tocar la luz en directo** mientras suena la música, como se toca el
sonido con el mixer, y eso es justo lo que la amalgama hacía más difícil de extender.

### 1.2 Alternativas y por qué se construye

Hay herramientas maduras que resuelven buena parte de lo mismo:

- **[LedFx](https://docs.ledfx.app/)**: motor de efectos reactivos al audio (Python + React) que
  funciona en una Raspberry Pi, con panel web, parámetros en vivo, varias tiras, escenas y salida
  Adalight, entre otros protocolos. Es la referencia más cercana y, para el usuario final, cubre la
  mayor parte de lo que hace Mood Table.
- **[WLED](https://kno.wled.ge/advanced/audio-reactive/) con sonido reactivo**: firmware para
  ESP8266/ESP32 con efectos reactivos; los efectos viven en el firmware.
- **Hyperion y dancyPi**: las piezas que usaba la v1.

Mood Table **no nace para cubrir un hueco de mercado**. Tiene dos objetivos primarios:

1. **Propiedad:** un instrumento propio, pequeño y entendible de punta a punta, que el autor puede
   leer, cambiar y ampliar sin depender del lenguaje, el ciclo de vida o las decisiones de un
   tercero. Es la lección de la v1: vivir dentro de piezas ajenas fue lo que la hizo imposible de
   mantener.
2. **Aprendizaje:** construirlo con método (Spec-Driven Development, agentes de código y tests como
   puertas) y que el propio proyecto sirva de práctica de ese método.

Por tanto, **no pretende competir** con LedFx en número de efectos, protocolos o escenas. LedFx se usa
como **referencia**: se toman ideas, no código, y sirve para comparar rendimiento en la Pi.

## 2. Usuarios y valor

A menudo el DJ y el maker son la misma persona con dos sombreros.

| Usuario | Quién es | Qué necesita | Historias |
|---|---|---|---|
| **DJ** *(principal)* | Pincha en su mesa, en casa o en sesiones pequeñas. Caso de referencia: el autor. | Que la luz acompañe a la música y poder **tocarla en directo**; que lo que ve en el panel sea lo que pinta la mesa; encender y que vuelva como estaba, sin portátil ni internet. | H2, H3, H5 |
| **Maker** | Monta el aparato (Raspberry, tira, Light Box o Arduino) y programa si hace falta. | Declarar sus tiras en un solo sitio; **probar sin hardware**; añadir efectos propios como piezas pequeñas y entendibles. | H1, H4 |

**Posicionamiento.** Frente a plataformas generales como LedFx, Mood Table es un **instrumento**: pocos
efectos bien elegidos, sin escenas ni repertorio que gestionar, pensado para tocarse en directo y para
arrancar solo en la mesa, con una base de código pequeña (TypeScript) que quien lo monta puede entender
y ampliar. La sencillez que promete es **de uso**, no de montaje: montarlo exige cablear y declarar las
tiras en un fichero.

## 3. Qué se espera del producto

| # | Expectativa | Cómo sabremos que se cumple | Horizonte |
|---|---|---|---|
| E1 | **Se toca en directo, de manera fluida.** | Al mover un control, la luz responde mientras arrastras, sin saltos ni tirones. | MVP |
| E2 | **La luz sigue a la música.** | Reacciona a los golpes y a la energía del tema, y no se nota que llegue tarde. | MVP |
| E3 | **Varios efectos para elegir.** | Se cambia de efecto en caliente, sin cortes, entre efectos reactivos y de ambiente. | MVP |
| E4 | **Cada tira, su efecto.** | Varias tiras a la vez, cada una con su efecto y sus valores. | MVP (la segunda tira física, *should*) |
| E5 | **Se controla con el hardware que elijas.** | El mismo instrumento se toca desde el panel web y, en el futuro, desde una pantalla táctil, una Traktor F1 o un mando propio. | MVP: panel · Visión: el resto |
| E6 | **Autónomo.** | Se enchufa y vuelve como estaba, sin portátil ni internet, incluso tras un corte de luz. | MVP |
| E7 | **Se prueba sin hardware.** | Con un ordenador y un fichero de audio se ve el instrumento funcionar. | MVP |
| E8 | **Cuida el hardware.** | Nunca pide más corriente de la que aguanta la fuente declarada. | MVP |
| E9 | **Fácil de ampliar.** | Añadir un efecto nuevo es escribir una pieza pequeña, sin tocar el resto. | MVP |

## 4. Historias de usuario

**Must-have**

- **H1 · Probar el instrumento en el simulador.** Como **maker**, quiero ver el instrumento funcionando
  sin hardware, con un fichero de audio o la tarjeta de sonido como fuente y las tiras virtuales en el
  visor, para desarrollarlo y probarlo antes de montar nada. *(E7, E2)*
- **H2 · Tocar los parámetros en vivo.** Como **DJ**, quiero cambiar el efecto de cada tira y mover sus
  controles mientras suena la música, para modular la luz como modulo el sonido. *(E1, E3)*
- **H3 · Pintar la tira física.** Como **DJ**, quiero que la tira de mi mesa pinte lo mismo que veo en el
  visor, para tocar la luz real desde el mismo panel. *(E1, E5)*
- **H4 · Declarar mis tiras.** Como **maker**, quiero declarar mis tiras en un solo sitio (salida, nº de
  LEDs, orden de color y límite de potencia), para que todo el instrumento las respete y cuide el
  hardware. *(E4, E8)*
- **H5 · Arrancar en el último estado.** Como **DJ**, quiero encender la mesa y que vuelva como la dejé
  (el efecto y los valores de cada tira), sin portátil ni internet, para no tener que prepararla cada
  vez. *(E6)*

**Should-have**

- **S1 · Tira de ambiente.** Como **DJ**, quiero una segunda tira física con su propio efecto,
  normalmente de ambiente, para que la mesa ilumine aunque no suene música. *(E4)*
- **S2 · Firmware propio.** Como **maker**, quiero conectar las tiras a un microcontrolador barato
  (ESP8266/ESP32) con firmware propio, para usar más LEDs con más fluidez y abrir el camino al WiFi.
  *(E1, E4)*

## 5. Alcance

### 5.1 MVP

- Historias **H1-H5**.
- **Efectos incluidos:** *espectro*, *energía* y *scroll* (reactivos; los de la v1, reescritos) y
  *respiración* (de ambiente: un color que sube y baja despacio).
- **Fuentes de audio:** tarjeta de sonido y fichero. **Salidas:** Adalight y virtual. **Control:** panel
  web.

### 5.2 Should-have

- **S1** Tira de ambiente · **S2** Firmware propio.

### 5.3 Visión (fuera del MVP, por orden de deseo)

1. Traktor F1 como mando.
2. Firmware en ESP32 con WiFi, sin cable.
3. Más de dos tiras o segmentos.
4. Conexión directa por GPIO de la Pi.
5. Pantalla táctil en la mesa, o encoder + pantalla pequeña.

### 5.4 Fuera por decisión (no se hará salvo que cambie el producto)

- **Escenas y presets:** es un instrumento para tocar en directo, no un reproductor de repertorio. Se
  revisaría si el uso lo pide.
- **Sincronía con el tempo (BPM, efectos a compás):** la reacción al audio ya se percibe a tempo; en el
  uso real de la v1 nunca se echó en falta una segunda señal.
- **Cuentas y login:** un instrumento, un usuario, en una red local.
- **Editar tiras desde el panel:** una tira existe porque está cableada; se declara en un fichero.
- **Crear efectos sin programar:** los efectos son código. "Fácil de ampliar" (E9) va dirigido a quien
  programa.

## 6. Supuestos y restricciones

### 6.1 Supuestos (creemos que son ciertos, pero hay que comprobarlos)

| # | Supuesto | Si resulta falso |
|---|---|---|
| A1 | Una Raspberry Pi (3 B+ o 4) tiene potencia de sobra para analizar el audio y pintar las tiras en tiempo real. | Se optimiza el motor o se cambia de enfoque. Se valida con una prueba de rendimiento antes de construir el motor. |
| A2 | Adalight da la fluidez suficiente con los LEDs de una tira de mesa (unos 200-300). | Menos LEDs por tira, o se adelanta el firmware propio (S2). |
| A3 | La reacción al audio se percibe a tempo sin necesitar una señal de tempo aparte. | Se revisaría la decisión de la §5.4. |

### 6.2 Restricciones (condiciones fijas)

- **Funciona sin internet:** todo ocurre en la red local.
- **Hardware de referencia:** Raspberry Pi (arm64) y tiras LED direccionables conectadas por serie (Light
  Box o Arduino con Adalight). Sin conexión directa por GPIO.
- **Sin software de luces de terceros** en el instrumento (Hyperion, dancyPi, LedFx): es la condición de
  la propiedad (§1.2).
- **Un solo lenguaje, TypeScript**, para que el autor pueda leer y juzgar todo el código. Única
  excepción: el firmware del S2.
- **La fuente de alimentación manda:** cada tira declara la corriente que aguanta su fuente, y el
  instrumento nunca la supera (E8).
- **Provisional: en el MVP se toca desde un portátil.** El panel web, pensado para escritorio, es el
  único mando. Es una solución provisional para contener el alcance: el producto tendrá más adelante un
  mando físico más apropiado para la mesa (E5, §5.3).

## 7. Preguntas abiertas

| # | Pregunta | Cómo se resuelve |
|---|---|---|
| Q1 | ¿Cuántos LEDs por tira admite el instrumento con fluidez? | Con la prueba de rendimiento (A1, A2). |
| Q2 | ¿Qué controles tiene cada efecto? Por ejemplo, sensibilidad, color o velocidad. | Decisión del DJ, a partir de los efectos de la v1. |
| Q3 | Al cambiar de efecto, ¿se pasa con un **fundido** o con un **corte seco**? | Decisión del DJ. |
| Q4 | ¿Qué hacen los efectos reactivos cuando hay **silencio** o no hay fuente de audio? ¿Se apagan o quedan con un mínimo? | Decisión del DJ. |
| Q5 | Si la tira física falla (el Light Box se desconecta), ¿qué pasa? ¿El resto sigue funcionando y el panel avisa? | Decisión de producto. |
| Q6 | ¿Cuál será el mando físico definitivo: la F1, un mando propio u otro? | Más adelante (visión, §5.3). |

## 8. Glosario

Los documentos se escriben en **español** y el código en **inglés**; esta tabla enlaza los dos. Un
término que no esté aquí no debería aparecer en specs ni en código sin añadirlo antes.

| Término | En código | Definición |
|---|---|---|
| **Tira** | `strip` | Tira LED declarada en el fichero de configuración: nombre, salida, nº de LEDs, orden de color y límite de potencia. Existe porque está cableada (o declarada como virtual). |
| **Tira virtual** | `strip` con salida `virtual` | Tira cuya salida es virtual: no tiene hardware y solo se ve en el visor. |
| **Visor** | `viewer` | Vista del navegador que dibuja **todas** las tiras (físicas y virtuales), LED a LED y en tiempo real. |
| **Simulador** | *(no es una pieza)* | Uso del instrumento **sin hardware**: fuente de audio = fichero y solo tiras virtuales. Es la H1. |
| **Salida** | `output` | A dónde van los colores de una tira: **Adalight** (serie, tira física) o **virtual**. |
| **Fuente de audio** | `audioSource` | De dónde sale la música: **tarjeta de sonido** o **fichero**. Opcional: sin fuente solo funcionan los efectos de ambiente. |
| **Efecto** | `effect` | Algoritmo que decide los colores de una tira en cada instante. **Reactivo** si usa el audio; **de ambiente** si no. |
| **Parámetro** | `param` | Cada ajuste que declara un efecto (p. ej. *sensibilidad*), con su tipo, rango y valor por defecto. Lo define el código. |
| **Valor** | `value` | Lo que vale ahora un parámetro en una tira concreta. Lo decide el DJ y se guarda. |
| **Control** | *(solo UI)* | Elemento del panel que representa un parámetro: slider, selector de color o desplegable. *El DJ mueve un control → cambia el valor de un parámetro.* |
| **Estado del instrumento** | `instrumentState` | Efecto activo y valores de cada tira. Es lo que vuelve al arrancar (H5). **"Estado" a secas no se usa**: la memoria interna de un efecto entre frames es otra cosa y se nombra aparte en la spec del motor (p. ej. `effectMemory`). |
| **Panel** | `panel` | Interfaz web desde la que se toca el instrumento: elegir tira y efecto y mover controles. Incluye el visor. En el MVP es el único mando. |
| **Mando** | `commands` | Cualquier superficie desde la que se toca el instrumento: hoy el panel; en el futuro una pantalla táctil, la F1 o un mando propio. Todos dan las mismas órdenes (cambiar efecto, cambiar un valor). |
| **Límite de potencia** | `powerLimit` | Corriente máxima que admite la fuente de una tira. El instrumento baja el brillo de cada frame para no superarla (E8). |
| **Mesa** | *(no aparece en el código)* | La instalación física: la mesa de DJ con su Raspberry, sus tiras y su tarjeta de sonido. Donde se usa el instrumento de verdad. |
