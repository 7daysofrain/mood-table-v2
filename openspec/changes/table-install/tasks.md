# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs MOO-n`, y
> la PR lleva `Fixes MOO-n` con el ID de su tarea. Un paso marcado **(test en rojo)** deja a propósito
> un test que falla, y el siguiente lo pone en verde. Antes de dar una sección por terminada:
> `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
>
> En el commit del change, en la rama de la historia, van los cambios del PRD: §6.2 (la excepción a
> «un solo lenguaje» incluye el script de instalación; «funciona sin internet» es una restricción de
> uso, no de instalación), §7 (Q12, *¿qué versión instala el script?*, contestada: lo último de
> `main` mientras no haya versiones publicadas) y §8 (*script de instalación* y *usuario propio*).
> El `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).

## 1. MOO-143 · infra

- [x] 1.1 **(test en rojo)** `tooling/moodtable-service.test.ts` espera `User=moodtable` y
  `WorkingDirectory=/opt/moodtable` (`design.md`, decisión 7). El resto de comprobaciones se queda.
  Verificar: el test falla solo por esas dos directivas, y el resto de la suite sigue en verde.
- [x] 1.2 `deploy/moodtable.service` pasa a `moodtable` y a `/opt/moodtable`. El comentario de
  cabecera dice que la registra `deploy/install.sh`, y el de `User=` deja de hablar de la historia de
  instalación.
  Verificar: el test de 1.1 pasa.
- [x] 1.3 `deploy/install.sh` para una Pi limpia (`design.md`, decisiones 2 a 5 y 7, y los pasos 3-7
  de la decisión 6), con `set -euo pipefail`:
  - el argumento opcional `<ref>` (`main` por defecto);
  - Node 24 de NodeSource si `/usr/bin/node` no es una 24, `git` y `corepack enable`;
  - el usuario de sistema `moodtable` (`nologin`, grupos `dialout` y `audio`);
  - clon superficial en `/opt/moodtable.new`, `pnpm install` y el build del panel;
  - `config/local.json` desde `config/demo.json` con `server.host` en `0.0.0.0`;
  - la propiedad de todo para `moodtable`, el cambio a `/opt/moodtable`, el registro de la unidad
    (`daemon-reload`, `enable --now`) y la dirección del panel al terminar.

  Hasta la sección 2, si detecta una instalación existente (decisión 6, paso 1), termina sin tocar
  nada y dice que todavía no sabe reinstalar.
  Verificar: `bash -n deploy/install.sh` no da errores.
- [ ] 1.4 ShellCheck dentro de `pnpm lint` (`design.md`, decisión 8): el paquete `shellcheck` en el
  catálogo de `pnpm-workspace.yaml` y en la raíz, y el script `lint` ejecuta ESLint y luego
  ShellCheck sobre `deploy/*.sh`. Se corrige lo que encuentre en el script.
  Verificar: `pnpm lint` va en verde en local y en la CI; con un error a propósito en el script
  (p. ej. una variable sin comillas), `pnpm lint` falla, y se deshace.
- [ ] 1.5 El README cuenta la instalación nueva:
  - **§1.4, «3. En la mesa»:** el paso 1 es el comando de `curl` (con el argumento opcional de la
    rama), el paso 2 declara las tiras y la tarjeta de sonido editando con `sudo`
    `/opt/moodtable/config/local.json` (desaparece `deploy/config/mesa.example.json`, que no existe) y
    el paso 3 reinicia el servicio para que la lea. Una nota: quien desarrolle en la Pi con
    `pnpm dev` para antes el servicio (`sudo systemctl stop moodtable`);
  - **§2.4:** el paso 3 de «Proceso de despliegue» describe el script real (Node 24 de NodeSource,
    clon de `main`, usuario `moodtable`), y «Servicio `systemd`», el usuario y la ruta nuevos;
  - **§2.5, «En la mesa»:** el motor corre con el usuario propio `moodtable` (`dialout` y `audio`,
    sin `sudo`). Desaparece el sacrificio de correr como `pi`.

  Verificar: `grep -n "mesa.example" readme.md` no devuelve nada; el comando del README coincide con
  la URL del script en `main`; los términos nuevos están en el glosario del PRD (§8).
