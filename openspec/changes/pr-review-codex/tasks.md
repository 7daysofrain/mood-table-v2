# Tasks

> Una sola tarea de Linear, así que una sola sección y una sola PR. Cada paso es un commit con
> `Refs MOO-66`, salvo el último, que es de verificación. La PR lleva `Fixes MOO-66` y va contra
> `main`.

## 1. MOO-66 · infra

- [x] 1.1 Documentar la puerta de Codex en `linear.md` §7 (decisión 1 de `design.md`):
  - revisión automática de Codex en cada PR que no es borrador y en cada push, activada en los
    ajustes de Codex, no en el *ruleset*;
  - fuera el sustituto `gh pr edit <n> --add-reviewer @copilot`; si hace falta pedirla, `@codex review`;
  - la regla de hilos resueltos incluye los de Codex.

  Actualizar también el *Purpose* de `openspec/specs/quality-gates/spec.md` («la de Codex y los hilos
  sin resolver»): el archivado aplica los requisitos, no el *Purpose*.

  Verificar: `grep -n -i copilot docs/instructions/linear.md openspec/specs/quality-gates/spec.md`
  solo encuentra los requisitos que el archivado sustituye, y `pnpm exec openspec validate --specs`
  pasa.
- [x] 1.2 Documentar el flujo en `workflow.md` §4.4 (decisión 2):
  - puertas: revisión de Codex en lugar de Copilot; Codex no revisa borradores *(asumido)*;
  - el protocolo con cada hallazgo, de Codex o de SonarQube (sin otros cambios);
  - antes de integrar, el SHA del comentario de Codex coincide con el último commit; si no, `@codex
    review` o avisar al usuario.

  Verificar: `grep -n -i copilot docs/instructions/workflow.md` no encuentra nada, y los enlaces a
  `linear.md` §7 siguen apuntando a una sección que existe.
- [x] 1.3 Registrar la decisión (decisión 3):
  - D62 en `docs/idea-mood-table.md` §10;
  - en D41, «revisión automática de Copilot» tachado y **Obsoleto (22-oct)** con un puntero a D62,
    sin borrar ni renumerar;
  - README §2.4, paso 1 del proceso de despliegue: «Codex revisa cada PR».

  Verificar: `grep -n -i copilot readme.md` no encuentra nada, y D41 conserva su texto original
  tachado.
- [ ] 1.4 Entrada en `prompts.md` sobre el cambio de revisor, con el formato de `course.md` §5.
  Verificar: tiene como mucho 3 prompts literales y la línea en cursiva.
- [ ] 1.5 **Verificación en GitHub** (sin commit; *Risks* de `design.md`):
  - con la PR de esta tarea en borrador, un push no recibe revisión de Codex; al marcarla como
    lista, Codex la revisa sin que nadie lo pida y su comentario dice el último commit;
  - en un push posterior, Codex vuelve a revisar y el SHA cambia;
  - si Codex deja algún hilo, el botón de integrar queda bloqueado hasta resolverlo.

  Si Codex revisa el borrador, corregir el escenario «PR en borrador» con `/opsx:update` antes de
  archivar. Verificar: enlaces a los comentarios de Codex en la descripción de la PR.
