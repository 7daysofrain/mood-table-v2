# Spec Delta

## MODIFIED Requirements

### Requirement: Un único runner de tests con un informe de cobertura común
Los tests unitarios y de integración de `shared`, `engine`, `panel` y `pr-babysitter` SHALL
ejecutarse con un único runner desde la raíz, que MUST generar un único informe de cobertura con los
cuatro paquetes. Los adaptadores de hardware y las raíces de composición MUST quedar fuera del cálculo
de cobertura. Los E2E MUST ejecutarse aparte y no entrar en el informe de cobertura.

> Traza: `MOO-28` («Vitest como único runner, con cobertura», README §2.6 «un único informe de
> cobertura» y exclusiones). E2E fuera del informe: `MOO-49` («Decidir si los E2E cuentan o no en la
> cobertura de SonarQube»), decidido por el usuario el 15-oct (`design.md`, decisión 4). El cuarto
> paquete, `pr-babysitter`: `MOO-73`, DoD (*quality gate de SonarQube en verde*), `design.md` de
> `pr-tracking`, decisión 5.

#### Scenario: Se ejecutan los tests con cobertura
- **GIVEN** al menos un test en cada paquete
- **WHEN** se ejecuta desde la raíz el comando de tests con cobertura
- **THEN** se ejecutan los tests de los cuatro paquetes en una sola ejecución
- **AND** se genera un único informe de cobertura que incluye ficheros de los cuatro paquetes

#### Scenario: Código excluido de la cobertura
- **GIVEN** ficheros de los adaptadores de hardware o de una raíz de composición sin tests
- **WHEN** se genera el informe de cobertura
- **THEN** esos ficheros no aparecen en el informe ni bajan el porcentaje

#### Scenario: Los E2E no entran en la cobertura
- **GIVEN** un E2E que recorre código del panel que ningún test unitario ni de integración cubre
- **WHEN** se ejecuta desde la raíz el comando de tests con cobertura
- **THEN** no se ejecuta ningún E2E
- **AND** ese código aparece en el informe como no cubierto
