# Proposal

> **Origen:** tarea *enabler* [`MOO-66`](https://linear.app/7daysofrain/issue/MOO-66/cambiar-la-revision-automatica-de-las-pr-de-copilot-a-codex)
> · Cambiar la revisión automática de las PR de Copilot a Codex · épica técnica `MOO-27` (sin historia
> de producto ni H#/E#).

## Why

La revisión automática de Copilot, puerta de cada PR desde `MOO-42` (D41), agotaba la cuota del plan
(`MOO-50`): sin cuota, las PR se integraban sin revisión. El 22-oct el usuario la sustituyó por
**Codex** y quitó la regla `copilot_code_review` del *ruleset*. La spec `quality-gates` y las
instrucciones de la PR siguen diciendo Copilot, así que un agente que las sigue pide o espera una
revisión que ya no llega.

## What Changes

- **La revisión automática de cada PR es de Codex**, con *Automatic review* activada para el repo en
  los ajustes de Codex: revisa cada PR que no es borrador al abrirse y en cada push, sin que nadie lo
  pida. Ya no hay regla de revisión en el *ruleset*.
- **Los hilos de Codex bloquean la integración** como los de cualquier revisor, por la regla de hilos
  resueltos (`required_review_thread_resolution`), que no cambia.
- **Cómo comprueba el agente que Codex ha revisado el último push:** Codex no deja una revisión de
  GitHub cuando no encuentra nada, sino un comentario con el SHA revisado. El agente lo compara con el
  último commit de la PR.
- **Documentación:** `linear.md` §7, `workflow.md` §4.4, README §2.4 (proceso de despliegue, paso 1) y
  la decisión D62 en `docs/idea-mood-table.md` §10, que deja obsoleta la parte de Copilot de D41 sin
  borrarla.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `quality-gates`:
  - el requisito «Copilot revisa cada PR sin que nadie lo pida» pasa a Codex. Se quita y se vuelve a
    añadir con otro nombre, porque MODIFIED no puede cambiar el título del requisito;
  - «Una PR con hilos de revisión sin resolver no se integra» pasa a llamarse «Ninguna PR se integra
    con hilos de revisión sin resolver», con el escenario «Hilo de Codex sin resolver». El
    comportamiento no cambia; se quita y se añade porque MODIFIED no deja renombrar un escenario.

## Non-goals

- **No se cambia ninguna comprobación de la CI** (`lint`, `typecheck`, `test`, `e2e`, Sonar).
- **No se convierte la revisión de Codex en comprobación requerida.** La puerta sigue siendo «todos
  los hilos resueltos», como con Copilot.
- **No se implementa la revisión de respaldo con Claude** que proponía `MOO-50`.
- **No se reescriben los changes archivados ni `prompts.md`**: cuentan lo que pasó con Copilot.

## Impact

- **Configuración (ya hecha por el usuario el 22-oct):** *Automatic review* de Codex activada; regla
  `copilot_code_review` fuera del *ruleset* «ramas de integración».
- **Spec:** `openspec/specs/quality-gates/spec.md` (requisitos y *Purpose*).
- **Documentación:** `docs/instructions/linear.md` §7, `docs/instructions/workflow.md` §4.4,
  `readme.md` §2.4 y `docs/idea-mood-table.md` §10.
- **Sin código.**
