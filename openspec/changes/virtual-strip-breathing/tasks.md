# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: cada una parte de la
> anterior ya integrada. Cada paso es un commit con `Refs MOO-n` de su tarea; la PR lleva
> `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso
> siguiente los pone en verde. Antes de dar una sección por terminada: `pnpm lint`, `pnpm typecheck`,
> `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la última PR, en una
> rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-16 · engine

- [x] 1.1 `typebox` 1.x en el catálogo de `pnpm-workspace.yaml` (la última estable que cumpla
  `minimumReleaseAge`) y como dependencia de `@moodtable/shared` (decisión 9).
  Verificar: `pnpm install` sin avisos, y `pnpm lint`, `pnpm typecheck` y `pnpm test` siguen en verde.
- [x] 1.2 **(test en rojo)** Tests de la validación de la configuración en `packages/shared`: fichero
  válido mínimo; sin `strips` y con `strips` vacía; JSON mal escrito; `ledCount` 0; salida de un tipo
  que no existe; `id` repetido; `fps` y `server` por defecto (60; `127.0.0.1:8080`) y declarados. Cada
  error comprueba que el mensaje nombra la tira y el campo (`specs/engine-config`).
  Verificar: los tests nuevos fallan porque la validación no existe; el resto sigue en verde.
- [x] 1.3 Esquema TypeBox del fichero de configuración y función pura que recibe el texto y devuelve
  la configuración o el error, publicados desde la entrada de `@moodtable/shared` (decisiones 4 y 8).
  Verificar: los tests de 1.2 pasan.
- [x] 1.4 **(test en rojo)** Tests de la respiración en `packages/engine/src/core`: todos los LEDs del
  mismo color; una respiración completa en 4 s (pasa por casi apagado y por el máximo, y el frame del
  segundo 4 es igual al del 0); frames dorados de una tira de 60 LEDs en 0, 1, 2 y 3 s, guardados como
  fichero de referencia (`specs/effects`).
  Verificar: los tests nuevos fallan porque el efecto no existe.
- [x] 1.5 Contrato `Effect` de README §2.2 (decisión 1) y efecto *respiración* con `usesAudio: false`,
  `color` blanco cálido y `period` 4 por defecto (decisión 5). Al fijar el RGB del blanco cálido y el
  brillo mínimo se generan los frames dorados.
  Verificar: los tests de 1.4 pasan.
- [x] 1.6 **(test en rojo)** Tests del bucle en el núcleo, con el instante pasado a mano: 60 frames por
  segundo de reloj, numerados de forma consecutiva; dos tiras con el mismo `seq` en cada pulso; un pulso
  tardío salta `seq` sin calcular los intermedios; el frame de cada tira llega a todas sus salidas; una
  salida que guarda los frames ve dos frames distintos tras dos pulsos (`specs/frame-loop`).
  Verificar: los tests nuevos fallan porque el bucle no existe.
- [x] 1.7 Puerto `LightOutput` con `write(frame, tick)` (decisión 2), bucle `tick(now)` puro con
  búfer preasignado por tira (decisión 7) y salida en memoria, que copia cada frame, en
  `packages/engine/src/adapters`. Se quitan los marcadores de `MOO-28` (`CORE_NAME`, `ADAPTERS_NAME`) y
  sus tests.
  Verificar: los tests de 1.6 pasan y `pnpm lint` sigue en verde (el núcleo no importa adaptadores).
- [x] 1.8 Lectura de `config/local.json`, resuelto desde la raíz del repositorio, fuera del núcleo
  (decisiones 3 y 8), con su test de integración sobre ficheros temporales: válido, inexistente (el
  mensaje da la ruta) y desde otro directorio de trabajo.
  Verificar: el test de integración pasa.
- [x] 1.9 Arranque del motor: un controlador con temporizador llama a `tick(now)` `fps` veces por
  segundo (decisión 7), y `main.ts` carga la configuración, crea las salidas de cada tira, escribe la
  línea de log (fichero, tiras y fps) y, si la configuración no sirve, escribe el error en la salida de
  errores y termina con código 1. Test de integración que arranca el motor con una tira y una salida
  en memoria y comprueba que llegan frames de respiración.
  Verificar: el test pasa; `node packages/engine/src/main.ts` sin `config/local.json` termina con
  código 1 y dice qué falla.
