# Spec Delta

## REMOVED Requirements

### Requirement: Copilot revisa cada PR sin que nadie lo pida
**Reason**: Copilot agotaba la cuota del plan y las PR se quedaban sin revisión (`MOO-50`). El 22-oct
se sustituye por Codex (`MOO-66`).
**Migration**: La revisión automática la hace Codex: requisito «Codex revisa cada PR sin que nadie lo
pida». La regla `copilot_code_review` sale del *ruleset*.

### Requirement: Una PR con hilos de revisión sin resolver no se integra
**Reason**: Su escenario nombra a Copilot, que ya no revisa (`MOO-66`), y un escenario no se puede
renombrar dentro de un MODIFIED. El comportamiento no cambia.
**Migration**: Requisito «Ninguna PR se integra con hilos de revisión sin resolver», con el escenario
«Hilo de Codex sin resolver».

## ADDED Requirements

### Requirement: Codex revisa cada PR sin que nadie lo pida
Cada PR a una rama de integración que no sea borrador SHALL recibir automáticamente una revisión de
Codex al abrirse y en cada push.

> Traza: `MOO-66` (descripción de la tarea: «revisa cada PR al abrirse y en cada push»).

#### Scenario: Revisión automática de Codex
- **GIVEN** una PR nueva contra `main` que no es borrador
- **WHEN** se abre o recibe un push
- **THEN** Codex la revisa sin que nadie lo pida

#### Scenario: PR en borrador (asumido)
- **GIVEN** una PR en borrador contra `main`
- **WHEN** recibe un push
- **THEN** Codex no la revisa hasta que se marca como lista para revisar

### Requirement: Ninguna PR se integra con hilos de revisión sin resolver
Cada rama de integración MUST impedir que se integre una PR mientras tenga algún hilo de revisión sin
resolver, incluidos los de Codex.

> Traza: `MOO-42` («Hilo de Copilot sin resolver»); el revisor pasa a Codex en `MOO-66` («sus
> hallazgos son hilos que bloquean la integración por la regla de hilos resueltos»).

#### Scenario: Hilo de Codex sin resolver
- **GIVEN** una PR con todas las comprobaciones en verde y un hilo de Codex sin resolver
- **WHEN** se intenta integrar
- **THEN** GitHub no deja integrarla
- **AND** al resolver el hilo sí deja
