# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs MOO-134`,
> y la PR lleva `Fixes MOO-134`. Un paso marcado **(test en rojo)** deja a propósito un test que
> falla, y el siguiente lo pone en verde. Antes de dar la sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
>
> La Q10 en el PRD §7 va en el commit del change, en la rama de la historia: *si el motor no llega a
> arrancar (un fichero de configuración mal escrito, una tarjeta de sonido que falta), ¿cómo lo sabe
> el DJ sin portátil, y qué muestra la tira mientras tanto?* Decisión del DJ, abierta. El
> `openspec archive` va tras integrar la PR, en una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-134 · infra

- [ ] 1.1 **(test en rojo)** `tooling/moodtable-service.test.ts` lee `deploy/moodtable.service` y
  comprueba lo que exige `specs/table-service` (`design.md`, decisión 5):
  - `WantedBy=multi-user.target`;
  - un `ExecStartPre=-/usr/bin/udevadm settle …`, con el prefijo `-`;
  - ninguna mención de `network-online.target` ni de `network.target`;
  - `Restart=no` y ninguna otra línea `Restart=`;
  - `User=pi`, `WorkingDirectory=/home/pi/mood-table-v2` y un `ExecStart` que lanza
    `packages/engine/src/main.ts` con `/usr/bin/node`.

  Verificar: el test nuevo falla porque la unidad no existe, y el resto sigue en verde.
- [ ] 1.2 `deploy/moodtable.service` según las decisiones 1 a 4 de `design.md`, con un comentario
  por cada línea que no se explica sola: por qué el `settle` y su `-`, por qué `Restart=no` y por qué
  no espera a la red.
  Verificar: el test de 1.1 pasa, y `pnpm lint` y `pnpm typecheck` van en verde.
- [ ] 1.3 El README deja de prometer lo que no se hace y explica cómo se registra el servicio:
  - **§1.4, «3. En la mesa»:**
    - el paso 1 instala a mano lo que hoy hace falta (Node.js 24 y el clon en
      `/home/pi/mood-table-v2`, con dependencias y build del panel), y dice que `deploy/install.sh`
      llegará con la historia de instalación;
    - el paso 2 pide `server.host: "0.0.0.0"` para abrir el panel desde la red;
    - el paso 3 son las tres órdenes de registro (decisión 6), en lugar del `systemctl start`;
    - el paso 5 se queda: desenchufar y enchufar, arranca sola y vuelve al último estado.
  - **§2.1, «Sacrificios y déficits»:** «Proceso único = punto único de fallo» dice que `systemd`
    **no** lo reinicia: el DJ apaga y enciende la mesa (D106).
  - **§2.4:**
    - «Servicio `systemd`» describe la unidad real: arranca al encender, tras `udevadm settle`, sin
      esperar a la red y sin `Restart=on-failure`. Desaparece «El servicio aún no existe»;
    - el paso 3 de «Proceso de despliegue» dice que `install.sh` es de la historia de instalación.
  - **§2.5, «En la mesa»:** el motor corre como `pi`, que tiene `sudo`, hasta la historia de
    instalación, anotado como sacrificio.

  Verificar: `grep -n "on-failure" readme.md` no devuelve nada; las tres órdenes de registro del
  README coinciden con las de la decisión 6; ningún término nuevo pide entrada en el glosario del PRD
  (§8).
- [ ] 1.4 La **D106** en `docs/idea-mood-table.md`, con el texto que propone `design.md` («Nueva
  D#»), su origen (`MOO-131`, change `table-autostart`) y lo descartado (decisiones 1 a 4). Se
  apunta en `prompts.md` el hito del change (formato de `course.md` §5).
  Verificar: la D106 está en la tabla de decisiones después de la D105 y no renumera ninguna.
- [ ] 1.5 Prueba en la mesa, a mano, con la PR abierta y la rama en la Pi. Los pasos con `sudo` los
  ejecuta el DJ. Hay que leer el registro de cada arranque antes de volver a apagar, porque el
  *journal* es volátil:
  - parar el motor que corra a mano, registrar la unidad (decisión 6) y pasar
    `systemd-analyze verify /etc/systemd/system/moodtable.service` sin errores;
  - *La mesa arranca sola al enchufarla*: desenchufar y enchufar. Las tiras pintan su efecto sin
    abrir el panel, los reactivos siguen la música de la tarjeta y el panel se abre en
    `http://<ip-de-la-pi>:8080`. `journalctl -u moodtable -b` muestra que el `settle` acabó antes
    del motor;
  - *El servicio sigue registrado tras apagar y encender*: una segunda vez, sin registrar nada;
  - *La red local no está al enchufar la mesa*: arrancar sin la red (sin cable y con la WiFi fuera de
    alcance o el router apagado). Las tiras pintan, y el panel se abre en cuanto vuelve la red, sin
    tocar el motor;
  - *Sin la tarjeta de sonido, el motor no arranca y dice por qué*: arrancar con la tarjeta
    desenchufada. `systemctl status moodtable` queda en `failed`, y el registro dice qué tarjeta no
    ha podido abrir;
  - *El motor se cae y el servicio no lo relanza*: `sudo systemctl kill moodtable`. El servicio queda
    parado y no vuelve; al apagar y encender, arranca solo.

  Verificar: cada escenario, con su resultado y lo que dijo el registro, apuntado en la descripción de
  la PR.

## Workflow follow-up

- Tras integrar la PR: `/opsx:archive table-autostart` en una rama `…-archivar-change`, con las tareas
  hijas de `MOO-131` revisadas en Linear antes de archivar.
