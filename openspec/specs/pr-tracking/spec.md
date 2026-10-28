# pr-tracking Specification

## Purpose

Fija qué PR sigue el PR Babysitter, cuándo y por dónde avisa al mantenedor de su estado, y qué cuenta
para decidir si una PR está lista para integrar o necesita intervención. Así el mantenedor no tiene
que vigilar cada PR.

## Requirements

### Requirement: El sistema sigue las PR del mantenedor contra main que no son borrador
El sistema SHALL seguir cada PR abierta del mantenedor contra `main` que esté lista para revisar. Una
PR en borrador, de otra persona o contra otra rama MUST NOT generar ningún aviso. El aviso de que el
sistema sigue una PR SHALL decir cómo detener su seguimiento.

> Traza: `MOO-73`, criterios *el sistema avisa de que sigue una PR* y *una PR en borrador no genera
> avisos*; non-goals de la historia (PR de otras personas, de forks, de entrega y de Dependabot).
> Decir cómo detenerla: `MOO-74`, decidido por el usuario al explorar el change (27-oct) para que la
> etiqueta se pueda descubrir, `design.md` decisión 3.

#### Scenario: Una PR del mantenedor queda lista para revisar
- **GIVEN** el PR Babysitter en marcha
- **WHEN** una PR del mantenedor contra `main` queda lista para revisar
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema la sigue y espera a que terminen sus comprobaciones
- **AND** el aviso dice que para detener su seguimiento hay que ponerle la etiqueta `babysitter:stop`

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
y avisar de cada una como si acabara de quedar lista para revisar. Las que tienen la etiqueta
`babysitter:stop` SHALL quedar detenidas y MUST NOT generar ningún aviso.

> Traza: `MOO-73`, criterio *al arrancar, el sistema sigue las PR que ya estaban abiertas*; D66
> (GitHub es la fuente de verdad). Repetir el aviso tras un reinicio lo acepta el non-goal de BE7.
> Las PR detenidas: `MOO-74`, criterio *una PR detenida sigue así al volver a poner en marcha el
> sistema*.

#### Scenario: Arranca con PR abiertas
- **GIVEN** hay PR del mantenedor contra `main` abiertas y listas para revisar
- **WHEN** el PR Babysitter arranca
- **THEN** el mantenedor recibe, por cada una, un aviso, que identifica la PR, de que el sistema la sigue

#### Scenario: Una PR detenida antes de parar el sistema
- **GIVEN** una PR con la etiqueta `babysitter:stop` y el PR Babysitter parado del todo
- **WHEN** el PR Babysitter arranca
- **THEN** el mantenedor no recibe ningún aviso de esa PR
- **AND** la PR sigue detenida

#### Scenario: Una PR detenida mientras el sistema estaba parado
- **GIVEN** el PR Babysitter parado del todo y una PR que el sistema seguía antes de pararse
- **AND** alguien le pone la etiqueta `babysitter:stop` mientras el sistema está parado
- **WHEN** el PR Babysitter arranca
- **THEN** el mantenedor no recibe ningún aviso de esa PR
- **AND** la PR queda detenida

### Requirement: Las comprobaciones son las que exige la rama main
Las comprobaciones de una PR SHALL ser las que el *ruleset* de `main` exige en el momento de leerlas.
Han terminado cuando cada una tiene un resultado sobre el último push; una falla si su resultado no es
correcto, neutro ni saltado. Una comprobación exigida que aún no ha empezado MUST contar como no
terminada.

> Traza: glosario de PB §8 (*comprobación*); decidido por el usuario al explorar el change (25-oct),
> `design.md` decisión 6. *Saltada cuenta como superada*: `linear.md` §7 (`sonar-issues`). El aviso de
> comprobaciones terminadas solo llega si pasan todas: `MOO-81`, decidido por el usuario al explorar
> el change `pr-review-request` (27-oct).

