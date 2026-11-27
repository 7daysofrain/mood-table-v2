# Proposal

> **Origen:** historia [`MOO-77`](https://linear.app/7daysofrain/issue/MOO-77/arreglar-los-hallazgos-reales-y-subirlos-a-la-rama-de-la-pr)
> · Arreglar los hallazgos reales y subirlos a la rama de la PR · épica **PB** (`MOO-67`, BH3, parte 1
> de 2) · expectativas **BE4**, **BE5**, **BE6**, **BE8** y **BE10** (`docs/pr-babysitter.md` §3).
> Matiza D124 (empezar en modo ensayo) y BE10, y resuelve BQ7. Tareas: `MOO-192` (identidad propia que
> sube commits sin poder integrar, `infra`), `MOO-193` (arreglar cada hallazgo real y subirlo, `infra`)
> y `MOO-194` (parar cuando las vueltas no acaban o la PR cambia, `infra`).

## Why

Hoy el sistema sigue cada PR, tría sus hallazgos y avisa, pero los arreglos los sigue escribiendo el
mantenedor, aunque casi todos son mecánicos: un comentario de Codex, una incidencia de SonarQube, un
`lint` que falla. El triaje ya está medido (`MOO-76`, D124): con 47 hallazgos de PR cerradas no se
equivoca con confianza en ninguno, y lo que no sabe lo deja en *exige criterio*.

D124 decidió empezar en modo ensayo, con el arreglo en una rama aparte. Al refinar la historia, el
mantenedor lo descartó: el modo ensayo no aporta nada por sí solo, y la puerta humana ya es el merge
(BE2). El arreglo va directo a la rama de la PR, y el mantenedor lo revisa al integrarla.

## What Changes

- **El sistema arregla los hallazgos reales de cada push y los sube a la rama de la PR.** Tras el
  triaje final, si hay hallazgos *real*, el nodo `decidir` elige arreglar:
  - un agente de código arregla cada hallazgo, con un commit por hallazgo, y el sistema los sube en un
    solo push nuevo;
  - el push nuevo vuelve a empezar el seguimiento: comprobaciones, revisión y triaje;
  - mientras arregla, el sistema no avisa del estado final de ese push.
- **El arreglo corre aparte y no bloquea el seguimiento.** Un servicio nuevo, el *fixer*, recibe el
  trabajo por un puerto del núcleo (`Fixer`), y el grafo lo espera como espera a la CI. Cambiar dónde
  se arregla es cambiar de adaptador.
- **Una identidad propia sube los commits y no puede integrar (BQ7).** Una GitHub App del PR Babysitter
  hace el push; un *ruleset* aparte sobre `main` solo deja actualizarla al mantenedor. El PAT del
  mantenedor sigue sin poder subir commits.
- **Antes del push, el agente pasa `lint`, `typecheck` y `test`.** `e2e` lo pasa la CI de la PR
  (matiza BE10). Un arreglo que no pasa no se sube, y el sistema avisa con el motivo.
- **El sistema deja de arreglar y avisa** cuando:
  - la misma comprobación falla dos veces seguidas, tras un arreglo cada vez;
  - se agotan las N vueltas de arreglo de la PR (N = 3, *asumido*);
  - se agota el tope de gasto del arreglo (2 $ por PR, *asumido*).
- **Lo que no arregla, lo avisa:** los hallazgos que exigen criterio, una comprobación que la PR no
  causa y las PR de Dependabot.
- **Un arreglo no pisa a nadie:** si llega un push nuevo, la PR se detiene, se cierra o se integra
  mientras arregla, el sistema no sube su arreglo.
- **D# nuevas:** arreglar en la rama de la PR (matiza D124), la identidad propia (resuelve BQ7 y
  matiza D64 y D71), el *fixer* detrás de un puerto, el agente y las comprobaciones antes del push
  (matiza BE10).

## Capabilities

### New Capabilities

