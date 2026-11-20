# Tasks

> **Organización:**
> - Una tarea de Linear, `MOO-177`, con su sección y su PR contra `main`, en la rama de la historia
>   (que ya lleva este change).
> - Empieza después de integrar la PR de `MOO-171` (#173), que también toca `core/tracking.ts` y
>   `core/graph.ts` (`design.md`, *Risks*): la rama se pone al día con `main` antes del paso 1.2.
> - Cada paso es un commit con `Refs MOO-177`, y la PR lleva `Fixes MOO-177`.
> - Los pasos marcados **(test en rojo)** dejan a propósito tests que fallan, y el paso siguiente los
>   pone en verde.
> - Antes de dar la sección por terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y
>   `pnpm test:e2e` en verde.
> - Las PR de prueba de la prueba a mano no llevan `Refs MOO-n` ni `Fixes`, y se cierran sin integrar y
>   sin rama.

## 1. MOO-177 · infra

- [x] 1.1 El umbral y la decisión (`design.md` decisión 5): el margen de 2 minutos con la medición de
  las 7 PR en `docs/umbrales-para-specs.md` (*PR Babysitter*), y D121 en `docs/idea-mood-table.md`
  §10.
  Verificar: el umbral cita las PR medidas y el porqué de 2 y no 1; D121 enlaza este change y dice qué
  matiza.
- [x] 1.2 **(test en rojo)** El estado `notStarted` en el adaptador (`design.md` decisión 1), en
  `adapters/github.test.ts`: una comprobación exigida sin *check run* sale `notStarted`; una con su
  *check run* `queued` o `in_progress`, `pending`; una `completed` sigue como hoy (superada o fallada,
  con su intento si es de GitHub Actions).
- [ ] 1.3 `notStarted` en el esquema de la comprobación (`core/pull-request.ts`) y en `checks` de
  `adapters/github.ts`; `checksFinished` cuenta `notStarted` como no terminada.
  Verificar: los tests de 1.2 en verde y los que ya había; `pnpm typecheck` en verde.
- [ ] 1.4 **(test en rojo)** La espera con el margen y el motivo (`design.md` decisiones 2 y 4), en
  `core/tracking.test.ts` y `core/notice.test.ts`:
  - `afterChecksWait`: una fallada, nada `pending` y una `notStarted` → la primera foto guarda
    `quietSince` y sigue esperando; antes de 2 minutos, sigue esperando; a los 2 minutos (justos),
    `checksFailed`;
  - con algo `pending` (en cola o en curso) no hay `quietSince`, y si lo había se borra: el margen
    vuelve a empezar al quedar quieta otra vez;
  - con una relanzable fallada en su primer intento, primero se relanza y no hay `quietSince`; si el
    relanzamiento pasa y queda alguna `notStarted` sin ningún fallo, se espera como hoy hasta el plazo;
  - una cancelada cuenta como fallada y también lleva al margen;
  - sin ninguna `notStarted`, una fallada sin nada `pending` sale `checksFailed` en la misma foto, como
    hoy; un push nuevo no lleva `quietSince`;
  - `finalState`: con una fallada y nada `pending`, las `notStarted` van en `checksNotRun` y no en
    `checksUnfinished`; al vencer el plazo sin fallo, siguen en `checksUnfinished`;
  - el texto de `checksNotRun`, en singular y en plural.
- [ ] 1.5 El núcleo: `quietSince` en `TrackedPush` y en `pushOf`, la espera en `afterChecksWait` con
  `notRunMarginMs`, el motivo `checksNotRun` en `finalState` y su texto en `core/notice.ts`.
  Verificar: los tests de 1.4 en verde y los que ya había.
- [ ] 1.6 **(test en rojo)** Los escenarios de la spec de punta a punta en el grafo
  (`core/graph.test.ts`), con GitHub falso y un reloj de fotos, un `describe` para el requisito:
  - la #154: `test` falla, `sonar-issues` saltada, `e2e` termina y *SonarCloud Code Analysis* no
    aparece → el aviso «necesita intervención» 2 minutos después, con «falla test» y «no ha llegado a
    ejecutarse SonarCloud Code Analysis», sin «no ha terminado», y el resumen del triaje en esa misma
    vuelta;
  - antes de los 2 minutos, ningún aviso;
  - una en curso y otra en cola: ningún aviso hasta que terminan;
  - algo entra en cola durante el margen: se espera a que termine y a otros 2 minutos;
  - el relanzamiento pasa: ningún aviso «necesita intervención» por ese fallo, y el camino de siempre;
  - todas pasan salvo una sin empezar: ningún aviso hasta el plazo, como hoy.
- [ ] 1.7 El margen en las opciones del grafo (`notRunMarginMs`, `core/graph.ts`), en la configuración
  (`TRACKING_NOT_RUN_MARGIN_SECONDS`, 120 por defecto, `adapters/config.ts` con su test, `main.ts` y
  `.env.example`) y en `src/studio.ts`, más lo que falte para que 1.6 pase.
  Verificar: `pnpm test` en verde; `pnpm studio` arranca.
- [ ] 1.8 Documentación: README §2.2 (*PR Babysitter*: con una comprobación que falla, deja de esperar a
  las que no tienen *check run* tras el margen, y el motivo «no ha llegado a ejecutarse»); `prompts.md`.
  Verificar: el README no dice que se espere siempre hasta el plazo a una comprobación sin empezar.
- [ ] 1.9 **Prueba a mano** (sin commit), con el sistema en marcha desde la rama, repitiendo las PR de
  prueba del 19-nov: una con un test de Vitest roto (como la #154) y otra con solo el `lint` roto, de
  control (como la #155).

  Verificar:
  - la del test roto recibe el aviso «necesita intervención» y su resumen del triaje en menos de 5
    minutos desde el push (no en 30), con «falla test» y «no ha llegado a ejecutarse SonarCloud Code
    Analysis»; si el relanzamiento de `MOO-170` vuelve a fallar, el tiempo cuenta desde que termina el
    segundo intento;
  - la de control sigue igual que el 19-nov: aviso y resumen en unos 3 minutos, con «falla lint» y sin
    ningún «no ha llegado a ejecutarse»;
  - en LangSmith, el camino de nodos de cada una y la foto que decidió el estado final: en la del test
    roto, `SonarCloud Code Analysis` como `notStarted` y el `quietSince` del push. Anotarlos.

  Los enlaces a los avisos, los resúmenes y las trazas, en la descripción de la PR de la tarea.

## Workflow follow-up

- Al integrar la PR de `MOO-177`: `/opsx:verify` y `/opsx:archive` en una rama `…-archivar-change`
  que sale de `main` (`workflow.md` §4.5). Si `pr-check-rerun` sigue sin archivar, este change se
  puede archivar antes: no modifican el mismo requisito (`design.md` decisión 4).
- Reconstruir el contenedor del PR Babysitter desde `main` (README §2.4).
