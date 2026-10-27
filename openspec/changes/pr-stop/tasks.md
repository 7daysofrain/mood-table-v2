# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs MOO-89`, y
> la PR lleva `Fixes MOO-89`. Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan,
> y el paso siguiente los pone en verde. Antes de dar la sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. El `openspec archive` va tras integrar la
> PR, en una rama `…-archivar-change` (`workflow.md` §4.5).
>
> **Antes de la prueba a mano (1.11)**, hay que crear la etiqueta `babysitter:stop` en el repo
> (`design.md`, *Migration Plan*).

## 1. MOO-89 · infra

- [x] 1.1 El término *PR detenida* en el glosario de `docs/pr-babysitter.md` §8 (ya escrito en la rama
  al refinar `MOO-74`).
  Verificar: el diff del commit es solo esa fila.
- [x] 1.2 **(test en rojo)** Las etiquetas en la foto (`design.md` decisión 1):
  - `test/fixtures/github/open-pulls-stopped.json`: copia de `open-pulls.json` con la etiqueta
    `babysitter:stop` en una de las PR;
  - `adapters/github.test.ts`: `listOpenPullRequests` devuelve las etiquetas de cada PR;
  - `core/pull-request.test.ts`: `isStopped` es cierto solo con la etiqueta `babysitter:stop` (no con
    otras ni sin etiquetas).
- [x] 1.3 `labels` en `pullSchema` (adaptador) y en `openPullRequestSchema` (núcleo), `STOP_LABEL` e
  `isStopped` en `core/pull-request.ts`, y las PR que construyen a mano los tests y `src/studio.ts`
  con `labels: []`.
  Verificar: los tests de 1.2 en verde; `pnpm typecheck` en verde.
- [x] 1.4 **(test en rojo)** Los avisos (`design.md` decisión 3) en `core/notice.test.ts`: `stopped` y
  `resumed` son avisos de PR, con su frase en `noticeSummary` («Detengo su seguimiento…» con cómo
  reanudarla, «Reanudo su seguimiento.»); el de seguimiento termina con cómo detenerla (nombra
  `babysitter:stop`). En `adapters/linear.test.ts`, que `stopped` va a la tarea de la PR como los
  demás.
- [x] 1.5 `stoppedNotice` y `resumedNotice` en `core/notice.ts`, y la pista en el aviso de seguimiento.
  Verificar: los tests de 1.4 en verde, y los que ya había del aviso de seguimiento, actualizados a su
  texto nuevo.
- [ ] 1.6 **(test en rojo)** El grafo (`design.md` decisión 2) en `core/graph.test.ts`: una ejecución
  que empieza sin aviso de seguimiento no avisa, fija el push de la foto (el tiempo de espera cuenta
  desde esa foto) y espera a las comprobaciones.
- [ ] 1.7 La entrada opcional del grafo que omite el aviso de seguimiento.
  Verificar: los tests de 1.6 y los del grafo que ya había en verde.
- [ ] 1.8 **(test en rojo)** El driver, en `core/driver.test.ts`, un `describe` por requisito de
  `specs/pr-tracking` que toca este change (`design.md` decisiones 2, 3 y 4):
  - detener: una PR que espera a sus comprobaciones avisa «Detenida» una vez y no avisa de nada más
    aunque terminen comprobaciones y revisión; con un aviso pendiente, primero ese y después
    «Detenida»; con el estado final, «Detenida»; un push nuevo no la reanuda ni avisa; una PR en
    borrador con la etiqueta que pasa a lista no avisa; otra etiqueta no la detiene;
  - reanudar: antes del estado final, «Reanudada» sin «La sigo» y después los avisos del último push;
    tras más de 30 min detenida, no da «necesita intervención» por tiempo hasta 30 min después de
    reanudarla; en estado final sin push nuevo, solo «Reanudada»; en estado final con un push nuevo,
    «Reanudada» y los avisos de ese push;
  - al arrancar: una PR con la etiqueta no avisa y queda detenida; al quitarle la etiqueta, avisa
    «Reanudada»;
  - si Linear rechaza «Detenida» o «Reanudada», se reintenta en la vuelta siguiente y la PR con la
    etiqueta no avanza mientras tanto;
  - una PR detenida que se cierra se olvida sin aviso.
- [ ] 1.9 Detener y reanudar en `core/driver.ts`: el conjunto de PR detenidas, la guarda en `advance`,
  terminar el aviso pendiente antes de «Detenida», conservar el hilo terminado y comparar su SHA al
  reanudar.
  Verificar: los tests de 1.8 y todos los del driver que ya había en verde; `pnpm lint`,
  `pnpm typecheck` y `pnpm test` en verde.
- [ ] 1.10 Documentación:
  - README §2.2 (*PR Babysitter*, el driver): detener y reanudar una PR con la etiqueta, y qué hace
    con el hilo;
  - README §2.4 (*PR Babysitter*): cómo detener y reanudar el seguimiento de una PR, y crear la
    etiqueta al desplegar;
  - `docs/idea-mood-table.md` §10: D74 (la señal es la etiqueta `babysitter:stop`) y D75 (detener y
    reanudar en el driver; reanudar desde el último push; matiza D73), con su porqué y lo descartado;
  - `prompts.md` §6: la entrada de esta historia (refinamiento, exploración y change), con el formato
    de `course.md` §5.

  Verificar: los enlaces del README y de las D# a `design.md` llevan a su sitio; `pnpm lint` en verde.
- [ ] 1.11 **Prueba a mano** (sin commit), con la etiqueta ya creada y el sistema en marcha contra una
  PR real del mantenedor:
  - ponerle `babysitter:stop` → aviso «Detenida» en su tarea de Linear, y nada más con un push nuevo;
  - parar y arrancar el sistema con la etiqueta puesta → ningún aviso de esa PR;
  - quitar la etiqueta → aviso «Reanudada» y después los avisos del último push.

  Verificar: enlaces a los comentarios de Linear en la descripción de la PR.
