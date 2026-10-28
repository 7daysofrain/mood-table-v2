# Design

> Decisiones tomadas con el DJ al explorar `MOO-94` (28-oct). Por tarea: `MOO-101` (shared) 3, 5 y 6
> (los esquemas) · `MOO-102` (engine) 1, 2, 4, 5 y 6 · `MOO-103` (panel) 5, 7, 8 y 9. Los D# nuevos
> empiezan en **D77**, tras la D76 de `MOO-92`.

## Context

- **El bucle fija cada tira al arrancar.** `createFrameLoop` crea una ranura por tira con el efecto
  del fichero (`StripSlot`: búfer del frame, salidas y un `render` con sus parámetros y su memoria), y
  no hay forma de cambiarla después. También decide al arrancar si hace falta analizar el audio
  (`needsBands`): si todas las tiras empiezan con un efecto de ambiente, el análisis no se calcula
  nunca y una tira que pasara a *energía* recibiría `ctx.audio = null`.
- **Hay dos estados que necesitan unos segundos para estabilizarse.** El análisis (ganancia y
  suavizado de las bandas, `analysis.ts`) y la memoria de *energía* (ganancia de cada banda, que
  empieza en 0,01, `energy.ts`). El segundo es por tira y nace con la memoria: elegir *energía* en
  marcha la crea de cero.
- **El servidor solo tiene salidas.** `startServer` sirve el panel, `/ws` y `/audio`, y escucha antes
  de que exista el bucle, porque el bucle necesita las salidas del visor que da el servidor. Fastify
  no admite rutas nuevas después de `listen()`.
- **El WebSocket solo va del motor al panel.** El panel no envía nada. Al conectarse recibe la fuente
  (tipo `2`) y el estado de la tarjeta (tipo `5`), y por cada pulso, frames, nivel y posición.
- **Un solo hilo.** Una petición HTTP nunca se ejecuta a mitad de un pulso, así que el búfer de
  control no protege de una carrera: lo que aporta es la frontera (README §2.1, *Plano de control*).
- **El catálogo de efectos ya está en `shared`** (`EFFECT_CATALOG`, con `usesAudio`). La regla de que
  un reactivo necesita fuente vive dentro de `parseConfig`.

Motivación y alcance: `proposal.md`. Requisitos: `specs/instrument-control` y `specs/effects`.

## Goals / Non-Goals

**Goals:**

- Que el plano de control escriba y el de tiempo real lea, sin que el bucle cree objetos ni sepa qué
  mando le habla.
- Que el panel tenga una sola fuente de verdad del efecto activo: el motor, por el WebSocket.
- Que el OpenAPI salga del mismo esquema que valida la ruta y que no pueda quedarse viejo.

**Non-Goals:**

- **Persistir el efecto elegido**: el búfer guarda en memoria. Avisar a `StateStore` en cada cambio es
  H5 (`MOO-25`); el aviso que se añade aquí (decisión 1) es el punto donde se enganchará.
- **Recordar los valores de un efecto al salir de él**: la ranura se crea con los valores por defecto
  cada vez (`MOO-96`).
- **Una API genérica de comandos** (cola, deshacer, varios cambios a la vez): solo `setEffect`.
  `setParam` llega con `MOO-95`.

## Decisions

### 1. El búfer de control es un objeto del núcleo que crea `main.ts` antes que el servidor y el bucle

`core/control.ts` exporta el búfer de control, creado con las tiras de la configuración, el registro
de efectos y si hay fuente de audio. Implementa el puerto **`Commands`** (`setEffect(stripId,
effectId)`) y da tres cosas más: el efecto activo de cada tira, la ranura de efecto que el bucle debe
pintar en cada tira y una suscripción a los cambios.

```
  config --> control (nucleo) <-- Commands -- API HTTP (luego, la F1)
                |     |
                |     +--watch--> main.ts --> servidor --> todos los paneles (tipo 6)
                v
           bucle: al empezar cada pulso, lee la ranura de cada tira
```