- [ ] 1.6 La **D110** en `docs/idea-mood-table.md`, con el texto que propone `design.md`
  («Nueva D#»), su origen (`MOO-137`, change `table-install`) y lo descartado (decisiones 1 a 5). Se
  apunta en `prompts.md` el hito del change (formato de `course.md` §5).
  Verificar: la D110 está en la tabla después de la última D# y no renumera ninguna.
- [ ] 1.7 Prueba en la mesa, a mano, con la PR abierta. Los pasos con `sudo` y el `dd` los ejecuta
  el maker:
  - apagar la mesa, copiar la SD entera al Mac con `dd` y grabar Raspberry Pi OS de 64 bits limpio
    en la misma SD;
  - *Instalar el instrumento en una Pi recién instalada* y *Arranca sin hardware*: sin nada
    enchufado, lanzar el script desde la URL de la rama de la PR, con la rama como argumento. El
    panel se abre desde el Mac en la dirección que da el script, y el visor muestra la tira virtual
    reaccionando al fichero de audio;
  - *El usuario propio llega al hardware*: enchufar el controlador Adalight y la tarjeta de sonido,
    declararlos en `config/local.json` y reiniciar el servicio. La tira física pinta lo mismo que el
    visor y los reactivos siguen la música. `ps -o user= -C node` dice `moodtable`, e
    `id moodtable` no incluye `sudo`;
  - `table-service` se mantiene: apagar y encender, y el instrumento arranca solo;
  - relanzar el script: termina sin tocar nada (todavía no sabe reinstalar).

  Verificar: cada escenario, con su resultado, en la descripción de la PR. La SD se queda con la
  instalación nueva hasta la sección 2; la copia, en el Mac.

## 2. MOO-144 · infra

- [ ] 2.1 Detectar la instalación existente y preguntar (`design.md`, decisión 6, pasos 1 y 2): la
  del script por `/opt/moodtable` y la anterior por el `WorkingDirectory` de la unidad registrada.
  La pregunta se lee de `/dev/tty`; solo valen conservar o sobrescribir, y cualquier otra cosa (o no
  poder leer) termina sin tocar nada, diciendo por qué. Sustituye la salida provisional de 1.3.
  Verificar: `pnpm lint` en verde.
- [ ] 2.2 Reinstalar según la respuesta (`design.md`, decisión 6, pasos 5 y 6): con conservar, el
  `config/local.json` de la instalación existente pasa a la nueva; con sobrescribir, el fichero base,
  y el anterior queda como `/opt/moodtable/config/local.json.bck`. `data/` no se copia. Se para el
  servicio, se retira la instalación del script y se cambia a la nueva; el clon anterior no se toca y
  el script dice que el servicio ya no lo usa.
  Verificar: `pnpm lint` en verde.
- [ ] 2.3 El README §1.4 explica qué pasa al volver a lanzar el script (la pregunta, la copia `.bck`
  y que el estado del instrumento empieza de cero) y que el clon anterior de la mesa se queda donde
  está.
  Verificar: lo que dice coincide con `specs/table-install`, requisitos de reinstalar.
- [ ] 2.4 Prueba en la mesa, a mano, con la PR abierta:
  - *Pregunta qué hacer con la configuración al reinstalar* (la del script): con la SD de la
    sección 1, relanzar el script de la rama de la PR. Pregunta antes de hacer nada;
  - *Sin respuesta, no cambia nada*: responder otra cosa, y lanzarlo sin terminal
    (`ssh <pi> 'curl … | sudo bash -s -- <rama>'`). En los dos casos termina diciendo por qué, y la
    instalación, su configuración y el servicio siguen igual;
  - *Reinstalar sobrescribiendo la configuración*: queda el fichero base, la copia `.bck` con las
    tiras declaradas en 1.7, y el panel arranca sin el estado anterior;
  - restaurar con `dd` la copia de la SD de la mesa (la instalación anterior, con el clon en
    `/home/pi`) y lanzar el script de la rama de la PR;
  - *Pregunta qué hacer…* (la anterior) y *Reinstalar conservando la configuración*: elegir
    conservar. La tira física pinta con la configuración de siempre, sin el estado anterior, y el
    servicio corre desde `/opt/moodtable`;
  - *El clon anterior se queda y deja de arrancar*: `/home/pi/mood-table-v2` sigue ahí, el script lo
    dice al terminar, y tras apagar y encender arranca el de `/opt/moodtable`.

  Verificar: cada escenario, con su resultado, en la descripción de la PR. La mesa se queda con la
  instalación nueva.

## Workflow follow-up

- Tras integrar la última PR: `/opsx:archive table-install` en una rama `…-archivar-change`, con las
  tareas hijas de `MOO-137` revisadas en Linear antes de archivar.
