# Spec Delta

## ADDED Requirements

### Requirement: El núcleo del PR Babysitter no depende de sus adaptadores
El lint del repositorio MUST fallar cuando un fichero del núcleo de `pr-babysitter` importe un módulo
de sus adaptadores. Los adaptadores SHALL poder importar del núcleo, y solo su raíz de composición
SHALL conocer a la vez núcleo y adaptadores.

> Traza: *(asumido)*. Decidido por el usuario al explorar el change (25-oct), `design.md` decisión 5:
> el mismo patrón que el motor (D50), para que las reglas y el grafo se prueben sin GitHub ni Linear.

#### Scenario: Un fichero del núcleo del PR Babysitter importa un adaptador (asumido)
- **GIVEN** un fichero del núcleo de `pr-babysitter` que importa un módulo de sus adaptadores
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
- **AND** el informe señala ese fichero y la regla de fronteras incumplida

#### Scenario: La raíz de composición del PR Babysitter monta núcleo y adaptadores (asumido)
- **GIVEN** la raíz de composición de `pr-babysitter` importa un módulo del núcleo y uno de los adaptadores
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint no informa ningún error de fronteras

### Requirement: El PR Babysitter no importa los paquetes del producto
El lint MUST fallar cuando un fichero de `pr-babysitter` importe código de `engine`, `panel` o
`shared`. Ningún paquete del producto MUST importar de `pr-babysitter`.

> Traza: *(asumido)*. Decidido por el usuario al explorar el change (25-oct), `design.md` decisión 5:
> el PR Babysitter es herramienta de desarrollo, no producto (PB, D63), y no debe acoplarse al
> instrumento.

#### Scenario: El PR Babysitter importa de shared (asumido)
- **GIVEN** un fichero de `pr-babysitter` que importa algo que `shared` exporta
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
- **AND** el informe señala ese fichero y la regla de fronteras incumplida

#### Scenario: El motor importa del PR Babysitter (asumido)
- **GIVEN** un fichero de `engine` que importa un módulo de `pr-babysitter`
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
