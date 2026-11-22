# Design

> Decisiones tomadas con el DJ al explorar `MOO-97` (6-nov): la 1 (sin capa genérica), la 3 (fader
> lineal), la 6 (zona nueva) y la 7 (porcentaje). El resto son propuestas de diseño para revisar
> aquí. Por tarea: `MOO-125` (shared) 4 y 5 (los esquemas y el mensaje) · `MOO-126` (engine) 1 a 5
> y 8 · `MOO-127` (panel) 3, 6, 7 y 9. Los D# nuevos empiezan en **D99**, tras la D98 de `MOO-128`.
> **D99** no sale de aquí, sino del refinamiento de la historia: matiza D49 (la sensibilidad de cada
> efecto sigue en Q2 y H2 cierra con *energía* sin parámetros) y va en el commit del change.

## Context

- **El bucle pinta y entrega en el mismo paso** (`core/frame-loop.ts`): para cada tira,
  `control.slot(i).render(ctx, frame)` y, sin nada en medio, `output.write(frame, tick)` en cada
  salida. Cada tira tiene su `Uint8Array` preasignado y el bucle no crea objetos.
- **El límite de potencia todavía no existe.** README §2.1 dibuja el plano de tiempo real como
  efecto → límite de potencia → salidas, pero en el núcleo no hay nada de `maxCurrentMa`: llega con
  H4.
- **Ningún efecto lee lo que hay en `out`.** *Respiración* escribe todos los LEDs; *energía*,
  *scroll* y *espectro* hacen `out.fill(0)` y escriben encima. Su estado vive en su memoria. Pero el
  contrato de `Effect` (`core/effects/effect.ts`) no lo dice.
- **Los valores del frame son de pantalla, no de luz.** La salida Adalight aplica la gamma 2,0 al
  final (`adapters/adalight.ts`, D96), solo hacia la tira. Además, el sketch del Uno topa el brillo al
  25 % (D46).
- **La *respiración* ya hace esta operación**: multiplica su color por su nivel y redondea
  (`breathing.ts`), con un mínimo de 0,05.
- **El búfer de control** (`core/control.ts`) guarda las ranuras y avisa de los cambios de efecto y
  de valores con un solo `watch`. El servidor (`adapters/server.ts`) vuelve a codificar entonces el
  mensaje `6` y lo envía a todos los paneles. Al conectarse, cada panel recibe los mensajes `2`, `5`
  y `6`.
- **El panel ya tiene la mecánica del arrastre**, pero por tira: `StripRequests`
  (`panel/src/engine/strip-requests.ts`) deja un `PUT` en camino por tira y guarda el último cambio
  pendiente (D82), y `useDraftValues` mantiene el valor local mientras el DJ arrastra (D85).
- **Mantine 9** trae `AppShell.Aside` (una columna a la derecha, bajo la cabecera) y `Slider` con
  `orientation="vertical"`, con el mínimo abajo (comprobado en su documentación el 6-nov).

Motivación y alcance: `proposal.md`. Requisitos: `specs/intensity` y `specs/panel-layout`.

## Goals / Non-Goals

**Goals:**

- Que la intensidad sea un paso del plano de tiempo real, entre el efecto y las salidas, sin que
  ningún efecto la conozca.
- Que en el bucle no cueste nada a intensidad máxima ni cree objetos a ninguna intensidad.
- Que el fader se comporte como los controles de los efectos: responde mientras se arrastra, sigue
  al dedo y en reposo muestra lo que pinta el motor.

**Non-Goals:**

- **El límite de potencia.** Solo se deja dicho dónde irá: detrás de la intensidad.
- **Una orden genérica del instrumento** (`PUT /api/instrument` con varios campos). Hoy hay uno.

## Decisions

### 1. Sin capa de transformaciones: una función pura en un orden fijo

La intensidad es una función del núcleo, `applyIntensity(frame, intensity)` en `core/intensity.ts`,
que el bucle llama entre el efecto y las salidas. No hay una pila de transformaciones que se pueda
ampliar o reordenar.

```
 efecto --> intensidad --> (limite de potencia, H4) --+--> visor
            todas las      por tira                   |
            tiras                                     +--> gamma 2,0 --> orden de color --> Adalight
                                                           (adaptador, solo hacia la tira)
```