- `pr-fix`: cómo arregla el sistema los hallazgos reales de un push y los sube a la rama de la PR,
  qué comprueba antes, cuándo deja de arreglar, qué no arregla y con qué identidad escribe.

### Modified Capabilities

- `pr-tracking`:
  - el estado final de un push que el sistema va a arreglar no se avisa: lo sustituye el push nuevo
    del arreglo, o el aviso de por qué no se ha arreglado;
  - lo que el sistema escribe en GitHub: también commits en la rama de la PR, con su identidad propia,
    que sigue sin poder integrar.
- `pr-triage`:
  - el triaje sigue sin actuar, pero lo que se hace con su resultado ya puede ser arreglar.

## Non-goals

Tomados de la historia `MOO-77`:

- **Contestar y resolver los hilos de los hallazgos:** `MOO-78`. Hasta entonces, el estado final del
  push sigue en *necesita intervención* mientras queden hilos del revisor sin resolver.
- **Arreglar los hallazgos que exigen criterio o no aplican:** los que exigen criterio se avisan y,
  con BH4, se escalan (`MOO-79`).
- **Capturar en *Triage* la comprobación que la PR no causa:** aquí solo se avisa; la captura es
  `MOO-166`.
- **Arreglar las PR de Dependabot:** en ellas el sistema avisa en vez de arreglar (`MOO-191`, BQ3).
- **Pasar SonarQube antes del push:** lo comprueba la PR después (BE10).

Fuera también, decidido al explorar el change (27-nov):

- **Pasar `e2e` antes del push:** lo pasa la CI de la PR.
- **Ejecutar el arreglo en GitHub Actions o en la nube:** el puerto `Fixer` lo permite más adelante,
  sin tocar el núcleo.
- **Llevar las trazas del agente a LangSmith:** se quedan en el log del *fixer*; en la traza del grafo
  queda el trabajo, su resultado y su coste.

## Impact

- **Código** (`packages/pr-babysitter`):
  - `src/core/decision.ts`: la acción `fix` y sus reglas.
  - `src/core/graph.ts`: los nodos `pedirArreglo` y `esperarArreglo`, y el aviso de lo que no se
    arregla.
  - `src/core/ports.ts`: los puertos `Fixer` y `FixRounds` (las vueltas, leídas de GitHub).
  - `src/core/driver.ts` y `src/core/pull-request.ts`: el estado del trabajo en la foto de cada vuelta.
  - `src/core/notice.ts`: los avisos nuevos.
  - `src/adapters/fixer-client.ts` (nuevo): el cliente HTTP del *fixer*.
  - `src/fixer/` (nuevo): el servicio del *fixer* (cola, agente, commits y push), con su raíz de
    composición propia.
- **Infraestructura:**
  - `compose.yaml`: el servicio `fixer`, solo en la red interna, con su volumen;
  - una GitHub App del PR Babysitter instalada en el repo, con *Contents* y *Pull requests* en
    escritura;
  - un *ruleset* nuevo sobre `main` con *Restrict updates* y el administrador exento (verificado el
    27-nov en un repo de prueba).
- **Dependencias:** `@anthropic-ai/claude-agent-sdk` en el paquete, y una clave de la API de Anthropic.
- **Coste:** el del agente, con un tope de 2 $ por PR *(asumido)*; se mide en la prueba a mano.
- **Documentación:**
  - `docs/pr-babysitter.md`: BE10, BQ3, BQ5, BQ7 y el glosario (*modo ensayo*);
  - `docs/idea-mood-table.md` §10: las D# nuevas y notas en D64, D71 y D124;
  - README §2.2, §2.4 y §2.5, y el README del paquete;
  - `prompts.md`.
- **Tests E2E:** ninguno. Vitest con fixtures y un *fixer* falso; la prueba de punta a punta, a mano
  contra PR de prueba, leyendo su traza en LangSmith (`tasks.md`).