- [x] 1.10 Simulador sin preparar nada (decisiones 3 y 6): `config/demo.json` con una tira virtual de
  60 LEDs; `config/local.json` en `.gitignore`; script `dev` en la raíz que copia `config/demo.json` a
  `config/local.json` si no existe y arranca el motor.
  Verificar: en un clon limpio, `pnpm dev` crea `config/local.json` y escribe la línea de log con 1
  tira a 60 fps; con un `config/local.json` cambiado, no lo pisa y `git status` no lo muestra.
- [x] 1.11 Documentación:
  - README §1.4: `config/local.json` en lugar de `/etc/moodtable/config.json` (también en la mesa),
    `config/demo.json` en lugar de `deploy/config/demo.json`, y una tira virtual en la demo;
  - README §2.1 y §2.2, si el puerto `LightOutput` por tira cambia lo que describen;
  - PRD Q2: la respuesta del DJ para la *respiración* (color y periodo);
  - `docs/idea-mood-table.md` §10: D43 (salidas por tira) y D44 (`config/local.json`), si el usuario
    las aprueba;
  - `prompts.md`: entrada de la exploración y la spec del change, con el formato de `course.md` §5.

  Verificar: ningún documento sigue citando `/etc/moodtable/config.json` ni `deploy/config/demo.json`,
  y la entrada de `prompts.md` tiene como mucho 3 prompts literales.
- [x] 1.12 Revisión de la PR: el esquema rechaza los campos que no declara (en la raíz, en `server`,
  en cada tira y en su `output`) y limita `fps` a 60, con sus tests (`specs/engine-config`).
  Verificar: `"fsp": 30` y `"fps": 120` no arrancan y el mensaje nombra el campo; `config/demo.json`
  sigue arrancando.

## 2. MOO-17 · engine

- [x] 2.1 Fastify, `@fastify/websocket` y `@fastify/static` en el catálogo (la última estable que
  cumpla `minimumReleaseAge`) y como dependencias de `@moodtable/engine`.
  Verificar: `pnpm install` sin avisos, y lint, tipos y tests siguen en verde.
- [x] 2.2 **(test en rojo)** Tests del codificador y el decodificador del protocolo del visor en
  `packages/shared`: un frame se codifica en tipo, `seq`, índice y colores, y se decodifica igual;
  una tira de 60 LEDs da 180 bytes de color; un mensaje de otro tipo o demasiado corto se rechaza.
  Verificar: los tests nuevos fallan porque el protocolo no existe.
- [x] 2.3 Codificador y decodificador del protocolo en `packages/shared`, publicados desde su entrada
  (decisión 10), y `docs/instructions/viewer-protocol.md` con el formato byte a byte, orden de los
  bytes de `seq` incluido, con su fila en el índice de `AGENTS.md` y un enlace desde README §4
  (decisión 11).
  Verificar: los tests de 2.2 pasan y el documento describe exactamente lo que hace el código.
- [x] 2.4 **(test en rojo)** Test de integración del servidor del motor, con dos clientes WebSocket y
  una tira: los dos reciben los mismos mensajes (mismo `seq` y mismos colores), uno por frame y tira;
  `GET /` devuelve el `index.html` del build del panel; sin `server` en la configuración escucha en
  `127.0.0.1:8080` (`specs/viewer`, `specs/engine-config`).
  Verificar: el test falla porque el servidor no existe.
- [x] 2.5 Adaptador del servidor en `packages/engine/src/adapters`: Fastify con `host` y `port` de la
  configuración (decisión 13), el build del panel servido (decisión 12) y un hub WebSocket con una
  única conexión por navegador; una salida del visor por tira que codifica cada frame y lo envía a
  todos los navegadores conectados (decisiones 2 y 10). Sin contramedida para un navegador atascado
  (riesgo aceptado).
  Verificar: los tests de 2.4 pasan.