#### Scenario: Terminan las comprobaciones del último push
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones del último push y pasan todas
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
Cuando han terminado las comprobaciones del último push y alguna falla, o cuando pasan todas y ha
terminado la revisión de ese push, el sistema SHALL avisar del estado final, con su motivo, y dejar de
seguir la PR: «lista para integrar» si todas las comprobaciones pasan y el revisor no tiene hallazgos,
y «necesita intervención» en otro caso. Si una comprobación falla, MUST NOT esperar a la revisión, y el
motivo solo dice si el revisor tiene hallazgos cuando ya había terminado ese push. La PR MUST seguir
abierta.

> Traza: `MOO-73`, esquema *el sistema deja de seguir la PR y avisa de su estado final*; BE9; D64 (el
> sistema no integra). *Con hallazgos* usa si el revisor ha tenido alguno en ese push, no si quedan sin
> resolver: en la #62, el bloque seguía diciendo que había hallazgos sin resolver con los hilos ya
> resueltos (`design.md` decisión 7). Si falla una comprobación: `MOO-81`, criterio *no pide la
> revisión si alguna comprobación falla* (*sin esperar a la revisión*, asumido en la historia); solo
> el aviso final, sin el de comprobaciones terminadas: decidido por el usuario al explorar el change
> `pr-review-request` (27-oct), su `design.md` decisión 4.

#### Scenario: Todo pasa y el revisor no tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa sin hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «lista para integrar»
- **AND** la PR sigue abierta

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que el revisor tiene hallazgos
- **AND** la PR sigue abierta

#### Scenario: Falla una comprobación
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones de su último push y alguna ha fallado
- **THEN** el sistema no pide la revisión al revisor
- **AND** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación falla, sin esperar a la revisión
- **AND** el aviso no dice que la revisión no ha terminado
- **AND** el mantenedor no recibe el aviso de comprobaciones terminadas
- **AND** la PR sigue abierta

#### Scenario: Falla una comprobación y el revisor ya había revisado con hallazgos (asumido)
- **GIVEN** el sistema sigue una PR y el revisor ya ha revisado su último push con hallazgos, por su revisión automática
- **WHEN** terminan las comprobaciones de ese push y alguna ha fallado
- **THEN** el mantenedor recibe un aviso de que el sistema deja de seguirla, con el estado «necesita intervención», qué comprobación falla y el motivo de que el revisor tiene hallazgos

### Requirement: Si algo no termina en 30 minutos, la PR necesita intervención
Si una comprobación del último push no ha terminado 30 minutos después de que el sistema vea ese push,
o la revisión no ha terminado 30 minutos después de que el sistema vea pasar sus comprobaciones, que es
cuando la pide, el sistema SHALL avisar de que deja de seguir la PR, con el estado «necesita
intervención» y qué no ha terminado. Si no llegó a pedir la revisión, el motivo MUST NOT decir que la
revisión no ha terminado.

> Traza: `MOO-73`, criterio *una comprobación o la revisión no termina a tiempo*. Los 30 min salen de
> la medición de #57-#68 (comprobaciones hasta 10,5 min, revisión hasta 20,7 min) y los decidió el
> usuario al explorar el change: `docs/umbrales-para-specs.md`, `design.md` decisión 8. Con `MOO-81`
> la revisión empieza al pasar las comprobaciones y no en paralelo: dos relojes de 30 min, decididos
> por el usuario al explorar el change `pr-review-request` (27-oct), su `design.md` decisión 5.

#### Scenario: La revisión no termina a tiempo
- **GIVEN** el sistema ha pedido la revisión del último push de una PR al pasar sus comprobaciones
- **WHEN** pasan 30 minutos desde la petición sin que el revisor haya revisado ese push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que la revisión no ha terminado

