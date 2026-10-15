# Design

> Decisiones por tarea: `MOO-16` (motor) 1-9 · `MOO-17` (frames al visor) 10-13 · `MOO-18` (visor en
> el panel) 14-19.

## Context

`packages/engine` tiene solo el esqueleto de `MOO-28`: `core/`, `adapters/` y `main.ts`, con la regla
de fronteras ya activa (`specs/module-boundaries`: el núcleo no importa adaptadores; solo `main.ts`
conoce ambos). `packages/shared` no exporta nada todavía. El diseño previsto del motor está en README
§2.1 (hexagonal ligera, dos planos) y §2.2 (bucle, efectos, carga de configuración). Motivación y
alcance en `proposal.md`.

## Goals / Non-Goals

**Goals:**

- `MOO-16` se cierra con una **salida en memoria**, frames dorados y una línea de log al arrancar con
  `pnpm dev` (qué fichero ha cargado, cuántas tiras y a qué fps). Que los frames se vean es cosa de
  `MOO-17` y `MOO-18`.
- Dejar fijado lo que `MOO-17` consume del motor: el puerto de salida y de quién es cada búfer.

**Non-Goals:**

- **Adaptador de consola** que pinte la respiración en la terminal: lo pensamos y lo descartamos.
  Sería comportamiento que la historia no pide y `MOO-17` trae el visor justo después.
- **Qué hace el bucle si una salida falla** (por ejemplo, un cable USB desconectado): no aplica a la
  salida en memoria. Se decide con la primera salida que pueda fallar (H3).
- **Proteger el motor de un navegador atascado:** riesgo aceptado (ver *Risks*).
- **Pausar el bucle sin navegadores conectados** (D30, demo pública): llega con el despliegue de la
  demo, no con esta historia.

## Decisions

### 1. El contrato de los efectos, tal como está en README §2.2

`Effect` con `id`, `usesAudio`, `paramsSchema`, `createMemory` y `render(ctx, params, memory, out)`.
La *respiración* lo implementa con `usesAudio: false` e ignora `ctx.audio`. No se cambia nada: ya se
diseñó pensando en *energía* (`MOO-20`), que es el riesgo que señalaba el Ticket 1.

### 2. Cada tira tiene sus salidas; el visor es una más y se añade siempre

El puerto `LightOutput` sirve a **una tira**:

```ts
interface LightOutput {
  /** Síncrono y sin bloquear. `frame` solo vale durante la llamada: quien lo guarde, lo copia. */
  write(frame: Uint8Array, tick: Tick): void;
}
// Tick = { seq, time }: el mismo objeto, reutilizado en cada frame
```

- En el fichero, cada tira declara **su salida** (glosario: `virtual` o `adalight`). `main.ts`
  construye la lista de salidas de cada tira: el visor siempre, más Adalight si la salida es
  `adalight`. Una tira virtual solo tiene el visor.
- El bucle recorre las salidas de cada tira y no enruta nada: quién recibe qué lo decide `main.ts`.
- **El búfer es del bucle.** Se reutiliza en cada frame para no crear basura (README §2.2), así que
  el frame solo vale durante `write`. El adaptador en memoria copia, y un test lo comprueba.
- **`seq`** numera cada ranura del bucle. Un hueco indica frames saltados, y permite medir el escenario
  *Dos paneles ven lo mismo* de la historia.
- Los frames van siempre en **RGB**; cada salida reordena según el orden de color de su tira (H3).

**Alternativa descartada:** un lote por tick con todas las tiras (`present(frameSet)`). Permitía al
visor mandar un único mensaje por tick con todas las tiras a la vez. La descartamos porque ese desfase
entre tiras (como mucho un frame, unos 16 ms) no se ve, y con una salida por tira el modelo es más
simple: Adalight encaja sin buscar su tira en un lote y una tira puede combinar salidas.

Que el puerto sea por tira no obliga a abrir un WebSocket por tira: las salidas del visor de cada
tira escriben en una única conexión por navegador (decisión 10).

→ **Proponer como D43** en `docs/idea-mood-table.md`.

### 3. El fichero de configuración vive en `config/local.json`