- [ ] 2.6 `main.ts` añade la salida del visor a todas las tiras y arranca el servidor; la línea de log
  incluye la dirección del panel.
  Verificar: con `pnpm --filter @moodtable/panel build` hecho, `pnpm dev` deja el panel en la dirección
  del log y un cliente WebSocket de prueba recibe frames.
- [ ] 2.7 Desarrollo con Vite (decisión 12): `pnpm dev` arranca también el servidor de Vite del panel
  (`localhost:5173`), que reenvía `/ws` al motor.
  Verificar: con `pnpm dev`, un cliente WebSocket conectado a `localhost:5173/ws` recibe frames, y al
  cambiar un componente del panel la página se recarga sola.
- [ ] 2.8 Documentación:
  - README §1.4: en desarrollo se abre `localhost:5173`; el motor sirve el build en `8080`;
  - README §2.2 (adaptador *Visor*), si cambia lo que describe;
  - `docs/idea-mood-table.md` §10: D45 (el protocolo del visor), si el usuario la aprueba.

  Verificar: los comandos de README §1.4 funcionan tal como están escritos.

## 3. MOO-18 · panel

- [ ] 3.1 **(test en rojo)** Tests de la conexión del panel con un WebSocket falso y temporizadores
  falsos: empieza «Sin conexión con el motor»; pasa a «Conectado» al abrirse; al cerrarse vuelve a
  «Sin conexión» y reintenta cada segundo; al reconectar vuelve a «Conectado» (`specs/viewer`).
  Verificar: los tests nuevos fallan porque la conexión no existe.
- [ ] 3.2 Cliente de conexión del panel: una única conexión, reintento cada segundo (decisión 15),
  decodificación con el protocolo de `@moodtable/shared` y último frame de cada tira guardado.
  Verificar: los tests de 3.1 pasan.
- [ ] 3.3 **(test en rojo)** Tests del visor y de la cabecera con Testing Library: con frames, una fila
  por tira y un punto por LED, en el orden del índice; sin conexión, ningún punto encendido; la
  cabecera dice «Conectado» o «Sin conexión con el motor». El test de `PanelLayout` *deja cada zona
  vacía* se ajusta al visor con contenido (decisión 19).
  Verificar: los tests nuevos fallan porque el visor y el indicador no existen.
- [ ] 3.4 Visor en `<canvas>` sin librería que dibuja el último frame de cada tira en cada
  `requestAnimationFrame` (decisión 16), apagado sin conexión (decisión 14), e indicador de conexión
  en la cabecera.
  Verificar: los tests de 3.3 pasan y, con `pnpm dev`, la tira respira en `localhost:5173`.
- [ ] 3.5 E2E de HU1 en `e2e/`: `webServer` arranca el motor, que sirve el build del panel (decisión
  17), con una configuración de test de una tira virtual; los E2E que tienen que parar o arrancar el
  motor lo lanzan ellos mismos. Escenarios: *El maker ve la tira virtual respirando en el visor*
  (los colores del canvas cambian); *El panel avisa si el motor no está en marcha* (la consola solo
  tiene el error de conexión: `specs/panel-layout`); *El visor se recupera solo tras un reinicio del
  motor*; *Dos paneles ven lo mismo* (los dos visores se animan; la igualdad de frames ya la cubre
  2.4: decisión 18). El E2E de humo (`panel.spec.ts`) sigue pasando.
  Verificar: `pnpm test:e2e` pasa en local y en la CI.
- [ ] 3.6 Documentación y cierre de la historia:
  - README §1.3 y §2.2 (*Panel y visor*), si cambia lo que describen;
  - `prompts.md`: entrada de la implementación de la historia, con el formato de `course.md` §5;
  - cada escenario de los criterios de `MOO-13` tiene su test (DoD de la historia).

  Verificar: la tabla de escenarios de `MOO-13` → test está en la descripción de la PR, y
  `pnpm exec openspec validate virtual-strip-breathing --strict` pasa.
