# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: El panel tiene las cinco zonas`
- TO: `### Requirement: El panel tiene las seis zonas`

## MODIFIED Requirements

### Requirement: El panel tiene las seis zonas
Al abrir el panel, la página SHALL mostrar seis zonas: **cabecera**, **visor**, **tiras**,
**efectos**, **controles** e **intensidad** (README §1.3). Cada zona MUST existir aunque todavía no
tenga contenido.

> Traza: `MOO-29` («las zonas del wireframe, vacías: cabecera, visor, tiras, efectos y controles»).
> La zona de la intensidad: `MOO-97` (*la intensidad es del instrumento, no de la tira seleccionada*)
> y decisión del DJ al explorar el change (`design.md` de `instrument-intensity`, decisión 6).

#### Scenario: Se abre el panel
- **WHEN** se abre el panel en el navegador
- **THEN** la página muestra la cabecera, el visor, las tiras, los efectos, los controles y la
  intensidad
- **AND** no muestra ninguna otra zona

### Requirement: Cada zona se identifica por su nombre del glosario
Cada zona MUST poder localizarse por un nombre accesible igual a su término del glosario (PRD §8):
«Visor», «Tiras», «Efectos», «Controles» e «Intensidad»; la cabecera, como cabecera de la página. Ese
nombre es el punto de anclaje de las historias y de sus tests.

> Traza: `MOO-29` («cada historia rellena su zona»). Que el anclaje sea el nombre accesible es
> *(asumido)*. «Intensidad»: el término nuevo del glosario que trae `MOO-97`.

#### Scenario: Una historia busca su zona (asumido)
- **GIVEN** el panel abierto
- **WHEN** se busca una región por el nombre «Visor», «Tiras», «Efectos», «Controles» o «Intensidad»
- **THEN** se encuentra exactamente una región con ese nombre
- **AND** la cabecera de la página se encuentra como cabecera (*banner*)

#### Scenario: El visor no se llama «Tira virtual» (asumido)
- **GIVEN** el panel abierto
- **WHEN** se lee el título de la zona del visor
- **THEN** el título es «Visor», no «Tira virtual» (glosario PRD §8; `MOO-35` corrige el wireframe)

### Requirement: Las zonas siguen el orden del wireframe
El panel SHALL colocar la cabecera arriba; debajo, a la derecha de todo y a toda la altura, la
intensidad; y a su izquierda, el visor a todo el ancho que queda y, debajo del visor, las tiras, los
efectos y los controles en tres columnas, en ese orden de izquierda a derecha, en una ventana de
escritorio. El orden de lectura de la página MUST ser el mismo, con la intensidad al final.

> Traza: `MOO-29` («las zonas del wireframe»), `docs/img/panel-wireframe.png`. La intensidad a la
> derecha de todo, como el máster de una mesa de mezclas: decisión del DJ al explorar `MOO-97`
> (`design.md` de `instrument-intensity`, decisión 6). Que vaya la última al leer es *(asumido)*.

#### Scenario: Orden de lectura de las zonas
- **GIVEN** el panel abierto
- **WHEN** se recorren las zonas en el orden del documento
- **THEN** el orden es cabecera, visor, tiras, efectos, controles, intensidad

#### Scenario: Disposición en una ventana de escritorio
- **GIVEN** el panel abierto en una ventana de escritorio
- **WHEN** se mira la página
- **THEN** la intensidad ocupa una columna a la derecha de todo, desde la cabecera hasta abajo
- **AND** el visor ocupa todo el ancho que queda a su izquierda, bajo la cabecera
- **AND** tiras, efectos y controles aparecen uno al lado del otro, debajo del visor

### Requirement: Las zonas vacías no inventan datos
Mientras ninguna historia rellene una zona, esta MUST mostrar solo su título, sin tiras, efectos,
controles ni datos del motor de ejemplo. El panel MUST abrirse sin errores aunque no haya un motor al
que conectarse; el único error admitido en la consola es el que escribe el propio navegador al no
poder conectar con el motor.

> Traza: `MOO-29` («zonas vacías»; «esta tarea solo fija la estructura»). La excepción del error de
> conexión: `MOO-13`, `design.md` del change `virtual-strip-breathing`, decisión 19 (desde que el
> panel intenta conectar, ese error no depende de su código).

#### Scenario: Panel abierto sin motor
- **GIVEN** que no hay ningún motor en marcha
- **WHEN** se abre el panel
- **THEN** se ven las seis zonas con su título y sin contenido de ejemplo
- **AND** la consola del navegador no muestra más errores que el de no poder conectar con el motor
