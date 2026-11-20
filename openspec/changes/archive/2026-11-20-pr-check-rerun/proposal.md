# Proposal

> **Origen:** historia [`MOO-155`](https://linear.app/7daysofrain/issue/MOO-155/relanzar-una-vez-test-y-e2e-cuando-fallan-antes-de-triarlos)
> · Relanzar una vez test y e2e cuando fallan, antes de triarlos · épica **PB** (`MOO-67`, BH2) ·
> expectativas **BE1**, **BE3** y **BE4** (`docs/pr-babysitter.md` §3). Sale de la captura del *spike*
> `MOO-120` y de D114. Tareas: `MOO-170` (relanzar una vez `test` y `e2e` que fallan y esperar su
> resultado, `infra`) y `MOO-171` (triar por regla tras el relanzamiento y contarlo en el resumen,
> `infra`).

## Why

Un `test` o un `e2e` que falla por azar le llega hoy al mantenedor como un hallazgo más, y el triador
no sabe separarlo de un fallo real: en las PR #112, #116 y #117, el `e2e` falló por tiempos o por una
carrera, el triaje dijo *exige criterio* o *real* (p = 0,83 en la #116), y relanzar el *job* sobre el
mismo commit bastaba. El *spike* `MOO-120` midió que el texto del error no dice si un fallo es
intermitente; solo repetir la ejecución lo dice (D114). Mientras el sistema no relance, esos fallos
le cuestan al mantenedor un relanzamiento a mano y un aviso que no pedía (BE1).

## What Changes

- **El seguimiento relanza una vez un `test` o `e2e` que falla.** Cuando terminan las comprobaciones
  del último push y alguna de las relanzables (por defecto `test` y `e2e`; configurable) ha fallado en
  su primer intento, el sistema relanza los *jobs* que han fallado de ese run de CI, sobre el mismo
  commit, sin avisar todavía, y espera el resultado:
  - si pasa, la PR sigue como si hubiera pasado a la primera: se pide la revisión y se sigue hasta su
    estado final;
  - si vuelve a fallar, la PR necesita intervención y se tría;
  - el tiempo de espera de 30 minutos cuenta desde el relanzamiento;
  - un push nuevo deja sin efecto el relanzamiento del anterior, como cualquier otro resultado.
- **No se relanza** una comprobación cancelada (la CI cancela el run de un push viejo con
  `cancel-in-progress`, así que una cancelación no dice que el fallo sea transitorio), ni una que ya se
  había relanzado en ese push, a mano o por el sistema.
- **Tras el relanzamiento, el triador decide por regla, sin el modelo de decisión:**
  - un `test` o `e2e` que ha fallado dos veces sale *real*. Resuelve BQ8: una comprobación exigida en
    rojo bloquea el merge, así que hay que atenderla en la PR aunque no la cause; quién y cómo la
    arregla es de BH3;
  - la decisión registra que ha fallado dos veces y, si el error del último intento es un caso
    evidente (*timeout*, infraestructura, red, *runner* perdido), cuál;
  - una comprobación que no se ha podido relanzar, cuyo relanzamiento no ha terminado o que se ha
    cancelado sale *exige criterio*, con ese motivo.
- **El resumen dice qué comprobaciones se relanzaron y pasaron,** también cuando la PR acaba lista
  para integrar. Hoy el resumen solo existe cuando la PR necesita intervención con hallazgos.
- **`test` y `e2e` dejan de pasar por la pregunta de la causa.** La pregunta queda para las
  comprobaciones que no son deterministas ni relanzables (p. ej., una exigida nueva).
- **El token gana *Actions: write*,** para relanzar. Sigue sin *Contents*: no puede subir commits ni
  integrar (BE2, D64).
- **Documentos de PB:** el glosario añade *Relanzar* y *Caso evidente*, y *Modo sombra* pasa a «decide
  y registra, pero no arregla»; §4.1 aclara que el relanzamiento no cuenta en «la misma comprobación
  falla dos veces seguidas»; BQ8 queda resuelta. Una D# nueva matiza D114.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-tracking`:
  - una comprobación relanzable que falla en su primer intento se relanza una vez antes del estado
    final;
  - el estado final y el tiempo de espera tienen en cuenta el relanzamiento;
  - el sistema escribe en GitHub también sus relanzamientos.
- `pr-triage`:
  - una comprobación relanzable que ha fallado dos veces sale *real* por regla, con el motivo;
  - una que no se ha podido relanzar, que no ha terminado o que se ha cancelado sale *exige criterio*;
  - la pregunta de la causa deja fuera `test` y `e2e`;
  - el resumen dice qué se relanzó y pasó, también en una PR lista para integrar.

## Non-goals

Tomados de la historia `MOO-155`:

- **Escalar cuando la misma comprobación falla dos veces seguidas:** `MOO-79` (BH4, PB §4.1). Fallar
  tras el relanzamiento no cuenta como esas dos veces.
- **Relanzar `lint`, `typecheck` o SonarCloud:** salen *real* por regla (D114, `MOO-159`). Si fallan en
  el mismo run que un `test` o `e2e`, se relanzan con él, pero siguen saliendo *real* por la regla.
- **Contar las repeticiones de un fallo transitorio** en el historial de GitHub y llevarlo como deuda
  de `main`, y **sacar como *real* un test intermitente que añade o cambia la propia PR**: `MOO-169`.
- **Arreglar o publicar:** `MOO-77` y `MOO-78` (BH3).
- **Calibrar el umbral de la pregunta de la causa:** `MOO-76`.

Fuera también, decidido al explorar el change (20-nov):

- **El motivo de un relanzamiento que pasa.** El caso evidente se calcula con el error del intento que
  vuelve a fallar, que el triaje ya lee; cuando el relanzamiento pasa, el resumen dice que se relanzó y
  pasó, sin motivo. Así el contexto de una comprobación sigue siendo un módulo del adaptador y no sube
  a puerto (D114, nota de `MOO-161`).
- **Distinguir en GitHub un relanzamiento del sistema de uno del mantenedor:** los dos salen con su
  cuenta (el PAT es suyo, BA7), y para el sistema cuentan igual.

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/pull-request.ts`: el `Check` del *snapshot* lleva su conclusión y su intento.
  - `src/core/tracking.ts`: cuándo se relanza, el reloj desde el relanzamiento y el estado final con
    lo relanzado.
  - `src/core/graph.ts`: el nodo `relanzar` y el resumen también en una PR lista para integrar.
  - `src/core/ports.ts`: un puerto nuevo para relanzar.
  - `src/core/triage.ts` y `src/core/triage-summary.ts`: la regla tras el relanzamiento, el caso
    evidente y las líneas de lo relanzado.
  - `src/adapters/github.ts`: el intento y el run de cada *job* que falla, y relanzar los *jobs*
    fallidos de un run.
  - `src/adapters/config.ts`, `.env.example`, `src/main.ts` y `src/studio.ts`: la lista de
    comprobaciones relanzables.
- **Peticiones a GitHub:** por cada comprobación de Actions que falla, el *job* (para su intento y su
  run); por cada relanzamiento, una escritura. Solo en las PR con un fallo.
- **Permisos:** el PAT pasa a *Actions: write*. El mantenedor lo cambia a mano antes de desplegar.
- **Documentación:** README §2.2 (el nodo y el puerto), §2.4 (la lista configurable) y §2.5 (*Actions:
  write* y lo que deja hacer); `docs/pr-babysitter.md` (glosario, §4.1, BQ8);
  `docs/idea-mood-table.md` §10 (la D# nueva); `prompts.md`.
- **Tests E2E:** ninguno. Vitest con fixtures de GitHub; la prueba de punta a punta, a mano contra una
  PR de prueba con un test que falla una vez, leyendo su traza en LangSmith (`tasks.md`).
