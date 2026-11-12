# Tasks

> Tres tareas de Linear, tres secciones y tres PR contra `main`, en orden: `MOO-146` parte de
> `MOO-145` ya integrada (usa el orden de color del catálogo), y `MOO-147` parte de `MOO-146` (el
> sketch deja de reordenar cuando el motor ya lo hace; `design.md`, decisión 4). Cada paso es un commit
> con `Refs MOO-n` de su tarea, y la PR lleva `Fixes MOO-n`. Un paso marcado **(test en rojo)** deja a
> propósito tests que fallan, y el siguiente los pone en verde. Antes de dar una sección por
> terminada: `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde.
>
> **En el commit del change, en la rama de la historia** (no en una tarea), lo que decidió el
> refinamiento de `MOO-136`:
>
> - `docs/PRD.md` §8: *Orden de color* (`colorOrder`) entra en el glosario: «Orden en que los LEDs de
>   una tira física esperan los canales rojo, verde y azul. Lo fija su chip (p. ej. GRB en el
>   `WS2812B`), lo aplica la salida Adalight y el visor no lo usa.» *Tira* deja de listar el orden de
>   color entre lo que se declara.
> - `docs/PRD.md` §4: la H4 deja de listar el orden de color entre lo que el maker declara.
> - `docs/idea-mood-table.md` §10: **D111** (`design.md`, decisión 1), y D29 se marca con un enlace a
>   D111, sin borrarla.
>
> El `openspec archive` va tras integrar la última PR, en una rama `…-archivar-change`
> (`workflow.md` §4.5).

## 1. MOO-145 · shared

- [x] 1.1 **(test en rojo)** Tests en `packages/shared/src/chips.test.ts`: el catálogo da a la `WS2812B`
  el orden de color `GRB`, y todo chip del catálogo tiene un orden de color.
  Tests en `packages/shared/src/config.test.ts` (`specs/engine-config`, *El fichero de configuración
  declara el orden de color de una tira*): rechaza `"colorOrder": "GRB"` en una tira física y en su
  salida, nombrando la tira y el campo. Estos ya pasan con el esquema cerrado: fijan el comportamiento.
  Verificar: los tests del catálogo fallan; el resto sigue en verde.
- [x] 1.2 El tipo `ColorOrder` en `packages/shared/src/chips.ts`, con las seis permutaciones de rojo,
  verde y azul (decisión 2), y `colorOrder: 'GRB'` en la entrada `WS2812B` del catálogo. Se exporta
  desde el punto de entrada del paquete.
  Verificar: los tests de 1.1 pasan, y `pnpm typecheck` y `pnpm test` en verde.
- [x] 1.3 Documentación:
  - README §1.1, §1.2 (H4), §1.4 paso 2, §2.1 «Justificación», §2.2 «Configuración de las tiras» y la
    tabla del §3: el orden de color deja de estar entre lo que se declara, y donde haga falta se dice
    que lo fija el chip de la tira;
  - `prompts.md`: la entrada del refinamiento, la estimación, la exploración y la propuesta de
    `MOO-136`, y la de esta tarea.

  Verificar: ninguna sección del README dice que el orden de color se declara (`grep -i "orden de
  color" readme.md`).

## 2. MOO-146 · engine

- [ ] 2.1 **(test en rojo)** Tests en `packages/engine/src/adapters/adalight.test.ts`
  (`specs/physical-strip`):
  - con el orden `GRB`, un LED en rojo puro sale como `00 FF 00`, y el frame de 173 LEDs empieza por
    `41 64 61 00 AC F9 00 FF 00` (*El frame de una tira de 173 LEDs*);
  - con el orden `GRB`, un LED a (128, 30, 255) sale como `04 40 FF` (*Un color tenue sale más tenue
    hacia la tira*);
  - con cada una de las seis permutaciones, un LED a (1, 2, 3) sale en ese orden (`RGB` → 1, 2, 3;
    `BGR` → 3, 2, 1…), con la gamma aplicada;
  - `openAdalightStrips` da a una tira `WS2812B` una salida que escribe en orden `GRB`.

  Los tests de la gamma que ya existen pasan a dar el orden de forma explícita (`RGB`), para seguir
  midiendo solo la gamma.
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [ ] 2.2 `AdalightStrip` gana `colorOrder`, y `openAdalightStrips` lo resuelve con
  `chipOf(output.chip).colorOrder` (decisión 3). `AdalightOutput` traduce el orden una vez a los
  índices de origen de cada byte, y `encodeAdalight` escribe los canales de cada LED en ese orden, con
  la gamma. El comentario de cabecera de `adalight.ts` deja de decir que el orden lo pone el sketch.
  En `engine.test.ts`, el test *no llevan el resto de la tira* deja de usar `colorOrder` como ejemplo
  de un campo que H4 añadirá a la tira.
  Verificar: los tests de 2.1 pasan, y `pnpm typecheck` y `pnpm test` en verde.
- [ ] 2.3 Documentación:
  - README §2.2, adaptador *Adalight serie*: reordena los canales según el chip de la tira, después de
    la gamma, en lugar de «el orden de color lo pone por ahora el sketch»;
  - `prompts.md`: la entrada de esta tarea.

  Verificar: §2.2 cuadra con `specs/physical-strip`.

## 3. MOO-147 · firmware

- [ ] 3.1 `HARDWARE_SETUP.md` §4.1 (decisión 4): `COLOR_ORDER` pasa a `RGB`, porque el motor ya
  reordena según el chip de la tira, y se explica qué pasa con el sketch antiguo (el rojo y el verde
  salen cambiados). Se quita «la tira se declara como `rgb`». El procedimiento para contar LEDs se
  revisa: los frames que se mandan directamente al sketch ya no se reordenan, así que en una
  `WS2812B` el rojo y el verde salen cambiados (el blanco no cambia).
  Verificar: §4.1 cuadra con `specs/physical-strip` y con el README §2.2.
- [ ] 3.2 En la Pi, en un solo paso y a mano (lo hace el maker: `sudo` pide contraseña): actualizar a
  `main` con `MOO-146` integrada, cargar el sketch con `COLOR_ORDER` en `RGB` (`arduino-cli`,
  `HARDWARE_SETUP.md` §4.1) y reiniciar el servicio `moodtable`.
  Verificar: el motor arranca y la tira pinta.
- [ ] 3.3 Comprobación a mano en la mesa, que confirma el maker (criterios de `MOO-136`):
  - **colores puros**: la *respiración* con su color en rojo puro, luego en verde puro y luego en azul
    puro; la tira física se ve del mismo color que el visor;
  - **un efecto reactivo** (el *espectro* o el *scroll*) con música: la tira física pinta los mismos
    colores que el visor;
  - si el sketch hace un destello al arrancar, en qué colores sale (sin comprobar; `design.md`,
    riesgos).

  Se anota en la PR. No es documentación hasta que el maker lo confirme.
  Verificar: el maker da el visto bueno en la PR.
- [ ] 3.4 `prompts.md`: la entrada de esta tarea.
  Verificar: sigue el formato de `docs/instructions/course.md` §5.

## Workflow follow-up

- Tras integrar `MOO-147`, `openspec archive strip-color-order` en una rama `…-archivar-change`, con
  la lista de tareas hijas de `MOO-136` revisada en Linear antes.
