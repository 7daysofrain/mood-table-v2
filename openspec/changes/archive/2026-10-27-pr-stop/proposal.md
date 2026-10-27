# Proposal

> **Origen:** historia [`MOO-74`](https://linear.app/7daysofrain/issue/MOO-74/detener-el-seguimiento-de-una-pr-y-reanudarlo)
> · Detener el seguimiento de una PR y reanudarlo · épica **PB** (`MOO-67`, BH1, parte 2 de 3) ·
> expectativa **BE11** (`docs/pr-babysitter.md` §3). Tarea: `MOO-89` (detener y reanudar el
> seguimiento de una PR desde GitHub, `infra`).

## Why

Hoy el PR Babysitter sigue cada PR del mantenedor sin que nadie pueda pararlo en una de ellas: la única
forma de que deje de avisar es pasarla a borrador, que significa otra cosa (Codex deja de revisarla) y,
al volver, avisa como si fuera nueva. BE11 pide que el mantenedor pueda detener el sistema en una PR
concreta y volver a ponerlo en marcha cuando quiera. Hace falta ya porque BH2-BH5 le darán al sistema
capacidad de actuar (triar, arreglar, publicar, pedir revisión), y la forma de pararlo tiene que estar
antes que eso. `MOO-81` ya está bloqueada por esta historia.

## What Changes

- **Detener una PR con la etiqueta `babysitter:stop`.** Mientras la PR la tenga, el sistema no avanza
  en ella: no la sigue, un push nuevo no la reanuda y no avisa de sus cambios de estado. Lo que estaba
  en curso termina, con su aviso si lo tenía. El sistema avisa una vez de que la ha detenido.
- **Reanudar quitando la etiqueta.** El sistema avisa de que la ha reanudado y empieza el seguimiento
  desde el último push, como con un push nuevo. Si la PR ya tenía su estado final y no ha llegado
  ningún push mientras estaba detenida, solo avisa de que la ha reanudado y no repite el resto.
- **Una PR detenida sigue detenida al arrancar el sistema**, la detuvieran antes de pararlo o
  mientras estaba parado, y no genera el aviso de arranque.
- **Solo quien puede etiquetar la PR la detiene o la reanuda.** En este repo, de una cuenta personal,
  son el mantenedor y los colaboradores, que tienen permiso de escritura. Lo garantiza GitHub: el
  sistema solo atiende a la etiqueta, no a comentarios.
- **El aviso de que el sistema sigue una PR dice cómo detenerla**, para que la etiqueta se pueda
  descubrir sin leer la documentación.
- **El sistema sigue sin escribir en GitHub.** La etiqueta la pone una persona, y el sistema la lee en
  la misma consulta con la que ya lista las PR abiertas.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-tracking`:
  - requisitos nuevos para detener una PR, reanudarla y quién puede hacerlo;
  - «El sistema sigue las PR del mantenedor contra main que no son borrador»: el aviso de que la sigue
    dice cómo detenerla;
  - «Al arrancar, el sistema sigue las PR que ya estaban abiertas»: salvo las detenidas, que no
    generan aviso;
  - «Un push nuevo vuelve a empezar el seguimiento»: salvo en una PR detenida.

## Non-goals

Tomados de la historia `MOO-74`:

- **Pausarse solo en los casos de la política de escalado** (BH4).
- **El tope de gasto por PR** (BE8), que llega con los agentes de BH2 y BH3.
- **Integrar PR** (BE2).
- **Construir una parada del sistema entero**: se para el proceso (`docker compose down`, README
  §2.4).

Fuera también, decidido al explorar el change (27-oct):

- **Un workflow de GitHub Actions** que detenga o reanude la PR con un comentario o una casilla: añade
  una orden que puede fallar, un token con escritura y lógica fuera de los tests. La etiqueta es
  declarativa y el sistema converge hacia ella en cada vuelta.
- **Ver el estado efectivo en la PR** (un *commit status* del sistema): obligaría al sistema a escribir
  en GitHub. La confirmación llega por el aviso de Linear.
- **Un estado «detenida» dentro del grafo**: detener y reanudar viven en el driver (`design.md`).
- **Enterarse de una parada y una reanudación dentro de la misma vuelta de 60 s**: con *polling*, el
  sistema no la ve, y no hay nada que avisar.

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/pull-request.ts`: las etiquetas de la PR en la foto, el nombre de la etiqueta y la
    regla de si está detenida.
  - `src/core/notice.ts`: los avisos de PR detenida y reanudada, y la pista para detenerla en el de
    seguimiento.
  - `src/core/driver.ts`: detener, reanudar y el silencio al arrancar.
  - `src/core/graph.ts`: el aviso de seguimiento se puede omitir al empezar un seguimiento reanudado.
  - `src/adapters/github.ts`: leer las etiquetas de cada PR.
- **Dependencias y permisos**: ninguno nuevo. El PAT sigue siendo de solo lectura.
- **Preparación a mano**: crear la etiqueta `babysitter:stop` en el repo, con su descripción
  (`design.md`, *Migration Plan*).
- **Documentación**:
  - `docs/pr-babysitter.md` §8: el término *PR detenida* (ya escrito en la rama).
  - `docs/idea-mood-table.md` §10: las decisiones nuevas (`design.md`).
  - README §2.2 (el driver) y §2.4 (cómo detener y reanudar una PR).
  - `prompts.md`.
- **Tests E2E**: ninguno. Se prueba con Vitest y fixtures de GitHub; la prueba de punta a punta se hace
  a mano contra una PR real (`tasks.md`).