- El motor carga siempre `config/local.json`, resuelto **desde la raíz del repositorio**, no desde el
  directorio de trabajo, para que funcione igual con `pnpm dev` que como servicio en la Pi. Está
  ignorado por git: describe el hardware de cada instalación.
- `config/demo.json` está versionado y es el ejemplo sin hardware. `pnpm dev` lo copia a
  `config/local.json` si este no existe.
- Sin argumentos ni rutas por defecto alternativas: hay un solo sitio donde mirar, y la línea de log
  del arranque dice qué fichero se ha cargado.

**Alternativas descartadas:** `/etc/moodtable/config.json` en la Pi (README §1.4), por convención de
Linux, y una ruta pasada siempre como argumento (`--config`). Las dos añaden un sitio más donde puede
estar el fichero. `git pull` no toca un fichero ignorado, así que `config/local.json` sobrevive a las
actualizaciones igual que uno en `/etc`.

**Impacto:** README §1.4 cambia las rutas. → **Proponer como D44** en `docs/idea-mood-table.md`.

**Matiz para los tests (`MOO-18`):** los E2E necesitan su propio fichero, con una tira virtual y un
puerto que no choque con un `pnpm dev` abierto, y no pueden depender de lo que tenga cada uno en
`config/local.json`. Si existe la variable de entorno `MOODTABLE_CONFIG`, el motor carga ese fichero.
Es solo para los tests, y la línea de log sigue diciendo qué fichero se ha cargado, que es lo que esta
decisión quería proteger. Se descartaron una raíz de composición propia de los E2E (los E2E prueban el
sistema desde fuera, sin importar código del motor, README §2.3) y que los E2E copien su fichero a
`config/local.json` (pisaría el de cada uno).

### 4. Lo que declara el fichero mínimo y cuándo impide arrancar

```json
{
  "fps": 60,
  "strips": [
    { "id": "demo", "name": "Tira de prueba", "output": { "type": "virtual" }, "ledCount": 60 }
  ]
}
```

- **`strips`**: al menos una tira, cada una con `id`, `name`, `output` y `ledCount` (los campos del
  Ticket 1). El resto de campos de README §3 llegan con H4.
- **`output`** es un objeto discriminado por `type`, con los campos propios de cada tipo. En esta
  historia solo existe `virtual`, sin más campos; `adalight` y su `port` llegan con H3.
- **`fps`** es el pulso del motor (decisión 7), opcional, entero entre 1 y 60, con **60** por
  defecto. Fuentes de las cifras: el glosario (*unos 60 por segundo*), D30 (la demo pública va a 30)
  y README §2.2 (*30-60 fps*).
- **El motor no arranca y dice qué falla** si el fichero no existe, si no declara ninguna tira (lista
  vacía o sin `strips`), si el JSON está mal escrito *(asumido)*, si una tira no cumple el esquema
  (por ejemplo, una salida de un tipo no soportado), si tiene un campo que el esquema no declara
  *(asumido)* o si `fps` está fuera de 1-60. Los dos últimos salen de la revisión de la PR de
  `MOO-16`: sin ellos, una errata en un campo opcional se ignora sin avisar, y unos `fps` muy altos
  saturan la CPU sin decir por qué. Y tampoco arranca si declara más de 256 tiras, porque el índice
  de la tira ocupa un byte en el protocolo del visor (decisión 10); sale de la revisión de la PR de
  `MOO-17`.

### 5. La *respiración*: blanco cálido que sube y baja cada 4 segundos

Esta es la decisión del DJ para la *respiración* en la pregunta Q2 del PRD.

| Parámetro | Qué hace | Valor por defecto |
|---|---|---|
| `color` | Color de la tira | Blanco cálido |
| `period` | Segundos de una respiración completa (subir y bajar) | 4 |

Toda la tira a la vez, con una subida y bajada suave (una onda) de casi apagado a brillo máximo. Los
valores se podrán mover desde el panel con H2; aquí solo cuentan los valores por defecto.

### 6. `config/demo.json` con una sola tira

Es lo que pide la historia (*con una sola tira virtual declarada*). El bucle se escribe para N tiras
desde el principio y se prueba con un fichero de test de dos tiras. La segunda tira de la demo llega
cuando haya algo que mostrar con ella (una reactiva junto a una de ambiente, con `MOO-14`). README §1.4
dice hoy "dos tiras virtuales": se corrige junto con las rutas de la decisión 3.

