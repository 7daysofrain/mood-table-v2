# pr-tracking Specification

## Purpose

Fija qué PR sigue el PR Babysitter, cuándo y por dónde avisa al mantenedor de su estado, y qué cuenta
para decidir si una PR está lista para integrar o necesita intervención. Así el mantenedor no tiene
que vigilar cada PR.

## Requirements

### Requirement: El sistema sigue las PR del mantenedor contra main que no son borrador
El sistema SHALL seguir cada PR abierta del mantenedor contra `main` que esté lista para revisar. Una
PR en borrador, de otra persona o contra otra rama MUST NOT generar ningún aviso.

> Traza: `MOO-73`, criterios *el sistema avisa de que sigue una PR* y *una PR en borrador no genera
> avisos*; non-goals de la historia (PR de otras personas, de forks, de entrega y de Dependabot).

#### Scenario: Una PR del mantenedor queda lista para revisar
- **GIVEN** el PR Babysitter en marcha
- **WHEN** una PR del mantenedor contra `main` queda lista para revisar
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema la sigue y espera a que terminen sus comprobaciones

#### Scenario: Una PR en borrador
- **GIVEN** el PR Babysitter en marcha
- **WHEN** el mantenedor abre una PR en borrador contra `main`
- **THEN** no recibe ningún aviso de esa PR mientras siga en borrador

#### Scenario: Un borrador pasa a lista para revisar
- **GIVEN** una PR del mantenedor en borrador contra `main`
- **WHEN** la PR pasa a lista para revisar
- **THEN** el mantenedor recibe el aviso de que el sistema la sigue

#### Scenario: Una PR de otra persona (asumido)
- **GIVEN** el PR Babysitter en marcha
- **WHEN** alguien que no es el mantenedor abre una PR contra `main` lista para revisar
- **THEN** el mantenedor no recibe ningún aviso de esa PR

### Requirement: Al arrancar, el sistema sigue las PR que ya estaban abiertas
Al arrancar, el sistema SHALL reconstruir desde GitHub qué PR debe seguir, sin estado guardado propio,
y avisar de cada una como si acabara de quedar lista para revisar.

> Traza: `MOO-73`, criterio *al arrancar, el sistema sigue las PR que ya estaban abiertas*; D66
> (GitHub es la fuente de verdad). Repetir el aviso tras un reinicio lo acepta el non-goal de BE7.

#### Scenario: Arranca con PR abiertas
- **GIVEN** hay PR del mantenedor contra `main` abiertas y listas para revisar
- **WHEN** el PR Babysitter arranca
- **THEN** el mantenedor recibe, por cada una, un aviso, que identifica la PR, de que el sistema la sigue

### Requirement: Las comprobaciones son las que exige la rama main
Las comprobaciones de una PR SHALL ser las que el *ruleset* de `main` exige en el momento de leerlas.
Han terminado cuando cada una tiene un resultado sobre el último push; una falla si su resultado no es
correcto, neutro ni saltado. Una comprobación exigida que aún no ha empezado MUST contar como no
terminada.

> Traza: glosario de PB §8 (*comprobación*); decidido por el usuario al explorar el change (25-oct),
> `design.md` decisión 6. *Saltada cuenta como superada*: `linear.md` §7 (`sonar-issues`).

#### Scenario: Terminan las comprobaciones del último push
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que sus comprobaciones han terminado

#### Scenario: Una comprobación exigida aún no ha empezado (asumido)
- **GIVEN** el sistema sigue una PR y todas las comprobaciones del último push han terminado salvo una exigida por `main` que aún no ha empezado
- **WHEN** el sistema vuelve a leer la PR
- **THEN** el mantenedor no recibe el aviso de comprobaciones terminadas

### Requirement: La revisión cuenta solo si es del último push y ha terminado
La revisión del revisor SHALL contar como terminada solo cuando su estado es completado y el commit que
revisa es el último push de la PR. Una revisión en curso, de un push anterior, ausente o que no se
puede leer MUST contar como no terminada.

> Traza: `MOO-73`, *Contexto técnico* (`commit_sha` del bloque `codex-review-state`, `workflow.md`
> §4.4) y criterio *una comprobación o la revisión no termina a tiempo*. Ausente o ilegible:
> `design.md` decisión 7, decidida por el usuario al explorar el change. En la #64, #65 y #67 el bloque
> se quedó en curso.

#### Scenario: El revisor revisa un push anterior
- **GIVEN** el sistema sigue una PR con las comprobaciones del último push terminadas
- **WHEN** el revisor termina la revisión de un push anterior al último
- **THEN** el mantenedor no recibe el aviso de estado final

