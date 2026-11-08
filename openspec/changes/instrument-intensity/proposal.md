# Proposal

> **Origen:** historia [`MOO-97`](https://linear.app/7daysofrain/issue/MOO-97/subir-y-bajar-la-intensidad-de-todas-las-tiras-a-la-vez)
> · Subir y bajar la intensidad de todas las tiras a la vez · épica **H2** · expectativa **E1**
> (y **E8**, que no puede empeorar).
> Tareas: `MOO-125` (contrato, `shared`) · `MOO-126` (motor y API, `engine`) · `MOO-127` (control,
> `panel`).

## Why

En directo, el DJ quiere acompañar con la luz los momentos de la sesión, como un drop: bajar todas
las tiras a la vez y volver a subirlas, también las de ambiente. Hoy solo puede tocar los valores del
efecto de una tira, uno por uno y tira a tira. La **intensidad** es un máster de brillo: un solo
valor para todo el instrumento, que se aplica sobre lo que pinta cada efecto, sin cambiar cómo
responde a la música.

## What Changes

- **Nuevo concepto, la *intensidad* (`intensity`):** cuánto brillo tienen todas las tiras, sea cual
  sea su efecto. Al máximo, cada tira pinta su efecto tal cual, sin quitarle ni añadirle brillo; a
  cero, todas las tiras se apagan. El motor arranca al máximo y no la guarda: al reiniciarse vuelve
  al máximo.
- **El motor la aplica al frame ya pintado de cada tira**, antes de entregarlo a sus salidas. Así el
  visor y la tira física reciben el mismo frame, los efectos no cambian (la *respiración* sigue por
  donde iba aunque la intensidad pase por cero) y los efectos futuros la obedecen sin tocarlos.
- **Una orden nueva, `PUT /api/intensity`**, con su esquema y su OpenAPI. Es del instrumento, no de
  una tira.
- **El panel recibe la intensidad por el WebSocket** (un mensaje nuevo, tipo `7`): al conectarse y
  cada vez que cambia. Así muestra la intensidad con que pinta el motor, también al abrir o recargar.
- **Una zona nueva del panel, «Intensidad»**: un fader vertical a toda la altura, a la derecha de
  todo, como el máster de una mesa de mezclas. Es lineal y muestra el valor en porcentaje, de 0 % a
  100 %. No depende de la tira seleccionada: cambiar de tira no la mueve ni la esconde. La luz
  responde mientras el DJ arrastra, y el fader sigue al dedo como los controles de los efectos. El
  panel pasa de cinco zonas a seis.

## Capabilities

### New Capabilities

- `intensity`: la intensidad del instrumento. Cómo afecta a los frames de todas las tiras, su valor
  al arrancar, la ruta de la API que la cambia, cómo se entera cada panel y la zona «Intensidad» del
  panel, con su fader.

### Modified Capabilities

- `panel-layout`: el panel tiene seis zonas, no cinco. La nueva se llama «Intensidad» y va a la
  derecha de todo, a toda la altura bajo la cabecera, la última en el orden de lectura.

`frame-loop`, `viewer`, `instrument-control` y `effects` no cambian. El frame sigue llegando igual a
todas las salidas de su tira, y la intensidad no toca el efecto ni sus valores. Lo que la intensidad
añade está entero en `intensity`.

## Non-goals

Tomados de la historia `MOO-97`:

- **Un control por tira o por efecto**, o que cada efecto interprete la intensidad a su manera: la
  sensibilidad de cada efecto sigue en Q2.
- **Más brillo del que da cada efecto**: el máximo es pintar el efecto tal cual.
- **La ganancia de captura de la tarjeta de sonido**: es `MOO-53` (hardware).
- **Que la intensidad vuelva tras reiniciar el motor**: se decide con H5.
- **Que otros paneles abiertos a la vez vean moverse la intensidad** cuando el DJ la toca. No se
  promete, como en `MOO-94` y `MOO-95`, aunque el mensaje llegue a todos los paneles
  (`design.md`, decisión 5).

Fuera también, decidido al explorar el change:

- **Una capa genérica de transformaciones del frame**, con una pila que se pueda ampliar o
  reordenar. Con un solo caso, su interfaz sería una suposición. Se vuelve a mirar cuando llegue el
  límite de potencia, con H4 (`design.md`, decisión 1).
- **Corregir el cambio de tono a muy baja intensidad**: es un riesgo conocido, que ya se da hoy en el
  mínimo de la *respiración* (`design.md`, decisión 3). Si molesta al probarlo en la mesa, irá en
  otra historia.

## Impact

- **Código:**
  - `packages/shared`: los esquemas de la orden y de su respuesta (`commands.ts`) y el mensaje `7`
    (`viewer-protocol.ts`).
  - `packages/engine`: aplicar la intensidad al frame (`core/intensity.ts`, nuevo), guardarla y
    cambiarla en el búfer de control (`core/control.ts`), aplicarla en el bucle (`core/frame-loop.ts`),
    la ruta y el mensaje `7` (`adapters/server.ts`) y su conexión en `main.ts`.
  - `packages/panel`: el mensaje `7` en la conexión, la cola de envíos generalizada para una orden
    sin tira y la zona «Intensidad» con su fader (`layout/PanelLayout.tsx` y una carpeta nueva,
    `intensity/`).
- **API:** una ruta nueva, `PUT /api/intensity` (`docs/openapi.yaml`, generado).
- **Protocolo del visor:** el mensaje de tipo `7` (`docs/instructions/viewer-protocol.md`). Un panel
  que no lo conoce lo ignora.
- **Dependencias nuevas:** ninguna. Mantine 9 ya trae el `Slider` vertical y `AppShell.Aside`.
- **Documentación:**
  - `docs/PRD.md`, en el commit de este change: *Intensidad* entra en el glosario (§8), y *Control* y
    *Mando* se amplían. Q7 no cambia.
  - `docs/idea-mood-table.md`: una D# nueva que matiza D49 (la sensibilidad no llega con H2), también
    en el commit del change, y las D# de `design.md`, cada una en la tarea que la implementa.
  - README: en el commit del change, las frases que prometen la sensibilidad para H2 (§1.4 y la nota
    de *energía*) y la fila de H2 en §5. En cada tarea, lo que cambia: §1.3 (la zona nueva), §2.1 y
    §2.2 (el plano de tiempo real y el bucle) y §4 (la ruta).
  - `prompts.md`.
- **Tests:** unitarios del factor, del búfer, del bucle, de la ruta y del mensaje `7`; componentes del
  panel; E2E del caso feliz.
