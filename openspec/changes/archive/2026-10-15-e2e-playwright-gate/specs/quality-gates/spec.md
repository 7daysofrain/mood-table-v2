## MODIFIED Requirements

### Requirement: Cada PR a una rama de integración pasa lint, tipos y tests
Cada PR contra una rama de integración, cada nuevo push a esa PR y cada push a una rama de integración
SHALL disparar en GitHub Actions el lint (con la
regla de fronteras), la comprobación de tipos estricta de los tres paquetes, los tests unitarios y de
integración y los E2E. Si cualquiera falla, la comprobación de la PR MUST quedar en rojo.

> Traza: `MOO-28` («CI en GitHub Actions en cada PR: lint, tipos, tests…», README §2.4); ramas de
> integración según `linear.md` §7. E2E: `MOO-49` («Job de E2E en la CI»).

#### Scenario: Una PR introduce un error de tipos
- **GIVEN** una PR a una rama de integración con un error de tipos en cualquiera de los paquetes
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado la comprobación de tipos

#### Scenario: Una PR rompe un test
- **GIVEN** una PR a una rama de integración con un test que falla
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica qué test ha fallado

#### Scenario: Una PR rompe un E2E
- **GIVEN** una PR a una rama de integración con un E2E que falla
- **WHEN** termina la CI
- **THEN** la comprobación de los E2E está en rojo e indica qué E2E ha fallado

#### Scenario: Una PR cruza una frontera prohibida
- **GIVEN** una PR a una rama de integración que incumple una regla de `module-boundaries`
- **WHEN** termina la CI
- **THEN** la comprobación de la PR está en rojo e indica que ha fallado el lint

#### Scenario: Una PR correcta
- **GIVEN** una PR a una rama de integración sin errores de lint, tipos, tests ni E2E
- **WHEN** termina la CI
- **THEN** las comprobaciones de lint, tipos, tests y E2E están en verde

### Requirement: Las comprobaciones locales son las mismas que las de la CI
El repositorio SHALL ofrecer desde su raíz un comando para cada comprobación (lint, tipos, tests con
cobertura y E2E), y la CI MUST ejecutar esos mismos comandos, de modo que un resultado en local
predice el de la CI.

> Traza: *(asumido)*. Se deduce de `MOO-28` («que todos y la CI usen la misma versión») extendido a
> los comandos. E2E: `MOO-49` («el script `pnpm test:e2e`»; «pasa en local y en la CI»).

#### Scenario: El desarrollador reproduce la CI en local (asumido)
- **GIVEN** un clon limpio del repositorio con las dependencias y el navegador de los E2E instalados
- **WHEN** se ejecutan desde la raíz los comandos de lint, tipos, tests y E2E
- **THEN** cada uno termina con el mismo resultado (éxito o error) que el paso equivalente de la CI sobre el mismo commit

### Requirement: Un único runner de tests con un informe de cobertura común
Los tests unitarios y de integración de `shared`, `engine` y `panel` SHALL ejecutarse con un único
runner desde la raíz, que MUST generar un único informe de cobertura con los tres paquetes. Los
adaptadores de hardware y la raíz de composición MUST quedar fuera del cálculo de cobertura. Los E2E
MUST ejecutarse aparte y no entrar en el informe de cobertura.

> Traza: `MOO-28` («Vitest como único runner, con cobertura», README §2.6 «un único informe de
> cobertura» y exclusiones). E2E fuera del informe: `MOO-49` («Decidir si los E2E cuentan o no en la
> cobertura de SonarQube»), decidido por el usuario el 15-oct (`design.md`, decisión 4).

#### Scenario: Se ejecutan los tests con cobertura
- **GIVEN** al menos un test en cada paquete
- **WHEN** se ejecuta desde la raíz el comando de tests con cobertura
- **THEN** se ejecutan los tests de los tres paquetes en una sola ejecución
- **AND** se genera un único informe de cobertura que incluye ficheros de los tres paquetes

#### Scenario: Código excluido de la cobertura
- **GIVEN** ficheros de los adaptadores de hardware o de la raíz de composición sin tests
- **WHEN** se genera el informe de cobertura
- **THEN** esos ficheros no aparecen en el informe ni bajan el porcentaje

#### Scenario: Los E2E no entran en la cobertura
- **GIVEN** un E2E que recorre código del panel que ningún test unitario ni de integración cubre
- **WHEN** se ejecuta desde la raíz el comando de tests con cobertura
- **THEN** no se ejecuta ningún E2E
- **AND** ese código aparece en el informe como no cubierto

### Requirement: Una PR con comprobaciones en rojo no se integra
Cada rama de integración MUST exigir que las comprobaciones de lint, tipos, tests, E2E, *quality gate*
e incidencias nuevas de SonarQube estén en verde para integrar una PR. La de incidencias nuevas cuenta
como superada cuando no se ejecuta, porque la PR no va contra `main`.

> Traza: README §2.4 («si algo falla o no se supera el *quality gate*, el PR no se integra»),
> referenciado por `MOO-28`; incidencias nuevas, `MOO-42` («la PR no se puede integrar»); E2E,
> `MOO-49` («una PR con el E2E en rojo no se puede integrar»); ramas de integración según
> `linear.md` §7.

#### Scenario: Intento de integrar una PR en rojo
- **GIVEN** una PR a una rama de integración con alguna comprobación obligatoria en rojo
- **WHEN** se intenta integrar
- **THEN** GitHub no permite la integración

#### Scenario: Intento de integrar una PR con el E2E en rojo
- **GIVEN** una PR a una rama de integración con lint, tipos, tests y SonarQube en verde y la comprobación de los E2E en rojo
- **WHEN** se intenta integrar
- **THEN** GitHub no permite la integración

## ADDED Requirements

### Requirement: Los E2E se ejecutan en un navegador real sobre el build del panel
El repositorio SHALL ofrecer desde su raíz un comando que construya el panel, lo sirva y ejecute los
E2E en un navegador real contra ese build de producción, no contra el servidor de desarrollo. Ese
comando MUST funcionar sin ningún paso previo salvo instalar el navegador una vez. Cuando un E2E falla, el
resultado MUST conservar lo necesario para ver por qué.

> Traza: `MOO-49` («Playwright…, su configuración y el script `pnpm test:e2e`»; «un primer E2E de
> humo que no necesite el motor… sobre el build del panel»; «`pnpm test:e2e` pasa en local y en la
> CI»).

#### Scenario: El desarrollador lanza los E2E
- **GIVEN** un clon del repositorio con las dependencias y el navegador de los E2E instalados, y sin el panel construido
- **WHEN** se ejecuta desde la raíz el comando de los E2E
- **THEN** se construye el panel, se sirve y se abre en el navegador
- **AND** el E2E de humo comprueba el escenario *Se abre el panel* de `panel-layout` y termina en verde

#### Scenario: El E2E de humo detecta un panel roto
- **GIVEN** un cambio que hace que el panel construido no muestre una de sus zonas
- **WHEN** se ejecuta el comando de los E2E
- **THEN** el E2E de humo falla e indica qué zona no ha encontrado

#### Scenario: Un E2E falla en la CI (asumido)
- **GIVEN** una PR con un E2E que falla
- **WHEN** termina la CI
- **THEN** el informe de los E2E, con la traza del navegador del E2E que ha fallado, se puede descargar desde la ejecución de la CI