#### Scenario: Comprobaciones lentas y revisión dentro de su plazo
- **GIVEN** las comprobaciones del último push de una PR tardan 20 minutos en pasar y el sistema pide entonces la revisión
- **WHEN** el revisor termina sin hallazgos 20 minutos después de la petición
- **THEN** el mantenedor recibe el aviso de estado final «lista para integrar»

#### Scenario: Una comprobación no termina a tiempo
- **GIVEN** el sistema sigue una PR
- **WHEN** pasan 30 minutos desde que el sistema vio el último push con una comprobación sin terminar
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación no ha terminado
- **AND** el aviso no dice que la revisión no ha terminado

### Requirement: Un push nuevo vuelve a empezar el seguimiento
Un push nuevo a una PR SHALL volver a empezar su seguimiento: los avisos de comprobaciones terminadas y
de estado final se refieren a ese push, y el tiempo de espera cuenta desde él. Si el sistema seguía la
PR, MUST NOT avisar del push; si ya había dejado de seguirla, SHALL avisar de nuevo de que la sigue. En
una PR con la etiqueta `babysitter:stop`, un push nuevo MUST NOT cambiar nada hasta que se reanude.

> Traza: `MOO-73`, esquema *un push nuevo vuelve a empezar el seguimiento*. La excepción de la PR
> detenida: `MOO-74`, criterio *un push nuevo no reanuda una PR detenida*.

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

### Requirement: La etiqueta babysitter:stop detiene el seguimiento de una PR
Mientras una PR tenga la etiqueta `babysitter:stop`, el sistema MUST NOT avanzar en ella ni avisar de
sus cambios de estado. Al ver la etiqueta en una PR que seguía, SHALL dejar terminar lo que estaba en
curso y después avisar una vez, identificando la PR, de que ha detenido su seguimiento.

> Traza: `MOO-74`, criterios *detener el seguimiento de una PR* y *un push nuevo no reanuda una PR
> detenida*; BE11. La etiqueta como señal, decidida por el usuario al explorar el change (27-oct),
> `design.md` decisión 1. Detener una PR en estado final: decidido al explorar el change,
> `design.md` decisión 2.

#### Scenario: Detener una PR que el sistema sigue
- **GIVEN** el sistema sigue una PR y espera a que terminen sus comprobaciones
- **WHEN** alguien con permiso de escritura le pone la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema ha detenido su seguimiento
- **AND** aunque terminen sus comprobaciones y la revisión, no recibe ningún aviso más de esa PR

#### Scenario: Detener una PR con un aviso en curso
- **GIVEN** el sistema sigue una PR y tiene pendiente un aviso de ella porque Linear no lo aceptó
- **WHEN** le ponen la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe primero el aviso pendiente y después el de que el sistema ha detenido su seguimiento

#### Scenario: Detener una PR que ya tiene su estado final
- **GIVEN** el sistema ha avisado del estado final de una PR
- **WHEN** le ponen la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema ha detenido su seguimiento

#### Scenario: Un push nuevo no reanuda una PR detenida
- **GIVEN** una PR con la etiqueta `babysitter:stop`
- **WHEN** llega un push nuevo a esa PR
- **THEN** el mantenedor no recibe ningún aviso de esa PR
- **AND** la PR sigue detenida

#### Scenario: Una PR que el sistema ve por primera vez ya detenida (asumido)
- **GIVEN** una PR del mantenedor en borrador contra `main` con la etiqueta `babysitter:stop`
- **WHEN** la PR pasa a lista para revisar
- **THEN** el mantenedor no recibe ningún aviso de esa PR
- **AND** la PR queda detenida

### Requirement: Quitar la etiqueta reanuda el seguimiento desde el último push
Al ver que una PR detenida ya no tiene la etiqueta `babysitter:stop`, el sistema SHALL avisar una vez,
identificando la PR, de que ha reanudado su seguimiento, y seguirla desde el último push, con el
tiempo de espera contado desde que lo ve. Si la PR ya tenía su estado final y su último push no ha
cambiado, SHALL solo avisar de que la ha reanudado.

