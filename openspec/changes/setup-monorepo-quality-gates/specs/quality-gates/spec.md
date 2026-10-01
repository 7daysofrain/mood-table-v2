# Spec Delta

## Purpose

Define las comprobaciones automáticas que todo cambio debe superar antes de integrarse en `main`
(lint, tipos, tests, cobertura y *quality gate* de SonarQube) y garantiza que el entorno local y la CI
usan las mismas herramientas en las mismas versiones.

## ADDED Requirements

### Requirement: Cada PR a main pasa lint, tipos y tests
Cada PR contra `main`, y cada nuevo push a ella, SHALL disparar en GitHub Actions el lint (con la
regla de fronteras), la comprobación de tipos estricta de los tres paquetes y los tests. Si cualquiera
falla, la comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («CI en GitHub Actions en cada PR: lint, tipos, tests…», README §2.4).

#### Scenario: Una PR introduce un error de tipos
- **GIVEN** una PR a `main` con un error de tipos en cualquiera de los paquetes
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado la comprobación de tipos

#### Scenario: Una PR rompe un test
- **GIVEN** una PR a `main` con un test que falla
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica qué test ha fallado

#### Scenario: Una PR cruza una frontera prohibida
- **GIVEN** una PR a `main` que incumple una regla de `module-boundaries`
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado el lint

#### Scenario: Una PR correcta
- **GIVEN** una PR a `main` sin errores de lint, tipos ni tests
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

### Requirement: El quality gate de SonarQube Cloud bloquea la PR
Cada PR a `main` SHALL analizarse en SonarQube Cloud con el informe de cobertura de los tests. Si el
código nuevo de la PR no supera el *quality gate* (que exige ≥ 80 % de cobertura en código nuevo), la
comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («análisis de SonarQube Cloud con su *quality gate*»); umbral de README §2.6.

#### Scenario: Código nuevo con cobertura insuficiente
- **GIVEN** una PR a `main` cuyo código nuevo tiene menos del 80 % de cobertura
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación del *quality gate* de la PR está en rojo

#### Scenario: Código nuevo que supera el quality gate
- **GIVEN** una PR a `main` cuyo código nuevo cumple todas las condiciones del *quality gate*
- **WHEN** termina el análisis de SonarQube Cloud
- **THEN** la comprobación del *quality gate* de la PR está en verde
- **AND** la cobertura que muestra SonarQube coincide con la del informe de los tests

### Requirement: Una PR con comprobaciones en rojo no se integra
La rama `main` MUST exigir que las comprobaciones de lint, tipos, tests y *quality gate* estén en verde
para integrar una PR.

> Traza: README §2.4 («si algo falla o no se supera el *quality gate*, el PR no se integra»),
> referenciado por `MOO-28`.

#### Scenario: Intento de integrar una PR en rojo
- **GIVEN** una PR a `main` con alguna comprobación obligatoria en rojo
- **WHEN** se intenta integrar
- **THEN** GitHub no permite la integración

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
Actions, de modo que abra PRs de actualización que pasen por las mismas comprobaciones que cualquier
otra PR.

> Traza: `MOO-28` («Dependabot activado», README §2.5).

#### Scenario: Una dependencia queda desactualizada
- **GIVEN** una dependencia de npm o una acción de GitHub con una versión nueva publicada
- **WHEN** se ejecuta la revisión programada de Dependabot
- **THEN** se abre una PR de actualización a `main`
- **AND** la CI ejecuta sobre ella lint, tipos, tests y *quality gate*
