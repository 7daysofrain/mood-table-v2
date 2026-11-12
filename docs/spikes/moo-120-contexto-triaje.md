# Spike de contexto del triaje · ¿Qué contexto de una comprobación que falla necesita el triador?

**Spike:** [MOO-120](https://linear.app/7daysofrain/issue/MOO-120) · **Hecho:** en curso ·
**Decisiones:** D# por crear (`docs/idea-mood-table.md`)

> **Notas de trabajo.** El documento se completa con las medidas del prototipo y se cierra con
> `/close-spike`. Lo que hay ahora es lo que se ha visto en los datos crudos, sin preguntar todavía a
> Clef.

## Preguntas

1. ¿Qué contexto de una comprobación que falla basta para que el triador acierte, y en qué
   comprobaciones no basta el genérico? → **Pendiente de medir.** Hay una propuesta de estrategias
   (abajo), sacada de los datos crudos.
2. ¿Mandar el diff de la PR mueve la p hacia la etiqueta real, y cuánto cuesta frente al tope de
   0,05 $ por PR? → **Pendiente de medir.**

## Veredicto

*Borrador, por piezas. Se cierra con `/close-spike`.*

- **`lint` y `typecheck` no pasan por el triador** (decidido con el usuario el 12-nov). Son
  deterministas: si fallan en una PR, el fallo es *real* sin preguntar al modelo.
- **`test` y `e2e` se relanzan una vez antes de preguntar al triador** (12-nov):
  - Si falla un paso de infraestructura, se relanza sin preguntar.
  - Si pasa al relanzar, *no aplica* para la PR: el test intermitente es una deuda de `main`, sea del
    test o del producto, y averiguar cuál le toca a quien lo arregle.
  - Si vuelve a fallar, se pregunta al triador si lo causa la PR, con el dato de que ha fallado dos
    veces (la regla de §4.1).
  - Un test intermitente que añade o cambia la propia PR es *real*.
- **«Si se repite» se saca del historial de GitHub, sin estado en el sistema** (12-nov). Al pasar un
  relanzamiento, se buscan en los runs fallidos recientes las anotaciones con la misma identidad del
  fallo (fichero y nombre del test). Así sobrevive a los reinicios y cuadra con D66. Si con la
  repetición el sistema propone un Bug en *Triage* o solo avisa al mantenedor, lo decide la historia
  del relanzamiento (`MOO-155`, con `MOO-79`).
- **`SonarCloud Code Analysis` no pasa por el triador** (12-nov). Su *quality gate* («Sonar way»)
  pone umbrales de métricas sobre el código nuevo, que es el de la PR: si falla, es *real* sin
  preguntar, como `lint` y `typecheck`. Con eso sobra el adaptador específico con la API de Sonar.
- **`sonar-issues` pasa por el triador, con una pregunta por incidencia** (12-nov). Cada incidencia es
  la opinión de un analizador y puede no aplicar: por eso se puede aceptar en Sonar con el motivo. Se
  parece más a un comentario del revisor que a una comprobación, y probablemente necesita criterios
  como los del revisor. Una incidencia, un hallazgo es `MOO-148`. Falta una fila de una incidencia que
  se aceptó en Sonar para ver si el triador la distingue, y eso puede ir a `MOO-76`.

## Resultados

### Cómo llega hoy una comprobación al triador

1. `checks()` lee `GET /commits/{sha}/check-runs` y reduce cada comprobación exigida a
   `{ name, status }`. Se pierden la conclusión exacta (`failure`, `timed_out`, `cancelled`), la app y
   el `output`.
2. `jobLog()` vuelve a leer los *check runs*. Si la app no es `github-actions`, devuelve `null`; si lo
   es, descarga el log entero del *job*.
3. `failingStep()` se queda con el paso que falla, desde su `##[group]Run` hasta el **primer**
   `##[error]`, incluido, con 16 KiB como mucho.
4. Al modelo le llega `{ source, name, log_tail }`, junto con el título y la descripción de la PR. Las
   anotaciones, el `output` y el diff no se leen.

`hasContext()` solo mira si el log es `null`. Un log cortado justo antes del error cuenta como
contexto.

### Dónde está el error en cada fila

| Fila | Etiqueta | Corte actual (lo que vio el triador) | Anotaciones | `output` |
|---|---|---|---|---|
| #112 `e2e` | relanzar | 822 B, sin el error | Error completo y resumen | vacío |
| #116 `e2e` | relanzar | 820 B, sin el error | Error completo y resumen | vacío |
| #117 `e2e` | relanzar | 817 B, **solo el primero de 2 fallos** | Los 2 errores y el resumen | vacío |
| #116 `sonar-issues` | real | 657 B, completo: regla, fichero y línea | Nada útil | vacío |
| #117 `SonarCloud Code Analysis` | real | Nada: no es un *job* de Actions (`noContext`) | 0 | `summary`: «71.4% Coverage on New Code (required ≥ 80%)» |

- **`e2e`:** el reporter de Playwright emite cada error como anotación, con fichero, línea,
  `Expected/Received` y el trozo del test. En el log, el `##[error]` es la primera línea del bloque, y
  el corte se queda sin el resto. Las anotaciones útiles (el resumen y los errores, unos 750 caracteres
  en la #112) ocupan menos que el corte actual.
- **`sonar-issues`:** nuestro script imprime las incidencias en el log antes de salir. Sus anotaciones
  son solo el `exit code 1` genérico y un aviso de GitHub.
- **`SonarCloud Code Analysis`:** es un *check run* de la app `sonarqubecloud` y no tiene log. La
  condición que falla está en `output.summary`, que ya llega en la llamada de los *check runs*. No dice
  el fichero: eso está en la API de SonarCloud.
- **Ruido en las anotaciones:** en todas las filas de Actions salen un `failure` en `.github`
  («Process completed with exit code 1.») y un `notice` sin `title` (la migración de
  `ubuntu-latest`).
- **El error completo no basta solo.** En la #116 `e2e`, el error (`jumps`: se esperaba 0 y llegó 1)
  dice *qué* falla, pero no que la PR no toca el audio. Eso lo da el diff, que es la pregunta 2.

### Propuesta de estrategias, por `app.slug` (a medir)

| `app.slug` | Estrategia | Respaldo |
|---|---|---|
| `github-actions` | Las anotaciones útiles. Se descartan los `failure` en `.github` y los `notice` sin `title`. Si no queda ninguna, el paso que falla del log | 4 filas |
| `sonarqubecloud` | `output.summary` + el detalle por fichero de la API de SonarCloud | Hipótesis: se mide frente al genérico |
| Cualquier otra | `output.title` + `output.summary` | Genérico |

- **Se elige por la app y no por el nombre de la comprobación.** Así, el triaje no depende de los
  nombres de los *jobs* del workflow, y una comprobación nueva tiene siempre una estrategia.
- **El adaptador de SonarCloud puede no ser del triaje.** «Cobertura del código nuevo por debajo del
  80 %» ya dice que hay que arreglarlo en la PR. El *dónde* le hace falta a quien arregla. Se mide la
  p con `summary` solo y con el detalle.
- **Salida estructurada, no un texto:** el estado del contexto (lo hay, la comprobación no lo da, o no
  se ha podido leer), de dónde sale, un resumen y la lista de errores, cada uno con su fichero, su
  línea y su mensaje. El estado separa «no tiene log» de «el log ha caducado», que hoy acaban igual. La
  lista deja abierto `MOO-148` sin decidirlo aquí.
- **El diff va en el contexto común**, junto al título y la descripción de la PR, una vez por
  petición. Si entra y cuánto (nada, la lista de ficheros o el diff entero) lo decide la pregunta 2. Si
  no entra, hay que cambiar los criterios de la pregunta, que hoy dicen *"judge the finding against the
  diff"*.

### Lo que responde Clef con cada variante (12-nov)

p media de 5 repeticiones: la probabilidad de que haya que arreglarlo en la PR. Umbral: 0,80 para
*real* y 0,20 para *no aplica*. Las filas *relanzar* deberían dar una p baja y las *real*, alta.

| Fila | Etiqueta | Actual | Paso entero | Propuesta | + ficheros | + diff |
|---|---|---|---|---|---|---|
| #112 `e2e` | relanzar | 0,476 | 0,312 | 0,380 | 0,302 | 0,311 |
| #116 `e2e` | relanzar | 0,626 | 0,679 | 0,645 | 0,611 | 0,586 |
| #117 `e2e` | relanzar | 0,432 | 0,354 | 0,321 | 0,313 | 0,242 |
| #116 `sonar-issues` | real | 0,783 | 0,783 | 0,760 | 0,734 | 0,659 |
| #117 `SonarCloud` | real | (sin pregunta) | — | 0,416 · con detalle 0,463 | 0,394 | 0,249 |
| **Tokens por llamada** | | ~2.200 | ~3.200 | ~2.300 | ~2.800 | **~28.000** |

- **El ruido es pequeño:** con el mismo contexto, la p varía como mucho 0,04 entre repeticiones, y casi
  siempre menos de 0,01. Una diferencia de más de 0,05 entre variantes es efecto del contexto.
- **Ninguna variante cruza el umbral en ninguna fila:** todas dan *exige criterio*.
- **`e2e`:** las anotaciones o el paso entero acercan la p a la etiqueta en la #112 y la #117 (de
  0,48 y 0,43 a 0,30-0,38), pero no en la #116, que se queda en torno a 0,6, del lado equivocado.
- **El diff no informa, desplaza:** baja la p de **todas** las filas, también las dos *real*, que se
  alejan de su etiqueta (SonarCloud, de 0,42 a 0,25). La separación media entre las *real* y las
  *relanzar* baja de 0,14 con la propuesta a 0,07 con el diff, y cada llamada cuesta unas 10 veces
  más. La lista de ficheros hace lo mismo, pero más suave.
- **SonarCloud da *no* con el contexto completo.** «71,4 % de cobertura en código nuevo, se exige un
  80 %» se queda en 0,42, y con el detalle por fichero sube a 0,46. Lo que le falta no parece contexto:
  el modelo no trata como defecto que una comprobación exigida no pase.
- **Lo que vio producción cuadra en la #112** (2.839 tokens y p = 0,47, igual que en la traza), **pero
  no en la #116:** allí dio p = 0,83 en el `e2e` y 0,70 en `sonar-issues`, frente a 0,63 y 0,78 aquí.
  La causa es la siguiente sección.

### Los hallazgos de un push se influyen entre sí (12-nov)

En producción, todos los hallazgos de un push van en **una** petición: el `state` lleva todos, y hay
una pregunta por cada uno. El push `b4a4734` de la #116 tuvo dos, `e2e` y `sonar-issues`, y ningún
comentario de Codex. Se repitió con los adaptadores de producción (`createFindings`,
`createDecisionModel`) y el corte de hoy, 5 veces cada caso:

| Petición | p del `e2e` (relanzar) | p de `sonar-issues` (real) |
|---|---|---|
| Cada uno solo | 0,637 | 0,779 |
| Juntos, `e2e` primero | 0,704 | 0,716 |
| Juntos, `sonar-issues` primero | **0,833** | 0,701 |
| *Producción (traza del 5-nov)* | *0,83* | *0,70* |

- **Juntos, la p de cada hallazgo se acerca a la del otro:** el `e2e` sube y `sonar-issues` baja.
  Además, **el orden importa:** con `sonar-issues` primero, el `e2e` pasa de 0,70 a 0,83.
- **El caso de producción se reproduce:** 0,83 y 0,70. Ese `e2e` cruzó el umbral y salió *real* por
  ir junto a un defecto real en la misma petición, no por su contexto. Solo, se habría quedado en
  *exige criterio*.
- **El efecto es mayor que el de cualquier variante de contexto:** hasta 0,20, frente a menos de
  0,15. Hasta que esto se resuelva, medir el contexto de un hallazgo solo tiene sentido con un hallazgo
  por petición, como en la tabla anterior.
- **Coste de separarlos:** cada petición repite el título y la descripción de la PR. En la #116, dos
  peticiones de unos 2.170 tokens frente a una de 2.594: alrededor de 0,0004 $ más por push.

### Una pregunta propia para las comprobaciones (12-nov)

Los criterios de producción se escribieron para los comentarios de un revisor («es un error, ya está
resuelto, queda fuera del alcance, es un detalle menor») y se aplican igual a las comprobaciones. Se
probó una pregunta y unos criterios propios para una comprobación que falla, con el contexto de la
propuesta y un hallazgo por petición, 3 repeticiones:

- **Pregunta:** *"Is the failure of the required check '<name>' caused by the changes in this PR?"*
- **Sí:** el fallo viene de lo que cambia la PR, o la regla de la comprobación señala algo que la PR
  añade o modifica. La comprobación es exigida: sin pasarla, la PR no se integra.
- **No:** un test intermitente o sensible a los tiempos, un *timeout*, la infraestructura o la CI, o
  código y tests que la PR no toca. Relanzarla sin cambiar la PR podría bastar.

| Fila | Etiqueta | Pregunta de hoy | Pregunta propia | Propia + ficheros |
|---|---|---|---|---|
| #112 `e2e` | relanzar | 0,380 | 0,340 | 0,251 |
| #116 `e2e` | relanzar | 0,645 | 0,622 | 0,563 |
| #117 `e2e` | relanzar | 0,321 | **0,156 · no aplica** | **0,127 · no aplica** |
| #116 `sonar-issues` | real | 0,760 | **0,944 · real** | **0,946 · real** |
| #117 `SonarCloud` | real | 0,416 | **0,812 · real** | 0,765 |

- **La separación pasa de 0,14 a 0,51:** con la pregunta propia, la media de las *real* es 0,88, y la
  de las *relanzar*, 0,37. Con la de hoy eran 0,59 y 0,45.
- **3 de las 5 filas salen con la clase correcta** sin preguntar al mantenedor, y las otras 2 se quedan
  en *exige criterio*. Ninguna sale con confianza del lado equivocado.
- **La lista de ficheros ahora sí aporta en los `e2e`:** baja las tres *relanzar*. A SonarCloud lo deja
  justo por debajo del umbral (0,77).
- **La #116 `e2e` sigue sin resolverse** (0,56-0,62). Con el error delante (`jumps`: se esperaba 0 y
  llegó 1), nada dice que sea intermitente.
