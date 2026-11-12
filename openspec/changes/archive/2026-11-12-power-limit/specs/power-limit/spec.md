# Spec Delta

## Purpose

Fija el límite de potencia de las tiras físicas: cómo estima el motor lo que consume cada frame, cuánto
usa como mucho de la fuente declarada y cómo baja un frame que se pasa, para que el instrumento nunca
pida más corriente de la que aguanta la fuente (E8).

## ADDED Requirements

### Requirement: El motor estima el consumo de cada frame de una tira física
El motor SHALL estimar el consumo de cada frame de una tira física sumando, canal a canal, lo que
consume un canal de su chip a todo brillo (20 mA en una `WS2812B`) por el PWM que le envía la
salida Adalight, la respuesta del LED ya redondeada, entre 255.

> Traza: criterio *Un frame pide más corriente de la que da la fuente* de `MOO-135` (*el consumo
> estimado del frame*). Con el PWM enviado: `design.md`, decisión 1. Los 20 mA: 60 mA por LED a
> blanco total (`HARDWARE_SETUP.md` §3).

#### Scenario: Todo blanco en la tira de la mesa
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B`
- **WHEN** el frame tiene todos los canales a 255
- **THEN** el motor estima un consumo de 10,38 A

#### Scenario: Los valores medios consumen menos de lo que parece en pantalla
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B`
- **WHEN** el frame tiene todos los canales a 128
- **THEN** el motor estima un consumo de unos 2,6 A, una cuarta parte del blanco total, y no la mitad

### Requirement: Un frame que pide más del 80 % de la fuente se baja hasta ahí
Si un frame pasa del 80 % de los amperios de su fuente, el motor MUST bajar todos sus canales con un
mismo factor de luz, lo justo para quedarse en ese 80 % (más lo que sumen el redondeo y los LEDs que
el límite mantiene encendidos). Su consumo estimado MUST NOT pasar nunca de los amperios de la
fuente.

> Traza: criterio *Un frame pide más corriente de la que da la fuente* de `MOO-135`. El 80 %:
> `docs/umbrales-para-specs.md` (E8). El factor y el redondeo: `design.md`, decisiones 1 y 2.

#### Scenario: Un frame pide más corriente de la que da la fuente
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 8 A
- **AND** el sketch del controlador ya no limita el brillo
- **WHEN** el efecto pide toda la tira en blanco con la intensidad al máximo
- **THEN** todos los canales del frame salen a 200, con un consumo estimado de unos 6,39 A
- **AND** el consumo estimado no pasa de los 8 A de la fuente
- **AND** en la mesa, la fuente no corta, la tira no parpadea y el controlador Adalight no se
  reinicia

#### Scenario: Con una fuente pequeña, el redondeo de los valores bajos no la hace pasar (asumido)
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 0,12 A
- **WHEN** el efecto pinta 53 canales a 255 y el resto a 12
- **THEN** el consumo estimado del frame, con el PWM que se envía, no pasa de los 0,12 A de la fuente

#### Scenario: El visor muestra el frame ya bajado
- **GIVEN** una tira física cuyo frame se pasa del 80 % de su fuente
- **WHEN** el motor entrega el frame a las salidas de esa tira
- **THEN** el visor y la salida Adalight reciben el mismo frame, ya bajado

### Requirement: Un frame que cabe sale tal cual
Si el consumo estimado de un frame no pasa del 80 % de los amperios de la fuente de su tira, el motor
MUST NOT cambiar el frame.

> Traza: criterio *Un frame pide menos corriente de la que da la fuente* de `MOO-135`.

#### Scenario: Un frame pide menos corriente de la que da la fuente
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 8 A
- **WHEN** el efecto pinta toda la tira de rojo puro (255, 0, 0)
- **THEN** el motor estima unos 3,46 A y el frame sale tal cual
- **AND** un LED con poco brillo, como (15, 0, 0), sale igual

### Requirement: El límite no apaga un LED que se veía
Al bajar un frame, el motor MUST NOT dejar por debajo de 12 un canal que valía 12 o más, salvo si la
fuente de la tira no aguanta ese suelo: entonces baja sin suelo, porque proteger la fuente va antes
(D14).

> Traza: criterio *Un frame que se pasa tiene LEDs con poco brillo* de `MOO-135`. El suelo y su
> excepción: `design.md`, decisión 2.

#### Scenario: Un frame que se pasa tiene LEDs con poco brillo
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 8 A
- **WHEN** el efecto pinta 172 LEDs en blanco y uno a (15, 40, 0)
- **THEN** los LEDs blancos salen a 200
- **AND** el LED tenue sale a (12, 31, 0): su rojo se sigue viendo

#### Scenario: Una fuente que no aguanta el suelo
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 0,06 A
- **WHEN** el efecto pinta 37 canales a 255 y el resto a 12
- **THEN** el consumo estimado del frame no pasa de los 0,06 A de la fuente

### Requirement: El límite va después de la intensidad
El motor SHALL estimar y bajar el frame de cada tira con la intensidad ya aplicada, como último paso
antes de entregarlo a sus salidas.

> Traza: *(asumido)*, D100 (orden de cada tira: efecto, intensidad, límite de potencia y salidas).

#### Scenario: Con la intensidad a la mitad, el blanco total cabe (asumido)
- **GIVEN** una tira física de 173 LEDs con chip `WS2812B` y una fuente de 8 A
- **AND** la intensidad al 50 %
- **WHEN** el efecto pide toda la tira en blanco
- **THEN** el frame sale con todos los canales a 128, sin bajar más: unos 2,6 A

### Requirement: Las tiras virtuales no tienen límite
El motor MUST NOT aplicar el límite de potencia a una tira virtual: no tiene fuente.

> Traza: *(asumido)*, la historia limita la declaración a las tiras físicas (*decidido al crear*).

#### Scenario: Una tira virtual pinta en blanco total (asumido)
- **GIVEN** una tira virtual de 173 LEDs
- **WHEN** el efecto pide toda la tira en blanco con la intensidad al máximo
- **THEN** el visor recibe todos los canales a 255

### Requirement: El log dice al arrancar el límite de cada tira física
Al arrancar, el motor SHALL escribir en el log una línea por tira física con su nombre, los amperios
de su fuente, lo que usará como mucho (el 80 %), lo que pide la tira en blanco total y si va a bajar
frames.

> Traza: *(asumido)*, decidido al crear `MOO-135` y llevado a su contexto técnico al refinarla (no es
> un criterio): le sirve al maker para comprobar que la declaración ha entrado bien (`design.md`,
> decisión 4).

#### Scenario: La tira de la mesa con su fuente de 8 A (asumido)
- **GIVEN** la tira física «Mesa» de 173 LEDs con chip `WS2812B` y una fuente de 8 A
- **WHEN** arranca el motor
- **THEN** el log dice que la tira «Mesa» tiene una fuente de 8 A, usará como mucho 6,4 A, pide
  10,38 A en blanco total y bajará los frames que se pasen

#### Scenario: Una fuente que nunca se queda corta (asumido)
- **GIVEN** la tira física «Mesa» de 173 LEDs con chip `WS2812B` y una fuente de 18 A
- **WHEN** arranca el motor
- **THEN** el log dice que usará como mucho 14,4 A, que pide 10,38 A en blanco total y que nunca
  bajará frames
