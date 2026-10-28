# Proposal

> **Origen:** historia [`MOO-81`](https://linear.app/7daysofrain/issue/MOO-81/pedir-la-revision-cuando-las-comprobaciones-pasan)
> · Pedir la revisión cuando las comprobaciones pasan · épica **PB** (`MOO-67`, BH5) · expectativas
> **BE4**, **BE11** y **BE12** (`docs/pr-babysitter.md` §3). Tareas: `MOO-90` (pedir la revisión
> firmada cuando las comprobaciones pasan, `infra`) y `MOO-91` (avisar sin esperar a la revisión cuando
> falla una comprobación, `infra`).

## Why

Hoy el revisor revisa cada push por su cuenta (*Automatic review*, D62): también los que no pasan las
comprobaciones y van a cambiar, así que se gastan revisiones de un límite que, cuando se agota, deja de
revisar sin avisar (`MOO-50`). Y no es fiable: en la #67 y en la #77 no revisó y solo contestó
«create an environment». BH5 pide que el sistema pida la revisión cuando las comprobaciones del último
push están en verde, una vez por push (BE12, D68), y que se vea que la pide él (BE4). Es la última
pieza de BH1-BH5 que no necesita un modelo, y con ella el mantenedor puede apagar la *Automatic review*.

## What Changes

- **El sistema pide la revisión cuando pasan todas las comprobaciones del último push**, con un
  comentario en la PR que menciona al revisor, dice que la pide el PR Babysitter y lleva una marca
  oculta con el SHA del push. También cuando una PR en borrador pasa a lista para revisar con las
  comprobaciones ya en verde.
- **No la pide dos veces para el mismo push**: ni si el revisor ya está revisando o ha revisado ese
  push (por su revisión automática o porque se la ha pedido el mantenedor), ni si el sistema ya la
  había pedido, también después de un reinicio.
- **Si alguna comprobación falla, no pide la revisión** y avisa del estado final («necesita
  intervención» y qué falla) sin esperarla y sin el aviso de comprobaciones terminadas.
- **El tiempo de espera de la revisión cuenta desde que pasan las comprobaciones**, que es cuando el
  sistema la pide, y no desde el push: comprobaciones y revisión van ahora una detrás de otra. Los dos
  relojes son de 30 minutos.
- **BREAKING (para la operación):** el sistema **escribe en GitHub** por primera vez, solo la petición
  de revisión, con el PAT del mantenedor, que pasa a tener escritura en *Issues* y *Pull requests*.
  Sigue sin poder hacer commits ni integrar (BE2).

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `pr-tracking`:
  - requisitos nuevos: pedir la revisión cuando pasan las comprobaciones y no pedirla dos veces para
    el mismo push;
  - «Las comprobaciones son las que exige la rama main»: el aviso de comprobaciones terminadas solo
    llega si pasan todas;
  - «Al terminar comprobaciones y revisión, el sistema avisa del estado final…»: si falla una
    comprobación, el estado final llega sin esperar a la revisión;
  - «Si algo no termina en 30 minutos…»: dos relojes, el de la revisión desde que pasan las
    comprobaciones;
  - «El sistema no escribe en GitHub» se sustituye por «El sistema solo escribe en GitHub para pedir
    la revisión».

## Non-goals

Tomados de la historia `MOO-81`:

- **Revisar código por su cuenta**: lo hace el revisor (PB §5.3).
- **Triar o contestar lo que diga la revisión** (BH2, BH3).
- **Escalar si el revisor no revisa** (PB §4.1, BH4); hasta entonces lo avisa el tiempo de espera.
- **Apagar la *Automatic review* de Codex**: la apaga el mantenedor en sus ajustes cuando esta
  historia esté integrada (D68).
- **PR de Dependabot**, hasta comprobar BA2 (en la #71, Codex no la revisó por su cuenta).

Fuera también, decidido al explorar el change (27-oct):

- **Una identidad propia del sistema en GitHub** (una GitHub App o una cuenta de máquina): una GitHub
  App no puede pedir la revisión a Codex (BA7, comprobado en la #77), y una cuenta de máquina
  vinculada a Codex cuesta dos cuentas y un plan. La petición sale a nombre del mantenedor y se
  identifica por su texto (`design.md` decisión 1).
- **Un revisor propio en local** (p. ej. con Ollama): choca con PB §5.3 y §6.2; se apunta en la Visión
  de PB y se valoraría tras BH2, con su medición.
- **Pedir la revisión tras relanzar una comprobación sin push nuevo**: la PR ya tiene su estado final y
  el sistema no la vuelve a leer hasta que llega un push; si el mantenedor relanza, la pide él.
- **Cerrar el hueco de unos 18 s** entre una petición a mano del mantenedor y la reacción del revisor:
  una petición sin marca no dice de qué push es (`design.md` decisión 3).
- **Volver a pedir la revisión si el revisor se atasca** (`running` para siempre, como en la #64): es
  la política de escalado (BH4).

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/tracking.ts`: comprobaciones que pasan o fallan, si hay que pedir la revisión, el reloj
    de la revisión y el estado final sin revisión.
  - `src/core/graph.ts`: el nodo `pedirRevision` y la salida directa al estado final si algo falla.
  - `src/core/ports.ts`, `src/core/pull-request.ts`, `src/core/driver.ts`: el puerto
    `ReviewRequester` y, en la foto, si el sistema ya ha pedido la revisión de ese push.
  - `src/adapters/codex-review.ts`, `src/adapters/github.ts`: el texto de la petición y escribir el
    comentario.
  - `src/adapters/config.ts`, `.env.example`, `src/main.ts`, `src/studio.ts`.
- **Permisos**: el PAT del mantenedor pasa a tener *Issues* y *Pull requests* en escritura (GitHub
  exige los dos para comentar en una PR: `x-accepted-github-permissions: issues=write;
  pull_requests=write`, #77). Sin *Contents*: no puede hacer push ni integrar.
- **Peticiones a GitHub**: una lectura más por PR seguida y vuelta (sus comentarios, para la marca):
  con 3 PR, de 480 a 660 por hora, frente a 5.000.
- **Preparación a mano**: dar los permisos nuevos al PAT y, tras integrar las dos tareas, apagar la
  *Automatic review* (`design.md`, *Migration Plan*).
- **Documentación**:
  - `docs/pr-babysitter.md`: BA7 con lo comprobado en la #77 y la nota del revisor en local en la
    Visión (§5.2).
  - `docs/idea-mood-table.md` §10: la decisión nueva, que matiza D71 (`design.md`).
  - `docs/umbrales-para-specs.md`: los dos relojes y las peticiones por hora.
  - README §2.2 (puerto y adaptador), §2.4 (pararlo ya no es «no escribe nada») y §2.5 (permisos).
  - `.gitignore`: `.local/`, donde el mantenedor guarda credenciales locales.
  - `prompts.md`.
- **Tests E2E**: ninguno. Vitest con fixtures de GitHub; la prueba de punta a punta, a mano contra una
  PR real (`tasks.md`).
