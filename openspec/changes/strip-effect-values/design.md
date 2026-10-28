# Design

> Decisiones tomadas con el DJ al explorar `MOO-95` (28-oct). Por tarea: `MOO-105` (shared) 1, 3, 4, 5
> y 6 (los esquemas) · `MOO-106` (engine) 3, 4, 7 y 8 · `MOO-107` (panel) 1, 2, 3, 5 y 9. Los D# nuevos
> empiezan en **D84**, tras la D83 de `MOO-81`.

## Context

- **El esquema de la respiración ya existe** en `shared/src/effects.ts`: `color` (patrón `#RRGGBB`,
  blanco cálido por defecto) y `period` (`exclusiveMinimum: 0`, 4 por defecto), sin máximo. Los
  esquemas son **abiertos**: `EnergyParamsSchema` es `Type.Object({})` y acepta cualquier objeto.
- **La ranura de cada tira no deja cambiar sus valores.** `createSlot` (`core/control.ts`) crea los
  parámetros con `defaultParams` y la memoria, y los encierra en el `render`: la única forma de
  cambiar algo es rehacer la ranura entera, que reinicia la memoria del efecto.
- **La respiración usa el tiempo absoluto:** `wave = (1 - cos(2π·time/period)) / 2`. Con otro periodo,
  la fase salta de `time/4` a `time/6` de un frame al siguiente: un fogonazo o un apagón. Sus tests y
  frames dorados llaman a `render` en instantes sueltos, con `dt = 0` y memoria nueva.
- **El panel ya envía un tipo de orden.** `EffectRequests` (`panel/src/engine/effect-requests.ts`)
  deja un `PUT` en camino por tira y guarda la última elección pendiente (D82).
- **El estado llega por el mensaje `6`** (D78): JSON con las tiras y su efecto, al conectarse y en
  cada cambio de efecto. `main.ts` arma la foto con `stripsMessage(config, control)`.
- **El panel está en castellano** y sus textos viven en `literals.ts` (decisión 9 de
  `strip-effect-switch`), con tipos que obligan a tener el texto de cada efecto. Pasarlo al inglés
  es `MOO-104`.
- **Mantine 9** trae lo que piden los controles: `Slider` con `scale` (mostrar el valor en otra
  escala) y `onChangeEnd` (al soltar), y `ColorPicker` con `onChange` continuo y `onChangeEnd`.
  TypeBox 1.3 conserva las palabras `x-` en el esquema y no las tiene en cuenta al validar
  (comprobado el 28-oct).

Motivación y alcance: `proposal.md`. Requisitos: `specs/instrument-control` y `specs/effects`.

## Goals / Non-Goals

**Goals:**

- Que el esquema de cada efecto sea la única fuente de sus parámetros: el motor valida con él y el
  panel dibuja con él.
- Que cambiar un valor no rehaga la ranura: la memoria del efecto sigue, y la respiración no salta.
- Que el control que se arrastra no tiemble y que, en reposo, el panel siga sin mostrar nada que el
  motor no pinte.

**Non-Goals:**

- **Persistir los valores**: siguen en la memoria del motor (H5, `MOO-25`). El aviso de cambio es el
  mismo punto donde se enganchará `StateStore`.
- **Recordar los valores de cada efecto al salir de él**: cambiar de efecto sigue creando la ranura
  con los valores por defecto (`MOO-96`).
- **Un control genérico para cualquier esquema**: solo los que usa hoy algún parámetro (slider y
  color). El desplegable llega con el primer parámetro que lo necesite.

## Decisions

### 1. El periodo va de 1 a 20 s, con un slider en escala logarítmica

El esquema fija `minimum: 1` y `maximum: 20`, y marca el periodo con `x-scale: "log"` (decisión 5).
Por debajo de 1 s deja de leerse como respiración; por encima de 20 s parece luz fija. La escala
logarítmica reparte el recorrido por cambios relativos: de 2 a 4 s se nota tanto como de 8 a 16, y el
valor por defecto (4 s) queda cerca del centro.

