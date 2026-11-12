## MODIFIED Requirements

### Requirement: La tira física pinta lo mismo que su fila del visor
Cada frame que la salida Adalight de una tira escribe en su puerto serie SHALL llevar los colores del
frame que recibe el visor en ese pulso, LED a LED y en el mismo orden, con cada canal corregido con la
gamma 2,0 de los LEDs: `round(255 · (v/255)²)`. Así la tira se ve como el visor, que no la necesita
porque la pantalla ya aplica su curva. Los tres canales de cada LED SHALL ir en el orden de color del
chip de la tira. El controlador no topa el brillo ni reordena los canales: lo que llega a la tira es
lo que decide el límite de potencia (specs/power-limit).

> Traza: caso feliz de `MOO-111` (*la tira física pinta lo mismo que esa tira en el visor*) y su
> esquema del escenario *La tira física responde mientras el DJ toca*. La gamma, de `MOO-123`: la
> prueba en la mesa del 5-nov y la tabla de la v1 (decisión 6 de `scroll-effect`). Sin el tope del
> controlador (D46): `MOO-135`, criterio *Un frame pide menos corriente de la que da la fuente*. El
> orden de color del chip, sin que el controlador reordene: `MOO-136`, caso feliz *Una tira física
> pinta los colores que calcula el motor* y esquema *Un color puro llega igual a la tira física*.

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
- **THEN** la salida Adalight escribe ese LED con rojo 64, verde 4 y azul 255, en el orden de color
  del chip de la tira

#### Scenario: Un color puro se ve con todo su brillo
- **GIVEN** la tira física de la mesa, con el sketch del controlador sin tope de brillo
- **WHEN** el efecto pinta toda la tira de un color puro
- **THEN** la tira física lo pinta a todo brillo, claramente más brillante que con el tope del 25 %
- **AND** un LED con poco brillo se sigue viendo

#### Scenario: Una tira física pinta los colores que calcula el motor
- **GIVEN** que una tira física declara su chip en el fichero de configuración
- **AND** que el controlador Adalight pasa los canales tal como le llegan
- **AND** que la tira tiene un efecto activo
- **WHEN** el motor envía un frame a la tira
- **THEN** cada LED de la tira física se ve del color que tiene en el frame

#### Scenario: Un color puro llega igual a la tira física (asumido)
- **GIVEN** que la tira física de la mesa declara el chip `WS2812B` en el fichero de configuración
- **AND** que el controlador Adalight pasa los canales tal como le llegan
- **WHEN** el motor pinta todos sus LEDs de rojo puro, de verde puro o de azul puro
- **THEN** la tira física se ve roja, verde o azul, la misma que pinta el motor

### Requirement: Los frames viajan con el formato Adalight
La salida Adalight SHALL escribir cada frame como una cabecera de 6 bytes, `A` `d` `a`, el nº de LEDs
menos uno en dos bytes (el alto primero) y su checksum (los dos bytes anteriores en XOR con `0x55`),
seguida de 3 bytes por LED, en el orden de los LEDs de la tira y, dentro de cada LED, en el orden de
color de su chip: verde, rojo y azul en un `WS2812B`.

> Traza: *(asumido)*, README §2.2 (adaptador *Adalight serie*: *añade la cabecera Adalight*) y el
> protocolo del sketch de D46. Es lo que entiende el controlador Adalight. El orden de color del chip:
> `MOO-136` (D111).

#### Scenario: El frame de una tira de 173 LEDs (asumido)
- **GIVEN** una tira de salida Adalight de 173 LEDs con el chip `WS2812B`
- **WHEN** la salida escribe un frame con el primer LED en rojo puro y el resto apagados
- **THEN** escribe 525 bytes
- **AND** empiezan por `41 64 61 00 AC F9 00 FF 00`, y el resto son ceros