- **`setEffect` hace todo el trabajo que crea objetos**: busca el efecto, crea su memoria y sus
  parámetros por defecto y deja la ranura nueva en el sitio de la tira. El bucle, al empezar el pulso,
  solo lee esa referencia. Así se mantiene la regla de no crear objetos dentro del bucle (README §2.2)
  y el cambio entra entero en el pulso siguiente, nunca a medias.
- **Devuelve un resultado, no lanza**: `changed`, `unchanged` (el efecto ya estaba activo: no crea
  ranura ni avisa, y la tira sigue por donde iba), `unknown-strip` o `needs-audio-source` (decisión
  5). La ruta lo traduce a HTTP; otro mando lo traducirá a lo suyo.
- **De varias elecciones, queda la última** sin código propio: cada `setEffect` pisa la ranura de la
  tira, y el bucle solo ve la que hay al empezar el pulso.
- **El aviso sale del búfer**, no de la ruta: cualquier mando que escriba en `Commands` se ve en todos
  los paneles. Es el mismo esquema que `watchSourceStatus`: el que sabe avisa, y `main.ts` conecta el
  aviso con el servidor.
- **`createFrameLoop` recibe el búfer** en lugar de construir las ranuras. Sigue siendo una función
  pura del instante, y los tests lo montan a mano con una salida en memoria. Así *Cambiar el efecto
  de una tira no toca las demás* se prueba en el núcleo: los frames de B salen idénticos a los de una
  ejecución sin el cambio.

Esto rompe el ciclo del arranque. El búfer no depende del servidor ni del bucle, y los dos dependen
de él: `main.ts` lo crea, se lo pasa al servidor (que registra la ruta antes de `listen()`) y después
al bucle.

**Alternativas descartadas:**
- **Que el bucle exponga `setEffect`**: es menos código, pero el servidor necesitaría el bucle antes de
  escuchar, y el bucle las salidas del servidor.
- **Partir `startServer` en «crear» y «escuchar», o salidas que se conectan después**: resuelven el
  ciclo con piezas a medio montar entre llamadas.
- **El búfer en el adaptador HTTP**: el núcleo dependería de un adaptador (`specs/module-boundaries`).

**→ D77** en `docs/idea-mood-table.md` §10.

### 2. Los mandos van por HTTP y el estado por el WebSocket

El reparto es por dirección: **el WebSocket lleva todo lo que el motor cuenta** (frames, nivel, fuente
y ahora las tiras), y **HTTP todo lo que el panel pide hacer**. El panel nunca lee estado por HTTP ni
envía órdenes por el WebSocket.

- **HTTP para mandar** porque una orden necesita respuesta (se aplicó, la tira no existe, no hay
  fuente), y HTTP ya la trae, con validación por ruta y OpenAPI (README §4). Por el WebSocket habría
  que inventar ids de petición, confirmaciones y plazos, y meter JSON de ida en el protocolo binario
  del camino caliente.
- **WebSocket para leer** porque el estado de las tiras es estado, como la fuente (D51). El panel lo
  recibe al conectarse, sin pedirlo, también tras un reinicio del motor. Y lo recibe al cambiar, venga
  el cambio de donde venga.
- **El panel marca lo que dice el mensaje**, no la respuesta del `PUT`, que solo se usa para saber si
  hubo error. Así hay una sola fuente de verdad.
- **Consecuencia aceptada**: varios paneles se sincronizan sin trabajo extra. Enviar el cambio solo al
  panel que lo pidió sería más código. Lo comprueba un test del servidor, y no se promete en la
  historia (non-goal).

**Alternativas descartadas:**
- **Todo por el WebSocket** (propuesta del DJ al explorar, para tener una sola vía): sin OpenAPI y
  reinventando la petición y la respuesta. Si los sliders de `MOO-95` no se sienten inmediatos por
  HTTP, `setParam` puede pasar al WebSocket como otro adaptador de `Commands` (README §2.1,
  *Sacrificios*).