### 7. El pulso: una función pura y un temporizador fuera del núcleo

- El núcleo expone una función que calcula los frames **para un instante dado** (`tick(now)`). No
  lee el reloj ni programa temporizadores: no tiene E/S.
- Un controlador fino, fuera del núcleo, la llama `fps` veces por segundo con un temporizador. Si una
  vuelta llega tarde, **se salta ese frame** en lugar de acumular retraso (README §2.2).
- Así el "reloj inyectable" del Ticket 1 sale solo: los tests pasan el instante a mano y obtienen
  siempre los mismos frames, sin temporizadores falsos ni esperas reales.

**Alternativa descartada:** inyectar un reloj y un planificador en el núcleo. Es más código para
conseguir lo mismo y mete en el núcleo la noción de "esperar".

### 8. Dónde vive cada parte de la carga del fichero

- **El esquema** del fichero, en `packages/shared`: lo usarán también el panel (las tiras y su
  geometría) y la API.
- **La validación** es una función pura que recibe el texto y devuelve la configuración o el error.
  Se testea sin disco.
- **La lectura del disco** va fuera del núcleo (en un adaptador o en `main.ts`), por la regla de
  fronteras.

### 9. Librería de esquemas: `typebox` 1.x

El paquete se llama ahora `typebox` (antes `@sinclair/typebox`). `@fastify/type-provider-typebox`
6.x, que usará la API, lo exige como dependencia *peer* (comprobado con Context7 y npm el
14-oct-2026: `typebox` 1.3.x). Va en el catálogo de `pnpm-workspace.yaml`. `shared` lo importa
directamente, no a través del plugin de Fastify, para que el panel no dependa de Fastify.

### 10. Una conexión por navegador y un mensaje binario por tira y frame

Este es el contrato que D42 pide proteger: si el motor se rehace, `MOO-18` se salva mientras no cambie.

- **Una sola conexión WebSocket por navegador.** Por ella viajarán también otros mensajes (estado,
  cambios de efecto), y el panel solo tiene que reconectar una conexión tras un reinicio del motor.
- **Un mensaje binario por cada frame de cada tira:**

  | Bytes | Campo | Para qué |
  |---|---|---|
  | 1 | Tipo de mensaje (`1` = frame) | Que por la misma conexión puedan viajar otros mensajes más adelante |
  | 4 | `seq` | Número de frame (decisión 2); permite comprobar que *dos paneles ven lo mismo* |
  | 1 | Índice de la tira | Su posición en el fichero de configuración (0, 1…) |
  | resto | Colores RGB | 3 bytes por LED |

- **El panel no necesita saber nada de antemano.** Cada mensaje dice de qué tira es, y el número de
  LEDs sale de su longitud (bytes ÷ 3). La lista de tiras con sus nombres llega con la zona *Tiras*
  (H4).

**Alternativa descartada:** identificar la tira por su `id` (el texto del fichero). Es más legible,
pero cada mensaje llevaría texto que hay que decodificar 60 veces por segundo por tira. El índice no se
queda desfasado: las tiras solo cambian al reiniciar el motor, y un reinicio obliga al panel a
reconectar.

→ **Proponer como D45** en `docs/idea-mood-table.md`.

### 11. El protocolo se documenta en `docs/instructions/viewer-protocol.md`

Cada sitio guarda una cosa, sin copiar entre ellos:

| Sitio | Qué guarda |
|---|---|
| `docs/instructions/viewer-protocol.md` | **El formato**: campos y bytes del mensaje. Es la fuente de verdad, con su fila en el índice de `AGENTS.md` |
| Spec `viewer` | **El comportamiento**, con sus escenarios. Enlaza el documento para el formato |
| `packages/shared` | **El código**: codificador y decodificador, con tests; el motor y el panel usan el mismo |
| README §4 | Un enlace al documento, como el de OpenAPI para la parte HTTP |

Detalles que no cambian nada de lo decidido (como el orden de los bytes de `seq`) se fijan al escribir
el documento.

**Alternativa descartada:** AsyncAPI (el equivalente de OpenAPI para mensajes). Para un solo tipo de
mensaje es más ceremonia que ayuda; se puede reconsiderar si el protocolo crece.