- **Cuidado: los criterios se escribieron conociendo estas 5 filas.** Hay que validarlos con filas que
  no se hayan visto al escribirlos, como las de `MOO-76`, antes de darlos por buenos.
- **Un «no aplica» en una comprobación exigida no deja integrar la PR.** Si el fallo no lo causa la PR,
  lo que toca es relanzar. Ese es justo el disparador de la acción de `MOO-155`.

### Permisos del PAT

Probado el 12-nov con el PAT del sistema (*fine-grained*, con *Metadata* en lectura e *Issues* y
*Pull requests* en escritura):

| Llamada | Permiso que pide GitHub | Con el PAT |
|---|---|---|
| `GET /commits/{sha}/check-runs` | `checks=read` | 200 |
| `GET /check-runs/{id}/annotations` | `checks=read` | 200 |
| `GET /actions/jobs/{id}/logs` | (no lo dice) | 302 a la descarga |
| `GET /actions/jobs/{id}` (los pasos) | `actions=read` | 200 |

- **Leer las anotaciones no pide ningún permiso nuevo.** Funciona por lo mismo que ya funcionan hoy
  los *check runs* y el log: el repo es público, y con eso basta cualquier token.
- **El riesgo ya existe hoy y no lo trae este cambio:** si el repo pasara a privado, el triaje se
  quedaría sin *check runs* y sin logs, no solo sin anotaciones. Para no depender de eso, el PAT
  tendría que declarar *Checks* y *Actions* en lectura. Se decide en la D#.

