# Spec Delta

## Purpose

Fija cómo el motor guarda el estado del instrumento (el efecto activo de cada tira y los valores de
todos sus efectos) y lo recupera al arrancar, también tras un corte de luz, y cómo lo concilia con
las tiras que declara el fichero de configuración.

## ADDED Requirements

### Requirement: Tras reiniciar, cada tira vuelve con su efecto y sus valores
Al arrancar con estado guardado, cada tira SHALL pintar el efecto activo y los valores que tenía,
aunque el motor se haya parado de golpe. Los valores de sus otros efectos MUST volver también: al
elegir uno, la tira lo pinta con los valores con que lo dejó.

> Traza: criterio *Cada tira vuelve como la dejé tras reiniciar el motor* de `MOO-25`. Los otros
> efectos son *(asumido)* en la historia: glosario del PRD, *estado del instrumento*.

#### Scenario: Cada tira vuelve como la dejé tras reiniciar el motor
- **GIVEN** dos tiras: A con la respiración en azul y un periodo de 8 s, B con la energía
- **AND** han pasado más de 500 ms desde el último cambio
- **WHEN** el motor se para de golpe, sin cerrarse, y vuelve a arrancar
- **THEN** A respira en azul con un periodo de 8 s y B pinta la energía
- **AND** los controles de A muestran ese color y ese periodo

#### Scenario: También vuelven los valores de los efectos no activos (asumido)
- **GIVEN** una tira a la que el DJ ha puesto la respiración en azul y después ha cambiado a la
  energía
- **AND** el motor se ha reiniciado
- **WHEN** el DJ vuelve a la respiración en esa tira
- **THEN** la tira respira en azul, no en el blanco cálido por defecto

### Requirement: El estado se guarda cuando el DJ deja de tocar
El motor SHALL guardar el estado del instrumento cuando pasan 500 ms sin cambios de efecto ni de
valores, vengan del mando que vengan. Un reinicio MUST devolver el último estado guardado: como
mucho se pierde lo cambiado en los últimos 500 ms, o un arrastre a medias.

> Traza: criterio *Se va la luz justo después de un cambio* de `MOO-25`. Los 500 ms y que se guarde
> al dejar de tocar, no mientras se arrastra: decisión del DJ al explorar (`design.md`, decisión 2;
> D103).

#### Scenario: Un cambio suelto se recupera
- **GIVEN** una tira con la respiración
- **AND** el DJ cambia su color a rojo y no toca nada más
- **WHEN** el motor se para de golpe 1 s después y vuelve a arrancar
- **THEN** la tira respira en rojo

#### Scenario: Se va la luz en mitad de un arrastre
- **GIVEN** una tira con la respiración con un periodo de 4 s, guardado
- **AND** el DJ está arrastrando el periodo hacia 10 s, sin parar
- **WHEN** el motor se para de golpe antes de que el DJ suelte, y vuelve a arrancar
- **THEN** la tira respira con un periodo de 4 s

#### Scenario: Se va la luz justo después de un cambio
- **GIVEN** una tira con la energía, guardada
- **AND** el DJ la cambia a la respiración
- **WHEN** el motor se para de golpe antes de que pasen 500 ms, y vuelve a arrancar
- **THEN** la tira pinta la energía

### Requirement: Sin estado guardado, cada tira arranca con el efecto del fichero
Si no hay estado guardado, el motor SHALL arrancar como la primera vez: cada tira con el efecto que
declara el fichero de configuración y los valores por defecto de cada efecto. No es un error: el log
MUST NOT avisar de nada.

> Traza: *(asumido)*, decisión al explorar `MOO-25` (`design.md`, decisión 4): el motor no puede
> distinguir un estado borrado de un primer arranque, así que el criterio *El estado guardado no se
> puede leer* queda para un estado dañado.

