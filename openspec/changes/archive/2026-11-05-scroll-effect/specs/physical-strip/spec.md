## MODIFIED Requirements

### Requirement: La tira física pinta lo mismo que su fila del visor
Cada frame que la salida Adalight de una tira escribe en su puerto serie SHALL llevar los colores del
frame que recibe el visor en ese pulso, LED a LED y en el mismo orden, con cada canal corregido con la
gamma 2,0 de los LEDs: `round(255 · (v/255)²)`. Así la tira se ve como el visor, que no la necesita
porque la pantalla ya aplica su curva. El brillo puede ser menor: lo topa el sketch del controlador
(D46).

> Traza: caso feliz de `MOO-111` (*la tira física pinta lo mismo que esa tira en el visor*) y su
> esquema del escenario *La tira física responde mientras el DJ toca*. Sin reordenar los colores ni
> limitar la potencia: non-goal de `MOO-111` (van en H4). La gamma, de `MOO-123`: la prueba en la mesa
> del 5-nov y la tabla de la v1 (decisión 6 de `scroll-effect`).

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

### Requirement: La tira física va a la vez que el visor
Desde un pulso hasta que su frame ha salido por el puerto serie MUST pasar como mucho lo que tarda un
frame en salir más un pulso. En la mesa (173 LEDs a 500.000 baudios), eso SHALL quedar por debajo de
100 ms.

> Traza: escenarios *La tira física responde mientras el DJ toca* de `MOO-111` (*a la vez que el
> visor*). El umbral: E1 en `docs/umbrales-para-specs.md` (≤ 100 ms, Nielsen). La cuenta: decisión 3
> del change `adalight-strip-output`. Los baudios de la mesa, de `MOO-123` (decisión 7 de
> `scroll-effect`): a 115.200 eran 45 ms por frame y 20 fps; a 500.000, 11 ms y 59 fps.

#### Scenario: El DJ mueve un control en la mesa
- **GIVEN** el motor en marcha en la mesa, con la tira física pintando
- **WHEN** el DJ mueve un control de la tira desde el panel
- **THEN** a ojo, la tira física cambia a la vez que el visor
- **AND** el tiempo por frame que dice el log, más un pulso, no pasa de 100 ms