El slider de Mantine trabaja en el espacio logarítmico (`ln 1` a `ln 20`) y `scale` muestra los
segundos. El valor que sale del panel y el que guarda el esquema son siempre segundos: la escala solo
vive en el control.

Alternativas descartadas: lineal de 1 a 20 s (la zona útil, 1-5 s, queda en el primer quinto del
recorrido) y lineal de 1 a 10 s (pierde las respiraciones lentas del ambiente sin música).

**→ D84.** Resuelve el rango de PRD Q2.

### 2. Mientras se arrastra, el control sigue al dedo; en reposo, al motor

Cada control guarda un valor local mientras el DJ lo toca: desde el primer `onChange` hasta que, tras
el `onChangeEnd`, ya no queda ningún envío de valores de esa tira en camino ni pendiente. Mientras lo
tiene, muestra ese valor e ignora los ecos del motor para ese parámetro. Después vuelve a mostrar lo
que dice el mensaje `6`.

```
 dedo:        2.0   2.4   2.9   3.5   4.0 (suelta)
 eco motor:      1.8   2.0   2.4   2.9   3.5   4.0
 control:     2.0   2.4   2.9   3.5   4.0 ......  4.0   <- motor otra vez, sin salto
                                       ^ espera a que no quede envio en camino
```

Esperar a la cola, y no solo a soltar, evita un salto atrás: al soltar, el último valor puede estar
aún pendiente, y el eco que llega antes es el anterior. Si el motor aplicó el último valor, el control
espera además a que la tira llegue con otros valores: el motor manda el eco antes de responder al
`PUT`, pero van por conexiones distintas y la respuesta puede llegar antes (precisado al implementar
`MOO-107`, a raíz de la revisión de la PR). Si el motor no aplica el valor, el control
acaba en el que pinta el motor (escenario *Un valor que no llega al motor*): el panel nunca miente en
reposo.

Alternativas descartadas: el control siempre obedece al motor, D82 tal cual (el pulgar tiembla con
cada eco atrasado), y el control siempre local (contradice D82 y miente si el motor rechaza un valor).

**→ D85.** Matiza D82: el panel no marca lo que el motor no pinta, salvo el control que el DJ está
moviendo.

### 3. Dos colas independientes y esquemas de parámetros cerrados

El panel envía los valores con el mismo patrón que el efecto: un `PUT` en camino por tira como mucho y
el último valor pendiente. El ritmo lo marca lo que tarda la petición, no un reloj, y lo pendiente
garantiza que la tira acaba en el valor en que el DJ soltó. `EffectRequests` se generaliza en una cola
por clave (la tira) con la ruta y el cuerpo como parámetros, y hay una instancia para efectos y otra
para valores.

Las dos colas son independientes, así que un `PUT` de valores y uno de efecto de la misma tira pueden
cruzarse en la red (soltar un control y pulsar otro efecto en el mismo instante, con la WiFi lenta).
Para que un valor atrasado no caiga en otro efecto, todos los esquemas de parámetros pasan a ser
**cerrados** (`additionalProperties: false`): unos valores de la respiración que llegan cuando la tira
ya es energía no cumplen el esquema de la energía y se rechazan con `400`.

**Riesgo aceptado:** dos efectos futuros con un parámetro del mismo nombre y del mismo tipo podrían
aceptar los valores del otro. La salida, si llega, es que la orden de valores nombre su efecto y el
motor responda `409` si no es el activo.

Alternativas descartadas: una sola cola por tira para las dos órdenes (garantiza el orden solo desde
este panel y complica lo pendiente) y nombrar el efecto ya (protege de algo improbable con daño casi
nulo hoy).

**→ D86.**

### 4. `PUT /api/strips/{stripId}/values` con todos los valores del efecto activo

