# Spec Delta

## ADDED Requirements

### Requirement: Volver a un efecto recupera los valores con que lo dejó
Cuando una tira vuelve a un efecto que ya había tenido, SHALL pintarlo con los valores que tenía al
salir de él, desde el primer frame, y los controles MUST mostrar esos valores, también si el panel se
ha vuelto a abrir entretanto. Vale para cualquier efecto con parámetros. Lo que vuelve son los
valores, no la memoria del efecto: el efecto puede empezar de nuevo.

> Traza: criterios *Volver a un efecto recupera sus valores* y *Los valores se recuperan aunque el
> panel se haya vuelto a abrir* de `MOO-96`. *Cualquier efecto con parámetros* y que la memoria no
> vuelve: nota de los criterios y non-goal de la historia. El primer frame es *(asumido)*: pregunta
> del contexto técnico de `MOO-96` (`design.md`, decisión 2).

#### Scenario: Volver a un efecto recupera sus valores
- **GIVEN** una tira con la respiración, a la que el DJ ha cambiado el color y el periodo
- **AND** el DJ ha cambiado esa tira a la energía
- **WHEN** el DJ vuelve a la respiración en esa tira
- **THEN** la tira respira en el visor con el color y el periodo que dejó
- **AND** los controles muestran ese color y ese periodo, no los valores por defecto

#### Scenario: Los valores se recuperan aunque el panel se haya vuelto a abrir
- **GIVEN** una tira con la respiración, a la que el DJ ha cambiado el color y el periodo
- **AND** el DJ ha cambiado esa tira a la energía
- **AND** el panel se ha vuelto a abrir
- **WHEN** el DJ vuelve a la respiración en esa tira
- **THEN** la tira respira con el color y el periodo que dejó
- **AND** los controles muestran ese color y ese periodo

#### Scenario: El primer frame tras volver ya lleva los valores recuperados (asumido)
- **GIVEN** una tira con la respiración en azul, que el DJ ha cambiado a la energía
- **WHEN** el DJ vuelve a la respiración en esa tira
- **THEN** el primer frame de la respiración en esa tira ya es azul, sin pasar por el blanco cálido
  por defecto

### Requirement: Cada tira guarda los valores de cada efecto
Los valores que se recuperan al volver a un efecto SHALL ser los de esa tira: cambiar los valores o el
efecto de una tira MUST NOT cambiar los que guarda otra. Un efecto que nunca se ha elegido en una tira
MUST empezar en ella con sus valores por defecto, aunque otra tira tenga otros.

> Traza: criterios *Cada tira recupera sus propios valores* y *La primera vez que se elige un efecto
> en una tira, tiene sus valores por defecto* de `MOO-96`, y E4 (*cada una con su efecto y sus
> valores*).

#### Scenario: Cada tira recupera sus propios valores
- **GIVEN** dos tiras, A y B, con la respiración y valores distintos
- **AND** el DJ ha cambiado las dos a la energía
- **WHEN** el DJ vuelve a la respiración en la tira B
- **THEN** B respira con sus valores, no con los de A

#### Scenario: La primera vez que se elige un efecto en una tira, tiene sus valores por defecto
- **GIVEN** dos tiras, A y B, con la energía
- **AND** el DJ ya ha usado la respiración en A y le ha cambiado el color y el periodo
- **WHEN** el DJ elige la respiración en B por primera vez
- **THEN** B respira con el color y el periodo por defecto, no con los de A
