# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-114` parte de
> `MOO-113` ya integrada (usa la salida `adalight` del contrato), y `MOO-115` parte de `MOO-114` (el
> motor ya manda el puerto en el mensaje `6`). Cada paso es un commit con `Refs MOO-n` de su tarea, y
> la PR lleva `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan,
> y el paso siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la
> última PR, en una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-113 · shared

- [ ] 1.1 **(test en rojo)** Tests del esquema en `packages/shared/src/config.test.ts`: acepta la
  tira `mesa` de `specs/engine-config` (*Tira con salida Adalight*) y cada velocidad de la lista;
  rechaza, nombrando la tira y el campo, una salida `adalight` sin `port`, con `port` vacío, sin
  `baudRate`, con `"baudRate": 11520` (el mensaje dice qué velocidades admite) y con un campo que no
  existe; el tipo desconocido dice que se admiten «virtual» y «adalight»; `port` en una salida
  `virtual` sigue sin existir (decisión 6).
  Verificar: los tests nuevos fallan porque el tipo `adalight` no existe; el resto sigue en verde.
- [ ] 1.2 `OutputSchema` con la variante `adalight` (cerrada, con `port` no vacío y `baudRate` como
  unión de literales de la lista de la decisión 6).
  Verificar: los tests de 1.1 pasan.
- [ ] 1.3 **(test en rojo)** Tests del mensaje `6` en `packages/shared/src/viewer-protocol.test.ts`:
  `encodeStrips` y `decodeStrips` con una tira `{ "type": "adalight", "port": "/dev/ttyUSB0" }`;
  `decodeStrips` rechaza una salida `adalight` sin `port` y una con `baudRate` (decisión 7).
  Verificar: los tests nuevos fallan porque la salida del mensaje solo admite `virtual`.
- [ ] 1.4 La salida `adalight` con `port` en `STRIP_FIELDS` (`viewer-protocol.ts`), con su comentario
  al día. Y sus usos, para que el motor y el panel no se rompan hasta `MOO-114` y `MOO-115`:
  `stripsMessage` (`packages/engine/src/engine.ts`) copia el tipo y el puerto de la salida, sin los
  baudios, con un test en `engine.test.ts`; `OUTPUT_NAMES` (`packages/panel/src/literals.ts`) gana
  `adalight: 'Adalight'`. `docs/instructions/viewer-protocol.md`: la salida `adalight` en la tabla del
  mensaje `6`, un ejemplo y la frase de «lo que no sale al panel» con los baudios.
  Verificar: los tests de 1.3 pasan, el documento describe exactamente lo que hace el código, y
  `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
- [ ] 1.5 README §3 (*Tira declarada*: `output` con `port` y `baudRate` y la lista de velocidades, con
  un ejemplo JSON de la tira de la mesa) y `prompts.md`: la entrada de la exploración y la propuesta
  del change (las decisiones de `design.md` y cómo se llegó a ellas) y la de esta tarea.
  Verificar: el README dice lo mismo que el esquema, y `prompts.md` sigue el formato de
  `docs/instructions/course.md` §5.

## 2. MOO-114 · engine

- [ ] 2.1 `serialport` 13 en el catálogo de `pnpm-workspace.yaml` y en `packages/engine`;
  `@serialport/bindings-cpp: false` en `allowBuilds` (decisión 1).
  Verificar: `pnpm install` termina sin compilar nada, y en el Mac
  `node -e "import('serialport').then(m => m.SerialPort.list()).then(console.log)"` desde
  `packages/engine` lista los puertos.
- [ ] 2.2 **(test en rojo)** Tests de la codificación en `packages/engine/src/adapters/adalight.test.ts`:
  el frame de 173 LEDs de `specs/physical-strip` (525 bytes, `41 64 61 00 AC F9 FF 00 00…`); la
  cabecera de 1 LED (`00 00 55`) y la de 300 (`01 2B 7F`, con el byte alto en uso); los colores en el
  orden de la tira, sin reordenar.
  Verificar: los tests nuevos fallan porque `adalight.ts` no existe.
- [ ] 2.3 La codificación en `packages/engine/src/adapters/adalight.ts`: un búfer por salida con la
  cabecera escrita al crearla, donde se copian los colores de cada frame.
  Verificar: los tests de 2.2 pasan.
- [ ] 2.4 **(test en rojo)** Tests de la salida con un enlace falso que decide cuándo «sale» cada
  frame (decisiones 2, 3 y 5):
  - escribe el frame del primer pulso; con el envío pendiente, descarta los siguientes; cuando el
    envío sale, escribe el del pulso siguiente;
  - con un enlace que tarda 3 pulsos por envío, a lo largo de 1.000 pulsos, cada frame escrito lleva
    los colores del pulso en que se escribe y nunca hay dos envíos pendientes;
  - el frame del bucle cambia después de escribirlo y lo escrito no cambia;
  - tras 50 envíos, una sola línea de log con el nombre de la tira, la mediana en ms, los fps, los
    baudios y los LEDs; ninguna más después;
  - si el enlace avisa de un error o se cierra, una sola línea de log con la tira y el puerto, y desde
    ahí descarta todos los frames sin lanzar nada.

  Verificar: los tests nuevos fallan porque la salida no existe.
- [ ] 2.5 La salida Adalight (`LightOutput`) en `adalight.ts`, sobre el enlace.
  Verificar: los tests de 2.4 pasan y la cobertura de `adalight.ts` no baja del umbral.
