# Spec Delta

## ADDED Requirements

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

## MODIFIED Requirements

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
