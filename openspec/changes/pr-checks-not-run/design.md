# Design

## Context

Motivación y alcance: `proposal.md`. Lo que hay hoy en `packages/pr-babysitter`:

- **El adaptador de GitHub** (`adapters/github.ts`, `checks`) lee los *check runs* del último push y,
  por cada comprobación exigida, toma el más reciente. Si no hay ninguno o no está `completed`, la
  comprobación sale `pending`: en cola, en curso y sin *check run* se leen igual.
- **La espera** (`core/tracking.ts`, `afterChecksWait`) primero decide si relanza (change
  `pr-check-rerun`). Después da las comprobaciones por terminadas solo si ninguna está `pending`
  (`checksFinished`). Si alguna falla y no hay nada que relanzar, sale `checksFailed`: estado final y
  triaje, sin esperar a la revisión. Si no, espera hasta el plazo de 30 minutos (`timedOut`), contado
  desde que vio el push o desde el relanzamiento.
- **El push que se sigue** (`TrackedPush`) guarda en el estado del grafo cuándo lo vio el sistema, cuándo
  pasaron sus comprobaciones y si se relanzó. Los plazos cuentan con la hora de la foto
  (`observedAt`), no con la de GitHub.
- **El estado final** (`finalState`) nombra las `failed` (`checksFailed`) y las `pending`
  (`checksUnfinished`, «no ha terminado …», `core/notice.ts`).
- **La CI** (`.github/workflows/ci.yml`): `lint`, `typecheck`, `test` y `e2e` empiezan a la vez;
  `sonar-issues` depende de `test` y, si `test` falla, se salta (y saltada cuenta como superada).
  *SonarCloud Code Analysis* la publica SonarCloud tras el paso de análisis del *job* `test`, que no
  espera al resultado; `sonar-issues` sí lo espera, y sigue en curso mientras tanto.

Lo medido al explorar (20-nov), con los *check runs* de la #154, #155, #160, #164, #166, #168 y #172:

```
PR en verde
lint, typecheck, test, e2e  ---------------------------->
test       ......[paso de SonarQube].............|
SonarCloud Code Analysis           termina 4-9 s ^ antes que test
sonar-issues                                       |-> empieza 2-3 s después de test

#154 (test roto)
17:50:18  test falla; sonar-issues se salta en el mismo segundo
17:51:09  e2e termina: nada en cola ni en curso, SonarCloud sin check run
          hoy: aviso a las 18:20 (plazo)    con este change: ~17:53
```

## Goals / Non-Goals

**Goals:**

- Distinguir una comprobación que no va a ejecutarse de una que aún no ha terminado, con lo que ya da
  GitHub.
- Que el aviso con un fallo llegue en minutos y diga qué no se llegó a ejecutar.
- No tocar el camino sin fallo, el plazo de 30 minutos ni el relanzamiento.

**Non-Goals:**

- Saber *por qué* no se ejecutó una comprobación (el paso que la publica, el *job* del que depende):
  basta con que no tenga *check run* cuando ya no queda nada en marcha.
- Volver a leer la PR después del estado final por si aparece algo tarde (*Risks*).

## Decisions

### 1. Una comprobación sin *check run* es `notStarted`; en cola o en curso, `pending`

El estado de una comprobación (`core/pull-request.ts`) gana un valor, `notStarted`. El adaptador de
GitHub lo da cuando no hay ningún *check run* con ese nombre en el último push. Un *check run* que no
está `completed` (en cola, en curso o esperando) sigue saliendo `pending`.

- `checksFinished` no cambia de significado: no han terminado mientras alguna esté `pending` o
  `notStarted`. Así el camino sin fallo, la espera de la revisión (`afterReviewWait`) y el escenario
  «Una comprobación exigida aún no ha empezado» siguen igual.
- La distinción vive en el adaptador, que es quien sabe qué es un *check run*; el núcleo solo ve tres
  estados de espera y fallo.

**Alternativas:**
- Un campo aparte (`hasRun: boolean`) junto a `pending`: dos campos que hay que leer juntos para saber
  algo que es un estado.
- Pedir la lista de *jobs* del workflow para saber cuáles dependen de uno fallido: solo sirve para las
  de GitHub Actions, no para *SonarCloud Code Analysis*, que es justo la que falta.

### 2. Los 2 minutos cuentan desde que el sistema ve la PR quieta

El push que se sigue gana `quietSince`: la hora de la primera foto en la que una comprobación ha
fallado, no queda nada que relanzar y ninguna está `pending`. En `afterChecksWait`, después de decidir
el relanzamiento y antes del plazo:

- si la foto está quieta y no hay `quietSince`, se guarda la hora de la foto y se sigue esperando;
- si está quieta y han pasado el margen desde `quietSince`, sale `checksFailed`;
- si no está quieta (algo ha entrado en cola o en curso, o el relanzamiento aún no ha terminado), se
  borra `quietSince`; la próxima vez que esté quieta, el margen vuelve a empezar.

Si no hay ninguna `notStarted`, la foto quieta ya es `checksFinished` y sale `checksFailed` como hoy,
sin margen. Un push nuevo no lleva `quietSince` (`pushOf`), como `rerunSince`. Una cancelada cuenta como
fallada, porque la spec ya dice que falla todo lo que no es correcto, neutro ni saltado; el
relanzamiento no la relanza (D119), así que también adelanta el aviso. El plazo de 30 minutos sigue
contando igual.