**Fuera de este change:** ampliar el propósito de `docs/instructions/` (arquitectura, buenas
prácticas…) con `AGENTS.md` como índice es una tarea del arnés aparte (`MOO-48`).

### 12. El motor sirve el build del panel; en desarrollo, Vite

- **En la Pi, en la demo y en los E2E**, el motor sirve el build del panel (`packages/panel/dist`) en
  su mismo puerto. No hay otro servidor.
- **En desarrollo**, `pnpm dev` arranca el motor y el servidor de Vite (`localhost:5173`), que da la
  recarga en caliente y reenvía `/ws` al motor. El motor no sabe nada de Vite.

**Alternativa descartada:** incrustar Vite en el motor en desarrollo para tener una sola dirección. Es
más complicado y frágil, y el motor pasaría a depender de Vite.

**Impacto:** README §1.4 dice hoy que en desarrollo se abre `localhost:8080`; pasa a `localhost:5173`.

### 13. Dirección y puerto del motor: en el fichero, solo local por defecto

El fichero de la decisión 4 admite un campo opcional `server`:

```json
{ "server": { "host": "0.0.0.0", "port": 8080 } }
```

- **Por defecto, `127.0.0.1:8080`**: solo local. El panel no tiene contraseña (README §2.5), y
  escuchar en toda la red por defecto expondría el motor en cualquier WiFi. `config/demo.json` no lo
  pone.
- **En la mesa**, el fichero de ejemplo de H3 pone `0.0.0.0` a propósito, con un comentario de por qué.
- **En la demo pública**, el valor por defecto es justo el que pide D30 (Caddy delante).

### 14. Sin conexión, el visor se apaga

| Estado | Cabecera | Visor |
|---|---|---|
| Conectado | `(*) Conectado` | Las tiras animándose |
| Sin conexión | `( ) Sin conexión con el motor` | Apagado: el canvas en negro, sin puntos |

- Es lo mismo si el panel no ha llegado a conectar nunca que si ha perdido la conexión.
- **Solo dos estados.** "Reconectando…" sería, visto desde fuera, lo mismo que "Sin conexión" (el
  panel siempre está reintentando), y solo añadiría un caso más que probar.

**Alternativa descartada:** congelar el último frame atenuado, como haría una tira física que deja de
recibir datos. El panel no distingue si se ha caído el motor o su propia red (en el segundo caso la
tira real sigue animándose), así que un frame congelado podría engañar. Apagado es lo más simple.

### 15. Reconexión: un intento cada segundo

El panel reintenta conectar cada segundo, siempre con el mismo intervalo, hasta que el motor vuelve.
Al reconectar, las tiras reaparecen solas, sin recargar.

**Alternativa descartada:** espera creciente entre intentos (la que preveía el Ticket 2). Protege a un
motor con muchos navegadores reconectando a la vez, que no es el uso real (red local, uno o dos
paneles).

### 16. Dibujo: canvas del navegador, sin librería

- La API de canvas 2D del navegador, sin librería de dibujo (la decisión que `panel-layout` dejó para
  este change).
- Una fila por tira, en el orden del fichero (el índice del mensaje, decisión 10), con un círculo por
  LED. La fila ocupa el ancho del visor.
- Sin nombres ni etiquetas: la lista de tiras llega con la zona *Tiras* (H4).
- En cada `requestAnimationFrame` se dibuja el **último** frame recibido de cada tira; los intermedios
  se descartan (Ticket 2), así que el panel nunca acumula retraso.

### 17. Los E2E: sobre el montaje de `MOO-49`

Playwright ya está montado (`MOO-49`, change `e2e-playwright-gate`): paquete `e2e/` del workspace,
`pnpm test:e2e`, job `e2e` en la CI y comprobación requerida. Hoy `webServer` sirve el build del panel
con `vite preview`, sin motor.

- `MOO-18` cambia solo el bloque `webServer` de `e2e/playwright.config.ts`: arranca el motor, que
  sirve el mismo build (decisión 12). Así lo prevé la decisión 3 de ese change.
- Los E2E de HU1 (la tira respira, el aviso sin motor, la reconexión, dos paneles) los escribe
  `MOO-18`. Usan un contexto de navegador por panel para el escenario de los dos paneles.

