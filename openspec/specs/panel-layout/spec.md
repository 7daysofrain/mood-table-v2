# panel-layout Specification

## Purpose

Fija la estructura del panel web: qué zonas tiene, cómo se identifican y en qué orden se reparten la
pantalla, para que cada historia rellene su zona sin redefinir la página.

## Requirements

### Requirement: El panel tiene las cinco zonas
Al abrir el panel, la página SHALL mostrar cinco zonas: **cabecera**, **visor**, **tiras**,
**efectos** y **controles** (README §1.3). Cada zona MUST existir aunque todavía no tenga contenido.

> Traza: `MOO-29` («las zonas del wireframe, vacías: cabecera, visor, tiras, efectos y controles»).

#### Scenario: Se abre el panel
- **WHEN** se abre el panel en el navegador
- **THEN** la página muestra la cabecera, el visor, las tiras, los efectos y los controles
- **AND** no muestra ninguna otra zona

### Requirement: Cada zona se identifica por su nombre del glosario
Cada zona MUST poder localizarse por un nombre accesible igual a su término del glosario (PRD §8):
«Visor», «Tiras», «Efectos» y «Controles»; la cabecera, como cabecera de la página. Ese nombre es el
punto de anclaje de las historias y de sus tests.

> Traza: `MOO-29` («cada historia rellena su zona»). Que el anclaje sea el nombre accesible es
> *(asumido)*.

#### Scenario: Una historia busca su zona (asumido)
- **GIVEN** el panel abierto
- **WHEN** se busca una región por el nombre «Visor», «Tiras», «Efectos» o «Controles»
- **THEN** se encuentra exactamente una región con ese nombre
- **AND** la cabecera de la página se encuentra como cabecera (*banner*)

#### Scenario: El visor no se llama «Tira virtual» (asumido)
- **GIVEN** el panel abierto
- **WHEN** se lee el título de la zona del visor
- **THEN** el título es «Visor», no «Tira virtual» (glosario PRD §8; `MOO-35` corrige el wireframe)

### Requirement: Las zonas siguen el orden del wireframe
El panel SHALL colocar la cabecera arriba, el visor debajo a todo el ancho y, debajo del visor, las
tiras, los efectos y los controles en tres columnas, en ese orden de izquierda a derecha, en una
ventana de escritorio. El orden de lectura de la página MUST ser el mismo.

> Traza: `MOO-29` («las zonas del wireframe»), `docs/img/panel-wireframe.png`.

#### Scenario: Orden de lectura de las zonas
- **GIVEN** el panel abierto
- **WHEN** se recorren las zonas en el orden del documento
- **THEN** el orden es cabecera, visor, tiras, efectos, controles

#### Scenario: Disposición en una ventana de escritorio
- **GIVEN** el panel abierto en una ventana de escritorio
- **WHEN** se mira la página
- **THEN** el visor ocupa todo el ancho bajo la cabecera
- **AND** tiras, efectos y controles aparecen uno al lado del otro, debajo del visor

### Requirement: Las zonas vacías no inventan datos
Mientras ninguna historia rellene una zona, esta MUST mostrar solo su título, sin tiras, efectos,
controles ni datos del motor de ejemplo. El panel MUST abrirse sin errores aunque no haya un motor al
que conectarse.

> Traza: `MOO-29` («zonas vacías»; «esta tarea solo fija la estructura»).

#### Scenario: Panel abierto sin motor
- **GIVEN** que no hay ningún motor en marcha
- **WHEN** se abre el panel
- **THEN** se ven las cinco zonas con su título y sin contenido de ejemplo
- **AND** la consola del navegador no muestra errores

### Requirement: El panel no carga recursos de internet
El panel MUST funcionar sin conexión a internet: todo lo que necesita para pintarse (código, estilos,
tipografías e iconos) SHALL venir de su propio build, sin peticiones a dominios externos.

> Traza: PRD §6 («funciona sin internet: todo ocurre en la red local»), E6. No aparece en la
> descripción de `MOO-29`: *(asumido)*.

#### Scenario: Panel abierto sin internet (asumido)
- **GIVEN** el build del panel servido en local y el equipo sin acceso a internet
- **WHEN** se abre el panel
- **THEN** la página se pinta con sus estilos y tipografías
- **AND** el navegador no ha hecho ninguna petición a un dominio distinto del que sirve el panel