#### Scenario: Primer arranque (asumido)
- **GIVEN** un fichero de configuración con una tira con `"effect": "breathing"`
- **AND** ningún estado guardado
- **WHEN** el motor arranca
- **THEN** la tira respira en el blanco cálido por defecto, con un periodo de 4 s
- **AND** el log no dice nada del estado guardado

### Requirement: Un estado dañado no impide arrancar
Si el estado guardado está dañado, el motor MUST arrancar igual que sin estado guardado y SHALL decir
en su log que no ha podido recuperarlo y por qué. MUST apartar el estado dañado con otro nombre, sin
borrarlo, y seguir guardando desde ese momento.

> Traza: criterio *El estado guardado no se puede leer* de `MOO-25`. Que el DJ se entere por el log
> y no por el panel, y que el dañado se aparte: decisiones al explorar (`design.md`, decisión 4).

#### Scenario: El estado guardado no se puede leer
- **GIVEN** un fichero de configuración con una tira con `"effect": "breathing"`
- **AND** un estado guardado dañado
- **WHEN** el motor arranca
- **THEN** la tira respira con los valores por defecto
- **AND** el log dice que no ha podido recuperar el estado guardado y por qué

#### Scenario: El estado dañado queda aparte y el motor sigue guardando (asumido)
- **GIVEN** el motor ha arrancado con un estado guardado dañado
- **AND** el DJ cambia el color de la tira a rojo y no toca nada más
- **WHEN** el motor se para de golpe 1 s después y vuelve a arrancar
- **THEN** la tira respira en rojo
- **AND** el estado dañado sigue junto al nuevo, con otro nombre

### Requirement: El estado se concilia con las tiras del fichero
Una tira se reconoce por su `id`. Al arrancar, una tira declarada sin estado guardado SHALL arrancar
como la primera vez, y una con estado, con él, aunque cambien su nombre, su nº de LEDs o su salida.
El estado de una tira que ya no se declara MUST conservarse por si vuelve.

> Traza: esquema del escenario *El maker cambia las tiras del fichero…* de `MOO-25` y README §3.
> Dos de sus ejemplos son *(asumido)* en la historia.

#### Scenario: El maker añade una tira nueva
- **GIVEN** el DJ ha dejado la tira A con la respiración en azul
- **AND** el maker añade al fichero la tira B, con `"effect": "breathing"`
- **WHEN** el motor se reinicia
- **THEN** B respira en el blanco cálido por defecto
- **AND** A respira en azul

#### Scenario: El maker vuelve a declarar una tira que había quitado
- **GIVEN** el DJ ha dejado la tira B con la respiración en azul
- **AND** el maker la ha quitado del fichero y el motor ha arrancado sin ella
- **WHEN** el maker la vuelve a declarar y el motor se reinicia
- **THEN** B respira en azul

#### Scenario: El maker cambia el nombre, el nº de LEDs o la salida de una tira (asumido)
- **GIVEN** el DJ ha dejado la tira A con la respiración en azul
- **AND** el maker cambia su `name`, su `ledCount` o su `output`, sin tocar su `id`
- **WHEN** el motor se reinicia
- **THEN** A respira en azul

#### Scenario: El maker cambia el identificador de una tira (asumido)
- **GIVEN** el DJ ha dejado la tira con `"id": "a"` con la respiración en azul
- **AND** el maker cambia su `id` a `"b"`, con `"effect": "breathing"`
- **WHEN** el motor se reinicia
- **THEN** la tira respira en el blanco cálido por defecto, como una tira nueva

### Requirement: Lo que dejó el DJ manda sobre el efecto del fichero
Con estado guardado, una tira SHALL arrancar con el efecto que tenía, no con el que declara el
fichero. Si ese efecto necesita fuente de audio y el fichero ya no la declara, MUST arrancar con el
efecto del fichero, conservar los valores guardados de todos sus efectos y decirlo en el log.

> Traza: criterio *Lo que dejó el DJ manda sobre el efecto del fichero* de `MOO-25` y README §3. La
> excepción sin fuente de audio es *(asumido)*: decisión al explorar (`design.md`, decisión 6).