> Traza: `MOO-74`, criterio *reanudar el seguimiento de una PR*. Empezar desde el último push y la
> excepción del estado final: decididos por el usuario al explorar el change (27-oct), `design.md`
> decisión 2.

#### Scenario: Reanudar una PR detenida antes de su estado final
- **GIVEN** una PR detenida antes de que el sistema avisara de su estado final
- **WHEN** alguien con permiso de escritura le quita la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema ha reanudado su seguimiento
- **AND** no recibe el aviso de que el sistema sigue la PR
- **AND** los avisos de comprobaciones terminadas y de estado final se refieren al último push

#### Scenario: Reanudar una PR que llevaba más de 30 minutos detenida
- **GIVEN** una PR detenida hace más de 30 minutos, con sus comprobaciones sin terminar
- **WHEN** le quitan la etiqueta `babysitter:stop`
- **THEN** el mantenedor no recibe el estado «necesita intervención» por tiempo hasta que pasen 30 minutos desde que el sistema la reanudó

#### Scenario: Reanudar una PR en estado final sin push nuevo
- **GIVEN** una PR detenida después de que el sistema avisara de su estado final, sin pushes nuevos desde entonces
- **WHEN** le quitan la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe solo el aviso de que el sistema ha reanudado su seguimiento
- **AND** no recibe ningún aviso más de esa PR hasta que llegue un push nuevo

#### Scenario: Reanudar una PR en estado final con un push nuevo
- **GIVEN** una PR detenida después de que el sistema avisara de su estado final, que ha recibido un push nuevo mientras estaba detenida
- **WHEN** le quitan la etiqueta `babysitter:stop`
- **THEN** el mantenedor recibe el aviso de que el sistema ha reanudado su seguimiento
- **AND** los avisos de comprobaciones terminadas y de estado final se refieren a ese push

### Requirement: Solo quien puede etiquetar la PR la detiene o la reanuda
El sistema SHALL detener o reanudar una PR solo por la etiqueta `babysitter:stop`, que en este repo
solo pueden poner o quitar quienes tienen permiso de escritura. Un comentario o cualquier otra acción
en la PR MUST NOT detenerla ni reanudarla.

> Traza: `MOO-74`, criterio *solo quien tiene permiso de escritura en el repo detiene o reanuda una
> PR*; BE6. En un repo de una cuenta personal solo el dueño y los colaboradores etiquetan (documentación
> de GitHub, comprobado el 27-oct), `design.md` decisión 1.

#### Scenario: Una persona sin permiso de escritura pide detenerla
- **GIVEN** el sistema sigue una PR
- **WHEN** alguien sin permiso de escritura en el repo comenta en ella que la detenga
- **THEN** el seguimiento de la PR no cambia

#### Scenario: Una persona sin permiso de escritura pide reanudarla
- **GIVEN** una PR con la etiqueta `babysitter:stop`
- **WHEN** alguien sin permiso de escritura en el repo comenta en ella que la reanude
- **THEN** la PR sigue detenida

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

### Requirement: El sistema pide la revisión cuando pasan las comprobaciones del último push
Cuando terminan las comprobaciones del último push de una PR que sigue y pasan todas, el sistema SHALL
pedir al revisor que revise ese push, con un comentario en la PR que diga que lo pide el PR Babysitter.
MUST NOT pedirla mientras alguna comprobación no haya terminado o si alguna falla.

> Traza: `MOO-81`, criterios *pide la revisión cuando las comprobaciones pasan*, *pide la revisión
> cuando una PR en borrador pasa a lista para revisar* y *la petición se identifica como del sistema*;
> BH5, BE4 (sus comentarios en la PR se identifican como del sistema) y D68. La petición sale a nombre
> del mantenedor y se identifica por su texto: decidido por el usuario al explorar el change
> `pr-review-request` (27-oct), `design.md` decisión 1.