Una segunda ruta, con el mismo estilo que la del efecto: `PUT` porque fija un estado y es
idempotente, el cuerpo con **todos** los valores del efecto activo, y la tira en la respuesta `200`.
`404` si la tira no existe y `400` si los valores no cumplen el esquema del efecto activo.

```http
PUT /api/strips/demo/values
Content-Type: application/json

{ "color": "#2040FF", "period": 7 }
```

El esquema del cuerpo en el OpenAPI es la unión de los esquemas de parámetros del catálogo, para que
describa cada forma posible con sus rangos. La validación que decide es la del **efecto activo** y la
hace el núcleo (decisión 8), porque cualquier mando, no solo la API, tiene que pasar por ella.

El recurso se llama `values` y no `params`: según el glosario, el *parámetro* lo declara el efecto y
el *valor* es lo que vale en una tira, y lo que cambia el DJ es el valor.

Alternativas descartadas: `PATCH` con solo el valor que cambia (el motor y el panel tendrían que
mezclar lo pendiente) y una ruta por parámetro (`…/values/period`, que deja el cuerpo sin tipo en el
OpenAPI).

**→ D87.** Matiza D81: la API pasa de una ruta a dos.

### 5. El esquema dice qué control pintar: palabras estándar y dos extensiones `x-`

El panel genera los controles sin conocer el efecto. Lo que JSON Schema ya expresa va con sus
palabras (`type`, `minimum`, `maximum`, `default`) y sirve también para validar: el mismo `maximum`
dibuja el slider y rechaza un 25. Lo que no expresa va en dos extensiones, la convención de OpenAPI
para datos propios:

| Parámetro | En el esquema | Control |
|---|---|---|
| `color` | `type: string`, patrón `#RRGGBB`, `x-control: "color"` | Selector de color |
| `period` | `type: number`, `minimum: 1`, `maximum: 20`, `x-scale: "log"` | Slider logarítmico |

Una función pura del panel traduce el esquema de cada parámetro a un control: `x-control: color` →
selector; `number` con `minimum` y `maximum` → slider, logarítmico si trae `x-scale: log`. Un test
recorre el catálogo y comprueba que cada parámetro tiene control. El catálogo de `shared` pasa a
llevar el esquema de parámetros de cada efecto, y el registro del motor lo usa en vez de repetirlo.

Alternativas descartadas: inferirlo todo del esquema (no puede expresar la escala logarítmica) y un
mapa de controles por efecto en el panel (rompe E9: añadir un efecto obligaría a tocar el panel).

**→ D88.**

### 6. Los valores viajan en el mensaje `6`, con su tipo según el efecto

Cada tira del mensaje lleva `values`, y su tipo depende del efecto: una unión discriminada por
`effect`, generada del catálogo.

```json
{ "id": "demo", "name": "Tira de prueba", "ledCount": 60, "output": { "type": "virtual" },
  "effect": "breathing", "values": { "color": "#FFA957", "period": 4 } }
```

El mensaje se envía al conectarse, en cada cambio de efecto y en cada cambio de valores. Un solo
camino: lo que el panel recibe al abrirse y lo que recibe al cambiar es lo mismo. La respuesta `200`
de las dos rutas es esta misma tira.

Mientras se arrastra, cada cambio reenvía todas las tiras: unos 150-200 bytes por tira, decenas de
veces por segundo. Por el mismo WebSocket pasan los frames, unos 54 KB/s por tira de 300 LEDs.

Alternativas descartadas: un mensaje `7` solo para los valores (el `6` tendría que llevarlos igual,
para el arranque) y una ruta `GET` (contradice D78).

**→ D89.** Amplía D78.

### 7. La respiración reancla su fase al cambiar el periodo

La memoria de la respiración guarda el periodo con que pintó el último frame y un desfase. La fase es
`time / period + desfase`. Cuando el periodo cambia, el desfase se recalcula para que la fase en ese
instante sea la misma con el periodo nuevo que con el viejo:

```
 desfase_nuevo = (time / periodo_viejo + desfase_viejo) - time / periodo_nuevo
```

El brillo no salta y, desde ahí, respira al ritmo nuevo. Con el periodo fijo, el desfase es 0 y la
respiración pinta exactamente lo mismo que hoy: los frames dorados y los tests de instantes sueltos
no cambian. No crea objetos ni lee el reloj.

Alternativa descartada: acumular la fase pulso a pulso (`fase += dt / periodo`). Haría depender cada
frame de todos los anteriores, rompería los tests que piden un instante suelto y arrastraría el
error del redondeo.

No es un D#: es cómo cumple la respiración su requisito, y queda en su código y en `specs/effects`.

### 8. El núcleo valida y cambia los valores sin rehacer la ranura

El puerto `Commands` gana `setValues(stripId, values)`, que devuelve `changed`, `unchanged`,
`unknown-strip` o `invalid` (con el motivo, para el mensaje del `400`), sin lanzar, como
`setEffect`. Valida contra el esquema del efecto activo de la tira y, si pasa, sustituye la
referencia a los valores de la ranura por un objeto nuevo, creado fuera del bucle. La memoria del
efecto no se toca. El bucle lee esa referencia en cada pulso, así que los valores entran enteros en
el pulso siguiente, nunca a medias. Unos valores iguales a los actuales dan `unchanged` y no avisan
a los paneles.

Cada cambio avisa por el mismo `watch` que el cambio de efecto, y `main.ts` vuelve a mandar el
mensaje `6`. La foto de las tiras lee los valores de cada ranura.

**→** amplía **D77** (el búfer de control); no hace falta un D# nuevo.

### 9. Los nombres de los parámetros van en el módulo de literales, en castellano

El panel sigue en castellano hasta `MOO-104`. Los nombres de cada parámetro («Color», «Periodo (s)»)
van en `literals.ts`, con un tipo que obliga a tener el de cada parámetro de cada efecto: un
parámetro nuevo no compila hasta tener su nombre, como ya pasa con los efectos. El esquema no lleva
`title`.

Alternativa descartada: el nombre en el `title` del esquema, en inglés. Mezclaría inglés y castellano
en el panel hasta `MOO-104`, y metería texto de la interfaz en `shared`.

Sin D#: sigue la decisión 9 de `strip-effect-switch`.

## Risks / Trade-offs

- **[Un valor atrasado cae en otro efecto con un parámetro del mismo nombre]** → Hoy no existe ese
  caso. Riesgo aceptado (decisión 3), con su salida apuntada.
- **[El control se queda con el valor local si una petición no vuelve nunca]** → El envío ya trata un
  fallo de red como respuesta (`catch`): la cola se vacía y el control vuelve al motor. Un test lo
  cubre.
- **[Muchos mensajes `6` mientras se arrastra]** → El ritmo lo limita la propia cola (un `PUT` en
  camino por tira), y el mensaje es pequeño frente a los frames.
- **[El selector de color ocupa sitio en la columna Controles]** → Se usa el `ColorPicker` en línea,
  sin desplegable: se toca directamente, como un pad. Si no cabe bien, el `ColorInput` con
  desplegable da el mismo `onChangeEnd`.
- **[Medir los 100 ms en el E2E]** → El mismo método que el cambio de efecto en `strip-effect-switch`:
  el tiempo desde la acción hasta que el visor pinta el cambio.

## Migration Plan

Sin datos que migrar: los valores viven en la memoria del motor. El panel y el motor se despliegan
juntos (el motor sirve el panel), así que el mensaje `6` con `values` no necesita convivir con el
antiguo.

En el commit de este change, además de los artefactos:

- `docs/PRD.md`: Q2 resuelta también en el rango del periodo (1-20 s, escala logarítmica, decisión
  del DJ al explorar este change) y Q8 ampliada a «un cambio de efecto o de valor».
