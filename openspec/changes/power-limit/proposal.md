# Proposal

> **Origen:** historia [`MOO-135`](https://linear.app/7daysofrain/issue/MOO-135/dar-a-cada-tira-todo-el-brillo-que-aguanta-su-fuente-sin-pasarse)
> · Dar a cada tira todo el brillo que aguanta su fuente, sin pasarse · épica **H4** · expectativa
> **E8**.
> Tareas: `MOO-139` (declaración y validación, `shared`) · `MOO-140` (límite de potencia, `engine`) ·
> `MOO-141` (sketch y prueba en la mesa, `firmware`).

## Why

Hoy lo único que protege la fuente de la mesa es el sketch del controlador Adalight, que topa el
brillo al 25 % (D46). Con 173 LEDs y una fuente de 8 A, la tira se queda muy por debajo de lo que la
fuente aguanta y se ve apagada; y el tope no sabe qué fuente hay: con una más pequeña no protegería,
y con una más grande desperdicia brillo. E8 pide que el instrumento nunca pida más corriente de la
que aguanta la fuente declarada, y D14 puso ese límite en el motor. Sin él no se puede quitar el
tope del sketch, y sin quitarlo no se nota en la mesa.

## What Changes

- **Cada tira física declara su chip y la fuente que la alimenta**, dentro de su salida `adalight`:
  `chip` (de momento solo `WS2812B`) y `power.supplyAmps`, los amperios de salida (OUTPUT) que pone la
  etiqueta de la fuente, con decimales. Son obligatorios en una tira física y no existen en una
  virtual. **BREAKING** para los ficheros de configuración con tiras físicas: sin los dos campos, el
  motor no arranca (el de la Pi se actualiza en `MOO-141`).
- **El motor no arranca si la declaración no sirve:** falta el chip o los amperios, el chip no es uno
  que conozca, o los amperios no llegan a lo que pide un solo LED de ese chip. El mensaje dice qué
  tira y qué campo falla.
- **Nuevo concepto, el *límite de potencia*:** en cada pulso, el motor estima lo que consume el frame
  de cada tira física, con el consumo de su chip y la respuesta del LED (la misma gamma 2,0 que la
  salida Adalight). Si pasa del 80 % de los amperios declarados, baja el frame lo justo para quedarse
  ahí. Si cabe, lo deja tal cual. Un LED que se veía en la tira no se apaga por el límite.
- **El límite va después de la intensidad y antes de las salidas** (D100): el visor recibe el frame
  ya bajado, así que muestra el recorte.
- **Al arrancar, el log dice por tira** los amperios de la fuente, lo que usará como mucho y si va a
  bajar frames.
- **Se quita el tope del sketch** (D46): `Brightness` pasa de 64 a 255 en `HARDWARE_SETUP.md` §4.1, y
  el Arduino de la mesa se vuelve a cargar.

## Capabilities

### New Capabilities

- `power-limit`: el límite de potencia de las tiras físicas. Cómo estima el consumo de un frame, cuánto
  usa como mucho de la fuente, cómo baja un frame que se pasa sin apagar los LEDs tenues y qué dice
  el log al arrancar.

### Modified Capabilities

- `engine-config`: la salida `adalight` declara también `chip` y `power.supplyAmps`, y el motor no
  arranca si faltan o no sirven.
- `physical-strip`: la tira física deja de estar topada por el sketch del controlador; su brillo lo
  decide el límite de potencia.

`frame-loop`, `viewer` e `intensity` (del change `instrument-intensity`, aún sin archivar) no
cambian: el frame sigue llegando igual a todas las salidas de su tira, y el visor y la tira física
siguen recibiendo el mismo.

## Non-goals

Tomados de la historia `MOO-135`:

- **Medir la corriente real**: se estima con los colores del frame; un sensor sería otro hardware.
- **Declarar la fuente desde el panel** (PRD §5.4).
- **Una fuente compartida entre varias tiras**: cada tira declara la suya (PRD §6.2).
- **Avisar en el panel cuando el límite está recortando.**
- **La protección física** (fusible o fuente con protección contra sobrecorriente): se recomienda en
  `HARDWARE_SETUP.md`, no la hace el motor.
- **Mantener estable el brillo de los LEDs que no cambian** mientras el límite recorta: al bajar el
  frame entero, el brillo «bombea» con los golpes. Se acepta como precio del límite.
- **Que la intensidad se note mientras el límite recorta**: bajarla desde el 100 % puede no cambiar
  nada hasta que el frame cabe.
- **Detectar qué fuente hay conectada**: si se cambia de fuente sin cambiar el fichero de
  configuración, el motor no lo sabe. Se avisa en `HARDWARE_SETUP.md`.

Fuera también, decidido al explorar el change:

- **Un tope superior para `supplyAmps`**: un valor alto no es un error en sí (una fuente de 18 A con la
  tira de la mesa nunca recorta), y cualquier tope sería arbitrario. La línea del log lo delata
  (`design.md`, decisión 4).
- **El consumo de los LEDs apagados**: menos de 1 mA por LED, dentro del margen (`design.md`,
  decisión 3).

## Impact

- **Código:**
  - `packages/shared`: el catálogo de chips (nuevo) y los campos `chip` y `power` de la salida
    `adalight`, con su validación (`config.ts`).
  - `packages/engine`: la respuesta del LED (gamma 2,0) pasa del adaptador Adalight al núcleo
    (`core/led-response.ts`, nuevo), el límite de potencia (`core/power-limit.ts`, nuevo), su paso
    en el bucle (`core/frame-loop.ts`), la línea del log y la conexión en `main.ts`/`engine.ts`. La
    salida Adalight usa la respuesta del núcleo (`adapters/adalight.ts`).
- **API y protocolo del visor:** no cambian. El panel solo recibe el puerto de cada tira.
- **Configuración:** `config/demo.json` (tira virtual) no cambia. El `config/local.json` de la Pi
  necesita `chip` y `power` antes de desplegar `MOO-139` (`design.md`, decisión 7).
- **Dependencias nuevas:** ninguna.
- **Documentación:**
  - `docs/PRD.md`, en el commit de este change: «Chip de la tira» entra en el glosario (§8), «Límite
    de potencia» se ajusta (el maker declara los amperios de la fuente y el motor usa como mucho el
    80 %), y Q10 entra en §7 (¿E8 cubre lo que no pasa por el motor?).
  - `docs/umbrales-para-specs.md`, en el commit de este change: el margen del 80 % en E8.
  - `docs/idea-mood-table.md`: las D# de `design.md`, cada una en la tarea que la implementa.
  - `HARDWARE_SETUP.md` §3 y §4.1, en `MOO-141`: sin tope en el sketch, copiar la cifra de OUTPUT y no
    la de INPUT, cambiar el fichero de configuración al cambiar de fuente, y un fusible o una fuente
    con protección.
  - README §2.2 y §3.2 (la tira declarada: `chip` y `power` sustituyen a `maxCurrentMa` y `ledMaxMa`),
    en `MOO-139` y `MOO-140`.
  - `prompts.md`.
- **Tests:** unitarios del esquema, del catálogo, de la respuesta del LED, del límite y del bucle; la
  prueba en la mesa del caso peor (todo blanco con la intensidad al máximo).
