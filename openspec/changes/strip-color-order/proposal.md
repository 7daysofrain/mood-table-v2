# Proposal

> **Origen:** historia [`MOO-136`](https://linear.app/7daysofrain/issue/MOO-136/pintar-bien-los-colores-con-el-orden-de-color-del-chip-de-cada-tira)
> · Pintar bien los colores con el orden de color del chip de cada tira · épica **H4** · expectativa
> **E4**.
> Tareas: `MOO-145` (orden de color en el catálogo de chips, `shared`) · `MOO-146` (reordenar en la
> salida Adalight, `engine`) · `MOO-147` (sketch y prueba en la mesa, `firmware`).

## Why

Una tira `WS2812B` espera los canales en orden verde, rojo y azul, y el motor los manda en rojo, verde
y azul. Hoy lo arregla el sketch del controlador Adalight, que reordena a GRB (D46): el motor no sabe
nada del orden, y un maker con otra tira tiene que tocar y recompilar el sketch para que sus colores
coincidan con los del visor. Desde `MOO-139`, cada tira física declara su chip (D109), y el orden de
color es una propiedad del chip: el motor ya tiene lo que necesita para reordenar él, y el sketch
puede quedarse genérico.

## What Changes

- **El catálogo de chips gana el orden de color** de cada chip: `WS2812B` es `GRB`. El orden es una de
  las seis permutaciones de rojo, verde y azul.
- **La salida Adalight reordena los canales** de cada frame según el orden de color del chip de su
  tira, junto con la gamma. El visor sigue recibiendo el frame en RGB.
- **El orden de color no se declara** en el fichero de configuración: lo fija el chip. Un `colorOrder`
  en la tira es un campo que no existe y el motor no arranca, como con cualquier otro.
- **El sketch deja de reordenar** (`COLOR_ORDER` pasa a `RGB`, que manda los canales tal como llegan)
  y el Arduino de la mesa se vuelve a cargar. **BREAKING** para un controlador con el sketch antiguo:
  con el motor nuevo, el orden se aplica dos veces y el rojo y el verde salen cambiados, sin ningún
  error. El motor y el sketch se despliegan juntos en la mesa (`design.md`, decisión 4).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `physical-strip`: los 3 bytes de cada LED salen en el orden de color del chip de la tira, y la tira
  física pinta los mismos colores que el visor sin que el controlador reordene.
- `engine-config`: un orden de color declarado en la tira es un campo que no existe.

`viewer` y `power-limit` no cambian: el visor sigue en RGB (`docs/instructions/viewer-protocol.md`) y
el consumo de un `WS2812B` es el mismo en los tres canales, así que el orden no lo altera.

## Non-goals

Tomados de la historia `MOO-136`:

- **Tiras de cuatro canales (RGBW).**
- **Detectar el orden de color automáticamente.**
- **Cambiar el visor:** sigue pintando en RGB.
- **Declararlo desde el panel** (PRD §5.4).
- **Declarar el orden de color de una tira o sobrescribir el de su chip** (WS2811, clones): cuando
  entre un chip que lo necesite.
- **Controladores Adalight que reordenan los canales por su cuenta** (el Light Box, otros sketches,
  la SD de la v1): el controlador tiene que pasarlos tal como llegan.
- **Cargar el sketch en el controlador:** lo hace el maker a mano, una vez (`HARDWARE_SETUP.md` §4.1).
  El instalador no lo hace.

## Impact

- **Código:**
  - `packages/shared`: el tipo del orden de color y su valor en el catálogo de chips (`chips.ts`).
  - `packages/engine`: la salida Adalight reordena al codificar (`adapters/adalight.ts`), y
    `openAdalightStrips` le da el orden del chip de su tira.
- **API y protocolo del visor:** no cambian.
- **Configuración:** ningún fichero cambia. `config/demo.json` solo tiene tiras virtuales, y el
  `config/local.json` de la Pi ya declara `chip`.
- **Hardware:** el sketch de la mesa se recarga con `COLOR_ORDER` en `RGB` en `MOO-147`.
- **Dependencias nuevas:** ninguna.
- **Documentación:**
  - `docs/PRD.md`, en el commit de este change: «Orden de color» entra en el glosario (§8); la
    definición de «Tira» y la H4 (§4) dejan de listarlo entre lo que se declara.
  - `docs/idea-mood-table.md`, en el commit de este change: D111 (el orden de color sale del chip), y
    D29 se marca con un enlace a ella.
  - README §1.1, §1.2 (H4), §1.4 paso 2, §2.1 «Justificación», §2.2 («Configuración de las tiras» y el
    adaptador *Adalight serie*) y la tabla del §3, en `MOO-145` y `MOO-146`.
  - `HARDWARE_SETUP.md` §4.1, en `MOO-147`: `COLOR_ORDER` en `RGB`, se quita «la tira se declara como
    `rgb`» y se revisa el procedimiento para contar LEDs.
  - `prompts.md`.
- **Tests:** unitarios del catálogo, de la codificación Adalight y de la configuración; la prueba en la
  mesa con rojo, verde y azul puros.
