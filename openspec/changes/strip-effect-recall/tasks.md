# Tasks

> Una tarea de Linear, una sección y una PR contra `main`. Cada paso es un commit con `Refs MOO-110`,
> y la PR lleva `Fixes MOO-110`. El paso marcado **(test en rojo)** deja a propósito tests que
> fallan, y el siguiente los pone en verde. Antes de dar la sección por terminada: `pnpm lint`,
> `pnpm typecheck`, `pnpm test` y `pnpm test:e2e` en verde. Los cambios del PRD (E3 y el glosario) van
> en el commit del change, en la rama de la historia. El `openspec archive` va tras integrar la PR, en
> una rama `…-archivar-change` (`workflow.md` §4.5).

## 1. MOO-110 · engine

- [ ] 1.1 **(test en rojo)** Tests del búfer de control en `packages/engine/src/core/control.test.ts`,
  con dos tiras y, además de los efectos del registro, un efecto de prueba con parámetros (para
  comprobar dos efectos con valores en la misma tira): volver a un efecto lo devuelve con los valores
  con que lo dejó; el primer `render` de la ranura nueva ya
  pinta con ellos (escenario del primer frame); la memoria es nueva (la respiración empieza como
  recién creada); cada tira recupera los suyos; un efecto que nunca se ha elegido en una tira empieza
  con sus valores por defecto aunque otra tenga otros; dos efectos con valores en la misma tira
  guardan cada uno los suyos; unos valores rechazados (`invalid`) no cambian lo que se recupera;
  `unchanged`, `unknown-strip` y `needs-audio-source` no tocan lo guardado. El test *cambiar de
  efecto sigue empezando con los valores por defecto* se sustituye por el de volver a un efecto
  (`specs/instrument-control`, decisiones 1 y 2).
  Verificar: los tests nuevos fallan; el resto sigue en verde.
- [ ] 1.2 Los valores guardados por tira y por efecto en `packages/engine/src/core/control.ts`:
  `setEffect` crea la ranura con los guardados o con los de por defecto, y `setValues` los apunta.
  El comentario de `setEffect` y el de la cabecera, al día.
  Verificar: los tests de 1.1 pasan, los del bucle siguen en verde y `pnpm lint` no da errores de
  fronteras.
- [ ] 1.3 Tests de la ruta en `packages/engine/src/adapters/server.test.ts`, con `inject` y un búfer
  real: tras cambiar los valores de una tira, pasar a la energía y volver a la respiración, la
  respuesta `200` de `PUT /api/strips/{stripId}/effect` y el mensaje `6` llevan los valores
  recuperados.
  Verificar: los tests pasan sin tocar `server.ts`.
- [ ] 1.4 El comentario de `packages/panel/src/controls/use-draft-values.ts` que dice que el efecto
  vuelve con sus valores por defecto (decisión 4).
  Verificar: los tests del panel siguen en verde.
- [ ] 1.5 E2E del caso feliz en `e2e/controls.spec.ts`, con el motor de prueba y una tira con la
  respiración: el DJ cambia el color y el periodo, pasa la tira a la energía, recarga el panel y
  vuelve a la respiración; los controles muestran ese color y ese periodo y el visor pinta la tira
  con ese color (`specs/instrument-control`, criterios de `MOO-96`).
  Verificar: `pnpm test:e2e` en verde tres veces seguidas.
- [ ] 1.6 Documentación: README §2.2 (*Búfer de control*: guarda los valores de cada efecto de cada
  tira y la ranura nueva sale con ellos) y §4 (la respuesta del cambio de efecto lleva los valores
  con que la tira dejó ese efecto, o los de por defecto la primera vez). `prompts.md`: la entrada de
  la exploración y la propuesta del change, y la de esta tarea.
  Verificar: lo que describe el README coincide con lo que hace el motor, y `prompts.md` sigue el
  formato de `docs/instructions/course.md` §5.
