# Design

> Decisiones tomadas al refinar `MOO-155` y al explorar el change con el usuario (20-nov), a partir de
> D114 y del *spike* `MOO-120`. El usuario eligió en persona la 1 (real por regla tras dos fallos), la 6
> (el caso evidente, que no cambia el resultado) y la 8 (el resumen en la PR, también en una PR lista
> para integrar). Las demás se tomaron en la exploración como las evidentes. Las decisiones 2 a 5 y 7
> son de `MOO-170`; la 1, la 6 y la 8, de `MOO-171`.

## Context

- **El seguimiento** (`graph.ts`, `tracking.ts`): un hilo de LangGraph por PR, que el *driver* despierta
  cada minuto con un *snapshot* de GitHub. `esperarComprobaciones` espera a que terminen todas; si
  alguna falla, va a `triar` → `preguntarModelo`×N → `reunirTriaje` → `publicarResumen` →
  `avisarEstadoFinal` → fin. Si todas pasan, pide la revisión y espera al revisor.

  ```
  hoy:
  esperarComprobaciones --checksFailed--> triar --> ... --> publicarResumen --> avisarEstadoFinal
           |
           +--todas pasan--> pedir revision --> esperarRevisor --> avisarEstadoFinal
  ```

- **El *snapshot* pierde casi todo de cada comprobación:** `Check` es `{name, status}`, con `status`
  `pending | passed | failed`. La conclusión exacta (`failure`, `timed_out`, `cancelled`) y el intento
  no llegan al grafo; solo el triaje vuelve a leer la *check run* (`checkRun()`) para su contexto.
- **Los relojes** se miden con `observedAt` del *snapshot*: las comprobaciones desde `push.seenAt`, la
  revisión desde `push.reviewSince`. Un push nuevo cambia `push` y vuelve a empezar.
- **La CI** es un solo workflow, `CI`, con los *jobs* `lint`, `typecheck`, `test`, `e2e` y
  `sonar-issues` (este necesita a `test`), y `cancel-in-progress` por rama. `SonarCloud Code Analysis`
  es una *check run* de la app `sonarqubecloud` que lanza el análisis dentro de `test`.
- **La API de GitHub** (documentación consultada el 20-nov): `POST
  /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs` relanza los *jobs* fallidos de un run
  y los que dependen de ellos; `POST …/actions/jobs/{job_id}/rerun` relanza uno, y GitHub no deja
  relanzar mientras el run está en marcha; `GET …/actions/jobs/{job_id}` da `run_id` y `run_attempt`.
  Relanzar pide *Actions: write* en un PAT *fine-grained*. En Actions, el `id` de la *check run* es el
  del *job* (como ya usa `jobLog`).
- **La única escritura en GitHub** hoy es `createComment`, y la spec `pr-tracking` lo limita a eso.

## Goals / Non-Goals

**Goals:**

- Que relanzar sea un paso del seguimiento, visible como un nodo propio en la traza de LangSmith, y
  que el triaje siga sin actuar sobre la PR.
- Que «ya se relanzó» salga de GitHub, no de un estado propio, para que un relanzamiento a mano cuente
  y el sistema resista un reinicio (D66, BE7).
- Que las decisiones nuevas del triaje sean reglas en funciones puras del núcleo, probadas sin el
  modelo, como las de `MOO-159`.

**Non-Goals:**

- Leer el error del primer intento cuando el relanzamiento pasa (decisión 6).
- Detectar la repetición de un fallo en otras PR o un test intermitente que añade la PR: `MOO-169`.
- Reintentar más de una vez.

## Decisions

### 1. Un relanzable que falla dos veces es *real* por regla (D# nueva, matiza D114)

D114 decía: relanzar una vez y, si vuelve a fallar, preguntar «¿lo causa esta PR?». Con la regla, el
segundo fallo sale *real* sin el modelo. El porqué: la pregunta del triaje es si hay que atenderlo en
esta PR antes de integrarla, y una comprobación exigida en rojo bloquea el merge, la cause o no la PR.
Si no la causa (un test roto en `main`), eso dice cómo se arregla, no si hay que arreglarlo, y le toca
a BH3. Con esto BQ8 queda resuelta sin una clase nueva.

- **Alternativas:** la pregunta de la causa tras el segundo fallo (D114), que deja abierta BQ8 y gasta
  una petición por algo que la regla ya sabe; *exige criterio* tras varios intentos (la primera idea
  del usuario), que lleva al mantenedor todos los fallos reales de `test` y `e2e`.