- **`GET /api/strips` para leer**: dos caminos para leer estado y un `fetch` extra en cada reconexión.

**→ D78**, junto con la decisión 3. Amplía D51.

### 3. El mensaje de las tiras es el tipo `6`: byte de tipo y JSON con la foto completa

```
  byte 0: 6 | bytes 1..: UTF-8 de
  {"strips":[{"id":"demo","name":"Tira de prueba","ledCount":60,
              "output":{"type":"virtual"},"effect":"energy"}]}
```

- **JSON detrás del byte de tipo, en un mensaje binario** como los demás. Así se mantiene la regla de
  que el primer byte dice el tipo, y un texto de longitud variable por tira no obliga a prefijar
  longitudes. Es un mensaje poco frecuente (al conectarse y en cada cambio) y de unos cientos de bytes.
  Es el primer mensaje JSON del protocolo.
- **Siempre la foto completa**, en el orden del fichero: la posición en la lista es el índice de la
  tira en los frames (tipo `1`). Es idempotente: da igual si llega dos veces, y reconectarse es recibir
  la misma.
- **Esquema propio, `StripsMessageSchema`**, en `shared`, con los campos que muestra el panel. No
  reutiliza `StripConfigSchema`: lo que H3 y H4 añadan al fichero (orden de color, límites de potencia,
  puerto) no sale al panel sin decidirlo, como la ruta del fichero en D51.
- **`decodeStrips` valida con el esquema**. Un mensaje que no lo cumple se trata como uno que no se
  entiende (`viewer-protocol.md`).

**Alternativas descartadas:** todo binario (más código para ganar bytes en un mensaje raro), y lista al
conectarse más un mensaje pequeño por cambio (dos mensajes que tienen que cuadrar).

### 4. Con fuente de audio, el análisis corre en todos los pulsos

El bucle deja de calcular `needsBands`: si hay fuente, cada pulso analiza las bandas y las deja en
`ctx.audio`; sin fuente, `ctx.audio` sigue siendo `null`. Con eso, una tira puede pasar a *energía* en
cualquier momento con el análisis ya estable.

- **Cabe en el presupuesto**: el spike de `MOO-12` (D48) midió el bucle con FFT en la Pi sin tirones,
  así que calcular siempre es el caso que ya se midió.
- **Simplifica el bucle**: desaparece la condición, y con ella el caso en que un efecto reactivo
  recibe `null` teniendo fuente.
- **El calentamiento de la memoria de *energía* se acepta** como límite conocido: hasta 2 s
  encendiendo los tres colores al elegirla, como al arrancar el motor (`specs/effects`). Evitarlo
  tocaría la ganancia inicial de la v1, que el usuario decidió portar tal cual en `MOO-20`, y los
  frames dorados de *energía*. Si en la demo se nota demasiado, irá en su propia historia.

**Alternativas descartadas:**
- **Mantener calientes los efectos inactivos**: pintar sin enseñarlo N tiras × M efectos en cada
  pulso.
- **No hacer nada**: dejaría `ctx.audio = null` en una tira reactiva con fuente.

**→ D79.** Matiza **D28** («el análisis … se omite si ninguna tira lo usa»): se tacha ese inciso y
apunta a D79, sin borrar ni renumerar. También cambian README §2.1 (diagrama y *El motor funciona sin
audio*) y §2.2 (*Análisis de audio*).

### 5. Sin fuente de audio: reactivos desactivados en el panel y `409` en la API

- **Una sola regla en `shared`**: una función que dice si un efecto necesita fuente de audio, a partir
  de `usesAudio`. La usan `parseConfig` (arranque), el búfer de control (`needs-audio-source`) y el
  panel. Sustituye la comprobación que hoy está escrita dentro de `parseConfig`.
