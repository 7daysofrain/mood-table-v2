# Design

> Decisiones tomadas con el maker al refinar y explorar `MOO-135` (11-nov): el 80 % de margen, que se
> estime después de la gamma (1), el suelo por canal (2), sin tope superior (4) y dónde y cómo se
> declara (5). El resto son propuestas de diseño para revisar aquí. Por tarea: `MOO-139` (shared) 5 ·
> `MOO-140` (engine) 1 a 4 y 6 · `MOO-141` (firmware) 7. Los D# nuevos empiezan en **D108**, tras la
> D107 de S3 (PR #131); si otra rama coge ese número antes de integrar, se renumeran.

## Context

- **El hueco ya está hecho.** El bucle (`core/frame-loop.ts`) aplica a cada tira, en este orden, el
  efecto y la intensidad (`applyIntensity`), y entrega el mismo frame a todas sus salidas: el visor y,
  si es física, la salida Adalight. El comentario del bucle y D100 dejan dicho que el límite de
  potencia va entre la intensidad y las salidas, el último, porque protege la fuente (D14).
- **Los valores del frame son de pantalla.** La gamma 2,0 la aplica la salida Adalight al codificar
  (`adapters/adalight.ts`, D96), solo hacia la tira: `round(255 · (v/255)²)`, que por debajo de 12 da
  0. El visor recibe los valores sin corregir.
- **El sketch del Uno topa el brillo al 25 %** (`Brightness = 64`, D46; `HARDWARE_SETUP.md` §4.1). Es
  la única protección de la fuente de la mesa (5 V · 8 A) hoy: 173 LEDs a blanco total piden unos
  10,4 A.
- **La configuración de la tira no sabe nada de la fuente.** `packages/shared/src/config.ts` declara
  la salida `adalight` con `port` y `baudRate`, cerrada (`additionalProperties: false`). El README
  §3.2 anunciaba `maxCurrentMa` y `ledMaxMa` en la tira, que nunca se implementaron.
- **El catálogo de efectos ya vive en `@moodtable/shared`** (D52): el esquema valida el id, y una
  comprobación aparte (`needsAudioSource`) rechaza lo que el esquema no puede expresar.
- **El panel solo recibe el puerto** de cada tira física (`engine.ts`, `panelOutput`): los campos
  nuevos no le llegan.

Motivación y alcance: `proposal.md`. Requisitos: `specs/power-limit`, `specs/engine-config` y
`specs/physical-strip`.

## Goals / Non-Goals

**Goals:**

- Que el límite use toda la fuente que puede (el 80 %) y nunca más, con una estimación que se parezca
  a lo que consume de verdad la tira.
- Que en el bucle no cree objetos y no cueste nada cuando el frame cabe.
- Que la gamma esté en un solo sitio: la usa la salida Adalight para codificar y el límite para
  estimar.

**Non-Goals:**

- **Reproducir en el visor la gamma o el redondeo de la tira física.** Es `MOO-132`. Este change solo
  hace que el visor reciba el frame ya bajado (D100).
- **Suavizar el factor entre frames.** Para proteger tiene que actuar en el mismo frame; el «bombeo»
  es un non-goal de la historia.

## Decisions

### 1. Se estima con la respuesta del LED, que pasa al núcleo (D108)

Un LED consume en proporción a su ciclo de PWM, que es el valor **después** de la gamma. El límite
estima el consumo de un frame como `mA_canal · Σ (v/255)²`, con `v` el valor de pantalla de cada
canal. Para no repetir la curva, la respuesta del LED se va del adaptador al núcleo
(`core/led-response.ts`): la tabla de 256 valores con la que la salida Adalight codifica cada canal.
El adaptador la importa (los adaptadores pueden importar del núcleo; al revés, no).

En la mesa, con todo blanco y una fuente de 8 A, el límite deja los canales en 200 y usa unos 6,4 A.
Estimando antes de la gamma (`mA_canal · Σ v/255`), los dejaría en 157, con unos 3,9 A: un 38 % menos
de luz. Además, en los tonos medios recortaría frames que caben.

*Alternativas descartadas:* estimar antes de la gamma (lo de arriba); y poner el límite en la salida
Adalight, después de la gamma, que estima igual de bien pero deja al visor sin el recorte y va contra
D100.

### 2. Se baja en valores de pantalla con `√k`, hacia abajo, con un suelo de 12 por canal (D108)

Con `S = Σ v²` (la suma del frame) y `B` el presupuesto en esas mismas unidades (decisión 3), si
`S > B` el factor de corriente es `k = B / S`. Como la gamma es `v²`, bajar la corriente a `k` es
multiplicar cada valor de pantalla por `√k`. Así el visor recibe valores coherentes con lo que ve en
la tira.

- **Hacia abajo** (`floor`): cada canal queda en `v' ≤ v · √k`, así que `Σ v'² ≤ k · S = B`. Con
  `round`, algún canal podría subir y pasarse.
- **Suelo de 12:** un canal que valía 12 o más no baja de 12, el valor más bajo que la gamma no
  apaga. Lo que añade el suelo está acotado: como mucho `mA_canal · (12/255)²` (unos 0,044 mA) por
  canal. Con los 519 canales de la mesa son unos 23 mA, dentro de los 1,6 A que quedan entre el 80 %
  y los 8 A. Puede cambiar algo el tono de un LED tenue, el mismo efecto de los colores tenues que
  `MOO-132` deja fuera.
- **El suelo, solo si la fuente lo aguanta** (decidido con el maker al implementar `MOO-140`): con
  una fuente muy pequeña, ese margen no cubre el suelo. Con 0,06 A, un frame de 37 canales a 255 y
  el resto a 12 pedía 68 mA tras el límite. Así que, al arrancar, el límite de cada tira comprueba
  si el 80 % más todos sus canales a 12 cabe en la fuente (`B + 3 · ledCount · 12² ≤ B / 0,8`). Si
  no cabe, esa tira baja sin suelo: proteger la fuente va antes (D14). En la mesa hace falta una
  fuente de unos 0,115 A para tener suelo. No cuesta nada por frame.

*Alternativa descartada:* un suelo por LED que conserve las proporciones entre canales. Mantiene mejor
el tono, pero sube los otros canales, consume más y es más difícil de razonar.

### 3. El presupuesto se calcula una vez al arrancar, en las unidades de la suma

`B = 0,8 · supplyAmps · 1000 / mA_canal · 255²`. Así, en cada pulso, el límite solo suma cuadrados de
enteros (una tabla de 256 valores) y compara: sin divisiones ni objetos. Si el frame cabe, no lo
toca, igual que `applyIntensity` a 1. Si no, una segunda pasada escala en su sitio. Con 519 canales,
dos pasadas son despreciables frente a los 0,46 ms por frame medidos en la Pi (A1).

El consumo de un LED apagado (menos de 1 mA en una `WS2812B`) no se cuenta *(asumido)*: con 173 LEDs
son menos de 0,17 A, dentro del margen.

### 4. La línea del log al arrancar, sin tope superior para los amperios

Al arrancar, por tira física: el nombre, los amperios de la fuente, lo que usará como mucho, lo que
pide la tira en blanco total (`ledCount · 3 · mA_canal`) y si bajará frames. Por ejemplo:

```
Tira «Mesa»: fuente de 8 A, usará como mucho 6,4 A; en blanco total pide 10,38 A: bajará los frames que se pasen
```

No hay tope superior para `supplyAmps`: un valor alto no es un error (una fuente de 18 A con la mesa
nunca recorta), y un `8000` por error lo delata esta línea («nunca bajará frames»).

### 5. `chip` y `power.supplyAmps` dentro de la salida `adalight`; los chips, en `@moodtable/shared` (D109)

```json
"output": { "type": "adalight", "port": "…", "baudRate": 500000,
            "chip": "WS2812B", "power": { "supplyAmps": 8 } }
```

- **Dentro de `adalight`**: obligatorios en una tira física y prohibidos en una virtual, sin validar
  nada a mano: lo hace la unión por `type`. Es lo físico junto a lo físico; otra salida (S2, GPIO)
  declarará los suyos.
- **`supplyAmps`**: lo que copia el maker (los amperios de OUTPUT), con la unidad en el nombre y con
  decimales (`Type.Number`, mayor que 0). Sustituye al `maxCurrentMa` del README.
- **`power` como objeto**: deja sitio para lo que venga (una fuente compartida) sin cambiar la forma.
- **El catálogo de chips** (`chips.ts`, nuevo), junto al de efectos (D52): el nombre y lo que consume
  un canal a todo brillo (`WS2812B`: 20 mA). El esquema valida el nombre, y el mensaje dice qué chips
  hay. Sustituye al `ledMaxMa` del README: el consumo lo decide el chip, no el maker, porque los
  datasheets mezclan la corriente por canal (20 mA) y por LED (60 mA).
- **El mínimo de un LED** (`supplyAmps` ≥ 3 · `mA_canal` / 1000) depende del chip, así que no cabe en
  el esquema: es una comprobación aparte, como `needsAudioSource`.
- **El término «Límite de potencia» (`powerLimit`) pasa a ser lo que calcula el motor** (el 80 % de
  la fuente), no lo que se declara.

*Alternativas descartadas:* los campos en la tira y no en la salida (habría que validar a mano «solo en
las físicas»); `chip` y `supplyAmps` sueltos en la salida (mezcla la fuente con el puerto); declarar
los mA por LED (el error de 20 frente a 60).

### 6. El bucle recibe el límite ya hecho, por tira

`LoopStrip` gana un campo opcional con el límite de la tira (el presupuesto de la decisión 3). Lo
construye la raíz de composición (`engine.ts`) desde la configuración y el catálogo, solo para las
tiras físicas. El bucle, después de `applyIntensity`, aplica el límite si la tira lo tiene. El núcleo
no sabe qué es una salida Adalight: solo que esa tira tiene presupuesto.

Con esto se cierra el seguimiento que dejó `instrument-intensity` (decisión 1: ¿merecen la intensidad
y el límite una interfaz común?). **No:** la intensidad es una para todo el instrumento, cambia en
directo y no tiene configuración; el límite es de cada tira, se fija al arrancar y solo existe en las
físicas. Una interfaz común tendría que ocultar esas diferencias sin ganar nada: siguen siendo dos
funciones puras en un orden fijo.

### 7. El tope del sketch se quita al final, en la mesa

Las tres tareas van en orden y cada paso deja la mesa protegida: `MOO-139` exige los campos (el tope
del sketch sigue), `MOO-140` añade el límite (con el tope aún puesto, el límite casi nunca actúa) y
`MOO-141` quita el tope y prueba el caso peor. `HARDWARE_SETUP.md` §3 y §4.1 cambian con ella:
`Brightness` a 255, copiar los amperios de OUTPUT y no los de INPUT, cambiar el fichero de
configuración al cambiar de fuente y recomendar un fusible o una fuente con protección contra
sobrecorriente.

## Risks / Trade-offs

- [Los 60 mA por LED del datasheet no son lo que consume la tira real] → Suelen estar por encima (un
  margen más), y el 20 % cubre una diferencia razonable. En `MOO-141` se prueba el caso peor en la
  mesa: la fuente no corta, la tira no parpadea y el Arduino no se reinicia.
- [Un fichero de configuración de la Pi sin `chip` ni `power` deja la mesa sin arrancar al desplegar
  `MOO-139`] → El despliegue en la Pi es a mano; `MOO-141` actualiza su fichero, y el README §1.4 lo
  dice.
- [El maker cambia de fuente y no cambia el fichero] → No se puede detectar (non-goal); se avisa en
  `HARDWARE_SETUP.md`.
- [El brillo «bombea» con los golpes cuando el límite recorta] → Aceptado en la historia. Si molesta en
  la mesa, irá en otra historia (un factor que se suaviza al subir, nunca al bajar).
- [`MOO-132` contaba con simular el tope del controlador en el visor] → Ya no hace falta: el tope
  desaparece y el visor recibe el recorte. Hay que decírselo a esa historia al refinarla.

## Migration Plan

1. `MOO-139`: añadir `chip` y `power` al `config/local.json` de la Pi antes de desplegar.
2. `MOO-140`: desplegar; la línea del log confirma la fuente y el presupuesto.
3. `MOO-141`: cargar el sketch con `Brightness = 255` y probar el caso peor en la mesa.

**Vuelta atrás:** volver a cargar el sketch con `Brightness = 64`. Es la protección de hoy y no
depende del motor.