## Cómo se hizo

Datos crudos de las 5 filas con `gh api`, en [`.spikes/moo-120/data/`](../../.spikes/moo-120/data):
el *check run*, sus anotaciones y, si es de Actions, el log del *job*.

- Hay que pedir los *check runs* con `filter=all`, o cada uno por su id. Al relanzar, GitHub da ids
  nuevos y `filter=latest` devuelve el que pasó.
- El *job* del `e2e` de la #117 es `127481356654` (run `42094639308`, primer intento).
- [`failing-step.mjs`](../../.spikes/moo-120/failing-step.mjs) reproduce el corte de `failingStep`. Da
  los 822 bytes de la traza de la #112.
- [`run.ts`](../../.spikes/moo-120/run.ts) arma una petición por fila y variante, igual que la de
  producción (mismo `state`, pregunta y criterios), con un solo hallazgo por petición, y la manda 5
  veces a `clef:27b` en la nube de Ollama. Las 120 llamadas sumaron 941.520 tokens de entrada (unos
  0,23 $). [`summarize.ts`](../../.spikes/moo-120/summarize.ts) saca la tabla de
  `out/results.jsonl`.
- El título y la descripción de cada PR son los de hoy, que pueden haber cambiado desde el push. El
  diff es el de `main...<sha>` del push.
- El detalle por fichero de SonarCloud se reconstruye del comentario de MOO-120 del 5-nov: la API de
  SonarCloud solo da el último análisis de la PR, que ya está en el 100 %. Responde sin token, porque
  el proyecto es público.

## Límites del resultado

- 5 filas, de 3 comprobaciones: `e2e`, `sonar-issues` y `SonarCloud Code Analysis`. `lint`,
  `typecheck` y `test` no tienen ninguna fila etiquetada.
- Los datos crudos se bajaron con el token de `gh` del usuario. Que el PAT del sistema lee lo mismo se
  comprobó aparte (ver *Permisos del PAT*).

## Qué sale

*Pendiente.*

## Tiempo dedicado frente al *timebox*

*Pendiente.* *Timebox:* 1 día.
