# Proposal

> **Origen:** historia [`MOO-173`](https://linear.app/7daysofrain/issue/MOO-173/triar-los-hallazgos-del-revisor-que-llegan-tras-un-push-nuevo)
> · Triar los hallazgos del revisor que llegan tras un push nuevo · épica **PB** (`MOO-67`, BH2) ·
> expectativas **BE1**, **BE4** y **BE9** (`docs/pr-babysitter.md` §3). Sale de lo visto en la #122 y
> la #166. Tarea: `MOO-175` (triar los comentarios sin resolver del revisor de cualquier push,
> `infra`).

## Why

Si el revisor comenta un push cuando el sistema ya sigue el siguiente, nadie tría ese comentario.
Pasó en la #166 (20-nov): Codex publicó dos P2 sobre `576b496` cuando el sistema ya seguía `a4b9361`.
El triaje solo toma los comentarios del último push, así que corrió con 0 hallazgos y no publicó
resumen. En la #122, el aviso fue «lista para integrar» con un hilo abierto.

Hay una segunda causa. El estado final y el triaje miran cosas distintas:
- el estado final mira el `has_any_findings` del bloque de Codex, que arrastra los hallazgos de otro
  push (#166) y no sigue a los hilos (#62);
- el triaje mira los comentarios del último push.

Por eso la #166 recibió «necesita intervención» con un triaje vacío, y la #62 lo recibió con los hilos
ya resueltos. El mantenedor quiere que ningún hallazgo del revisor se salte el triador (BE1, BE9), y
que el estado y el triaje hablen de lo mismo.

## What Changes

- **Los hallazgos del revisor son sus hilos sin resolver, sean del push que sean.**
  - Se vuelven a triar en cada push hasta que alguien resuelve el hilo, aunque ya se triaran en uno
    anterior.
  - Un hilo resuelto no cuenta nunca.
  - Si un hilo está resuelto se lee de GitHub, sin estado propio (D66).
- **El estado final sale de esos mismos hilos, no del bloque de Codex.**
  - «El revisor tiene hallazgos» quiere decir que le queda algún hilo sin resolver, de cualquier push.
  - El bloque de Codex solo dice si ha terminado la revisión del último push.
  - El motivo del aviso dice si los hallazgos son de un push anterior.
  - Una PR con los hilos del revisor resueltos sale «lista para integrar», aunque el bloque diga otra
    cosa (la #62).
- **Un comentario de un push anterior lleva una pregunta más: si el código del último push ya lo
  arregla.**
  - Va en la misma petición que las dos del alcance, con el código del último push alrededor de su
    línea.
  - Si llega al umbral, el hallazgo es *no aplica*, porque ya está arreglado, salvo si es de severidad
    alta: entonces *exige criterio*, por la regla de siempre.
  - Si no llega, se clasifica por el alcance, como hoy.
  - Si ese código no se puede leer, *exige criterio* sin preguntar.
  - En modo sombra, la PR sigue en «necesita intervención» hasta que se resuelva el hilo.
- **El resumen del triaje dice de qué push viene cada hallazgo del revisor** que no es del último.
- **PB se alinea en el primer commit:**
  - en el glosario (§8), una entrada nueva, *Estado final*: es el veredicto de un push, y un push
    nuevo lo reabre;
  - se ajustan *Hallazgo* y *Lista para integrar*: cuentan los hilos del revisor sin resolver, de
    cualquier push.
  - El término «estado final» no se renombra en specs ni en código.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-triage`:
  - los hallazgos del revisor pasan a ser sus hilos sin resolver de cualquier push, y no solo sus
    comentarios del último push;
  - nueva pregunta «ya arreglado» para los de un push anterior, con su regla de severidad alta y su
    regla sin código;
  - el resumen dice de qué push viene cada uno y da todas las probabilidades de su petición.
- `pr-tracking`: «el revisor tiene hallazgos» en el estado final sale de los hilos sin resolver, con un
  motivo que dice si son de un push anterior.

## Non-goals

Tomados de la historia `MOO-173`:

- **Medir el triaje contra PR cerradas**, incluidas las que ya tienen este patrón: `MOO-76`.
- **Volver a triar las PR ya integradas** con este patrón (#122, #166).
- **Exigir resueltos los hilos de otras personas, y que el sistema resuelva hilos:** BH3 (`MOO-78`).
- **Arreglar los hallazgos o escalar:** `MOO-77` (BH3) y `MOO-79` (BH4).
- **Los comentarios de otro revisor**, como Copilot: `MOO-124`.
- **Triar una revisión que llega después del aviso final «lista para integrar»** sin push nuevo: no se
  ha visto (`MOO-176`, cancelada).

Fuera también, decidido al explorar y al proponer el change (20-nov):

- **Renombrar «estado final»:** se define en el glosario y se queda como está en las specs, el código y
  los changes archivados.
- **Medir la pregunta «ya arreglado» antes de escribir el change:** solo hay dos casos reales, y la
  calibra `MOO-76` (`design.md`, *Risks*).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/adapters/github.ts`: lee los hilos de revisión de una PR por GraphQL (`reviewThreads`, con
    `isResolved`), en lugar de los comentarios en línea por REST.
  - `src/adapters/codex-review.ts`: cuenta los hilos sin resolver del revisor, del último push y de
    los anteriores. Del bloque solo usa el commit revisado y si ha terminado.
  - `src/core/pull-request.ts` y `src/core/ports.ts`: la foto lleva los hilos sin resolver del
    revisor, y `Review` pierde `hasFindings`.
  - `src/core/driver.ts`: lee los hilos en cada vuelta, para la foto.
  - `src/core/tracking.ts`: `finalState` con los hilos, y el motivo con el push.
  - `src/core/notice.ts`: el texto del motivo.
  - `src/adapters/findings.ts`: los hallazgos del revisor son sus hilos sin resolver de cualquier
    push. Los de un push anterior llevan su push y el código del último push alrededor de la línea
    (`fileAt`).
  - `src/core/triage.ts`, `src/adapters/decision-model.ts`: la pregunta «ya arreglado», su
    clasificación y sus reglas.
  - `src/core/triage-summary.ts`: el push de origen, el porqué de «ya arreglado» y las probabilidades.
  - `src/studio.ts`: un hallazgo de un push anterior.
- **Peticiones a GitHub:** una consulta GraphQL más por PR seguida y vuelta, en lugar de nada; y, al
  triar, un `fileAt` por cada comentario de un push anterior. El PAT ya tiene lo que hace falta: *Pull
  requests* para los hilos y *Contents* en lectura para el código (D117).
- **Peticiones al modelo de decisión:** las mismas, una por hallazgo. Las de un comentario de un push
  anterior llevan una pregunta más y el código del último push. Volver a triar en cada push cuesta
  unos 0,0004 $ por hallazgo, dentro del tope de 0,05 $ por PR (BQ5).
- **Documentación:**
  - `docs/pr-babysitter.md` §8 (*Estado final*, *Hallazgo*, *Lista para integrar*), en el primer
    commit;
  - `docs/idea-mood-table.md` §10: una D# nueva, que matiza D114 y D116 (`design.md`);
  - README §2.2 (el adaptador de GitHub, el del revisor, el de los hallazgos y el modelo de decisión)
    y §2.5 (qué sale hacia el proveedor: el código del último push);
  - `prompts.md`.
- **Tests E2E:** ninguno.
  - Vitest, con una fixture de GraphQL grabada de la #166 y el modelo de decisión falso.
  - La prueba de punta a punta, a mano, contra una PR de prueba con un comentario de Codex sobre un
    push anterior, leyendo su traza en LangSmith (`tasks.md`).
