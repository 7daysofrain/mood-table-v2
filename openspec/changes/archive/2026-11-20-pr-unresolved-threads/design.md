# Design

## Context

Motivación y alcance: `proposal.md`. Lo que hay hoy en `packages/pr-babysitter`:

- **El estado final** (`core/tracking.ts`, `finalState`) añade `reviewFindings` si la revisión del
  último push ha terminado y `review.hasFindings` es cierto. `hasFindings` es el `has_any_findings`
  del bloque `codex-review-state` (`adapters/codex-review.ts`). Codex reescribe ese bloque en cada
  revisión, y en la #166 dejó en `a4b9361` los hallazgos de `576b496`.
- **El triaje** solo se lanza si el estado es «necesita intervención» por `checksFailed` o
  `reviewFindings` (`needsTriage`).
- **Los hallazgos del revisor** (`adapters/findings.ts`) son sus comentarios en línea por REST
  (`listReviewComments`) con `originalSha === sha` del último push, sin las respuestas. REST no dice
  si un hilo está resuelto.
- **La foto** (`core/pull-request.ts`) la arma el driver en cada vuelta con lo que leen los puertos.
  El grafo no lee GitHub (change `pr-tracking`, decisión 9).
- **Un comentario del revisor** se pregunta con P1 y P2 del alcance en una petición (D116), con su
  `diffHunk` como contexto. El resumen da su revisor, insignia, `fichero:línea` y título.
- **El código de una incidencia de SonarQube** se lee en el commit del push con `fileAt`, 25 líneas
  antes y 15 después (D117, D118).

En la #166 y la #122, Codex publicó su revisión y sus comentarios en línea en el mismo segundo. El
bloque se actualizó después, pero la API solo da su última edición.

## Goals / Non-Goals

**Goals:**

- Que el estado final y el triaje miren el mismo conjunto: los hilos del revisor sin resolver.
- Que un comentario de un push anterior se trie contra el código del último push.
- No tocar el triaje de las comprobaciones ni de las incidencias de SonarQube.

**Non-Goals:**

- Un umbral propio para la pregunta «ya arreglado»: usa el de 0,80 hasta que `MOO-76` lo calibre.
- Seguir la línea de un comentario a través de los push (diff entre commits): se usa la que da GitHub
  (decisión 3).
- Leer los hilos solo cuando hacen falta: se leen en cada vuelta (decisión 2).

## Decisions

### 1. Los hallazgos del revisor salen de sus hilos sin resolver, por GraphQL

`GitHubReader` lee los hilos de revisión de una PR por GraphQL. De cada hilo da:
- `isResolved`;
- el primer comentario: autor, cuerpo, fichero, `originalLine`, `line`, el SHA de `originalCommit` y
  `diffHunk`.

Pagina de 100 en 100. El adaptador de los hallazgos se queda con los hilos sin resolver cuyo primer
comentario es del revisor. Ese primer comentario es el hallazgo, y las respuestas no se miran, como
hoy. La lectura por REST (`listReviewComments`) deja de usarse y se borra.

