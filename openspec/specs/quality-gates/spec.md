# quality-gates Specification

## Purpose

Define las comprobaciones automáticas que todo cambio debe superar antes de integrarse en una **rama
de integración** (lint, tipos, tests, cobertura y *quality gate* de SonarQube) y garantiza que el
entorno local y la CI usan las mismas herramientas en las mismas versiones. Son ramas de integración
`main`, adonde van las PR de las tareas, y las ramas de entrega `feature/entrega-*`, que solo reciben
la foto de `main` al cerrar cada entrega (`linear.md` §7). Incluye también las puertas de revisión:
la de Copilot y los hilos sin resolver.

## Requirements

### Requirement: Cada PR a una rama de integración pasa lint, tipos y tests
Cada PR contra una rama de integración, cada nuevo push a esa PR y cada push a una rama de integración
SHALL disparar en GitHub Actions el lint (con la
regla de fronteras), la comprobación de tipos estricta de los tres paquetes y los tests. Si cualquiera
falla, la comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («CI en GitHub Actions en cada PR: lint, tipos, tests…», README §2.4); ramas de
> integración según `linear.md` §7.

#### Scenario: Una PR introduce un error de tipos
- **GIVEN** una PR a una rama de integración con un error de tipos en cualquiera de los paquetes
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado la comprobación de tipos

#### Scenario: Una PR rompe un test
- **GIVEN** una PR a una rama de integración con un test que falla
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica qué test ha fallado

#### Scenario: Una PR cruza una frontera prohibida
- **GIVEN** una PR a una rama de integración que incumple una regla de `module-boundaries`
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado el lint

#### Scenario: Una PR correcta
- **GIVEN** una PR a una rama de integración sin errores de lint, tipos ni tests
- **WHEN** termina la CI
- **THEN** las comprobaciones de lint, tipos y tests están en verde

### Requirement: Las comprobaciones locales son las mismas que las de la CI
El repositorio SHALL ofrecer desde su raíz un comando para cada comprobación (lint, tipos y tests con
cobertura), y la CI MUST ejecutar esos mismos comandos, de modo que un resultado en local predice el
de la CI.

> Traza: *(asumido)*. Se deduce de `MOO-28` («que todos y la CI usen la misma versión») extendido a
> los comandos.

#### Scenario: El desarrollador reproduce la CI en local (asumido)
- **GIVEN** un clon limpio del repositorio con las dependencias instaladas
- **WHEN** se ejecutan desde la raíz los comandos de lint, tipos y tests
- **THEN** cada uno termina con el mismo resultado (éxito o error) que el paso equivalente de la CI sobre el mismo commit

### Requirement: Un único runner de tests con un informe de cobertura común
Los tests de `shared`, `engine` y `panel` SHALL ejecutarse con un único runner desde la raíz, que MUST
generar un único informe de cobertura con los tres paquetes. Los adaptadores de hardware y la raíz de
composición MUST quedar fuera del cálculo de cobertura.

> Traza: `MOO-28` («Vitest como único runner, con cobertura», README §2.6 «un único informe de
> cobertura» y exclusiones).

#### Scenario: Se ejecutan los tests con cobertura
- **GIVEN** al menos un test en cada paquete
- **WHEN** se ejecuta desde la raíz el comando de tests con cobertura
- **THEN** se ejecutan los tests de los tres paquetes en una sola ejecución
- **AND** se genera un único informe de cobertura que incluye ficheros de los tres paquetes

#### Scenario: Código excluido de la cobertura
- **GIVEN** ficheros de los adaptadores de hardware o de la raíz de composición sin tests
- **WHEN** se genera el informe de cobertura
- **THEN** esos ficheros no aparecen en el informe ni bajan el porcentaje

### Requirement: El quality gate de SonarQube Cloud bloquea cada PR a una rama de integración
Cada PR a una rama de integración SHALL analizarse en SonarQube Cloud con el informe de cobertura de
los tests, tomando como código nuevo lo que la PR añade respecto a su rama destino. Si no supera el *quality gate* (que exige ≥ 80 % de cobertura en código nuevo), la
comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («análisis de SonarQube Cloud con su *quality gate*»); umbral de README §2.6.
> PR de una tarea contra `main`: `MOO-42` («PR limpia contra main»).

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

### Requirement: Versiones de la cadena de herramientas fijadas en el repositorio
El repositorio SHALL fijar las versiones de Node.js, pnpm y el CLI de OpenSpec, y la CI MUST usar esas
mismas versiones. El CLI de OpenSpec MUST poder ejecutarse desde el repositorio sin instalación global.

> Traza: `MOO-28` («CLI de OpenSpec fijado como dependencia de desarrollo (hoy 1.14.0)… para que todos
> y la CI usen la misma versión»). Node.js y pnpm: *(asumido)*, misma razón.

#### Scenario: El CLI de OpenSpec del repositorio
- **GIVEN** un clon del repositorio con las dependencias instaladas y sin OpenSpec instalado en global
- **WHEN** se ejecuta el CLI de OpenSpec a través del gestor de paquetes del repositorio
- **THEN** responde con la versión `1.14.0`

#### Scenario: Node.js o pnpm en otra versión (asumido)
- **GIVEN** un entorno local con una versión de pnpm distinta de la fijada
- **WHEN** se instalan las dependencias
- **THEN** se usa la versión fijada o la instalación avisa del desajuste

### Requirement: Las dependencias se vigilan automáticamente
El repositorio SHALL tener Dependabot activo para las dependencias de npm y las acciones de GitHub
Actions, de modo que abra PRs de actualización contra `main` (la rama por defecto) que pasen por las
mismas comprobaciones que cualquier otra PR.

> Traza: `MOO-28` («Dependabot activado», README §2.5). GitHub solo lee la configuración de
> Dependabot en la rama por defecto: se activa cuando la entrega que la contiene llega a `main`.

#### Scenario: Una dependencia queda desactualizada
- **GIVEN** una dependencia de npm o una acción de GitHub con una versión nueva publicada
- **WHEN** se ejecuta la revisión programada de Dependabot
- **THEN** se abre una PR de actualización a `main`
- **AND** la CI ejecuta sobre ella lint, tipos, tests y *quality gate*
