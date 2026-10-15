# Spec Delta

## Purpose

Fija lo que ve el maker en el visor del panel: las tiras animándose con los frames del motor, el
estado de la conexión con el motor y la recuperación tras un reinicio, y cómo llegan esos frames al
navegador.

## ADDED Requirements

### Requirement: El motor sirve el panel
El motor SHALL servir el panel en su propia dirección (decisión de `engine-config`), sin ningún otro
servidor.

> Traza: caso feliz de `MOO-13` (*cuando el maker abre el panel*) y README §2.1 (*el motor sirve el
> build estático*). `design.md`, decisión 12.

#### Scenario: El maker abre el panel
- **GIVEN** el motor en marcha con su dirección por defecto
- **WHEN** el maker abre `http://127.0.0.1:8080` en el navegador
- **THEN** ve el panel con sus zonas

### Requirement: El visor dibuja cada tira con los frames del motor
El visor SHALL dibujar cada tira declarada como una fila de puntos, uno por LED, en el orden del
fichero de configuración, con los colores del último frame que ha recibido de esa tira. El navegador
MUST NOT calcular colores por su cuenta.

> Traza: caso feliz de `MOO-13` (*ve la tira virtual en el visor y la ve animarse*). Una fila por tira
> y un punto por LED: `design.md`, decisión 16.

#### Scenario: El maker ve la tira virtual respirando en el visor
- **GIVEN** el motor en marcha con una sola tira virtual declarada, con la respiración
- **WHEN** el maker abre el panel
- **THEN** ve en el visor una fila con un punto por cada LED de la tira
- **AND** ve cómo el brillo de los puntos sube y baja

#### Scenario: Dos tiras declaradas (asumido)
- **GIVEN** el motor en marcha con dos tiras virtuales
- **WHEN** el maker abre el panel
- **THEN** ve dos filas en el visor, en el orden del fichero de configuración

### Requirement: El panel avisa si no hay conexión con el motor
La cabecera del panel SHALL mostrar si hay conexión con el motor: «Conectado» o «Sin conexión con el
motor». Sin conexión, el visor MUST quedar apagado: sin ningún punto encendido.

> Traza: escenario *El panel avisa si el motor no está en marcha* de `MOO-13`. Los textos, los dos
> estados y el visor apagado: `design.md`, decisión 14.

#### Scenario: El panel avisa si el motor no está en marcha
- **GIVEN** que el motor no está en marcha
- **WHEN** el maker abre el panel
- **THEN** la cabecera dice «Sin conexión con el motor»
- **AND** el visor está apagado

#### Scenario: Con el motor en marcha (asumido)
- **GIVEN** el motor en marcha
- **WHEN** el maker abre el panel
- **THEN** la cabecera dice «Conectado»

### Requirement: El visor se recupera solo tras un reinicio del motor
Mientras no tenga conexión, el panel SHALL reintentar conectar con el motor. Cuando el motor vuelve a
estar en marcha, el panel MUST reconectar y el visor volver a mostrar las tiras sin que el maker
recargue la página.

> Traza: escenario *El visor se recupera solo tras un reinicio del motor* de `MOO-13`. El intervalo
> entre intentos está en `design.md`, decisión 15.

#### Scenario: El visor se recupera solo tras un reinicio del motor
- **GIVEN** que el maker tiene el panel abierto
- **AND** el motor se ha reiniciado
- **WHEN** el motor vuelve a estar en marcha
- **THEN** el visor vuelve a mostrar la tira animándose, sin que el maker recargue el panel
- **AND** la cabecera vuelve a decir «Conectado»

### Requirement: Todos los paneles reciben los mismos frames
El motor SHALL enviar los mismos frames (mismo `seq` y mismos colores) a todos los paneles
conectados.

> Traza: escenario *Dos paneles ven lo mismo* de `MOO-13`, *(asumido)* en la historia. Se reformula
> sin la cifra de *como mucho un frame de diferencia*, que no se puede comprobar de forma fiable:
> `design.md`, decisión 18.

#### Scenario: Dos paneles ven lo mismo (asumido)
- **GIVEN** el maker con el panel abierto en un navegador
- **WHEN** abre el panel en un segundo navegador
- **THEN** los dos navegadores reciben, desde que se conectan, los mismos frames con el mismo `seq`
- **AND** los dos visores muestran la tira animándose

### Requirement: Los frames viajan con el formato del protocolo del visor
El motor SHALL enviar a cada panel conectado, por una única conexión, un mensaje binario por cada
frame de cada tira, con el formato de `docs/instructions/viewer-protocol.md`: tipo de mensaje, `seq`,
índice de la tira en el fichero y sus colores RGB, tres bytes por LED.

> Traza: *(asumido)*, `design.md`, decisiones 10 y 11. Es el contrato que D42 pide proteger.

#### Scenario: Un panel recibe un frame (asumido)
- **GIVEN** el motor en marcha con una tira de 60 LEDs y un panel conectado
- **WHEN** el motor calcula un frame
- **THEN** el panel recibe un mensaje binario de tipo frame con su `seq`, el índice 0 y 180 bytes de
  color