- **La API responde `409`** con el mensaje del estilo del fichero: «la tira «demo», efecto `energy`:
  necesita una fuente de audio». La tira no cambia.
- **El panel los desactiva, no los oculta**, con el motivo a la vista («Necesita una fuente de
  audio»). Sabe si hay fuente por el mensaje de tipo `2`, que ya recibe.

Rechazarlo en la entrada mantiene la misma regla al arrancar y en marcha (decisión 6 de
`virtual-strip-audio-file`: una tira reactiva sin fuente es un olvido que se dice, no una tira
apagada).

**→ D80.**

### 6. Una sola ruta, OpenAPI generado y guardado en el repositorio

- **Solo `PUT /api/strips/{stripId}/effect`**, con `{ "effect": "<id>" }`. Es `PUT` porque fija un
  estado: es idempotente, y elegir el efecto activo no hace nada (decisión 1). La respuesta `200` es
  la tira con la misma forma que en el mensaje `6`. Los errores responden `{ "message": "…" }`: `404`
  (tira), `409` (fuente) y `400` (cuerpo o efecto que no existe, que valida el esquema). El `400` de
  validación de Fastify se formatea igual.
- **Prefijo `/api`, sin versión**: el panel lo sirve el propio motor y siempre van juntos. Un cliente
  externo, si llega, añadirá la versión.
- **Ninguna ruta de lectura**: el panel no la necesita (decisión 2) y la F1 o la pantalla táctil serán
  adaptadores dentro del proceso, que llaman a `Commands` directamente.
- **Esquemas en `shared`** (cuerpo, respuesta y error), para que el panel use los mismos tipos.
- **OpenAPI con `@fastify/swagger`** a partir de los esquemas de la ruta, con
  `@fastify/type-provider-typebox` 6.x (admite `typebox` 1.x, comprobado con npm el 28-oct; la 5.x
  pide `@sinclair/typebox` ≤ 0.34). Se sirve en `/api/openapi.json`. Sin Swagger UI: una página y una
  dependencia para una ruta.
- **`docs/openapi.yaml` generado y commiteado**: `pnpm openapi` lo escribe y un test falla si no
  coincide con lo que genera el código, con el comando en el mensaje. El corrector de la entrega lee el
  repositorio, no el motor en marcha. El README §4 resume la ruta con un ejemplo y enlaza el fichero y
  el protocolo del visor.
- **Generarlo sin abrir el puerto** pide separar en `server.ts` el montaje de la app de `listen()`:
  `buildServer` registra plugins y rutas, y `startServer` lo usa y escucha.

**→ D81.**

### 7. El panel se toca como un instrumento

El DJ puede querer cuadrar a mano el cambio con un golpe de la música, así que la zona Efectos
funciona como los pads de una controladora:

- **Se dispara al pulsar** (`pointerdown`), no al soltar: el `click` llega entre 50 y 150 ms después,
  más que todo el resto de la cadena. Enter y Espacio siguen funcionando con el teclado, sin que un
  mismo gesto dispare dos veces.
- **Sin indicadores**: ni spinner ni estado de «enviando». El activo se marca cuando llega el mensaje
  `6`, unos milisegundos después.
- **Un `PUT` en camino como mucho**, con la última elección pendiente: al terminar el que está en
  camino, se envía la pendiente si es distinta de la última enviada. El navegador puede abrir varias
  conexiones, y dos `PUT` en paralelo podrían llegar al motor en otro orden. Así gana lo último que
  pulsó el DJ, no lo último que llegó. Solo espera si ya hay uno en camino (unos ms en red local).
- **Un error no se avisa**: el panel no marca lo que el motor no pinta, y el visor enseña el efecto
  real. Qué debe ver el DJ es la pregunta Q8 del PRD.

**Presupuesto de tiempo**, contra los 100 ms de E1 (`docs/umbrales-para-specs.md`):

