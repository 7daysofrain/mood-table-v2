# Spec Delta

## MODIFIED Requirements

### Requirement: Cada hallazgo sale real, no aplica o exige criterio según la probabilidad del modelo
Para cada hallazgo que no decide una regla, el sistema SHALL preguntar al modelo de decisión: por un
comentario del revisor, si hay que arreglarlo en esta PR antes de integrarla; por una comprobación que
falla, si la causa esta PR. SHALL clasificarlo por la probabilidad del sí: **real** si llega al umbral,
**no aplica** si no pasa de su complemento y **exige criterio** entre los dos. El umbral MUST ser 0,80 y
configurable. Un nit que no merece un commit MUST contar como no aplica.

> Traza: `MOO-75`, caso feliz (*su clase (real, no aplica o exige criterio)*); glosario de PB §8
> (*triaje*). *Exige criterio* cuando el sistema no lo tiene claro y los nits como *no aplica*:
> decididos por el usuario al refinar la historia y al explorar el change (28-oct), `design.md`
> decisiones 3 y 4. El 0,80 es *(asumido)*: `docs/umbrales-para-specs.md`; lo ajusta `MOO-76`.
> La pregunta según la fuente: `MOO-159`, criterio *el modelo de decisión recibe la pregunta de la
> causa y el error completo*, y non-goal *los hallazgos del revisor siguen con la pregunta de hoy*
> (`MOO-160`); D114. Una comprobación que la PR no causa sale *no aplica* hasta resolver BQ8
> (`MOO-155`): decidido al explorar el change (13-nov), `design.md` decisión 7.

#### Scenario: El modelo lo tiene claro y hay que arreglarlo
- **GIVEN** una PR que necesita intervención con un hallazgo en su último push
- **WHEN** el modelo da una probabilidad de 0,80 o más de que hay que arreglarlo en esta PR
- **THEN** el resumen da el hallazgo como real, con esa probabilidad

#### Scenario: El modelo lo tiene claro y no hay que arreglarlo
- **GIVEN** una PR que necesita intervención con un hallazgo de severidad baja en su último push
- **WHEN** el modelo da una probabilidad de 0,20 o menos de que hay que arreglarlo en esta PR
- **THEN** el resumen da el hallazgo como no aplica, con esa probabilidad

#### Scenario: El modelo no lo tiene claro
- **GIVEN** una PR que necesita intervención con un hallazgo en su último push
- **WHEN** el modelo da una probabilidad entre 0,20 y 0,80 de que hay que arreglarlo
- **THEN** el resumen da el hallazgo como exige criterio, porque la probabilidad no llega al umbral

#### Scenario: Una comprobación que falla se pregunta por la causa
- **GIVEN** una PR con la comprobación `e2e` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe la pregunta de si el fallo de `e2e` lo causa esta PR

#### Scenario: Un comentario del revisor sigue con la pregunta de hoy
- **GIVEN** una PR con un comentario del revisor en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe la pregunta de si hay que arreglarlo en esta PR antes de integrarla

### Requirement: Un hallazgo sin contexto exige criterio sin preguntar al modelo
Si el sistema no tiene lo que señala un hallazgo (el trozo de código que comenta el revisor, o el
contexto de la comprobación que falla), SHALL clasificarlo como exige criterio con ese motivo, MUST NOT
preguntar por él al modelo y MUST seguir con el resto de hallazgos. En una comprobación, el motivo MUST
distinguir si la comprobación no da contexto o si no se ha podido leer.

> Traza: BE4 (cada decisión se puede explicar). Decidido por el usuario al explorar el change `pr-shadow-triage`
> (28-oct), su `design.md` decisión 4: un modelo sin contexto juzga con la misma seguridad que con él.
> Los dos motivos de una comprobación: `MOO-159`, criterio *sin contexto, el triador no pregunta al
> modelo de decisión*; D114 (el estado del contexto separa «no tiene log» de «el log ha caducado»).

