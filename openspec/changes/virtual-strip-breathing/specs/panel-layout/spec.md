# Spec Delta

## MODIFIED Requirements

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
- **THEN** se ven las cinco zonas con su título y sin contenido de ejemplo
- **AND** la consola del navegador no muestra más errores que el de no poder conectar con el motor
