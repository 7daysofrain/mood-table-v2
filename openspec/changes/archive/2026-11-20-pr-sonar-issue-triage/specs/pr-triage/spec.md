# Spec Delta

## MODIFIED Requirements

### Requirement: El sistema tría los hallazgos del último push cuando la PR necesita intervención
Cuando el sistema va a avisar de que una PR «necesita intervención» y su último push tiene hallazgos,
SHALL triarlos antes del aviso. Los hallazgos MUST ser los comentarios del revisor sobre ese push, las
comprobaciones que fallan en él y, en lugar de la comprobación de incidencias nuevas de SonarQube, cada
incidencia que anota; y nada más. Una PR «lista para integrar», o que necesita intervención sin
hallazgos (algo no termina a tiempo), MUST NOT triarse.

> Traza: `MOO-75`, caso feliz (*el sistema tría en modo sombra los hallazgos del último push*) y
> criterio *una comprobación que falla se tría como un hallazgo más*; glosario de PB §8 (*hallazgo*).
> Triar justo antes del aviso final, cuando ya están todos los hallazgos del push: decidido por el
> usuario al explorar el change `pr-shadow-triage` (28-oct), su `design.md` decisión 1. Cada
> incidencia en lugar de la comprobación: `MOO-148`, caso feliz; D114.

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la PR tiene un comentario resumen del sistema con cada comentario del revisor sobre ese push, su clase y por qué

#### Scenario: Una comprobación que falla es un hallazgo más
- **GIVEN** el sistema sigue una PR y una comprobación de su último push falla
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la comprobación que falla aparece en el resumen con su clase y por qué, como cualquier otro hallazgo

#### Scenario: Sin hallazgos no hay triaje (asumido)
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor revisa sin hallazgos
- **WHEN** el sistema avisa de que está «lista para integrar»
- **THEN** la PR no tiene comentario resumen de ese push

## ADDED Requirements

### Requirement: Cada incidencia nueva de SonarQube se tría como un hallazgo propio
Si falla la comprobación de incidencias nuevas de SonarQube, el sistema SHALL triar cada incidencia que
anota como un hallazgo propio, con su fichero y su línea, y MUST NOT triar la comprobación entera. El
modelo de decisión MUST recibir cada incidencia en una petición propia, con la pregunta de si su regla
se cumple en ese código y con el código alrededor de su línea en el commit del push.

> Traza: `MOO-148`, caso feliz (*cada incidencia nueva de SonarQube se tría como un hallazgo propio*).
> La pregunta de la premisa de la regla y el código como contexto: decidido al refinar la historia
> (20-nov), con una prueba de 12 filas contra Clef (7 de 12 con código, 5 sin él, ninguna con confianza
> del lado equivocado); `design.md` decisiones 3 y 4. Que el resumen muestre la clase de cada una es
> *(asumido)* en la historia.

#### Scenario: Una incidencia nueva de SonarQube
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 1 incidencia nueva de SonarQube
- **WHEN** el triador tría los hallazgos del último push
- **THEN** la incidencia es un hallazgo, con su fichero y su línea, y la comprobación no lo es
- **AND** el modelo de decisión recibe la pregunta de si su regla se cumple en ese código, con el código alrededor de su línea
- **AND** el resumen muestra la incidencia con su clase y por qué

#### Scenario: Dos incidencias nuevas de SonarQube
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 2 incidencias nuevas de SonarQube en ficheros distintos
- **WHEN** el triador tría los hallazgos del último push
- **THEN** cada incidencia es un hallazgo propio, con su fichero y su línea
- **AND** el modelo de decisión recibe cada una en una petición propia, sin la otra
- **AND** el resumen muestra cada una con su propia clase

### Requirement: Una incidencia nueva de SonarQube sale real, no aplica o exige criterio según si su regla se cumple
El sistema SHALL clasificar una incidencia nueva de SonarQube por la probabilidad de que su regla se
cumpla en ese código: **real** si llega al umbral, **no aplica** si no pasa de su complemento y **exige
criterio** entre los dos, con el umbral de siempre. Cuando sale no aplica, el resumen MUST decir que la
incidencia se aceptaría en SonarQube, con esa probabilidad.

> Traza: `MOO-148`, criterio *una incidencia cuya regla no se cumple en ese código sale no aplica*. Que
> salga *no aplica* y no *exige criterio* es *(asumido)* hasta resolver BQ9 (PB §7): aceptar una
> incidencia es motivo para escalar (PB §4.1). El umbral: `docs/umbrales-para-specs.md`.

#### Scenario: El código tiene el problema que describe la regla
- **GIVEN** una PR con una incidencia nueva de SonarQube en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como real, con esa probabilidad