- [ ] 2.6 `adalight.hardware.ts`: abre el puerto con `serialport` (`path`, `baudRate`, `lock: true`) y
  lo envuelve en el enlace (escribir y avisar tras el `drain()`, error y cierre). Si no abre, devuelve
  un mensaje con la tira, el puerto y el motivo del sistema (decisión 4).
  Verificar: `pnpm typecheck` en verde; queda fuera de la cobertura por su nombre.
- [ ] 2.7 **(test en rojo)** Tests de `engine.ts` y `frame-loop`: una tira `adalight` tiene el visor y
  su salida Adalight, que reciben el mismo frame; una tira `virtual` solo el visor; la salida Adalight
  recibe frames sin ningún panel conectado (`specs/frame-loop`).
  Verificar: los tests nuevos fallan porque `createOutputs` solo da el visor.
- [ ] 2.8 `main.ts`: abre los puertos de las tiras físicas después de la fuente de audio y antes del
  servidor; si alguno falla, el motor no arranca con su mensaje (y para la tarjeta de sonido si estaba
  abierta, como hoy con el servidor); da a cada tira física el visor y su salida Adalight. El
  comentario de cabecera, al día.
  Verificar: los tests de 2.7 pasan; en el Mac, con una tira declarada en un puerto que no existe,
  `pnpm dev` no arranca y nombra la tira, el puerto y el motivo.
- [ ] 2.9 Prueba en el Mac con el Arduino de la mesa conectado por USB (decisión 1: se puede probar sin
  la Pi), declarado en `config/local.json` con su `/dev/cu.usbserial-…`:
  - la tira física pinta la respiración a la vez que el visor, y responde al mover el periodo y el
    color;
  - el log dice los ms por frame y los fps, y ms + 16,7 ≤ 100 (decisión 3);
  - con el monitor serie de otro programa abierto en ese puerto, el motor no arranca y lo dice;
  - al desconectar el Arduino con el motor en marcha, el motor sigue y el log lo dice una vez.

  Verificar: lo comprobado, con la línea del log, queda en la descripción de la PR.
- [ ] 2.10 Prueba en la Pi de la mesa (excepción al DoD de la historia; el usuario está en la mesa),
  con `/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0` y 115.200 baudios:
  - `pnpm install` carga el precompilado de `serialport` (si no, decisión 1: `allowBuilds` a `true`);
  - el caso feliz de `MOO-111` con música desde el mixer y la *energía*: la tira física pinta lo mismo
    que el visor, sin quedarse atrás;
  - cambiar el efecto y mover un control: la tira física responde a la vez que el visor;
  - con el panel cerrado, recargado y sin abrir: la tira física sigue pintando;
  - la línea de ms y fps del log.

  Verificar: lo comprobado, con la línea del log, queda en la descripción de la PR.
- [ ] 2.11 Documentación:
  - README §2.2 (adaptador *Adalight serie*: `serialport`, el descarte con `drain()`, la medida del
    log, la pérdida en plena sesión y los fps a saltos; el orden de color, con H4) y la raíz de
    composición;
  - `HARDWARE_SETUP.md`: cómo declarar la tira de la mesa en `config/local.json`, el segundo de tira
    apagada al arrancar (decisión 9) y cómo leer la línea de ms y fps del log;
  - `docs/idea-mood-table.md` §10: D90 (decisión 1), D91 (decisiones 2 y 3) y D92 (decisión 6);
  - `docs/PRD.md`: Q1 y A2 con lo medido en 2.10 (LEDs, baudios, ms por frame y fps), y en A2 el riesgo
    de E2 y las salidas (S2, placa con USB nativo);
  - `prompts.md`: la entrada de la tarea.

  Verificar: README, `HARDWARE_SETUP.md` y PRD dicen lo mismo que el código y que la medida.

## 3. MOO-115 · panel

- [ ] 3.1 **(test en rojo)** Tests de `StripList` con Testing Library: una tira «Mesa» de 173 LEDs con
  salida Adalight en `/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0` muestra «173 LEDs · Adalight»
  y, debajo, la ruta entera, sin recortar; una tira virtual no tiene línea de puerto
  (`specs/instrument-control`, decisión 7).
  Verificar: los tests nuevos fallan porque la zona Tiras no muestra el puerto.
- [ ] 3.2 La línea del puerto en `StripList.tsx`: pequeña y atenuada, como la de los LEDs, y partiéndose
  donde haga falta.
  Verificar: los tests de 3.1 pasan, y los E2E existentes siguen pasando (no hay E2E nuevo: la CI no
  tiene puerto serie, decisión 8).
- [ ] 3.3 Comprobación en la mesa: con la tira física declarada, la zona Tiras la muestra con
  «Adalight» y la ruta entera de su puerto, en el ancho de la columna.
  Verificar: el resultado («verificado visualmente») queda en la descripción de la PR.
- [ ] 3.4 Documentación y cierre de la historia:
  - README §1.3 (zona Tiras: la salida Adalight con su puerto) y la ficha de la historia en §5
    (tareas `MOO-113`, `MOO-114` y `MOO-115`, y sus escenarios);
  - `prompts.md`: la entrada de la tarea;
  - cada escenario de los criterios de `MOO-111` tiene su test o su comprobación en la mesa (DoD de la
    historia): *La tira física pinta lo mismo que el visor* (2.10), *La tira física responde mientras
    el DJ toca* (2.9 y 2.10), *La tira física no se va quedando atrás* (2.4), *La tira física pinta
    aunque no haya ningún panel mirando* (2.7 y 2.10), *Una salida Adalight mal declarada no deja
    arrancar el motor* (1.1), *El panel dice qué tira es la física* (3.1 y 3.3).

  Verificar: la tabla de escenarios de `MOO-111` → test está en la descripción de la PR, y
  `pnpm exec openspec validate adalight-strip-output --strict` pasa.