- **Número:** D119. `pr-sonar-issue-triage` (`MOO-148`, en curso) reserva D117 y D118; si al integrar
  cambia, se renumera.

### 2. Se relanzan los *jobs* fallidos del run, con una llamada

`rerun-failed-jobs` sobre el run del primer relanzable que falla. Relanza también una determinista que
haya fallado en el mismo run (sigue saliendo *real* por su regla, y cuesta ~1 min de CI) y los *jobs*
que dependen de los relanzados (`sonar-issues` tras `test`).

- **Alternativas:** relanzar *job* a *job* (si fallan `test` y `e2e`, GitHub rechaza el segundo
  mientras corre el primero); relanzar el workflow entero (repite lo que ya pasó).

### 3. «Ya relanzada» = intento 2 o más en GitHub, o un relanzamiento pedido en este push

El adaptador lee el *job* de cada comprobación de Actions que falla (`GET …/actions/jobs/{id}`) y el
`Check` del *snapshot* pasa a llevar `conclusion` e `attempt` (este, solo en Actions). Se relanza si es
relanzable, ha fallado (`failure` o `timed_out`), no está cancelada y `attempt` es 1. Además, el push
guarda `rerunSince` al pedir el relanzamiento: entre la petición y que GitHub cree el intento 2, un
*tick* puede ver todavía el intento 1 fallido, y sin esa marca lo pediría otra vez.

Se relanza **en cuanto termina el run** de la que falla, sin esperar a que terminen las demás
exigidas. Lo enseñó la prueba a mano (20-nov): con `test` roja, *SonarCloud Code Analysis* no se
analiza nunca, así que esperar a todas dejaba la PR esperando hasta el tiempo límite y sin relanzar. Y
hay que esperar al run, no solo al *job*: GitHub no relanza los *jobs* fallidos de un run en marcha, y
el rechazo acabaría en «necesita intervención». Por eso el adaptador lee también el run
(`GET …/actions/runs/{id}`) y el `Check` lleva `runFinished`; si no se puede leer, cuenta como no
terminado, y la PR sigue el camino de antes.

- **Alternativas:** solo estado propio (no ve el relanzamiento a mano y duplica lo que dice GitHub,
  contra D66); solo `run_attempt` (la carrera de arriba).

### 4. Un nodo `relanzar` en el seguimiento y un puerto `CheckReruns`

```
esperarComprobaciones --checksFailed--> (relanzable en intento 1?) --si--> relanzar
        ^                                        |                           |
        |                                        no                          | 201: rerunSince
        |                                        v                           | 4xx: rerun rechazado
        |                                      triar --> ...                 |
        +--------------------- interrupt: espera el nuevo intento <----------+
                                                (4xx va a triar)
```

`afterChecksWait` devuelve un destino nuevo, `rerun`, cuando hay que relanzar. El puerto
`CheckReruns.rerun(runId)` vive en el núcleo, y el núcleo elige el run (el de la primera relanzable
que falla); el adaptador está en `github.ts`. El triaje no relanza: el requisito *El triaje no actúa
sobre la PR* no cambia.

`relanzar` sale por una arista condicional, no por un `Command`, para que el *driver* pueda saltárselo
como ya hace con `pedirRevision`: si el nodo falló y entretanto llega un push nuevo, o si se detiene
la PR, relanzar repetiría el run de un push viejo o actuaría en una PR detenida (añadido al
implementar `MOO-170`).

- **Alternativa:** relanzar desde el triaje, como dice D114 («antes de triar»). Mezcla actuar con
  clasificar y obliga a cambiar ese requisito.

### 5. Errores al relanzar: 4xx da *exige criterio*, lo demás se reintenta

Un `GitHubRequestRejectedError` (403 sin permiso, 422) deja en el estado que el relanzamiento fue
rechazado, y la PR va al estado final por `triar`. Cualquier otro error hace fallar el nodo, y el
reloj de 30 min, que no se ha puesto en marcha, sigue contando desde el push.

El *driver* no reintenta `relanzar` con la foto que tenía, como hace con los demás nodos: se lo salta,
y el hilo vuelve a esperar la foto siguiente. GitHub pudo aceptar la petición aunque se perdiera la
respuesta, o el mantenedor pudo relanzar a mano entretanto. Repetirla con la foto vieja pediría un
tercer intento, o GitHub la rechazaría con el segundo en marcha y la PR iría a «necesita
intervención» sin motivo. Con la foto nueva, el intento 1 aún fallido vuelve a `relanzar`, y el 2
espera como un relanzamiento a mano, con el reloj desde el push (hallado en la revisión de la PR de
`MOO-170`, 20-nov).