#### Scenario: El bloque del revisor no se puede leer (asumido)
- **GIVEN** el sistema sigue una PR con las comprobaciones del último push terminadas
- **WHEN** el comentario del revisor no tiene un bloque de estado que se pueda leer
- **THEN** la revisión cuenta como no terminada

### Requirement: Al terminar comprobaciones y revisión, el sistema avisa del estado final y deja de seguir la PR
Cuando han terminado las comprobaciones y la revisión del último push, el sistema SHALL avisar del
estado final, con su motivo, y dejar de seguir la PR: «lista para integrar» si todas las
comprobaciones pasan y el revisor no tiene hallazgos, y «necesita intervención» en otro caso. La PR
MUST seguir abierta.

> Traza: `MOO-73`, esquema *el sistema deja de seguir la PR y avisa de su estado final*; BE9; D64 (el
> sistema no integra). *Con hallazgos* usa si el revisor ha tenido alguno en ese push, no si quedan sin
> resolver: en la #62, el bloque seguía diciendo que había hallazgos sin resolver con los hilos ya
> resueltos (`design.md` decisión 7).

#### Scenario: Todo pasa y el revisor no tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa sin hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «lista para integrar»
- **AND** la PR sigue abierta

#### Scenario: Falla una comprobación
- **GIVEN** el sistema sigue una PR, alguna comprobación falla en el último push y el revisor lo revisa sin hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación falla
- **AND** la PR sigue abierta

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que el revisor tiene hallazgos
- **AND** la PR sigue abierta

### Requirement: Si algo no termina en 30 minutos, la PR necesita intervención
Si una comprobación o la revisión del último push no ha terminado 30 minutos después de que el sistema
vea ese push, el sistema SHALL avisar de que deja de seguir la PR, con el estado «necesita
intervención» y qué no ha terminado.

> Traza: `MOO-73`, criterio *una comprobación o la revisión no termina a tiempo*. Los 30 min salen de
> la medición de #57-#68 (comprobaciones hasta 10,5 min, revisión hasta 20,7 min) y los decidió el
> usuario al explorar el change: `docs/umbrales-para-specs.md`, `design.md` decisión 8.

#### Scenario: La revisión no termina a tiempo
- **GIVEN** el sistema sigue una PR con las comprobaciones del último push terminadas
- **WHEN** pasan 30 minutos desde que el sistema vio ese push sin que el revisor lo haya revisado
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que la revisión no ha terminado

#### Scenario: Una comprobación no termina a tiempo
- **GIVEN** el sistema sigue una PR
- **WHEN** pasan 30 minutos desde que el sistema vio el último push con una comprobación sin terminar
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación no ha terminado

### Requirement: Un push nuevo vuelve a empezar el seguimiento
Un push nuevo a una PR SHALL volver a empezar su seguimiento: los avisos de comprobaciones terminadas y
de estado final se refieren a ese push, y el tiempo de espera cuenta desde él. Si el sistema seguía la
PR, MUST NOT avisar del push; si ya había dejado de seguirla, SHALL avisar de nuevo de que la sigue.

> Traza: `MOO-73`, esquema *un push nuevo vuelve a empezar el seguimiento*.

#### Scenario: Push nuevo mientras el sistema sigue la PR
- **GIVEN** el sistema sigue una PR
- **WHEN** llega un push nuevo a esa PR
- **THEN** el mantenedor no recibe ningún aviso
- **AND** los avisos de comprobaciones terminadas y de estado final se refieren a ese push

#### Scenario: Push nuevo cuando el sistema ya ha dejado de seguir la PR
- **GIVEN** el sistema ya ha dejado de seguir una PR
- **WHEN** llega un push nuevo a esa PR
- **THEN** el mantenedor recibe el aviso de que el sistema sigue la PR
- **AND** los avisos de comprobaciones terminadas y de estado final se refieren a ese push

### Requirement: Solo el revisor y las comprobaciones deciden el estado final
El estado final SHALL depender solo de las comprobaciones y de la revisión del revisor. Un comentario de
cualquier otra cuenta MUST NOT cambiarlo.

> Traza: `MOO-73`, criterio *un comentario que no es del revisor no cambia el estado final*; BE6.

#### Scenario: Comenta alguien que no es el revisor
- **GIVEN** el sistema sigue una PR y alguien que no es el revisor ha comentado en ella
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el estado final del aviso es el mismo que sin ese comentario

