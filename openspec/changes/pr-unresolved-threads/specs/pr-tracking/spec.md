# Spec Delta

## MODIFIED Requirements

### Requirement: Al terminar comprobaciones y revisión, el sistema avisa del estado final y deja de seguir la PR
Cuando han terminado las comprobaciones del último push y alguna falla, o cuando pasan todas y ha
terminado la revisión de ese push, el sistema SHALL avisar del estado final, con su motivo, y dejar de
seguir la PR. El estado es:
- «lista para integrar» si todas las comprobaciones pasan y al revisor no le queda ningún hilo sin
  resolver, de ningún push;
- «necesita intervención» en otro caso.

Si una comprobación falla, MUST NOT esperar a la revisión. Si al revisor le quedan hilos sin resolver,
el motivo MUST decir que tiene hallazgos y si son de un push anterior. La PR MUST seguir abierta.

> Traza: `MOO-73`, esquema *el sistema deja de seguir la PR y avisa de su estado final*; BE9; D64 (el
> sistema no integra). Si falla una comprobación: `MOO-81`, criterio *no pide la revisión si alguna
> comprobación falla* (*sin esperar a la revisión*, asumido en la historia); solo el aviso final, sin
> el de comprobaciones terminadas: decidido por el usuario al explorar el change `pr-review-request`
> (27-oct), su `design.md` decisión 4. *Con hallazgos* son los hilos del revisor sin resolver, de
> cualquier push, y no el bloque de estado del revisor:
> - en la #62, el bloque seguía diciendo que había hallazgos con los hilos ya resueltos;
> - en la #166, arrastraba los de otro push.
>
> `MOO-173`, criterios *un comentario sin resolver de un push anterior es un hallazgo*, *el mantenedor
> sabe de qué push viene cada hallazgo* (motivo *(asumido)* en la historia) y *un comentario sin
> resolver que el último push ya arregla*. Decidido por el usuario al explorar el change (20-nov),
> `design.md` decisiones 1 y 2.

#### Scenario: Todo pasa y el revisor no tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push, el revisor lo revisa sin hallazgos y no le queda ningún hilo sin resolver
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «lista para integrar»
- **AND** la PR sigue abierta

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que el revisor tiene hallazgos
- **AND** la PR sigue abierta

#### Scenario: Un hilo sin resolver de un push anterior
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor lo revisa sin hallazgos
- **AND** el revisor tiene un comentario sin resolver sobre un push anterior
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe el aviso «necesita intervención», con el motivo de que el revisor tiene hallazgos de un push anterior

#### Scenario: Hallazgos del último push y de uno anterior (asumido)
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor lo revisa con hallazgos
- **AND** el revisor tiene además un comentario sin resolver sobre un push anterior
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe el aviso «necesita intervención», con el motivo de que el revisor tiene hallazgos de este push y de uno anterior

#### Scenario: Los hilos resueltos no cuentan
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor lo ha revisado
- **AND** todos los hilos del revisor están resueltos, aunque su bloque de estado diga que tiene hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe el aviso «lista para integrar»

#### Scenario: Un comentario que el último push ya arregla cuenta hasta que se resuelve su hilo
- **GIVEN** una PR con un comentario sin resolver del revisor sobre un push anterior, que el código del último push ya arregla
- **AND** su último push pasa todas las comprobaciones y el revisor lo revisa sin hallazgos
- **WHEN** han terminado las comprobaciones y la revisión del último push
- **THEN** el mantenedor recibe el aviso «necesita intervención», con el motivo de que el revisor tiene hallazgos de un push anterior

#### Scenario: Falla una comprobación
- **GIVEN** el sistema sigue una PR sin hilos del revisor sin resolver
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

#### Scenario: Falla una comprobación con un hilo sin resolver de un push anterior (asumido)
- **GIVEN** el sistema sigue una PR con un comentario sin resolver del revisor sobre un push anterior
- **WHEN** terminan las comprobaciones de su último push y alguna ha fallado
- **THEN** el mantenedor recibe un aviso, sin esperar a la revisión, con el estado «necesita intervención», qué comprobación falla y el motivo de que el revisor tiene hallazgos de un push anterior