Decidido por el usuario al explorar (20-nov).

**Alternativa:** el `completed_at` de GitHub de la última comprobación terminada. No guarda estado,
pero hay que leer otro campo y comparar el reloj de GitHub con el del contenedor, mientras que los
otros dos plazos ya cuentan desde que el sistema ve el push.

### 3. El margen es de 2 minutos y se configura como el plazo

`TRACKING_NOT_RUN_MARGIN_SECONDS`, 120 por defecto, se lee en `adapters/config.ts` y llega al grafo
como `notRunMarginMs`, igual que `TRACKING_TIMEOUT_MINUTES`.

- **El hueco que cubre** dura segundos: entre que termina un *job* y entra en cola el que depende de él
  (`sonar-issues`, 2-3 s tras `test` en las 7 PR). El análisis de SonarCloud, que es asíncrono, lo
  cubre `sonar-issues`, que sigue en curso mientras lo espera.
- **Con el sondeo de 60 s**, 2 minutos son dos o tres vueltas: el aviso llega entre 2 y 3 minutos
  después de que la PR quede quieta.
- **Por qué 2 y no 1:** quedarse corto da un aviso sin el resultado de una comprobación que sí iba a
  llegar; quedarse largo, un minuto más de espera, y `docs/umbrales-para-specs.md` ya dice que un
  minuto de retraso en un aviso no cambia nada para el mantenedor.

El número y su medición van a `docs/umbrales-para-specs.md` en el primer commit, como fuente del 2 de la
spec.

### 4. Solo cambia el requisito de las comprobaciones exigidas, motivo incluido

El delta modifica «Las comprobaciones son las que exige la rama main» y nada más. Lo que nombra el
aviso va en ese mismo requisito, aunque el texto del aviso viva en «Al terminar comprobaciones y
revisión…».

El motivo: el change `pr-check-rerun` modifica «Al terminar comprobaciones y revisión…» y «Si algo no
termina en 30 minutos», y sigue sin archivar (la PR de `MOO-171`, #173, está abierta). Al archivar,
un requisito MODIFIED se reemplaza entero, así que el change que se archivara segundo borraría el
texto del primero. Con requisitos distintos, se archivan en cualquier orden.

**El motivo nuevo** (`core/tracking.ts`, `core/notice.ts`): `{ kind: 'checksNotRun', checks }`, con el
texto «no ha llegado a ejecutarse X» o «no han llegado a ejecutarse X e Y». `finalState` nombra las
`notStarted` así cuando alguna ha fallado y ninguna está `pending`; si no (el plazo vence sin fallo, o
con algo aún en marcha), siguen en `checksUnfinished`, «no ha terminado». El requisito del plazo no
cambia.

**El triaje no cambia:** `needsTriage` ya tría con `checksFailed`, así que el resumen llega con el aviso,
solo que antes.

### 5. Primer commit: el umbral y la D#

- `docs/umbrales-para-specs.md`, en *PR Babysitter*: el margen de 2 minutos, con la medición de las 7
  PR y el porqué de la decisión 3.
- `docs/idea-mood-table.md` §10, **D121**: con una comprobación que falla, el sistema deja de esperar a
  las exigidas sin *check run* cuando no queda nada en cola ni en curso y han pasado 2 minutos así,
  contados desde que lo ve; el aviso las nombra como no ejecutadas. Matiza la decisión 6 del change
  `pr-tracking` (25-oct) y lo que hoy dice el requisito.

El glosario de PB no cambia: *comprobación* y *necesita intervención* ya cubren el caso, y «no ha
llegado a ejecutarse» es el texto de un motivo, no un término nuevo.

## Risks / Trade-offs

- **[Una comprobación aparece después del margen]** (un SonarCloud que tarda más que `sonar-issues`, o
  una comprobación exigida nueva de otra app que crea su *check run* tarde) → el estado final ya está
  dado, y la PR no se vuelve a leer hasta el siguiente push. Aceptado al explorar: es el mismo caso que
  relanzar a mano después del aviso (non-goal de la historia). Si se ve, se captura.
- **[Choque con la PR de `MOO-171`]** (#173 toca `core/tracking.ts` y `core/graph.ts`) → `MOO-177` se
  implementa después de integrar la #173, partiendo de `main`; si no da tiempo, se rehace sobre ella
  antes de abrir la PR.
- **[El sondeo retrasa el aviso]** → entre 2 y 3 minutos desde que la PR queda quieta, frente a los 30
  de hoy. Bajar el margen no lo cambiaría mucho, porque manda el sondeo de 60 s.
- **[Una comprobación sin *check run* que sí iba a empezar más de 2 minutos después]** (un *runner*
  que tarda en asignarse) → GitHub crea el *check run* en cola en cuanto el *job* se encola, así que
  ese caso sale `pending` y se espera; solo un *job* que dependa de otro y tarde en encolarse caería
  aquí, y en las 7 PR fueron 2-3 s.

## Migration Plan

Sin migración: el estado del grafo gana un campo opcional (`quietSince`), y un push que ya se seguía
lo trae vacío. Al integrar, se reconstruye el contenedor del PR Babysitter desde `main` (README §2.4).