- **Alternativa:** que el adaptador lea el intento del run antes de pedirlo y no lo pida si ya va por
  el 2. Conserva el reloj desde el relanzamiento en ese caso raro, pero hace una lectura más en cada
  relanzamiento y da al puerto una regla que ya decide el núcleo con la foto.

### 6. El caso evidente se calcula con el error del último intento, en el triaje

Una función pura del núcleo mira la conclusión (`timed_out`) y el texto del contexto del hallazgo
(anotaciones o paso del log) y devuelve `timeout | infrastructure | network | runnerLost | null`:

| Caso | Patrones |
|---|---|
| `timeout` | conclusión `timed_out`; `Test timeout of`, `Timeout \d+ms exceeded`, `Test timed out in` |
| `infrastructure` | el paso que falla es `pnpm install`, `playwright install`, `actions/checkout` o `actions/setup-node` |
| `network` | `ECONNRESET`, `ETIMEDOUT`, `socket hang up`, `502 Bad Gateway`, `503 Service Unavailable` |
| `runnerLost` | `The runner has received a shutdown signal`, `lost communication with the server` |

Solo cambia el porqué del resumen, no la clase. Cuando el relanzamiento pasa no hay triaje, y el
resumen dice «se relanzó y pasó» sin motivo: así no hace falta leer el contexto del primer intento
desde el seguimiento, y el contexto sigue siendo un módulo del adaptador (D114, nota de `MOO-161`).

- **Alternativa:** calcularlo al relanzar, como decía el criterio de la historia. Sube el contexto a
  puerto del núcleo para un dato que no cambia nada.

### 7. La lista de relanzables es configurable, como la de deterministas

`RERUN_CHECKS`, por defecto `test,e2e`, igual que `TRIAGE_RULE_CHECKS`: por nombre de comprobación. La
usan el seguimiento (qué relanzar) y el triaje (qué decide la regla nueva y qué no pasa por la pregunta
de la causa). Sin ningún nombre (una coma sola), el sistema vuelve al comportamiento de hoy.

### 8. El resumen cuenta lo relanzado, también en una PR lista para integrar

Las comprobaciones que han pasado con `attempt` 2 o más salen del *snapshot*. Si hay alguna, el camino
de *lista para integrar* pasa por `publicarResumen` antes de `avisarEstadoFinal`, con un resumen sin
hallazgos que lo dice; en una PR que necesita intervención, va como líneas aparte junto a los
hallazgos. La marca de un resumen por push no cambia. El aviso de Linear no cambia: el usuario lo
quiere en la PR, que es donde vive el proceso.

## Risks / Trade-offs

- **[`checks()` se queda con la primera *check run* de cada nombre]** → la API las lista con
  `filter=latest` por defecto, que devuelve la del intento más reciente. Se comprueba con una fixture
  grabada de un run relanzado y en la prueba a mano.
- **[*Actions: write* deja hacer más que relanzar]** (cancelar runs, borrar logs y artefactos) → el
  código solo llama a `rerun-failed-jobs`, y la spec `pr-tracking` lo fija; sin *Contents*, sigue sin
  poder subir commits ni integrar (BE2, D64). Se documenta en README §2.5.
- **[Un fallo real tarda ~2 min más en llegar]** → es el coste de no molestar al mantenedor con los
  transitorios; el *spike* no encontró forma de separarlos sin repetir.
- **[El relanzamiento sale a nombre del mantenedor]** (el PAT es suyo, BA7) → para el sistema cuenta
  igual que uno a mano; distinguirlo no lo pide nadie (non-goal de la proposal).
- **[Los patrones del caso evidente dependen de los mensajes de Playwright, Vitest y GitHub]** → si
  cambian, el resumen deja de decir el caso evidente, pero la clase no cambia. Tests con los mensajes
  reales de las fixtures.

## Migration Plan

1. Antes de desplegar, el mantenedor añade *Actions: write* al PAT. Si no lo hace, el primer
   relanzamiento sale rechazado: *exige criterio*, con el motivo, y nada se rompe.
2. Desplegar `MOO-170` (relanza, y lo que vuelve a fallar sigue con la pregunta de la causa) y después
   `MOO-171` (la regla y el resumen).
3. **Vuelta atrás:** `RERUN_CHECKS=,` (una coma sola; vacía es la lista por defecto, como
   `TRIAGE_RULE_CHECKS`) devuelve el comportamiento de hoy sin desplegar código.