### 18. "Dos paneles ven lo mismo" se comprueba en el motor

El criterio de la historia (*con como mucho un frame de diferencia*, asumido) no se puede comprobar de
forma fiable en un E2E: un frame dura 16 ms y el test lee un navegador después del otro. Se reformula
como **"todos los paneles reciben los mismos frames"**:

| Test | Qué comprueba |
|---|---|
| Integración del motor | Con dos navegadores conectados, los dos reciben exactamente los mismos frames (mismo `seq`, mismos colores) |
| E2E (`MOO-18`) | Con dos navegadores abiertos, los dos visores se animan |

Si el motor envía lo mismo a todos y cada visor dibuja el último frame recibido, la diferencia entre
paneles queda limitada por la red, que es lo que pedía la cifra original.

### 19. `panel-layout`: el error de conexión del navegador no cuenta

`specs/panel-layout` exige que, con el panel abierto sin motor, *la consola del navegador no muestre
errores*. Desde `MOO-18`, al intentar conectar sin motor, el propio navegador escribe un error del tipo
"WebSocket connection to ws://… failed", y el código del panel no puede evitarlo. El requisito se
matiza: **sin errores en la consola, salvo el del navegador al no poder conectar con el motor**. Se
mantiene la intención (el panel no se rompe ni falla sin motor); los tests filtran ese mensaje concreto.

El test unitario *deja cada zona vacía, solo con su título* se ajusta, porque el visor ya no está
vacío. El requisito ya lo prevé (*mientras ninguna historia rellene una zona*).

## Risks / Trade-offs

- **[Si TypeScript no llega en la Pi, se rehace el motor]** → Riesgo aceptado en D42. Lo que conviene
  proteger es el contrato del WebSocket (`MOO-17`), que es lo que salva `MOO-18`.
- **[Una salida guarda el búfer y ve cómo cambia]** → El contrato de `write` lo prohíbe, y el adaptador
  en memoria, que copia, lo prueba.
- **[Las tiras de un mismo tick llegan por separado al visor]** → Un desfase de un frame entre tiras no
  se ve. Con una sola conexión (preferencia para `MOO-17`), llegan seguidas de todos modos.
- **[`config/local.json` se borra con un `git clean -x`]** → Es un fichero de una instalación, como
  lo sería uno en `/etc`. `HARDWARE_SETUP.md` (`MOO-34`) puede recomendar guardar una copia.
- **[Un navegador abierto que no recibe (un móvil bloqueado con el panel abierto) hace crecer la
  memoria del motor]** → **Riesgo aceptado, sin contramedida.** WebSocket va sobre TCP: lo que no llega
  se queda en la cola de salida de esa conexión hasta que se da por muerta, lo que puede tardar
  minutos. Con la demo (una tira de 60 LEDs) son unos 6 MB en 10 minutos; con la mesa real (dos tiras
  de 300 LEDs), unos 65 MB. Si aparece en uso real, la solución es un `if` en el adaptador del visor:
  no enviar un frame a un navegador que todavía tiene algo pendiente en su cola.
- **[Cualquier web abierta en el navegador puede conectarse al WebSocket del visor]** → Los
  navegadores no aplican CORS a WebSocket, así que una página de otro sitio puede abrir
  `ws://127.0.0.1:8080/ws`. Hoy solo recibiría frames, que no son sensibles: **riesgo aceptado en
  esta historia**. Deja de serlo con H2, cuando por la misma conexión viajen comandos: su spec tiene
  que comprobar la cabecera `Origin` al conectar y rechazar las que no sean la del propio panel.
  Sale de la revisión de la PR de `MOO-17`.
- **[El fichero mínimo se queda corto para H4]** → El esquema crece añadiendo campos opcionales y
  nuevos tipos de `output`, sin romper los ficheros existentes. Como rechaza los campos que no
  declara, un fichero con campos de una versión posterior no arranca en un motor anterior: es
  aceptable, porque el fichero y el motor se actualizan juntos con `git pull`.

## Open Questions

- **El valor exacto de "blanco cálido"** (RGB) y el brillo mínimo de "casi apagado": se fijan al
  escribir el efecto, y los frames dorados los congelan. No cambian los escenarios.