#### Scenario: La comprobación no da contexto (asumido)
- **GIVEN** una PR con una comprobación de otra app que falla y que publica un resumen vacío
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa comprobación como exige criterio, porque la comprobación no da contexto
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
- **AND** el resto de hallazgos se tría con el modelo

#### Scenario: No se puede leer el log de una comprobación que falla (asumido)
- **GIVEN** una PR con una comprobación de GitHub Actions que falla, sin anotaciones útiles, y cuyo log ha caducado
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa comprobación como exige criterio, porque no se ha podido leer su contexto
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
- **AND** el resto de hallazgos se tría con el modelo

### Requirement: El resumen del triaje es un comentario del sistema por push
El sistema SHALL publicar el triaje en un comentario de la PR que diga que es del PR Babysitter y de qué
push es, con cada hallazgo, su clase y por qué: la probabilidad frente al umbral, o la regla que lo ha
decidido; y, en una comprobación, de dónde sale su contexto y si se ha cortado. MUST publicar como mucho
uno por push; un push nuevo MUST tener el suyo, sin tocar el anterior.

> Traza: `MOO-75`, caso feliz (*la PR tiene un comentario resumen del sistema*) y criterio *un solo
> resumen por push, aunque los hallazgos lleguen en tandas*; BE4 (sus comentarios en la PR se
> identifican como del sistema); BQ2, resuelta al refinar la historia (28-oct). El porqué como la
> probabilidad frente al umbral, y un comentario nuevo por push: decididos por el usuario al explorar
> el change (28-oct), `design.md` decisiones 3 y 7. El origen del contexto: `MOO-159`, criterio *la
> decisión registra que el contexto sale de <origen>*; que vaya también en el resumen, y no solo en la
> traza, se decidió al explorar el change (13-nov), `design.md` decisión 2.

#### Scenario: El resumen se identifica y dice de qué push es
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el sistema publica su triaje
- **THEN** el comentario dice que es del PR Babysitter y a qué push se refiere

#### Scenario: Reintentar no duplica el resumen (asumido)
- **GIVEN** una PR que ya tiene el resumen del triaje de su último push
- **WHEN** el sistema vuelve a publicar el triaje de ese mismo push, tras un fallo
- **THEN** la PR sigue teniendo un solo resumen de ese push

#### Scenario: Un push nuevo tiene su propio resumen
- **GIVEN** una PR con el resumen del triaje de un push anterior
- **WHEN** el sistema tría los hallazgos de un push nuevo
- **THEN** la PR tiene un resumen nuevo para ese push y el del anterior sigue como estaba

## ADDED Requirements

### Requirement: El contexto de una comprobación que falla depende de la app que la ejecuta
Para una comprobación que falla, el sistema SHALL dar al modelo de decisión: si es de GitHub Actions,
sus anotaciones útiles, con todos sus errores, o, si no tiene ninguna, el paso del log que falla,
entero; si es de otra app, el resumen que publica. MUST cortar el contexto a 16 KiB y decir que lo ha
cortado. El resumen del triaje MUST decir de dónde sale el contexto.

> Traza: `MOO-159`, criterio *el modelo de decisión recibe la pregunta de la causa y el error
> completo*; D114. Una anotación es útil salvo un `failure` en `.github` (el genérico de «el proceso
> acabó con error») o un `notice` sin título: `docs/spikes/moo-120-contexto-triaje.md`. El paso
> entero sustituye el corte en el primer `##[error]`, que dejaba fuera el error de Playwright
> (`MOO-154`). El corte de 16 KiB para cualquier origen: decidido al explorar el change (13-nov),
> `design.md` decisión 2 *(asumido)*.

#### Scenario: Una comprobación de Actions con anotaciones útiles
- **GIVEN** una PR con la comprobación `e2e` que falla y que deja dos anotaciones de error de sus tests
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto las dos anotaciones, cada una con su fichero, su línea y su mensaje
- **AND** el resumen dice que el contexto sale de las anotaciones