```
  pulsar --> PUT (red local, ~2-5 ms) --> bufer --> siguiente pulso (<= 16,7 ms a 60 fps)
         --> visor: WebSocket + requestAnimationFrame (~16 ms)    total ~ 20-40 ms
         --> tira:  Adalight, 200 LEDs (~50 ms, H3)                total ~ 55-75 ms
```

Los 100 ms son el umbral de «instantáneo» de una interfaz (Nielsen), no el de un músico, que nota
desfases de 20-30 ms. Para el visor hay margen; el término que pesa es Adalight, ya apuntado para H3 en
los umbrales. No hay fuente para un número más estricto, así que el escenario usa el de E1.

**Alternativas descartadas:** marcar al pulsar sin esperar al motor (puede mostrar algo falso y no se
gana nada perceptible), desactivar los botones mientras hay un `PUT` en camino (bloquea al DJ) y un
aviso de error (responde a Q8 antes de tiempo).

**→ D82.**

### 8. Sin conexión, Tiras y Efectos se vacían y la selección vuelve por su `id`

La conexión del panel guarda las tiras del último mensaje `6` y las olvida al perder la conexión, igual
que la fuente y el estado de la tarjeta. Las zonas Tiras y Efectos quedan con su título (*Las zonas
vacías no inventan datos*). La tira seleccionada se guarda en el panel por su `id`: al volver, si
sigue declarada vuelve a estar seleccionada, y si no, la primera. Mantener la última lista con los
botones desactivados también valdría, pero sería un estado más que diseñar y probar.

### 9. Los textos nuevos van en un módulo de literales, en castellano

Los textos de las zonas Tiras y Efectos (etiquetas, nombres de los efectos, salida, motivo de los
desactivados) van en un módulo del panel, sin librería de i18n. Los nombres de los efectos son un
`Record<EffectId, string>`: cuando `MOO-98` añada `spectrum` al catálogo, el panel no compila hasta
tener su nombre. No van en el catálogo de `shared` porque son presentación y hoy solo hay un cliente.
El panel sigue en castellano; pasarlo al inglés, con su D#, es `MOO-104`, que llevará a este módulo los
textos que ya existen.

## Risks / Trade-offs

- **[El análisis cuesta CPU aunque todo sea ambiente]** → El spike de D48 ya midió ese caso. Si una
  tira de muchos LEDs lo pone justo, el análisis podría volver a omitirse cuando ninguna tira es
  reactiva y calentarse en segundo plano al elegir un reactivo. Hoy no hace falta.
- **[El calentamiento de *energía* se ve en directo]** → Está en la spec como límite. Se comprueba a
  mano con la demo antes de la entrega; si molesta, va a su propia historia (decisión 4).
- **[Los 100 ms en el E2E pueden fallar en la CI]** → El E2E mide desde el `pointerdown` hasta el
  primer frame de respiración que recibe la página, con motor y navegador en la misma máquina, lo que
  deja unas 3 veces de margen. Si falla de forma intermitente, se abre una *chore*, como con el
  reproductor.
- **[El primer mensaje JSON del protocolo]** → Lo valida su esquema al decodificarse, y
  `viewer-protocol.md` documenta su forma con un ejemplo, como los binarios.
- **[Dos paneles cambiando la misma tira a la vez]** → Gana el último que llega al motor, y los dos ven
  el resultado por el mensaje `6`. Lo cerrará la historia de varios paneles.
- **[`@fastify/swagger` con `typebox` 1.x]** → El type provider está comprobado. Que swagger lea bien
  los esquemas (por ejemplo, la unión de literales del efecto) se comprueba en el primer paso del
  OpenAPI, con el test que compara el YAML.

## Migration Plan

Sin datos que migrar ni ficheros de configuración que cambien. Al desplegar, el panel servido y el
motor van juntos (decisión 6). Para volver atrás, basta con revertir la PR.