- **El push del hallazgo** es el `originalCommit` del primer comentario, como hoy `originalSha`. El
  `commit` de GitHub no vale: se mueve al push siguiente si la línea no cambia (la #88).
- **Un comentario sobre un commit que ya no existe** (*force push*) sigue en su hilo, con su
  `diffHunk`. Se tría como uno de un push anterior. Su SHA se nombra aunque ya no exista; si GitHub
  ya no da el commit (`originalCommit` es `null`), el hilo cuenta igual, como de un push anterior, y
  el resumen lo dice sin SHA (hallazgo de Codex en la PR de `MOO-175`).

**Alternativas:**
- Seguir con REST y cruzar con GraphQL solo para `isResolved`: son dos lecturas y un cruce por id para
  lo que una consulta da entera.
- El `has_unresolved_findings` de Codex: no sigue a los hilos (#62).

### 2. El estado final sale de los hilos; el bloque de Codex solo dice si ha terminado

- **La foto** lleva cuántos hilos sin resolver tiene el revisor: los del último push y los de pushes
  anteriores (`reviewerThreads: { lastPush, earlierPushes }`).
  - Los cuenta el adaptador del revisor, que sabe su cuenta, con la lectura de la decisión 1.
  - Se exponen en un método nuevo del puerto `ReviewReader`.
  - `Review` pierde `hasFindings`: del bloque solo quedan el commit revisado y si ha terminado
    (`reviewFinished`, sin cambios).
- **`finalState`** añade `reviewFindings` si queda algún hilo sin resolver, haya terminado o no la
  revisión del último push:
  - con las comprobaciones en verde, al estado final solo se llega con esa revisión terminada, así que
    nada cambia de orden;
  - si falla una comprobación, los hilos de un push anterior ya cuentan, igual que entran en el triaje.
- **El motivo** lleva de qué push son los hilos (`{ kind: 'reviewFindings', pushes: 'last' | 'earlier'
  | 'both' }`). Los textos (`core/notice.ts`):

| `pushes` | Motivo |
|---|---|
| `last` | el revisor tiene hallazgos |
| `earlier` | el revisor tiene hallazgos de un push anterior |
| `both` | el revisor tiene hallazgos de este push y de uno anterior |

- **El driver lee los hilos en cada vuelta**, con lo demás de la foto: una consulta GraphQL por PR
  seguida y minuto. Son unos 60 puntos por hora de los 5.000 del límite. Leerlos solo al llegar al
  estado final obligaría al grafo a pedir una foto más, o al driver a saber en qué paso está el hilo.
- `needsTriage` no cambia.

**Alternativa:** mantener el bloque para el estado y los hilos para el triaje. Una PR con un hilo
antiguo abierto y un último push limpio saldría «lista para integrar» sin triaje (la #122), y la #166
saldría «necesita intervención» con el triaje vacío.

**D#:** sí, **D120**, que matiza D114 y D116. Los hallazgos del revisor son sus hilos sin resolver,
de cualquier push, y deciden el estado final y el triaje. A los de un push anterior se les pregunta
también si el último push ya los arregla (decisiones 3 y 4). D119 está en la rama de `MOO-155`, sin
integrar: si esta llega antes a `main`, se renumera al integrar la segunda.

### 3. A un comentario de un push anterior se le pregunta si el último push ya lo arregla

**La pregunta** se formula en inglés, como las demás:

> *Does the code at this PR's latest push already fix the {insignia} reviewer comment on
> {fichero:línea}, titled '{título}'?*

- **true:** *The latest code no longer has the problem the comment describes: the lines it points at
  were changed or removed in a way that addresses it.*
- **false:** *The latest code still has the problem, the problem does not depend on these lines, or
  the code shown is not enough to tell.*

El *false* se lleva la duda a propósito: dar por arreglado lo que no lo está es el error caro.

**El contexto** son el comentario y su `diffHunk`, como hoy, más el código del último push alrededor
de su línea. Se lee con `fileAt` en el último push, con la ventana de D118: 25 líneas antes y 15
después.
- La línea es la `line` que da GitHub, que sigue al comentario mientras el código de alrededor no
  cambia.
- Si GitHub la da `null` (el comentario está *outdated*), se usa su `originalLine`.

**En la misma petición** que P1 y P2: tres preguntas sobre el mismo `state`, con las claves de la del
hallazgo y los sufijos `_fixed`, `_inside` y `_outside`, dentro del límite de 100 caracteres. Las tres
juntas siguen D116: no se contaminan, porque el `state` es el mismo. `estimate` cuenta las tres
preguntas y el código, y el tope se reserva por lo alto. Un comentario del último push no lleva la
pregunta: su código es el mismo que comentó el revisor.

**Alternativas:**
- Una regla sin modelo: «*outdated*» quiere decir que la línea ha cambiado, no que esté arreglado.
- Una petición aparte: duplica el `state` y el coste.

### 4. La clasificación de un comentario de un push anterior

Las reglas sin modelo (`withoutModel`) van primero, en este orden:
1. la PR sin descripción (`noScope`, como hoy);
2. sin `diffHunk` (`noContext`, como hoy);
3. **sin el código del último push** (`noCurrentCode`, nueva): el fichero ya no existe o la línea cae
   fuera;
4. el tope.

Sin código no se pregunta nada, tampoco el alcance: el modelo juzgaría con la misma seguridad sin ese
contexto (como con SonarQube).

Después, con la respuesta (`classify`):

```
ya arreglado >= 0,80  --> no aplica, ya está arreglado  (P0/P1: exige criterio, regla)
si no                 --> el alcance, como hoy (P1 / P2, decisión 1 de pr-reviewer-scope)
```

- Dar por arreglado un P0 o un P1 es descartar un hallazgo de severidad alta: lo escala PB §4.1, como
  la regla del alcance.
- El veredicto guarda las tres probabilidades, también cuando decide una regla, para que `MOO-76`
  calibre la pregunta.

### 5. El resumen dice de qué push viene cada hallazgo y el porqué de «ya arreglado»

- **La identidad** de un comentario de un push anterior termina en
  `· de un push anterior (`576b496`)`. Los del último push no cambian.
- **El porqué** (`core/triage-summary.ts`):

| Caso | Clase | Por qué |
|---|---|---|
| Ya arreglado | no aplica | `ya arreglado en el último push: p = 0,91 ≥ 0,80` |
| Ya arreglado, P0/P1 | exige criterio | `regla: descartaría un hallazgo de severidad alta` |
| Ninguna llega | exige criterio | `ya arreglado p = 0,40, dentro p = 0,58, de otra tarea p = 0,32: ninguna llega a 0,80` |
| Sin código | exige criterio | `no se ha podido leer su código en el último push` |

Los demás casos del alcance siguen con sus textos de `pr-reviewer-scope`.

### 6. PB se alinea en el primer commit

`docs/pr-babysitter.md` §8:
- **Estado final, entrada nueva:** el veredicto que el sistema da de un push cuando ha terminado de
  mirarlo, «lista para integrar» o «necesita intervención». Un push nuevo lo reabre. El término se
  queda como está en specs, código y changes archivados, sin renombrarlo.
- **Hallazgo:** un comentario del revisor cuyo hilo sigue sin resolver, sea del push que sea.
- **Lista para integrar:** los hilos que deben estar resueltos son los del revisor, de cualquier push.
  Los de otras personas, BH3.
- **Necesita intervención:** se enlaza con *Estado final*.

Y D120 en `docs/idea-mood-table.md` §10 (decisión 2).

## Risks / Trade-offs

- **Que Codex dé por terminada la revisión antes de que estén sus comentarios.** El sistema saldría
  «lista para integrar» con hallazgos que aún no ve. En la #122 y la #166, la revisión y sus
  comentarios llegan en el mismo segundo, y el bloque después, pero no hay forma de ver el orden de
  las ediciones del bloque → en la prueba a mano se comprueba en la traza que la foto que decide ya
  tiene los hilos. Si no los tiene, hace falta un cambio de diseño, no un parche.
- **Un hallazgo de Codex sin comentario en línea no se vería.** Hasta ahora, todos los P0-P3 de Codex
  llegan en línea (fixtures de la #85 y la #88, la #122, la #166) → si aparece uno, se captura.
- **La pregunta «ya arreglado» no está medida.** Solo hay dos casos reales, y ninguno estaba
  arreglado. Lo decidió así el usuario al proponer el change → `MOO-76` la calibra. Mientras tanto,
  el modo sombra no actúa, el *false* se lleva la duda y la regla de severidad alta frena los P0/P1.
- **La línea de un comentario *outdated* puede no ser la suya en el último push** (`originalLine` en
  otro código) → el modelo ve otro trozo. Lo normal es que responda que no está arreglado, que es el
  lado seguro. El código va en el resumen solo por su origen, sin copiarlo.
- **El mismo hallazgo se repite en el resumen de cada push** hasta que se resuelve su hilo. Es lo que
  pidió el usuario: un comentario puede triarse en un push y resolverse en otro → no hay arreglo,
  ni falta que haga.
- **Más peticiones a GitHub:** una consulta GraphQL por PR y vuelta, y un `fileAt` por cada comentario
  de un push anterior al triar → lejos de los límites.
- **Conflicto con `MOO-155`** (change `pr-check-rerun`, PR #168, sin integrar): las dos tocan
  `pr-triage`, el glosario y §10 de la ficha → quien integre después resuelve la D# y las specs al
  archivar.

## Migration Plan

Sin migración de datos. El estado de los hilos vive en memoria (`MemorySaver`), y la foto cambia de
forma (`Review` sin `hasFindings`, `reviewerThreads` nuevo). Por eso se reconstruye el contenedor
desde `main` al integrar (README §2.4), y los hilos empiezan de cero. Los resúmenes de push anteriores
se quedan como estaban. *Rollback*: revertir la PR.