#### Scenario: Seguir la regla rompería lo que el código debe hacer
- **GIVEN** una PR con una incidencia nueva de SonarQube cuyo código muestra que seguir la regla rompería lo que el código debe hacer
- **WHEN** el modelo de decisión da una probabilidad de 0,20 o menos de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como no aplica, con esa probabilidad
- **AND** dice que la incidencia se aceptaría en SonarQube

#### Scenario: El modelo no lo tiene claro
- **GIVEN** una PR con una incidencia nueva de SonarQube en su último push
- **WHEN** el modelo de decisión da una probabilidad entre 0,20 y 0,80 de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como exige criterio, porque la probabilidad no llega al umbral

### Requirement: Descartar una incidencia de SonarQube de severidad alta exige criterio
Si el modelo de decisión daría como no aplica una incidencia nueva de SonarQube de severidad alta, el
sistema SHALL clasificarla como exige criterio, por la regla de severidad alta, y el resumen MUST NOT
decir que se aceptaría en SonarQube. Severidad alta MUST ser `BLOCKER` o `HIGH` en SonarQube.

> Traza: `MOO-148`, criterio *una incidencia de severidad alta que se descartaría exige criterio*;
> política de escalado de PB §4.1 (*descarta un hallazgo de severidad alta*). Que sean `BLOCKER` o
> `HIGH` es *(asumido)* en la historia: son las dos más altas de los *impacts* de SonarQube.

#### Scenario: El modelo descartaría una incidencia bloqueante
- **GIVEN** una PR con una incidencia nueva de SonarQube de severidad `BLOCKER` en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,20 o menos de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como exige criterio, por la regla de severidad alta
- **AND** no dice que se aceptaría en SonarQube

#### Scenario: Una incidencia de severidad alta que se cumple es real
- **GIVEN** una PR con una incidencia nueva de SonarQube de severidad `HIGH` en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como real

### Requirement: Una incidencia sin código legible exige criterio sin preguntar al modelo
Si el sistema no puede leer el código de una incidencia nueva de SonarQube en el commit del push, SHALL
clasificarla como exige criterio con ese motivo, MUST NOT preguntar por ella al modelo de decisión y
MUST triar el resto de hallazgos.

> Traza: `MOO-148`, criterio *una incidencia sin contexto legible exige criterio* (fila *el código de
> una incidencia no se puede leer en el commit del push*). Mismo principio que *un hallazgo sin
> contexto exige criterio*: un modelo sin contexto juzga con la misma seguridad que con él.

#### Scenario: La línea de la incidencia no está en el fichero
- **GIVEN** una PR con dos incidencias nuevas de SonarQube, una de ellas en una línea que no existe en el fichero del commit del push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa incidencia como exige criterio, porque no se ha podido leer su código
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
- **AND** la otra incidencia se tría con el modelo

#### Scenario: GitHub no da el fichero (asumido)
- **GIVEN** una PR con una incidencia nueva de SonarQube cuyo fichero GitHub no devuelve en el commit del push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa incidencia como exige criterio, porque no se ha podido leer su código

### Requirement: La comprobación de incidencias nuevas sin incidencias legibles exige criterio
Si la comprobación de incidencias nuevas de SonarQube falla sin anotar ninguna incidencia legible, el
sistema SHALL triar la comprobación entera como un hallazgo, clasificarla como exige criterio con ese
motivo y MUST NOT preguntar por ella al modelo de decisión.

> Traza: `MOO-148`, criterio *una incidencia sin contexto legible exige criterio* (fila *la
> comprobación no lista ninguna incidencia legible*), y glosario de PB §8 (*hallazgo*: la comprobación,
> solo cuando no lista ninguna).

#### Scenario: El análisis de SonarQube no termina a tiempo
- **GIVEN** una PR cuya comprobación `sonar-issues` falla porque el análisis no ha terminado, sin anotar ninguna incidencia
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da la comprobación como exige criterio, porque no anota ninguna incidencia legible
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella

### Requirement: El resumen dice si la comprobación trae más incidencias de las triadas
Si la comprobación de incidencias nuevas de SonarQube trae más incidencias de las que anota, el sistema
SHALL triar cada incidencia anotada como un hallazgo propio, y el resumen MUST decir cuántas trae la
comprobación y cuántas se han triado.

> Traza: `MOO-148`, criterio *la comprobación trae más incidencias de las que puede listar*. Que el
> resumen dé las dos cifras es *(asumido)* en la historia. Cuántas anota: `quality-gates`, requisito
> *una PR contra main con incidencias nuevas de SonarQube queda en rojo*.

#### Scenario: Doce incidencias nuevas (asumido)
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 12 incidencias nuevas de SonarQube, de las que anota 10
- **WHEN** el triador tría los hallazgos del último push
- **THEN** cada una de las 10 incidencias anotadas es un hallazgo propio
- **AND** el resumen dice que la comprobación trae 12 incidencias y se han triado 10