- **Con un solo caso, la interfaz se adivina.** El segundo que llega, el límite de potencia, ya es
  distinto: va por tira, lee la configuración de la tira y no tiene control en el panel. La gamma y
  el orden de color viven en el adaptador, una vez por salida, porque el visor no debe recibirlos.
  Una pila única no los cubriría.
- **El orden no es libre.** El límite de potencia tiene que ser el último paso antes de las salidas,
  porque protege la fuente (D14, E8). Un orden escrito en el código no deja poner nada detrás.
- **En el bucle cuestan lo mismo**: llamar a una función o recorrer una lista de una.

Alternativa descartada: una lista de pasos `(frame, strip) => void` en el bucle, o una capa de
transformaciones como concepto del producto, con su API y su sitio en el panel. Se vuelve a mirar con
el límite de potencia, cuando haya dos casos reales.

**→ D100** (con las decisiones 2 y 3).

### 2. El bucle lee la intensidad una vez por pulso y escala el frame en su sitio

Al empezar cada pulso, el bucle lee `control.intensity()` una sola vez, igual que lee la ranura de
cada tira. Después, para cada tira:

```ts
control.slot(index).render(ctx, frame);
applyIntensity(frame, intensity);          // en su sitio, sin crear nada
for (const output of outputs) output.write(frame, tick);
```

- **Una lectura por pulso** hace que todas las tiras de un pulso lleven la misma intensidad
  (`specs/intensity`), aunque el DJ la cambie a mitad del recorrido.
- **A intensidad 1, `applyIntensity` no toca el frame** y sale al momento. Así el máximo es
  exactamente el efecto tal cual, y la mesa no paga nada mientras nadie toca el fader.
- **Escalar en su sitio es seguro porque los efectos no leen `out`.** Se deja escrito en el contrato
  de `Effect`: el efecto escribe todo `out` en cada `render` y no lee lo que había. Un test del
  registro lo comprueba para todos los efectos: pintar sobre un búfer lleno de basura da el mismo
  frame que sobre uno a cero. Si un efecto futuro necesita su frame anterior, lo guarda en su memoria.
- **No toca el estado del efecto.** La intensidad actúa después del `render`, así que la memoria y
  los valores siguen igual: la *respiración* sigue por donde iba aunque la intensidad pase por cero.

Alternativas descartadas: pasar la intensidad en el `FrameContext` para que la aplique cada efecto
(cada efecto la tendría que implementar, y uno que la olvide la rompe) y escalar en una copia del
frame (crea o mantiene otro búfer por tira para nada).

### 3. Un factor lineal sobre los valores del frame, redondeado

Cada canal vale `Math.round(valor × intensidad)`. El fader es lineal: su posición es la intensidad,
sin curva.

- **El frame va en valores de pantalla, no en luz.** La gamma 2,0 de la salida Adalight se aplica
  después, así que en la tira la luz baja como `intensidad²` y un recorrido lineal se percibe
  bastante uniforme. La pantalla aplica su propia curva y hace lo mismo: visor y mesa siguen
  coincidiendo a cualquier intensidad.
- **Es la misma operación que la *respiración***: multiplicar y redondear. Una curva encima de la
  gamma dejaría la parte baja del fader casi sin recorrido útil.
- **Redondear, no truncar**, como la *respiración*: truncar apagaría los valores bajos antes de
  tiempo y quitaría luz a cualquier intensidad por debajo de 1.

Lo que no se arregla aquí, el cambio de tono cerca de cero (calculado con el blanco cálido,
`#FFA957`):

| Intensidad | Frame (visor) | Hacia la tira, con la gamma |
|---|---|---|
| 1 | 255, 169, 87 | 255, 112, 30 |
| 0,25 | 64, 42, 22 | 16, 7, 2 |
| 0,1 | 26, 17, 9 | 3, 1, 0 |
| 0,05 | 13, 8, 4 | 1, 0, 0 |

Por debajo de un 10 %, la tira pierde primero el azul y luego el verde antes de apagarse. Es por los
256 escalones de cada canal. Hoy ya pasa en el mínimo de la *respiración*.

Alternativas descartadas: una curva perceptual en el fader (decisión del DJ: lineal) y un mínimo por
canal o *dithering* temporal (afectan a todos los efectos; otra historia si molesta).

### 4. `PUT /api/intensity`, con un número de 0 a 1

```http
PUT /api/intensity
{ "intensity": 0.4 }

200 { "intensity": 0.4 }
400 { "message": "..." }     // falta, sobra un campo, no es un número o está fuera de 0..1
```

