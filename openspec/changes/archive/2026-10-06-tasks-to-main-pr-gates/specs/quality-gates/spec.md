## MODIFIED Requirements

### Requirement: Una PR con comprobaciones en rojo no se integra
Cada rama de integración MUST exigir que las comprobaciones de lint, tipos, tests, *quality gate* e
incidencias nuevas de SonarQube estén en verde para integrar una PR. La de incidencias nuevas cuenta
como superada cuando no se ejecuta, porque la PR no va contra `main`.

> Traza: README §2.4 («si algo falla o no se supera el *quality gate*, el PR no se integra»),
> referenciado por `MOO-28`; incidencias nuevas, `MOO-42` («la PR no se puede integrar»); ramas de
> integración según `linear.md` §7.

#### Scenario: Intento de integrar una PR en rojo
- **GIVEN** una PR a una rama de integración con alguna comprobación obligatoria en rojo
- **WHEN** se intenta integrar
- **THEN** GitHub no permite la integración

## ADDED Requirements

### Requirement: El quality gate de SonarQube Cloud bloquea cada PR a una rama de integración
Cada PR a una rama de integración SHALL analizarse en SonarQube Cloud con el informe de cobertura de
los tests, tomando como código nuevo lo que la PR añade respecto a su rama destino. Si no supera el *quality gate* (que exige ≥ 80 % de cobertura en código nuevo), la
comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («análisis de SonarQube Cloud con su *quality gate*»); umbral de README §2.6.
> PR de una tarea contra `main`: `MOO-42` («PR limpia contra main»). Sustituye al requisito «El
> quality gate de SonarQube Cloud bloquea la PR», sin el escenario de las PR de las tareas contra la
> rama de entrega.

#### Scenario: Código nuevo con cobertura insuficiente
- **GIVEN** una PR a una rama de integración cuyo código nuevo tiene menos del 80 % de cobertura
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación del *quality gate* de la PR está en rojo

#### Scenario: Código nuevo que supera el quality gate
- **GIVEN** una PR a una rama de integración cuyo código nuevo cumple todas las condiciones del *quality gate*
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación del *quality gate* de la PR está en verde
- **AND** la cobertura que muestra SonarQube coincide con la del informe de los tests

#### Scenario: PR limpia de una tarea contra main
- **GIVEN** una PR de una tarea contra `main` sin incidencias nuevas de SonarQube
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación del *quality gate* y la de incidencias nuevas están en verde
- **AND** las incidencias y la cobertura de la PR se pueden consultar en SonarQube Cloud, en la web y por su API


### Requirement: Las PR de las tareas van contra main y la rama de entrega es una foto de main
Las PR de las tareas, las de archivado de OpenSpec y las de Dependabot SHALL ir contra `main`.
Una rama de entrega (`feature/entrega-*`) MUST recibir trabajo solo mediante una PR desde `main` al
cerrar la entrega. Esa PR pasa las mismas comprobaciones, y al integrarla el contenido de la rama de
entrega coincide con el de `main`.

> Traza: `MOO-42` («Cierre de una entrega», «El agente sabe a qué rama va una tarea»).

#### Scenario: Cierre de una entrega
- **GIVEN** `main` con el trabajo de la entrega integrado
- **WHEN** se abre la PR de `main` a `feature/entrega-N-JA`
- **THEN** pasa las mismas comprobaciones obligatorias que cualquier otra PR a una rama de integración
- **AND** al integrarla no hay diferencias de contenido entre `feature/entrega-N-JA` y `main`
- **AND** el enlace `…/tree/feature/entrega-N-JA` de esa rama es el que se envía en el Typeform

#### Scenario: El agente sabe a qué rama va una tarea
- **GIVEN** una sesión nueva de Claude Code sin el contexto de esta tarea
- **WHEN** se le pregunta a qué rama va la PR de una tarea
- **THEN** responde `main`, citando `linear.md` §7

### Requirement: Una PR contra main con incidencias nuevas de SonarQube queda en rojo
Cada PR contra `main` SHALL tener una comprobación de incidencias nuevas, que espera a que termine
el análisis de SonarQube Cloud. Si la PR tiene alguna incidencia abierta, la comprobación MUST quedar
en rojo y listar cada una (regla, fichero y línea). Una incidencia marcada como aceptada o falso
positivo en SonarQube no cuenta.

> Traza: `MOO-42` («PR con una incidencia nueva de Sonar»). La tarea pedía que se pusiera en rojo el
> *quality gate*. En el plan gratuito no se puede, así que se pone en rojo una comprobación propia;
> ver `design.md`, decisión 2.

#### Scenario: PR con una incidencia nueva de SonarQube
- **GIVEN** una PR contra `main` que añade al menos una incidencia nueva
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación de incidencias nuevas está en rojo y lista cada incidencia
- **AND** la PR no se puede integrar

#### Scenario: Incidencia aceptada en SonarQube (asumido)
- **GIVEN** una PR contra `main` cuya única incidencia nueva se ha marcado como aceptada en SonarQube Cloud, con el motivo de por qué no aplica
- **WHEN** se vuelve a ejecutar la comprobación de incidencias nuevas
- **THEN** la comprobación está en verde

#### Scenario: Análisis que no termina a tiempo (asumido)
- **GIVEN** una PR contra `main` cuyo análisis en SonarQube Cloud no termina en el tiempo de espera de la comprobación
- **WHEN** vence la espera
- **THEN** la comprobación de incidencias nuevas está en rojo e indica que el análisis no ha terminado, no que no haya incidencias

### Requirement: Copilot revisa cada PR sin que nadie lo pida
Cada PR a una rama de integración que no sea borrador SHALL recibir automáticamente una revisión de
GitHub Copilot al abrirse y en cada push.

> Traza: `MOO-42` («Revisión automática de Copilot»).

#### Scenario: Revisión automática de Copilot
- **GIVEN** una PR nueva contra `main` que no es borrador
- **WHEN** se abre o recibe un push
- **THEN** Copilot la revisa sin que nadie lo pida

#### Scenario: PR en borrador (asumido)
- **GIVEN** una PR en borrador contra `main`
- **WHEN** recibe un push
- **THEN** Copilot no la revisa hasta que se marca como lista para revisar

### Requirement: Una PR con hilos de revisión sin resolver no se integra
Cada rama de integración MUST impedir que se integre una PR mientras tenga algún hilo de revisión sin
resolver, incluidos los de Copilot.

> Traza: `MOO-42` («Hilo de Copilot sin resolver»).

#### Scenario: Hilo de Copilot sin resolver
- **GIVEN** una PR con todas las comprobaciones en verde y un hilo de Copilot sin resolver
- **WHEN** se intenta integrar
- **THEN** GitHub no deja integrarla
- **AND** al resolver el hilo sí deja

## REMOVED Requirements

### Requirement: El quality gate de SonarQube Cloud bloquea la PR
**Reason**: Su escenario «PR de una tarea contra la rama de entrega» ya no aplica: las PR de las tareas
van contra `main` (`MOO-42`). OpenSpec no deja quitar un escenario con MODIFIED.
**Migration**: Lo sustituye «El quality gate de SonarQube Cloud bloquea cada PR a una rama de
integración», con el mismo texto y los mismos escenarios, salvo ese, que pasa a ser «PR limpia de una
tarea contra main».
