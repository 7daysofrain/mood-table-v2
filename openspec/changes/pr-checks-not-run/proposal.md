# Proposal

> **Origen:** historia [`MOO-164`](https://linear.app/7daysofrain/issue/MOO-164/avisar-de-que-la-pr-necesita-intervencion-sin-esperar-a-las)
> · Avisar de que la PR necesita intervención sin esperar a las comprobaciones que no empiezan ·
> épica **PB** (`MOO-67`, BH1) · expectativa **BE1** *(asumido en la historia: ninguna BE fija cuánto
> tarda un aviso)* (`docs/pr-babysitter.md` §3). Tarea: `MOO-177` (avisar sin esperar a las
> comprobaciones que no van a ejecutarse, `infra`).

## Why

Cuando falla `test`, el mantenedor recibe el aviso «necesita intervención» a los 30 minutos, y no a
los 3. *SonarCloud Code Analysis* la publica un paso del *job* `test` que va después de los tests:
si fallan, el paso no se ejecuta y esa comprobación exigida no llega a existir. El sistema cuenta
una comprobación exigida que no ha empezado como no terminada, así que espera hasta el plazo.

Medido el 19-nov: la #154 (`test` roto) recibió su aviso y su resumen del triaje a los 31 min, y la
#155 (`lint` roto), a los 3. Pasó también en la #149, la #152 y la #170; en esta última, con el
relanzamiento de `MOO-170`, el plazo empieza a contar al relanzar, así que la espera es aún mayor.
El mantenedor acaba vigilando la PR, que es lo que BH1 quiere quitarle.

## What Changes

- **Con una comprobación que falla, el sistema deja de esperar a las que no van a ejecutarse.**
  - Una comprobación exigida «no va a ejecutarse» cuando no tiene resultado ni está en cola ni en
    curso, otra del último push ha fallado, ninguna está en cola ni en curso y han pasado 2 minutos
    así.
  - El margen de 2 minutos cubre el hueco entre que termina un *job* y entra en cola el que depende
    de él (`sonar-issues` tras `test`, 2-3 s en las PR medidas). Cuenta desde que el sistema ve ese
    momento, como los otros dos plazos.
  - Mientras otra comprobación esté en curso o en cola, se espera a que termine, para que el aviso y
    el triaje traigan todos los fallos del push.
  - Una comprobación que el sistema relanza no adelanta el aviso: si el relanzamiento pasa, la PR
    sigue como si no hubiera fallado ninguna.
- **El aviso nombra la comprobación que falla y las que no llegaron a ejecutarse**, sin decir que no
  terminaron a tiempo.
- **Sin fallo no cambia nada:** una comprobación exigida que no ha empezado sigue contando como no
  terminada, y se espera hasta el plazo de 30 minutos.
- **Primer commit:** el margen y su medición en `docs/umbrales-para-specs.md`, y una D# nueva en
  `docs/idea-mood-table.md` §10 (`design.md`).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-tracking`: el requisito «Las comprobaciones son las que exige la rama main» distingue una
  comprobación que no va a ejecutarse de una que no ha terminado, y dice qué nombra el aviso.

## Non-goals

Tomados de la historia `MOO-164`:

- **Arreglar la CI** para que el paso de SonarQube se ejecute también cuando fallan los tests: la
  regla no depende de cómo publica cada comprobación.
- **Cambiar el plazo de 30 minutos** de una comprobación en curso o de la revisión (requisito «Si algo
  no termina en 30 minutos»).
- **Cambiar cuándo o cuántas veces se relanzan `test` y `e2e`** (`MOO-155`, change `pr-check-rerun`).
- **Adelantar el estado final cuando no ha fallado ninguna comprobación:** *lista para integrar* exige
  todas en verde.
- **Reabrir el estado final** cuando el mantenedor relanza a mano una comprobación después del aviso:
  solo un push nuevo lo reabre.

Fuera también, decidido al explorar (20-nov):

- **Ver una comprobación que aparece después del margen:** el estado final ya está dado y no se vuelve
  a leer la PR hasta el siguiente push (`design.md`, *Risks*).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/adapters/github.ts`: una comprobación exigida sin *check run* sale como no empezada, y una
    en cola o en curso, como pendiente.
  - `src/core/pull-request.ts`: el estado `notStarted` de una comprobación.
  - `src/core/tracking.ts`: la espera con el margen (`afterChecksWait`), la marca en el push que se
    sigue y el motivo en `finalState`.
  - `src/core/notice.ts`: el texto del motivo nuevo.
  - `src/core/graph.ts`, `src/adapters/config.ts`, `src/main.ts`, `.env.example`: el margen como
    opción, igual que el plazo.
- **Peticiones a GitHub:** ninguna nueva; la lista de *check runs* ya dice si hay uno y en qué estado.
- **Coordinación:** el change `pr-check-rerun` sigue sin archivar y la PR de `MOO-171` (#173) toca
  `core/tracking.ts`. Este change solo modifica un requisito que `pr-check-rerun` no toca
  (`design.md` decisión 4).
- **Documentación:** `docs/umbrales-para-specs.md` (el margen), `docs/idea-mood-table.md` §10 (D121),
  README §2.2 (*PR Babysitter*: cuándo deja de esperar a las comprobaciones) y `prompts.md`.
- **Tests E2E:** ninguno. Vitest con GitHub falso; la prueba de punta a punta, a mano, repitiendo la
  #154 con la #155 de control y leyendo sus trazas en LangSmith (`tasks.md`).