- **No cuelga de `/api/strips/{stripId}`** porque es del instrumento.
- **De 0 a 1 en la API**, igual que el nivel. El porcentaje es solo cómo lo enseña el panel
  (decisión 7).
- **Esquemas cerrados en `packages/shared/src/commands.ts`**, `SetIntensityBodySchema` y la
  respuesta, como los de efecto y valores (D86). La ruta valida con ellos y el OpenAPI sale de
  ellos.
- **No hay `404` ni `409`**: la intensidad siempre existe y vale con cualquier fuente de audio.
- **Responde `200` también si no cambia**, con la intensidad aplicada, como las otras órdenes.

En el puerto `Commands`, `setIntensity(value)` devuelve `'changed'`, `'unchanged'` o `'invalid'` y no
lanza, como `setValues`. El núcleo también valida (un número finito de 0 a 1), porque cualquier mando
futuro, como la F1, entra por el mismo puerto sin pasar por la API.

**→ D101** (con la decisión 5).

### 5. El mensaje `7` lleva la intensidad, al conectarse y en cada cambio, a todos los paneles

| Byte | Tamaño | Campo | Valor |
|---|---|---|---|
| 0 | 1 | Tipo de mensaje | `7` (intensidad) |
| 1-8 | 8 | Intensidad | Coma flotante de 64 bits (IEEE 754), **big-endian**, de 0 a 1 |

Ejemplo, la intensidad 0,5: `07  3f e0 00 00 00 00 00 00`.

- **Un tipo aparte, no un campo del `6`.** El `6` es «las tiras» y se rehace entero en cada cambio.
  Mientras el DJ arrastra, mandar la foto de todas las tiras con cada paso sería ruido, y la
  intensidad no es de ninguna tira.
- **64 bits, no 32 como el nivel**, para que el eco sea exactamente el valor que envió el panel.
  Con 32 bits, 0,4 vuelve como 0,4000000059604645 y el panel tendría que comparar con tolerancia
  para saber si su cambio ya ha llegado (decisión 9). Son 9 bytes, y solo con cada cambio.
- **Al conectarse va después del `6`**, el último del arranque. **En cada cambio, a todos los
  paneles**, como el `6`: el aviso sale del cambio, venga del mando que venga. Que otro panel vea
  moverse su fader no se promete (non-goal de `MOO-97`), pero sale gratis.
- **El búfer avisa por un `watchIntensity` aparte**, no por el `watch` de las tiras, para que un
  cambio de intensidad no rehaga el mensaje `6`.
- **El panel rechaza** un mensaje `7` que no mide 9 bytes o cuya intensidad no es un número de 0 a 1.
  Un panel que no conoce el tipo `7` lo ignora, así que el cambio es compatible hacia atrás.

Va en `docs/instructions/viewer-protocol.md` y en `packages/shared/src/viewer-protocol.ts`, en la
misma PR (`MOO-125`).

### 6. Una zona nueva, «Intensidad», a la derecha de todo y a toda la altura

```
+--------------------------------------------+-------+
| Cabecera                                   |       |
+--------------------------------------------+ Inten-|
| Visor                                      | sidad |
|                                            |  40 % |
|                                            |   |   |
+--------------+--------------+--------------+   o   |
| Tiras        | Efectos      | Controles    |   |   |
|              |              |              |   |   |
+--------------+--------------+--------------+-------+
```

Va en `AppShell.Aside`, de unos 100 px, con un `Slider` vertical que ocupa la altura que queda bajo
el título y el valor. En el JSX va después de `AppShell.Main`, así que en el orden de lectura es la
última zona (`specs/panel-layout`). El componente vive en `panel/src/intensity/` y usa la misma
`Zone` que las demás, con su nombre accesible «Intensidad».

- **Se ve que es de todo el instrumento**: queda fuera del recorrido tira → efecto → controles. Junto
  a Controles parecería un control más de la tira seleccionada.
- **Se puede tocar en directo**: es un control largo que se agarra sin mirar, como el máster de una
  mesa de mezclas. La cabecera mide 60 px y ya está llena.
- **El coste**: el visor pierde unos 100 px de ancho.

Alternativas descartadas: un slider horizontal en la cabecera (pequeño y apretado) y una cuarta
columna junto a Controles (se confunde con la tira seleccionada).

**→ D102** (con la decisión 7).

### 7. El valor se ve como un porcentaje entero

