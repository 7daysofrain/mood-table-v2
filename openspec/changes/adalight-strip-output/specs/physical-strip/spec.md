# Spec Delta

## Purpose

Fija cómo pinta el motor una tira física a través de su controlador Adalight: qué le envía por el
puerto serie, qué hace cuando el puerto va más lento que el motor y cuándo le impide arrancar.

## ADDED Requirements

### Requirement: La tira física pinta lo mismo que su fila del visor
Cada frame que la salida Adalight de una tira escribe en su puerto serie SHALL llevar los mismos
colores, LED a LED y en el mismo orden, que el frame que recibe el visor en ese pulso. El brillo
puede ser menor: lo topa el sketch del controlador (D46).

> Traza: caso feliz de `MOO-111` (*la tira física pinta lo mismo que esa tira en el visor*) y su
> esquema del escenario *La tira física responde mientras el DJ toca*. Sin reordenar los colores ni
> limitar la potencia: non-goal de `MOO-111` (van en H4).

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

### Requirement: Los frames viajan con el formato Adalight
La salida Adalight SHALL escribir cada frame como una cabecera de 6 bytes, `A` `d` `a`, el nº de LEDs
menos uno en dos bytes (el alto primero) y su checksum (los dos bytes anteriores en XOR con `0x55`),
seguida de 3 bytes por LED (rojo, verde y azul), en el orden de la tira.

> Traza: *(asumido)*, README §2.2 (adaptador *Adalight serie*: *añade la cabecera Adalight*) y el
> protocolo del sketch de D46. Es lo que entiende el controlador Adalight.

#### Scenario: El frame de una tira de 173 LEDs (asumido)
- **GIVEN** una tira de salida Adalight de 173 LEDs
- **WHEN** la salida escribe un frame con el primer LED en rojo puro y el resto apagados
- **THEN** escribe 525 bytes
- **AND** empiezan por `41 64 61 00 AC F9 FF 00 00`, y el resto son ceros

### Requirement: Mientras un frame no ha salido por el cable, el siguiente se descarta
La salida Adalight MUST NOT escribir un frame mientras el anterior no ha salido entero por el puerto
serie: SHALL descartarlo. Así, cada frame que escribe es el del pulso en que lo escribe, y el retraso
de la tira física no crece con el tiempo.

> Traza: escenario *La tira física no se va quedando atrás* de `MOO-111`. Descartar en lugar de
> encolar: README §2.2. Que «salido» sea por el cable y no por el sistema operativo, y que la
> propiedad sustituya al «un rato» de la historia: `design.md`, decisiones 2 y 3.

#### Scenario: El puerto sigue enviando el frame anterior
- **GIVEN** una salida Adalight que ha escrito el frame del pulso 10, que aún no ha salido entero
- **WHEN** llega el pulso 11
- **THEN** la salida no escribe nada

#### Scenario: El puerto ha terminado de enviar
- **GIVEN** una salida Adalight cuyo frame del pulso 10 ya ha salido entero
- **WHEN** llega el pulso 13
- **THEN** la salida escribe el frame del pulso 13

#### Scenario: La tira física no se va quedando atrás
- **GIVEN** una salida Adalight cuyo puerto tarda en enviar un frame lo que duran 3 pulsos
- **WHEN** pasan 1.000 pulsos
- **THEN** cada frame que escribe es el del pulso en que lo escribe
- **AND** nunca escribe mientras el frame anterior no ha salido entero

### Requirement: La tira física va a la vez que el visor
Desde un pulso hasta que su frame ha salido por el puerto serie MUST pasar como mucho lo que tarda un
frame en salir más un pulso. En la mesa (173 LEDs a 115.200 baudios), eso SHALL quedar por debajo de
100 ms.

> Traza: escenarios *La tira física responde mientras el DJ toca* de `MOO-111` (*a la vez que el
> visor*). El umbral: E1 en `docs/umbrales-para-specs.md` (≤ 100 ms, Nielsen). La cuenta: `design.md`,
> decisión 3.

#### Scenario: El DJ mueve un control en la mesa
- **GIVEN** el motor en marcha en la mesa, con la tira física pintando
- **WHEN** el DJ mueve un control de la tira desde el panel
- **THEN** a ojo, la tira física cambia a la vez que el visor
- **AND** el tiempo por frame que dice el log, más un pulso, no pasa de 100 ms

### Requirement: El log dice cuánto tarda en salir cada frame
Para cada tira física, cuando su salida ha enviado sus primeros 50 frames, el motor SHALL escribir en
el log una línea con el nombre de la tira, la mediana de lo que ha tardado cada uno en salir por el
puerto serie, en milisegundos, y los frames por segundo a los que va.

> Traza: *(asumido)*, `design.md`, decisión 3. Es la medida que comprueba E1 en la mesa y la que se
> lleva a Q1 y A2 del PRD.

#### Scenario: La medida de la tira de la mesa (asumido)
- **GIVEN** el motor en marcha con la tira «Mesa» de salida Adalight
- **WHEN** su salida ha enviado sus primeros 50 frames
- **THEN** el log tiene una sola línea con «Mesa», los milisegundos por frame y los frames por segundo

### Requirement: El motor no arranca si no puede abrir el puerto de una tira física
Si al arrancar el motor no puede abrir el puerto serie de una tira física, MUST NOT arrancar: SHALL
terminar con un código de salida distinto de 0 y decir qué tira, qué puerto y por qué no lo puede
abrir.

> Traza: *(asumido)*, `design.md`, decisión 4. Es un estado de paso: el PRD (Q5) pide que el motor
> arranque y espere al controlador, y eso llega con `MOO-112`.

#### Scenario: El puerto no existe (asumido)
- **GIVEN** un `config/local.json` con una tira de salida `adalight` en un puerto que no existe (el
  controlador no está conectado, o la ruta está mal escrita)
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el puerto, y dice por qué no lo puede abrir

#### Scenario: El puerto lo tiene otro programa (asumido)
- **GIVEN** un `config/local.json` con una tira de salida `adalight` en un puerto que otro programa
  tiene abierto
- **WHEN** el maker arranca el motor
- **THEN** el motor no arranca
- **AND** el mensaje nombra la tira y el puerto, y dice por qué no lo puede abrir

### Requirement: Si se pierde el puerto en plena sesión, el resto sigue
Si el puerto serie de una tira física falla o desaparece con el motor en marcha, el motor MUST seguir
en marcha: el visor y las demás tiras siguen pintando. SHALL decirlo en el log una sola vez, con el
nombre de la tira y el puerto, y dejar de escribir en ese puerto.

> Traza: *(asumido)*, `design.md`, decisión 5. Lo que pide Q5 del PRD (*el resto del instrumento
> sigue*); el aviso en el panel y la reconexión llegan con `MOO-112`.

#### Scenario: Se desconecta el controlador en plena sesión (asumido)
- **GIVEN** el motor en marcha con una tira física y un panel abierto
- **WHEN** se desconecta el controlador Adalight
- **THEN** el motor sigue en marcha y el visor sigue pintando todas las tiras
- **AND** el log lo dice una sola vez, con el nombre de la tira y su puerto