### Requirement: Una PR cerrada o integrada deja de seguirse sin aviso
Si una PR que el sistema sigue se cierra o se integra, el sistema SHALL dejar de seguirla y MUST NOT
avisar de ello.

> Traza: non-goal de `MOO-73` (*se decide en la spec*); decidido por el usuario al explorar el change
> (25-oct): el cierre o el merge los hace el mantenedor, y un aviso sería redundante.

#### Scenario: El mantenedor integra la PR antes del estado final
- **GIVEN** el sistema sigue una PR
- **WHEN** el mantenedor la integra
- **THEN** el sistema deja de seguirla
- **AND** el mantenedor no recibe ningún aviso más de esa PR

### Requirement: Los avisos llegan por Linear, en la tarea de la PR
Cada aviso de una PR SHALL publicarse como comentario en la tarea de Linear enlazada a esa PR,
mencionar al mantenedor e identificar la PR por su número, su título y su enlace. Lo MUST publicar una
identidad propia del sistema, no la cuenta del mantenedor. Si la PR no tiene tarea enlazada, el aviso
SHALL ir al issue buzón del sistema.

> Traza: `MOO-73`, *Contexto técnico* (BQ1 se resuelve en este change; BE9, el mismo canal que usará
> `MOO-79`). Linear, la identidad propia, la mención y el buzón: decididos por el usuario al explorar el
> change (25-oct), `design.md` decisiones 1 y 2.

#### Scenario: Aviso de una PR con tarea
- **GIVEN** el sistema sigue una PR enlazada a una tarea de Linear
- **WHEN** el sistema avisa del estado de la PR
- **THEN** la tarea tiene un comentario nuevo del PR Babysitter que menciona al mantenedor y lleva el número, el título y el enlace de la PR

#### Scenario: Aviso de una PR sin tarea
- **GIVEN** el sistema sigue una PR que no está enlazada a ninguna tarea de Linear
- **WHEN** el sistema avisa del estado de la PR
- **THEN** el comentario va al issue buzón del sistema

### Requirement: Un aviso no se pierde si Linear falla
Si Linear no acepta un aviso, el sistema SHALL volver a intentarlo hasta publicarlo. Un mismo aviso MAY
llegar dos veces, pero MUST NOT perderse.

> Traza: decidido por el usuario al explorar el change (25-oct), `design.md` decisión 4: un aviso
> repetido molesta y uno perdido es el fallo de `MOO-50`.

#### Scenario: Linear no está disponible
- **GIVEN** el sistema tiene que avisar del estado final de una PR
- **WHEN** Linear rechaza el comentario
- **THEN** el sistema lo vuelve a intentar hasta que se publica
- **AND** el mantenedor recibe el aviso al menos una vez

### Requirement: Si no puede leer GitHub, el sistema espera y avisa si es por el token
Si una lectura de GitHub falla, el sistema MUST NOT cambiar el estado de ninguna PR y SHALL volver a
leer en la siguiente consulta. Si falla porque el token ya no es válido, SHALL avisar una vez al issue
buzón de que no puede leer GitHub.

> Traza: decidido por el usuario al explorar el change (25-oct), `design.md` decisiones 3 y 4. Sin el
> aviso, un token caducado pararía el sistema sin que nadie se enterase, como en `MOO-50`.

#### Scenario: GitHub no responde
- **GIVEN** el sistema sigue una PR
- **WHEN** una consulta a GitHub falla por la red o por un error del servidor
- **THEN** el mantenedor no recibe ningún aviso de esa PR por ese fallo
- **AND** el sistema vuelve a consultar GitHub en la siguiente vuelta

#### Scenario: El token de GitHub ha caducado
- **GIVEN** el PR Babysitter en marcha
- **WHEN** GitHub rechaza el token
- **THEN** el issue buzón recibe un solo aviso de que el sistema no puede leer GitHub

### Requirement: El sistema no escribe en GitHub
El sistema MUST NOT escribir nada en GitHub (comentarios, revisiones, commits ni merges), y su token
de GitHub MUST ser de solo lectura.

> Traza: BE2 y D64 (el sistema no integra); decidido por el usuario al explorar el change (25-oct),
> `design.md` decisión 3.

#### Scenario: Una PR seguida hasta su estado final
- **GIVEN** el sistema ha seguido una PR hasta avisar de su estado final
- **WHEN** el mantenedor revisa la PR en GitHub
- **THEN** no hay ningún comentario, revisión, commit ni merge hecho con el token del sistema
