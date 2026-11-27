## MODIFIED Requirements

### Requirement: Al terminar comprobaciones y revisión, el sistema avisa del estado final y deja de seguir la PR
Cuando han terminado las comprobaciones del último push y alguna falla, o cuando pasan todas y ha
terminado la revisión de ese push, el sistema SHALL avisar del estado final, con su motivo, y dejar de
seguir la PR. El estado es:
- «lista para integrar» si todas las comprobaciones pasan y al revisor no le queda ningún hilo sin
  resolver, de ningún push;
- «necesita intervención» en otro caso.

Si una comprobación falla, MUST NOT esperar a la revisión. Si la que falla es una relanzable en su
primer intento, el estado final MUST esperar a su relanzamiento (requisito *Una comprobación
relanzable que falla en su primer intento se relanza una vez*). Si al revisor le quedan hilos sin
resolver, el motivo MUST decir que tiene hallazgos y si son de un push anterior. La PR MUST seguir
abierta.

Si el sistema va a arreglar hallazgos reales de ese push (capacidad `pr-fix`), MUST NOT avisar de su
estado final: el siguiente aviso es el del push del arreglo o el de por qué no se ha arreglado.

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
>
> La espera al relanzamiento: `MOO-155`, criterio *el relanzamiento pasa y la PR sigue su camino*.
>
> Sin aviso del push que se arregla: `MOO-77`, caso feliz; que no se avise *(asumido)*, para no dar un
> «necesita intervención» de algo que el sistema ya está arreglando (change `pr-fixer`, `design.md`
> decisión 10).

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
- **WHEN** terminan las comprobaciones de su último push y alguna que no se relanza ha fallado
- **THEN** el sistema no pide la revisión al revisor
- **AND** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación falla, sin esperar a la revisión
- **AND** el aviso no dice que la revisión no ha terminado
- **AND** el mantenedor no recibe el aviso de comprobaciones terminadas
- **AND** la PR sigue abierta

#### Scenario: Falla una comprobación y el revisor ya había revisado con hallazgos (asumido)
- **GIVEN** el sistema sigue una PR y el revisor ya ha revisado su último push con hallazgos, por su revisión automática
- **WHEN** terminan las comprobaciones de ese push y alguna que no se relanza ha fallado
- **THEN** el mantenedor recibe un aviso de que el sistema deja de seguirla, con el estado «necesita intervención», qué comprobación falla y el motivo de que el revisor tiene hallazgos

#### Scenario: Falla una comprobación con un hilo sin resolver de un push anterior (asumido)
- **GIVEN** el sistema sigue una PR con un comentario sin resolver del revisor sobre un push anterior
- **WHEN** terminan las comprobaciones de su último push y alguna que no se relanza ha fallado
- **THEN** el mantenedor recibe un aviso, sin esperar a la revisión, con el estado «necesita intervención», qué comprobación falla y el motivo de que el revisor tiene hallazgos de un push anterior

#### Scenario: El sistema arregla el push en vez de avisar (asumido)
- **GIVEN** el sistema sigue una PR cuyo último push tiene una comprobación `lint` que falla, real
- **WHEN** el triaje de ese push termina y el sistema sube el arreglo
- **THEN** el mantenedor no recibe el aviso del estado final de ese push
- **AND** el siguiente aviso que recibe es el del estado final del push del arreglo

### Requirement: El sistema solo escribe en GitHub sus peticiones de revisión y el resumen del triaje
Lo único que el sistema SHALL escribir en GitHub son sus peticiones de revisión, el resumen del triaje
de cada push, el relanzamiento de las comprobaciones relanzables y los commits de sus arreglos en la
rama de la PR: MUST NOT escribir otros comentarios, revisiones, commits ni merges. Ninguna de sus
identidades MUST poder integrar una PR ni actualizar `main`; solo la de los arreglos MUST poder subir
commits.

> Traza: BE2 y D64 (el sistema no integra); `MOO-81`, *Contexto técnico* (el PAT tiene escritura en
> *Issues* y *Pull requests*, sin *Contents*); `MOO-75`, caso feliz (*la PR tiene un comentario resumen
> del sistema*). Sustituye a «El sistema solo escribe en GitHub para pedir la revisión»: change
> `pr-shadow-triage`. El relanzamiento y *Actions: write*: `MOO-155`, *Contexto técnico*. Los commits
> de los arreglos, con una identidad propia que no puede integrar: `MOO-77`, caso feliz; BQ7, resuelta
> al explorar el change `pr-fixer` (27-nov), su `design.md` decisión 2.

#### Scenario: Una PR seguida hasta su estado final
- **GIVEN** el sistema ha seguido una PR hasta avisar de su estado final
- **WHEN** el mantenedor revisa la PR en GitHub
- **THEN** lo único hecho con las identidades del sistema son sus peticiones de revisión, sus resúmenes de triaje, sus relanzamientos y los commits de sus arreglos, como mucho un push de arreglos por push

#### Scenario: El token del sistema no puede integrar
- **GIVEN** el token de GitHub del sistema
- **WHEN** se intenta integrar una PR con él
- **THEN** GitHub lo rechaza y la PR sigue abierta

#### Scenario: El token del sistema no sube commits (asumido)
- **GIVEN** el token de GitHub con el que el sistema pide la revisión
- **WHEN** se intenta subir un commit con él
- **THEN** GitHub lo rechaza