El fader va de 0 a 1 con paso 0,01, y el panel enseña `Math.round(intensidad × 100)` seguido de
« %», bajo el título de la zona y en la etiqueta que flota mientras se arrastra. Al enviarlo, el
panel redondea a dos decimales, para que la API reciba 0,07 y no 0,07000000000000001.

- **«100 %» y «0 %» se entienden solos**: el efecto tal cual y todo apagado.
- **No promete más precisión de la que hay**: por debajo del 10 %, la tira va a saltos.
- Los textos van en `literals.ts`, como el resto del panel.

### 8. El búfer de control guarda la intensidad, como guarda las ranuras

`createControl` (`core/control.ts`) empieza con la intensidad a 1 y gana `setIntensity` (en
`Commands`), `intensity()` y `watchIntensity(listener)`. El número se sustituye fuera del bucle y el
bucle lo lee al empezar el pulso, así que un cambio entra entero en el pulso siguiente. El servidor
recibe un `PanelIntensity` aparte del `PanelStrips`, y `main.ts` lo arma con el mismo búfer.

- **Vive en memoria y no se guarda** (H5). El aviso de cambio es el punto donde se enganchará
  `StateStore` si H5 decide guardarla.

### 9. El panel reutiliza la cola de D82 y el borrador de D85, con una clave sin tira

- **La cola**: `StripRequests<T>` pasa a llamarse `RequestQueue<T>` (`panel/src/engine/request-queue.ts`)
  y recibe cómo construir la URL de cada clave, en vez de suponer `/api/strips/{stripId}/<resource>`.
  Los cambios de efecto y de valores siguen igual, con la tira como clave. La intensidad usa una sola
  clave y `PUT /api/intensity`: un envío en camino y el último cambio pendiente, como D82.
- **El borrador**: un hook `useDraftIntensity` con la regla de `useDraftValues`. El valor local dura
  desde el primer cambio hasta que, tras soltar, no queda ningún envío en camino ni pendiente y ha
  llegado el eco del último. Si el motor no lo aplica, el fader acaba en la intensidad que pinta el
  motor. Con 64 bits en el mensaje `7`, el eco se compara por igualdad.
- **Sin conexión, o antes del primer mensaje `7`**, la zona solo muestra su título.

Alternativa descartada: una cola nueva solo para la intensidad. Repetiría la lógica de «uno en camino
y el último pendiente», que ya está probada.

## Risks / Trade-offs

- **[A muy baja intensidad, los colores cambian de tono antes de apagarse]** → Riesgo conocido,
  aceptado por el DJ (decisión 3). Se mira en la comprobación a mano en la mesa. Si molesta, irá en
  otra historia, para todos los efectos.
- **[En la mesa, la parte baja del fader tiene menos recorrido que en el visor]** → El sketch del Uno
  topa el brillo al 25 % (D46), y eso se suma a la gamma, así que la tira física llega antes a sus
  últimos escalones. La comprobación a mano lo mira, y se apunta lo que se vea. No cambia el diseño:
  el visor y la mesa siguen recibiendo el mismo frame.
- **[Muchos `PUT` y mensajes `7` mientras se arrastra]** → La cola los limita a uno en camino. El
  mensaje `7` mide 9 bytes y sale solo cuando la intensidad cambia de verdad (`'changed'`).
- **[Un efecto futuro que lea `out`]** → Lo prohíbe el contrato de `Effect`, y el test del registro
  falla con cualquier efecto que lo haga (decisión 2).
- **[El límite de potencia se pone delante de la intensidad]** → El orden queda escrito en el bucle,
  en README §2.1 y en D100: intensidad, después límite de potencia y después salidas.
- **[Medir los 100 ms en el E2E]** → El mismo método que el arrastre de los controles de
  `strip-effect-values`, con el panel ya usado (D98).
- **[Otro panel abierto ve saltar su fader]** → Sale del aviso a todos los paneles y no se promete
  (non-goal). Si estorba en la demo pública, se reconsidera allí.

## Migration Plan

Sin migración: la intensidad no se guarda y el mensaje `7` es nuevo, así que un panel viejo lo
ignora. Las tres PR van contra `main` en orden: `MOO-125` → `MOO-126` → `MOO-127`. Con la de
`MOO-126` integrada y la de `MOO-127` sin integrar, el motor ya aplica la intensidad (siempre a 1)
y la API la cambia, pero el panel todavía no tiene fader. Deshacerlo es revertir las PR en orden
inverso.