#### Scenario: Lo que dejó el DJ manda sobre el efecto del fichero
- **GIVEN** una tira con `"effect": "breathing"` en el fichero
- **AND** el DJ la dejó con la energía
- **WHEN** el motor se reinicia
- **THEN** la tira pinta la energía

#### Scenario: El efecto guardado necesita una fuente de audio que ya no hay (asumido)
- **GIVEN** una tira con `"effect": "breathing"` que el DJ dejó con la energía, con fuente de audio
- **AND** el maker quita `audioSource` del fichero
- **WHEN** el motor se reinicia
- **THEN** la tira respira
- **AND** el log nombra la tira y dice que su efecto guardado necesita una fuente de audio

### Requirement: Unos valores guardados que ya no encajan vuelven a los de por defecto
Al arrancar, los valores guardados de cada efecto SHALL validarse con su esquema actual: los campos
que falten toman su valor por defecto y los que sobren se quitan. Si aun así no lo cumplen, MUST
volver a los de por defecto solo los de ese efecto. Un efecto que ya no existe se ignora.

> Traza: *(asumido)*, decisión al explorar `MOO-25` (`design.md`, decisión 5; D104). Pregunta del
> contexto técnico de la historia: *lo guardado deja de encajar tras actualizar el código*.

#### Scenario: Un efecto gana un parámetro (asumido)
- **GIVEN** una tira con un efecto guardado con un color azul
- **AND** una versión nueva del motor que añade a ese efecto un parámetro con su valor por defecto
- **WHEN** el motor arranca
- **THEN** la tira pinta ese efecto en azul, con el parámetro nuevo en su valor por defecto

#### Scenario: Un valor guardado se sale del rango nuevo (asumido)
- **GIVEN** una tira con la respiración guardada en azul con un periodo de 15 s
- **AND** una versión nueva del motor en que el periodo va de 1 a 10 s
- **WHEN** el motor arranca
- **THEN** la tira respira con los valores por defecto de la respiración

#### Scenario: El efecto activo guardado ya no existe (asumido)
- **GIVEN** una tira con `"effect": "breathing"` en el fichero, guardada con un efecto que la versión
  nueva del motor ya no tiene
- **WHEN** el motor arranca
- **THEN** la tira respira, con los valores guardados de la respiración si los había

### Requirement: Guardar no congela la luz
Mientras se guarda el estado del instrumento, el motor MUST seguir pintando cada tira a su ritmo,
aunque la escritura tarde: la luz SHALL NOT esperar a la tarjeta.

> Traza: prueba en la mesa del 10-nov, con la escritura en el hilo del bucle: algunos guardados
> tardaron de 0,5 a 2 s y la luz se quedó congelada ese tiempo. Decisión del DJ: escribir en un
> *worker* (`design.md`, decisión 3 revisada; D105).

#### Scenario: Un guardado que tarda no para la tira
- **GIVEN** una tira con la respiración
- **AND** un guardado del estado que tarda 2 s en escribirse
- **WHEN** el motor guarda
- **THEN** la tira sigue respirando durante esos 2 s, sin quedarse fija

### Requirement: Una escritura lenta queda en el log
Si un guardado del estado tarda más de 10 ms, el motor MUST decirlo en el log, con lo que ha
tardado. Por debajo de ese tiempo, MUST NOT escribir nada en el log al guardar.

> Traza: *(asumido)*, al explorar `MOO-25` (`design.md`, decisión 3). Con el *worker* (D105) ya no
> retrasa ningún frame, pero dice cómo responde la tarjeta. 10 ms: un frame a 60 fps, con margen.

#### Scenario: Un guardado que tarda (asumido)
- **GIVEN** un guardado del estado que tarda 25 ms
- **WHEN** termina
- **THEN** el log dice que el guardado ha tardado 25 ms
