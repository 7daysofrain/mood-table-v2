# Tasks

> Dos tareas de Linear, dos secciones y dos PR contra `main`. `MOO-64` parte de `MOO-63` ya integrada,
> porque necesita el mensaje de estado del protocolo (decisión 3). Cada paso es un commit con
> `Refs MOO-n` de su tarea, y la PR lleva `Fixes MOO-n`. Los pasos marcados **(test en rojo)** dejan
> a propósito tests que fallan, y el paso siguiente los pone en verde. Antes de dar una sección por
> terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El
> `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).

## 1. MOO-63 · engine

- [ ] 1.1 **(test en rojo)** Tests del protocolo en `packages/shared/src/viewer-protocol.test.ts`:
  `encodeSourceStatus` con conectada da `05 00` y con perdida `05 01`; `decodeSourceStatus` los
  devuelve igual y rechaza otro tipo, un estado que no es `0` ni `1` y un mensaje que no mide 2 bytes
  (decisión 3).
  Verificar: los tests nuevos fallan porque el tipo `5` no existe; el resto sigue en verde.
- [ ] 1.2 El tipo `5` en `packages/shared/src/viewer-protocol.ts` (`SOURCE_STATUS_MESSAGE_TYPE`,
  `encodeSourceStatus`, `decodeSourceStatus`) y su sección en `docs/instructions/viewer-protocol.md`,
  con su ejemplo y la regla de rechazo.
  Verificar: los tests de 1.1 pasan y el documento describe exactamente lo que hace el código.
- [ ] 1.3 **(test en rojo)** Tests de la reconexión en `packages/engine/src/adapters/soundcard.test.ts`,
  con el `arecord` falso y un reloj falso: tras perderla, cada segundo lanza `arecord` con la misma
  cadena; un intento que termina antes del primer bloque no escribe en el log y programa otro; el
  primer bloque la recupera, escribe una línea con nombre y cadena y vuelve a entregar audio; tras
  recuperarla descarta de nuevo 300 ms y no entrega audio de antes del corte; sigue intentándolo tras
  muchos fallos seguidos; varias pérdidas y recuperaciones seguidas (cable flojo) dan cada vez sus dos
  líneas; quien se suscribe recibe el estado actual al momento y cada cambio después; `stop()` cancela
  el intento pendiente y no lanza más `arecord` (decisiones 1, 2 y 4, `specs/audio-source`).
  Verificar: los tests nuevos fallan porque la fuente no vuelve a abrirse.
- [ ] 1.4 La reconexión en `packages/engine/src/adapters/soundcard.ts`: el reloj inyectable, el
  reintento cada segundo, el reinicio del búfer y del descarte al recuperarla, la línea del log y la
  suscripción al estado. `soundcard.hardware.ts` no cambia. El comentario de cabecera deja de decir
  «no se vuelve a abrir».
  Verificar: los tests de 1.3 pasan y los de arranque y pérdida de `MOO-23` siguen en verde.
- [ ] 1.5 **(test en rojo)** Tests del servidor en `packages/engine/src/adapters/server.test.ts`: con
  una tarjeta como fuente, un panel que se conecta recibe el mensaje de fuente y después el de estado
  (también si está perdida); un cambio de estado llega a todos los paneles conectados; con un fichero
  o sin fuente, ningún mensaje de estado (`specs/audio-source`, decisión 3).
  Verificar: los tests nuevos fallan porque el servidor no conoce el estado.
- [ ] 1.6 El estado de la fuente en `packages/engine/src/adapters/server.ts` (lo guarda, lo envía al
  conectarse y lo difunde al cambiar) y la unión en `packages/engine/src/main.ts`: el estado inicial
  sale del adaptador, y cada cambio va al servidor.
  Verificar: los tests de 1.5 pasan, `pnpm lint` no da ningún error de fronteras y
  `pnpm test:e2e` sigue en verde.
- [ ] 1.7 Umbrales y decisiones: el aviso en menos de 1 s (Nielsen) y la recuperación en menos de 3 s (con la medición del 22-oct)
  en `docs/umbrales-para-specs.md`; D60 (reconexión y log) y D61 (mensaje de estado) en
  `docs/idea-mood-table.md` §10, con «No se reconecta (`MOO-59`)» de D57 tachado y apuntando a D60;
  README §2.2 (el adaptador *Tarjeta de sonido* recupera la tarjeta) y `prompts.md`.
  Verificar: los enlaces y los números de D# cuadran con `design.md`.
- [ ] 1.8 Prueba a mano en la mesa: con el motor de la rama en la Pi y una tira con «energía»,
  desenchufar la tarjeta (el log dice la pérdida y la tira se apaga), enchufarla en otro puerto (en
  menos de 3 s desde que aparece en `arecord -l` la tira vuelve a seguir la música, y el log dice la
  recuperación) y dejarla un rato desenchufada sin que el log crezca.
  Verificar: el resultado se anota en la PR.

## 2. MOO-64 · panel

- [ ] 2.1 **(test en rojo)** Tests de la conexión en `packages/panel/src/engine/connection.test.ts`:
  guarda el estado que llega por el tipo `5` y avisa al cambiar; sin mensaje de estado, la fuente no
  está perdida; lo olvida al perder la conexión con el motor (decisión 5).
  Verificar: los tests nuevos fallan porque la conexión no decodifica el tipo `5`.
- [ ] 2.2 El estado de la fuente en `packages/panel/src/engine/connection.ts`.
  Verificar: los tests de 2.1 pasan.
- [ ] 2.3 **(test en rojo)** Tests de la cabecera en
  `packages/panel/src/layout/AudioSourceIndicator.test.tsx` (y `App.test.tsx` si la unión pasa por
  ahí): con la tarjeta perdida, «Desconectada» junto a «Tarjeta de sonido: \<nombre\>», anunciado a los
  lectores de pantalla y con el vúmetro aún visible; con la tarjeta conectada o con silencio, sin
  aviso; al recuperarla, el aviso desaparece; con `prefers-reduced-motion`, sin parpadeo
  (`specs/audio-source`, decisión 5).
  Verificar: los tests nuevos fallan porque la cabecera no conoce el estado.
- [ ] 2.4 La etiqueta reutilizable (texto como parámetro, roja, parpadeo a 1 Hz salvo con
  `prefers-reduced-motion`) y su uso en `AudioSourceIndicator.tsx`, con el estado que da la conexión.
  Verificar: los tests de 2.3 pasan y, con el motor de la rama y la tarjeta desenchufada, la cabecera
  muestra el aviso parpadeando y lo quita al reenchufarla.
- [ ] 2.5 README §1.3 (la cabecera y su aviso, con una captura si cambia la de la sección) y
  `prompts.md`.
  Verificar: lo que describe el README coincide con lo que muestra el panel.
