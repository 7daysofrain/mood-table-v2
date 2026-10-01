# module-boundaries Specification

## Purpose

Fija qué partes del código pueden importar a cuáles (núcleo del motor, adaptadores, raíz de
composición, panel y `shared`) para que la arquitectura hexagonal y la frontera motor/navegador se
comprueben automáticamente en lugar de depender de la disciplina de quien escribe el código.

## Requirements

### Requirement: El núcleo del motor no depende de los adaptadores
El lint del repositorio MUST fallar cuando un fichero del núcleo de `engine` importe, directa o
indirectamente por ruta relativa o alias, un módulo de la carpeta de adaptadores de `engine`. El
mensaje de error MUST identificar el fichero que importa y la frontera que incumple.

> Traza: `MOO-28` («el núcleo no importa de los adaptadores», README §2.3).

#### Scenario: Un fichero del núcleo importa un adaptador
- **GIVEN** un fichero dentro del núcleo de `engine` que importa un módulo de los adaptadores de `engine`
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
- **AND** el informe señala ese fichero y la regla de fronteras incumplida

#### Scenario: Un adaptador importa un puerto del núcleo (asumido)
- **GIVEN** un fichero de los adaptadores de `engine` que importa una interfaz del núcleo
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint no informa ningún error de fronteras

### Requirement: Solo la raíz de composición conoce núcleo y adaptadores a la vez
La raíz de composición de `engine` SHALL poder importar tanto del núcleo como de los adaptadores sin
que el lint informe errores de fronteras.

> Traza: README §2.3 («solo la raíz de composición conoce a la vez el núcleo y los adaptadores»),
> referenciado por `MOO-28`.

#### Scenario: La raíz de composición monta núcleo y adaptadores
- **GIVEN** la raíz de composición de `engine` importa un módulo del núcleo y uno de los adaptadores
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint no informa ningún error de fronteras

### Requirement: El panel solo importa de shared entre los paquetes del repo
El lint MUST fallar cuando un fichero de `panel` importe código de `engine`, ya sea por nombre de
paquete o por ruta relativa que salga de `packages/panel`. Importar de `shared` y de dependencias
externas declaradas MUST estar permitido.

> Traza: `MOO-28` («el panel solo importa de `shared`», README §2.3).

#### Scenario: El panel importa del motor
- **GIVEN** un fichero de `panel` que importa un módulo de `engine`
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
- **AND** el informe señala ese fichero y la regla de fronteras incumplida

#### Scenario: El panel importa de shared
- **GIVEN** un fichero de `panel` que importa algo que `shared` exporta
- **WHEN** se ejecutan el lint y la comprobación de tipos desde la raíz del repositorio
- **THEN** ninguno de los dos informa errores

#### Scenario: El panel importa un fichero interno de shared (asumido)
- **GIVEN** un fichero de `panel` que importa por ruta un módulo de `shared` que este no exporta en su punto de entrada público
- **WHEN** se ejecutan el lint o la comprobación de tipos desde la raíz del repositorio
- **THEN** al menos uno de los dos termina con error

### Requirement: shared no depende de los otros paquetes
El lint MUST fallar cuando un fichero de `shared` importe código de `engine` o de `panel`, para que
lo que el panel obtiene de `shared` no arrastre lógica del motor ni del navegador.

> Traza: *(asumido)*. Se deduce de README §2.3 (el panel solo puede usar lo que exporta `shared`),
> pero `MOO-28` no lo enuncia.

#### Scenario: shared importa del motor (asumido)
- **GIVEN** un fichero de `shared` que importa un módulo de `engine`
- **WHEN** se ejecuta el lint desde la raíz del repositorio
- **THEN** el lint termina con error