#### Scenario: Pasan todas las comprobaciones
- **GIVEN** el sistema sigue una PR
- **WHEN** todas las comprobaciones de su último push terminan en verde
- **THEN** el sistema pide al revisor que revise ese push

#### Scenario: Un borrador pasa a lista para revisar con las comprobaciones en verde
- **GIVEN** una PR del mantenedor en borrador cuyas comprobaciones del último push han terminado en verde
- **WHEN** el mantenedor la marca lista para revisar
- **THEN** el sistema pide al revisor que revise ese push

#### Scenario: La petición se identifica como del sistema
- **GIVEN** el sistema sigue una PR
- **WHEN** el sistema pide al revisor que revise su último push
- **THEN** la petición dice en la PR que la pide el PR Babysitter

### Requirement: El sistema no pide dos veces la revisión del mismo push
El sistema MUST NOT pedir la revisión de un push si el revisor ya lo está revisando o lo ha revisado, ni
si el propio sistema ya la ha pedido, también después de reiniciarse. Solo MUST contar como petición del
sistema la escrita con su token.

> Traza: `MOO-81`, esquema *no pide dos veces la revisión del mismo push*; BE12 y D68 (una vez por
> push). La petición a mano del mantenedor cuenta en cuanto el revisor empieza a revisar (unos 18 s
> en la #64 y la #67): el hueco hasta entonces lo aceptó el usuario al explorar el change
> `pr-review-request` (27-oct), `design.md` decisión 3. Solo las peticiones del token: BE6.

#### Scenario: El revisor ya ha revisado ese push
- **GIVEN** el sistema sigue una PR y el revisor ya ha revisado su último push, por su revisión automática
- **WHEN** todas las comprobaciones de ese push terminan en verde
- **THEN** el sistema no pide la revisión al revisor

#### Scenario: El mantenedor ya ha pedido la revisión de ese push
- **GIVEN** el sistema sigue una PR, el mantenedor ha pedido la revisión de su último push y el revisor ha empezado a revisarlo
- **WHEN** todas las comprobaciones de ese push terminan en verde
- **THEN** el sistema no pide la revisión al revisor

#### Scenario: El sistema ya la había pedido antes de reiniciarse
- **GIVEN** el sistema ha pedido la revisión del último push de una PR y se reinicia antes de que el revisor empiece a revisarlo
- **WHEN** vuelve a seguir la PR
- **THEN** no pide otra vez la revisión de ese push

#### Scenario: Un comentario de otra cuenta que imita la petición del sistema (asumido)
- **GIVEN** el sistema sigue una PR y alguien que no es el mantenedor ha copiado en ella la petición del sistema para el último push
- **WHEN** todas las comprobaciones de ese push terminan en verde
- **THEN** el sistema pide al revisor que revise ese push

### Requirement: El sistema solo escribe en GitHub para pedir la revisión
Lo único que el sistema SHALL escribir en GitHub son sus peticiones de revisión: MUST NOT escribir otros
comentarios, revisiones, commits ni merges. Su token de GitHub MUST NOT poder integrar una PR ni subir
commits.

> Traza: BE2 y D64 (el sistema no integra); `MOO-81`, *Contexto técnico* (el PAT pasa a tener
> escritura en *Issues* y *Pull requests*, sin *Contents*). Sustituye a «El sistema no escribe en
> GitHub»: change `pr-review-request`, `design.md` decisión 1, que matiza D71.

#### Scenario: Una PR seguida hasta su estado final
- **GIVEN** el sistema ha seguido una PR hasta avisar de su estado final
- **WHEN** el mantenedor revisa la PR en GitHub
- **THEN** lo único hecho con el token del sistema son sus peticiones de revisión, como mucho una por push

#### Scenario: El token del sistema no puede integrar
- **GIVEN** el token de GitHub del sistema
- **WHEN** se intenta integrar una PR con él
- **THEN** GitHub lo rechaza y la PR sigue abierta
