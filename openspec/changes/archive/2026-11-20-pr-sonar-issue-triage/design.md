# Design

## Context

- **`sonar-issues` no anota nada.** `tooling/ci/check-sonar-issues.ts` imprime las incidencias dentro de
  un bloque `::stop-commands::` (para que un mensaje de SonarQube no inyecte comandos) y en el resumen
  del *job*. Por eso el contexto que lee hoy el triador (`adapters/check-context.ts`) es el paso que
  falla del log, y la comprobación es un solo hallazgo (`adapters/findings.ts`).
- **Cómo se tría hoy:** `lint`, `typecheck` y SonarCloud salen *real* por regla (`ruleChecks`); las
  demás comprobaciones, con la pregunta de la causa; los comentarios del revisor, con las dos del
  alcance (D116). Un hallazgo por petición, en ramas paralelas del grafo (D115), con el tope reservado
  antes de repartir.
- **Lo que se probó al refinar** (notas del agente de `MOO-148`): con la pregunta de la premisa, los
  criterios genéricos y el código alrededor de la línea, 7 de 12 aciertos, 5 *exige criterio* y
  ninguno del lado equivocado con confianza. Sin el código, 5 de 12: «Unexpected `await` inside a
  loop» se lee igual en el caso bueno y en el malo.
- **El PAT del sistema no tenía *Contents*** (README §2.5, D64 y D71). El mantenedor le ha añadido
  *Contents* en lectura el 20-nov.
- **El runner de GitHub Actions guarda 10 anotaciones de error por paso** (`_maxCountPerIssueType = 10`
  en `actions/runner`, `ExecutionContext.cs`). Las demás salen en el log, pero no como anotación.

## Goals / Non-Goals

**Goals:**

- Un contrato de anotaciones entre `sonar-issues` y el triador, que se pueda leer sin interpretar el
  log y que no deje inyectar comandos.
- Una pregunta y un contexto para las incidencias que separen lo que hay que arreglar de lo que hay que
  aceptar en SonarQube, reutilizando el *fan-out*, el tope y el resumen que ya existen.

**Non-Goals:**

- Partir otras comprobaciones: `lint` y `typecheck` salen por regla, y `test`/`e2e` esperan al
  relanzamiento (`MOO-155`).
- Calibrar los criterios nuevos: se escribieron con las 12 filas delante; los valida `MOO-76`.
- Subir el contexto de una comprobación a puerto del núcleo: sigue siendo un módulo del adaptador
  (change `pr-check-triage`, decisión 1).

## Decisions

### 1. El contrato: un `::error` por incidencia, hasta 10, y un `::notice` con el total

Por cada incidencia, `sonar-issues` emite, **antes** del bloque `::stop-commands::`:

```
::error file=<ruta>,line=<línea>,title=<regla> · <severidad> · <nombre de la regla>::<mensaje>
```