#### Scenario: Una comprobación de Actions sin anotaciones útiles
- **GIVEN** una PR con la comprobación `test` que falla y cuya única anotación es el error genérico en `.github` de que el proceso acabó con error
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto el paso que falla del log, entero, incluido lo que sigue al primer error
- **AND** el resumen dice que el contexto sale del log

#### Scenario: Una comprobación de otra app
- **GIVEN** una PR con una comprobación de otra app que falla y que publica un título y un resumen
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto ese título y ese resumen
- **AND** el resumen del triaje dice que el contexto sale del resumen de la app

#### Scenario: Un contexto que no cabe se corta y lo dice (asumido)
- **GIVEN** una PR con una comprobación de Actions sin anotaciones útiles cuyo paso que falla ocupa más de 16 KiB
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe los últimos 16 KiB del paso, con la marca de que se ha cortado
- **AND** el resumen dice que el contexto se ha cortado

#### Scenario: Una comprobación que se pasa de tiempo es un hallazgo (asumido)
- **GIVEN** una PR con una comprobación que acaba por tiempo o cancelada en su último push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** la comprobación es un hallazgo más, y el modelo de decisión recibe con su contexto cómo acabó

### Requirement: Las comprobaciones deterministas salen reales por regla
Si falla una comprobación de la lista de deterministas (por defecto, `lint`, `typecheck` y
`SonarCloud Code Analysis`; configurable), el sistema SHALL clasificarla como real por esa regla, sin
preguntar al modelo de decisión, y el resumen MUST decir que la ha decidido la regla. La regla MUST
aplicarse antes que la de sin contexto y que el tope de gasto.

> Traza: `MOO-159`, criterio *una comprobación determinista sale real por regla*; D114 (fallan solo
> si algo de la PR incumple su regla). La lista configurable y la regla antes que el contexto y el
> tope: decidido al explorar el change (13-nov), `design.md` decisión 6. Que mande sobre el tope
> estaba *(asumido)* en la historia.

#### Scenario: Falla una comprobación determinista
- **GIVEN** una PR con la comprobación `lint` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla de las comprobaciones deterministas
- **AND** el modelo de decisión no recibe ninguna pregunta sobre él

#### Scenario: La regla no necesita contexto
- **GIVEN** una PR con la comprobación `typecheck` que falla y cuyo log no se puede leer
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla, y no como exige criterio

#### Scenario: La regla no gasta del tope (asumido)
- **GIVEN** una PR cuyo gasto acumulado ya ha llegado al tope, con la comprobación `SonarCloud Code Analysis` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla, y no como exige criterio por el tope

### Requirement: Cada hallazgo se pregunta al modelo de decisión en una petición propia
El sistema SHALL preguntar al modelo de decisión por cada hallazgo en una petición propia, con el
título y la descripción de la PR y sin los demás hallazgos. Si la petición de un hallazgo falla, MUST
clasificarlo como exige criterio, con el motivo de que el modelo no ha respondido, y MUST clasificar
los demás con su propia respuesta.

> Traza: `MOO-159`, criterios *cada hallazgo se pregunta al modelo de decisión por separado* y *la
> petición de un hallazgo falla y la de los demás no*; D114, que matiza D91 (en la #116, el `e2e`
> pasó de 0,64 a 0,83 por ir junto a `sonar-issues`). Lo que cobra una petición que falla suma al
> gasto de la PR: `design.md` decisión 5.

#### Scenario: Cada hallazgo va en su petición
- **GIVEN** un push con un comentario del revisor y dos comprobaciones que fallan y que pasan por el modelo de decisión
- **WHEN** el triador los tría
- **THEN** el modelo de decisión recibe tres peticiones, cada una con un solo hallazgo

#### Scenario: La petición de un hallazgo falla y la de los demás no
- **GIVEN** un push con tres hallazgos que pasan por el modelo de decisión
- **AND** el modelo de decisión no responde a la petición de uno de ellos
- **WHEN** el triador los tría
- **THEN** el resumen da ese hallazgo como exige criterio, porque el modelo de decisión no ha respondido
- **AND** los otros dos salen con la clase de su propia respuesta
