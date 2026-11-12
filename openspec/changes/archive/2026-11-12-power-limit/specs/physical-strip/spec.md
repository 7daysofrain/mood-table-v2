# Spec Delta

## MODIFIED Requirements

### Requirement: La tira física pinta lo mismo que su fila del visor
Cada frame que la salida Adalight de una tira escribe en su puerto serie SHALL llevar los colores del
frame que recibe el visor en ese pulso, LED a LED y en el mismo orden, con cada canal corregido con la
gamma 2,0 de los LEDs: `round(255 · (v/255)²)`. Así la tira se ve como el visor, que no la necesita
porque la pantalla ya aplica su curva. El controlador no topa el brillo: lo que llega a la tira es
lo que decide el límite de potencia (specs/power-limit).

> Traza: caso feliz de `MOO-111` (*la tira física pinta lo mismo que esa tira en el visor*) y su
> esquema del escenario *La tira física responde mientras el DJ toca*. Sin reordenar los colores:
> non-goal de `MOO-111` (va en H4). La gamma, de `MOO-123`: la prueba en la mesa del 5-nov y la tabla
> de la v1 (decisión 6 de `scroll-effect`). Sin el tope del controlador (D46): `MOO-135`, criterio
> *Un frame pide menos corriente de la que da la fuente*.

#### Scenario: La tira física pinta lo mismo que el visor
- **GIVEN** que el controlador Adalight está conectado a la Raspberry de la mesa, con su tira física
- **AND** que el fichero de configuración declara esa tira con salida Adalight, su puerto serie y sus
  baudios
- **WHEN** el motor arranca (asumido)
- **THEN** la tira física pinta lo mismo que esa tira en el visor, sin quedarse atrás, aunque con
  menos frames por segundo si los baudios no dan para más

#### Scenario: La tira física responde cuando el DJ cambia el efecto
- **GIVEN** que la tira física pinta lo mismo que el visor
- **WHEN** el DJ cambia el efecto de la tira desde el panel
- **THEN** la tira física lo pinta a la vez que el visor

#### Scenario: La tira física responde cuando el DJ mueve un control
- **GIVEN** que la tira física pinta lo mismo que el visor
- **WHEN** el DJ mueve un control de la tira desde el panel
- **THEN** la tira física lo pinta a la vez que el visor

#### Scenario: Un color tenue sale más tenue hacia la tira
- **GIVEN** una tira de salida Adalight
- **WHEN** el visor recibe un frame con un LED a (128, 30, 255)
- **THEN** la salida Adalight escribe ese LED como (64, 4, 255)

#### Scenario: Un color puro se ve con todo su brillo
- **GIVEN** la tira física de la mesa, con el sketch del controlador sin tope de brillo
- **WHEN** el efecto pinta toda la tira de un color puro
- **THEN** la tira física lo pinta a todo brillo, claramente más brillante que con el tope del 25 %
- **AND** un LED con poco brillo se sigue viendo