- **Una incidencia de fichero** (sin línea, p. ej. `S2187`) va sin `line` y con ` · fichero` al final
  del título. GitHub da línea a toda anotación (la 1 si no se dice), así que sin la marca el triador
  no la distinguiría de una en la línea 1. *(Lo encontró Codex en la #166.)*
- **La severidad** es la más alta de sus `impacts` (`BLOCKER` > `HIGH` > `MEDIUM` > `LOW` > `INFO`).
  Si no trae `impacts`, se traduce la heredada: `BLOCKER`→`BLOCKER`, `CRITICAL`→`HIGH`,
  `MAJOR`→`MEDIUM`, `MINOR`→`LOW`, `INFO`→`INFO`.
- **El nombre de la regla** sale de `api/issues/search` con `additionalFields=rules`. Si falta, va la
  clave de la regla.
- **Como mucho 10 `::error`**, en el orden de SonarQube, y siempre un aviso:
  `::notice title=Incidencias nuevas de SonarQube::<total> incidencias nuevas; se anotan <n>`. El
  aviso con título es una anotación útil para `check-context` y va a su `summary`; de ahí sale el
  total.
- **Escapado:** en el texto de la anotación, `%`, `\r` y `\n` (`%25`, `%0D`, `%0A`); en las
  propiedades (`file`, `title`), además `:` y `,` (`%3A`, `%2C`). Es el escapado que deshace el
  runner. Funciones puras con tests, en `sonar-issues.ts`.
- **El log y el resumen del *job* no cambian:** siguen listando todas, dentro del bloque.

**Por qué:**

- Lo pide D114: que `sonar-issues` siga la estrategia genérica de Actions, sin un adaptador que
  interprete su log. Además, las incidencias se ven en la PR junto a su línea.
- **10 y no más:** es lo que guarda el runner, y repartirlas entre varios pasos complica el *job* por
  un caso raro *(asumido: en los casos vistos, la #134 y la #122, traía 2)*.
- **El aviso siempre, y no solo al cortar:** así el triador no tiene que adivinar si falta algo. Y el
  total viaja en la propia comprobación, sin otra petición.

**Descartados:**

- Partir las anotaciones en varios pasos para pasar de 10.
- `::warning` para las que no caben, que da 10 más: mezcla dos niveles para una misma cosa, y solo
  retrasa el límite.

### 2. La comprobación se reconoce por su nombre, configurable

El triador sabe qué comprobación lista incidencias de SonarQube por su nombre,
`TRIAGE_SONAR_ISSUES_CHECK` (por defecto `sonar-issues`), como `TRIAGE_RULE_CHECKS`.

**Por qué no por el contenido de sus anotaciones**, aunque D114 descartó atar el triaje a los nombres
de los *jobs*: una comprobación que falla sin anotar nada (el análisis no termina, el script revienta)
tiene que salir *exige criterio* como la comprobación de incidencias, y no con la pregunta de la causa
sobre su log. Eso solo se sabe por el nombre. `ruleChecks` ya sentó el precedente: un nombre en
configuración, no en el código.

### 3. La pregunta `rule`: si la regla se cumple en ese código, con criterios genéricos

`questionFor` da `rule` para una incidencia. En el adaptador:

- **Instrucción:** `Does the code that SonarQube rule <regla> ('<nombre>') flags on <fichero>:<línea>
  actually have the problem the rule describes?`
- **Criterio del sí:** *The flagged code does what the rule warns against, and following the rule's
  advice would keep the behaviour the code is meant to have, even if the change takes work.*
- **Criterio del no:** *The rule's premise does not hold here: the code shows that following the
  rule's advice would break the behaviour it is meant to have, or that the alternative the rule
  suggests does not fit this code. A comment saying it is intentional is not enough on its own, and
  neither is preferring another style.*

Se clasifica con una sola probabilidad, como la causa: real, no aplica o exige criterio contra el
umbral. *No aplica* lleva en el resumen «se aceptaría en SonarQube» (BQ9 lo puede cambiar).

**Por qué:**

- La pregunta de la causa responde casi siempre que sí: SonarQube solo mira el código nuevo de la PR.
- La de alcance (D116) daría *real* a las incidencias aceptadas, que caen dentro del alcance.
- La de validez de hoy (`fixInThisPr`) ya no existe (D116), y trataba como *no aplica* los nits, que
  en SonarQube son justo lo mecánico que sí se arregla.

**Genéricos y no con ejemplos:** los ejemplos ganaban una fila (el `await` de `check-sonar-issues.ts`,
0,08 frente a 0,21), pero se escribieron conociendo esos casos.

**Una D# nueva, D118.**

### 4. El código: el fichero en el commit del push, de 25 líneas antes a 15 después

- **Lectura:** `github.ts` gana `fileAt(sha, path)` (`GET /repos/{owner}/{repo}/contents/{path}?ref=<sha>`
  en crudo). Un 404 da `null`, y un 5xx lanza, como las demás lecturas. Dentro de un push, cada
  fichero se pide una vez.
- **Recorte:** de la línea − 25 a la línea + 15, numeradas, con la de la incidencia marcada con `>>`,
  que es el formato que se probó. Una incidencia de fichero toma las 40 primeras líneas.
- **Sin código:** un fichero que no llega, o una línea fuera del fichero, dan `code: null`. Entonces
  `hasContext` es falso y la incidencia sale *exige criterio* (`noContext`) sin preguntar.
- **Permiso:** `Contents` en lectura (D117). Matiza D64 y D71: leer el código no deja hacer push ni
  integrar, que es lo que el «sin Contents» protegía. *Contents: write* sigue fuera (BQ7).

**Por qué una ventana fija y no la función que contiene la línea:** es lo que se midió, y encontrar la
función pide un parser por lenguaje.

**Por qué no la API de fuentes de SonarQube:** añadiría al babysitter una dependencia y una clave del
proyecto. D114 descartó un adaptador de SonarQube, y el análisis puede ser de otro commit si llega
tarde.

### 5. En el núcleo: un hallazgo `sonarIssue`, y la comprobación sin incidencias

- **El hallazgo:** `findingSchema` gana `{ source: 'sonarIssue', rule, ruleName, severity: 'high' |
  'normal', file, line: number | null, message, code: string | null }`. `high` son `BLOCKER` y
  `HIGH`; lo traduce el adaptador, como la severidad del revisor.
- **Severidad alta:** si saldría *no aplica* y es `high`, *exige criterio* con `highSeverity`. La
  probabilidad se guarda igualmente, para `MOO-76`. `verdictSchema` gana esa variante con
  `probability`.
- **La comprobación sin incidencias legibles** sigue siendo un hallazgo `check`, con una respuesta
  nueva sin modelo, `noIssues`. `withoutModel` la decide después de la regla y antes del contexto: es
  la comprobación entera y no hay nada que preguntar. En el resumen: «no anota ninguna incidencia
  legible».
- **La lista cortada:** `Findings.read` devuelve, además, `sonarIssues: { total, triaged } | null`.
  Viaja en el estado del hilo y el resumen añade una línea bajo la tabla: «`sonar-issues` trae 12
  incidencias nuevas; se han triado 10».
- **Partir es del adaptador:** `adapters/sonar-issues.ts` (nuevo) lee las anotaciones de la
  comprobación, saca cada incidencia y el total, y pide y recorta el código. `findings.ts` lo usa
  para la comprobación de `TRIAGE_SONAR_ISSUES_CHECK`.
- **Las anotaciones enteras, no el contexto:** el contexto de una comprobación se corta a 16 KiB
  (`check-context.ts`), y con mensajes largos dejaría incidencias anotadas sin triar, y quizá el
  aviso con el total. El código de cada incidencia ya va acotado por su ventana. *(Lo encontró Codex
  en la #166.)*

**Por qué un `source` propio y no un `check` con incidencias:** una incidencia tiene fichero, línea,
severidad y una pregunta propias, como un comentario del revisor. Meterla dentro de `check` llenaría
de casos `hasContext`, `questionFor`, `classify` y el resumen.

### 6. Lo que no cambia

- **El tope:** cada incidencia es una petición, y su estimación ya incluye el código (unos 2.600
  tokens, 0,0006 $). Con 10 incidencias, 0,006 $, lejos de 0,05 $.
- **Lo demás:** el *fan-out*, la ronda y el reductor (D115); las reglas de `lint`, `typecheck` y
  SonarCloud; la pregunta de la causa en las demás comprobaciones, y las del alcance en el revisor.

## Risks / Trade-offs

- **[El código sale hacia el modelo]** → Ya salía el `diffHunk` del revisor. README §2.5 lo dice, y el
  repo es público.
- **[La ventana no basta]** El `<canvas role="img">` se quedó en *exige criterio*. → Es la clase
  prudente; `MOO-76` dirá si compensa una ventana mayor.
- **[Criterios sobreajustados]** 12 filas, y las 4 negativas son de dos reglas. → Las valida `MOO-76`
  con filas nuevas.
- **[Más de 10 incidencias]** Solo se trían las 10 anotadas. → El resumen lo dice, con las dos cifras.
- **[Un nombre de *job* renombrado]** `sonar-issues` pasaría a la pregunta de la causa. → Es
  configuración; mismo riesgo que `ruleChecks`.
- **[BQ9 abierta]** *No aplica* podría tener que ser *exige criterio*. → Es una línea en
  `classify`, y el resumen ya distingue «se aceptaría».

## Migration Plan

1. **Hecho (20-nov):** *Contents* en lectura en el PAT.
2. **`MOO-167` primero:** la CI anota. Mientras no llegue `MOO-168`, el triador lee esas anotaciones
   como el contexto genérico de la comprobación y le hace la pregunta de la causa, como hoy, pero con
   mejor contexto.
3. **`MOO-168`, en una rama que sale de `main`** después de integrar `MOO-167`.

Para volver atrás, se revierte la PR de `MOO-168`. Las anotaciones de `MOO-167` no molestan a nadie.

## Notas al archivar

Lo que el código hace distinto de lo escrito arriba, sin cambiar el comportamiento de las specs (#166):

- **El orden de las incidencias es el de las anotaciones que da GitHub,** que no coincide con el de
  emisión (en la #165 venían al revés). Solo cambia el orden de las filas del resumen y el reparto del
  tope.
- **La línea de la lista cortada** dice «La comprobación de incidencias nuevas de SonarQube trae 12; se
  han triado las 10 que anota.», no el texto de ejemplo de la decisión 5.
- **`sonar-issues.ts` devuelve sus propias incidencias,** sin la marca de hallazgo, y `findings.ts` las
  convierte. La comprobación `noIssues` no lleva en el resumen el origen de su contexto: no se ha
  preguntado por ella.
- **Hallazgos de Codex en la #166,** arreglados antes de integrar: el adaptador lee las anotaciones
  enteras, sin el corte de 16 KiB (decisión 5), y la incidencia de fichero lleva ` · fichero` en el
  título (decisión 1).
- **Esos dos hallazgos no se triaron:** Codex revisó un push anterior cuando ya había otro, y el triaje
  solo lee los del último. Es el hueco que ya anotaba `MOO-76` (visto en la #122) y que captura
  `MOO-173`.
