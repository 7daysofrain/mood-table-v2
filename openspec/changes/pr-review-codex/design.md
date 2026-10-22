# Design

## Context

Desde `MOO-42` (change archivado `tasks-to-main-pr-gates`, decisión 4) la revisión automática era la
regla `copilot_code_review` del *ruleset* «ramas de integración», y la puerta real, «todos los hilos
resueltos». El 22-oct el usuario activó *Automatic review* de Codex para el repo y quitó esa regla. La
regla de hilos y las comprobaciones requeridas siguen igual (consultado con `gh api …/rulesets` el
22-oct).

Primera revisión observada: PR `7daysofrain/mood-table-v2#59` (`MOO-65`). Codex no encontró nada y
no dejó una revisión de GitHub, sino un comentario de `chatgpt-codex-connector` con un bloque
`codex-review-state` que dice el commit revisado (`commit_sha`) y si hay hallazgos
(`has_any_findings`).

## Goals / Non-Goals

**Goals:**

- Que un agente que sigue `linear.md` y `workflow.md` sepa que revisa Codex, que no tiene que pedirlo
  y cómo comprobar que ha revisado el último push.

**Non-Goals:**

- Escribir pautas de revisión para Codex (la sección *Review guidelines* que Codex lee de
  `AGENTS.md`). Si la revisión se queda corta o se pasa, es otra tarea.

## Decisions

### 1. Codex se configura en sus ajustes, no en el *ruleset*

GitHub no tiene una regla de *ruleset* para pedir revisión a una app de terceros: `copilot_code_review`
solo sirve para Copilot. *Automatic review* se activa en los ajustes de Codex (ChatGPT → Codex →
*Code review*) y el disparador, al abrir y en cada push, se elige allí. Es configuración de la cuenta,
como el *ruleset*; queda documentada en `linear.md` §7.

- **Por qué no hacer de Codex una comprobación requerida:** con hallazgos deja hilos, y sin ellos un
  comentario. Ninguno de los dos es un *check*. La puerta sigue siendo «todos los hilos resueltos»
  (como Copilot, que tampoco podía aprobar).
- **Alternativa descartada:** la GitHub Action `openai/codex-action` en la CI, que sí podría fallar
  como un *check*. Necesita una clave de la API de OpenAI como secreto y se paga por uso, y el
  usuario ya tiene Codex con su plan.

### 2. El agente comprueba el SHA del comentario de Codex

Antes de integrar, el agente busca el último comentario de `chatgpt-codex-connector` y compara su
`commit_sha` con el último commit de la PR. Si no coinciden, o no hay comentario, Codex no ha revisado
el último push: se pide con un comentario `@codex review` o se le dice al usuario. Sustituye a «hay una
revisión de Copilot del último push» de `workflow.md` §4.4.

### 3. D62 deja obsoleta la parte de Copilot de D41

D41 decidió a la vez la base de las PR, `sonar-issues`, Copilot y los hilos. Solo cambia Copilot, así
que en D41 se tacha «revisión automática de Copilot», marcado como **Obsoleto (22-oct)** y con un
puntero a D62, sin borrar nada. D62: «La revisión automática de cada PR es de Codex (*Automatic
review*), no de Copilot; la puerta sigue siendo hilos resueltos», con el porqué (cuota, `MOO-50`) y la
alternativa descartada (decisión 1).

## Risks / Trade-offs

- **[Codex no revisa sin avisar]** Si se agota el límite de uso del plan, o falla la integración,
  no hay comentario ni hilos y ninguna puerta lo detecta → la comprobación del SHA (decisión 2).
- **[Codex revisa los borradores]** El escenario «PR en borrador» es *(asumido)*: la documentación de
  Codex no lo aclara → se comprueba con la PR de esta tarea, que se abre en borrador. Si los revisa,
  se corrige el escenario con `/opsx:update` antes de archivar.
- **[Los hallazgos de Codex no son hilos]** Solo se ha visto una revisión sin hallazgos. Si Codex
  dejara los hallazgos en un comentario general en lugar de hilos, la regla de hilos no los bloquearía
  → se comprueba con la primera PR en la que Codex encuentre algo. Hasta entonces, el agente lee
  también el comentario de resumen.
