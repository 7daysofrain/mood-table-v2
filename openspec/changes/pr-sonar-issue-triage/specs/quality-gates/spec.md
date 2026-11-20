# Spec Delta

## MODIFIED Requirements

### Requirement: Una PR contra main con incidencias nuevas de SonarQube queda en rojo
Cada PR contra `main` SHALL tener una comprobación de incidencias nuevas, que espera a que termine
el análisis de SonarQube Cloud. Si la PR tiene alguna incidencia abierta, la comprobación MUST quedar
en rojo y listar cada una (regla, fichero y línea). Una incidencia marcada como aceptada o falso
positivo en SonarQube no cuenta. Además, MUST anotar cada incidencia en su línea, con su regla, el
nombre de la regla, su severidad y su mensaje, hasta las 10 primeras, y MUST avisar del total.

> Traza: `MOO-42` («PR con una incidencia nueva de Sonar»). La tarea pedía que se pusiera en rojo el
> *quality gate*. En el plan gratuito no se puede, así que se pone en rojo una comprobación propia;
> ver `design.md`, decisión 2. Las anotaciones: `MOO-148`, para que el PR Babysitter trie cada
> incidencia (D114). Las 10 son el límite de errores por paso del runner de GitHub Actions (change
> `pr-sonar-issue-triage`, `design.md` decisión 1).

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

#### Scenario: Cada incidencia se anota en su línea
- **GIVEN** una PR contra `main` que añade 2 incidencias nuevas en ficheros distintos
- **WHEN** termina la comprobación de incidencias nuevas
- **THEN** la comprobación tiene una anotación de error en la línea de cada incidencia, con su regla, el nombre de la regla, su severidad y su mensaje
- **AND** tiene un aviso que dice que hay 2 incidencias nuevas

#### Scenario: Más incidencias de las que se anotan (asumido)
- **GIVEN** una PR contra `main` que añade 12 incidencias nuevas
- **WHEN** termina la comprobación de incidencias nuevas
- **THEN** la comprobación anota las 10 primeras
- **AND** su aviso dice que hay 12 incidencias nuevas y se anotan 10
- **AND** el log de la comprobación lista las 12

#### Scenario: Un mensaje de SonarQube no inyecta comandos en el runner (asumido)
- **GIVEN** una PR contra `main` con una incidencia nueva cuyo mensaje o ruta trae saltos de línea, `::` o `%`
- **WHEN** la comprobación anota la incidencia
- **THEN** la anotación lleva el texto escapado, en una sola línea, y el runner no ejecuta nada de él
