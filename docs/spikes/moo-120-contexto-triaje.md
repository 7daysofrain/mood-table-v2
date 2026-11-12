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

*Pendiente.*

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

## Límites del resultado

- 5 filas, de 3 comprobaciones: `e2e`, `sonar-issues` y `SonarCloud Code Analysis`. `lint`,
  `typecheck` y `test` no tienen ninguna fila etiquetada.
- Los datos crudos se bajaron con el token de `gh` del usuario. Que el PAT del sistema lee lo mismo se
  comprobó aparte (ver *Permisos del PAT*).

## Qué sale

*Pendiente.*

## Tiempo dedicado frente al *timebox*

*Pendiente.* *Timebox:* 1 día.
