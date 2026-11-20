# Spec Delta

## ADDED Requirements

### Requirement: Una comprobación relanzable que falla en su primer intento se relanza una vez
Si en el último push una relanzable (por defecto `test` y `e2e`; configurable) ha fallado en su
primer intento, el sistema SHALL relanzar una vez los *jobs* fallidos de ese run, sobre el mismo
commit, en cuanto el run termina y sin esperar a las demás comprobaciones, y esperar su resultado sin
avisar. MUST NOT relanzar una cancelada ni
una ya relanzada en ese push. Si GitHub lo rechaza, SHALL avisar «necesita intervención» con ese
motivo; tras un fallo pasajero SHALL volver a decidir con la foto siguiente, y MUST NOT repetir la
petición si esa foto ya trae el segundo intento.

> Traza: `MOO-155`, caso feliz (*se relanza una vez, sobre el mismo commit, sin preguntar al modelo de
> decisión*) y criterios *el relanzamiento pasa y la PR sigue su camino*, *un push nuevo deja sin efecto
> el relanzamiento del anterior*, *el relanzamiento no llega a dar resultado*, *una comprobación ya
> relanzada en ese push no se vuelve a relanzar* y *una comprobación cancelada no se relanza*; D114.
> Relanzar los *jobs* que han fallado del run, y no uno a uno, y reintentar el fallo pasajero: decidido
> al explorar el change (20-nov), `design.md` decisiones 2 y 5. No esperar a las demás: hallado en la
> prueba a mano (20-nov), `design.md` decisión 3. Decidir el reintento con la foto siguiente: hallado
> en la revisión de la PR de `MOO-170` (20-nov), `design.md` decisión 5.

#### Scenario: Falla un e2e en su primer intento
- **GIVEN** el sistema sigue una PR
- **WHEN** termina el run de su último push y `e2e` ha fallado en su primer intento
- **THEN** el sistema relanza los *jobs* que han fallado de ese run, sobre el mismo commit
- **AND** el mantenedor no recibe ningún aviso
- **AND** el sistema no pide la revisión al revisor todavía

#### Scenario: No espera a una comprobación que depende de la que falla
- **GIVEN** el sistema sigue una PR y *SonarCloud Code Analysis* solo se ejecuta si `test` pasa
- **WHEN** termina el run de su último push y `test` ha fallado en su primer intento
- **THEN** el sistema relanza los *jobs* que han fallado de ese run sin esperar a *SonarCloud Code Analysis*

#### Scenario: El relanzamiento pasa y la PR sigue su camino
- **GIVEN** el sistema ha relanzado `e2e` en el último push de una PR, con las demás comprobaciones en verde
- **WHEN** el relanzamiento de `e2e` pasa
- **THEN** el mantenedor no recibe el aviso «necesita intervención» por ese fallo
- **AND** el sistema pide la revisión del revisor y sigue la PR hasta su estado final, como si `e2e` hubiera pasado a la primera (asumido)

#### Scenario: El relanzamiento vuelve a fallar
- **GIVEN** el sistema ha relanzado `test` en el último push de una PR
- **WHEN** el relanzamiento de `test` vuelve a fallar
- **THEN** el sistema no lo relanza otra vez
- **AND** el mantenedor recibe el aviso de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación falla

#### Scenario: Un push nuevo deja sin efecto el relanzamiento del anterior
- **GIVEN** el sistema ha relanzado `test` en un push de una PR y el relanzamiento sigue en curso
- **WHEN** llega un push nuevo a la PR
- **THEN** el resultado de ese relanzamiento no cambia el estado de la PR ni genera aviso (asumido)
- **AND** los avisos de comprobaciones terminadas y de estado final se refieren al push nuevo

#### Scenario: GitHub rechaza el relanzamiento (asumido)
- **GIVEN** el token del sistema no tiene permiso para relanzar
- **WHEN** terminan las comprobaciones del último push de una PR y `e2e` ha fallado en su primer intento
- **THEN** el mantenedor recibe el aviso de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que no ha podido relanzar `e2e`

#### Scenario: Un fallo pasajero al relanzar se reintenta (asumido)
- **GIVEN** `e2e` ha fallado en su primer intento en el último push de una PR
- **WHEN** GitHub no responde a la petición de relanzarlo, y la siguiente vuelta lo ve aún en su
  primer intento
- **THEN** el sistema vuelve a pedir el relanzamiento, sin avisar

#### Scenario: Un relanzamiento que llegó a GitHub sin respuesta no se repite
- **GIVEN** `e2e` ha fallado en su primer intento en el último push de una PR
- **WHEN** la petición de relanzarlo falla sin respuesta, y la siguiente vuelta lo ve ya en su
  segundo intento, porque la petición llegó a GitHub o porque el mantenedor lo ha relanzado a mano
- **THEN** el sistema no vuelve a pedir el relanzamiento y espera el resultado de ese intento

#### Scenario: Una comprobación ya relanzada a mano no se vuelve a relanzar
- **GIVEN** el mantenedor ha relanzado a mano `test` en el último push de una PR
- **WHEN** ese relanzamiento vuelve a fallar
- **THEN** el sistema no lo relanza
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención» con qué comprobación falla

#### Scenario: Una comprobación cancelada no se relanza
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones de su último push y `e2e` ha acabado cancelada
- **THEN** el sistema no la relanza
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención» con qué comprobación falla

#### Scenario: Una comprobación que no es relanzable no se relanza
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones de su último push y solo ha fallado `lint`
- **THEN** el sistema no relanza nada
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención» con qué comprobación falla

#### Scenario: Una determinista que falla en el mismo run se relanza con la relanzable (asumido)
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones de su último push y han fallado `lint` y `e2e` en su primer intento
- **THEN** el sistema relanza los dos *jobs* de ese run

## MODIFIED Requirements

### Requirement: Al terminar comprobaciones y revisión, el sistema avisa del estado final y deja de seguir la PR
Cuando han terminado las comprobaciones del último push y alguna falla, o cuando pasan todas y ha
terminado la revisión de ese push, el sistema SHALL avisar del estado final, con su motivo, y dejar de
seguir la PR: «lista para integrar» si todas las comprobaciones pasan y el revisor no tiene hallazgos,
y «necesita intervención» en otro caso. Si una comprobación falla, MUST NOT esperar a la revisión, y el
motivo solo dice si el revisor tiene hallazgos cuando ya había terminado ese push. Si la que falla es
una relanzable en su primer intento, el estado final MUST esperar a su relanzamiento (requisito *Una
comprobación relanzable que falla en su primer intento se relanza una vez*). La PR MUST seguir
abierta.

> Traza: `MOO-73`, esquema *el sistema deja de seguir la PR y avisa de su estado final*; BE9; D64 (el
> sistema no integra). *Con hallazgos* usa si el revisor ha tenido alguno en ese push, no si quedan sin
> resolver: en la #62, el bloque seguía diciendo que había hallazgos sin resolver con los hilos ya
> resueltos (`design.md` decisión 7). Si falla una comprobación: `MOO-81`, criterio *no pide la
> revisión si alguna comprobación falla* (*sin esperar a la revisión*, asumido en la historia); solo
> el aviso final, sin el de comprobaciones terminadas: decidido por el usuario al explorar el change
> `pr-review-request` (27-oct), su `design.md` decisión 4. La espera al relanzamiento: `MOO-155`,
> criterio *el relanzamiento pasa y la PR sigue su camino*.

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

### Requirement: Si algo no termina en 30 minutos, la PR necesita intervención
Si una comprobación del último push no ha terminado 30 minutos después de que el sistema vea ese push,
o 30 minutos después de relanzarla si se ha relanzado, o la revisión no ha terminado 30 minutos después
de que el sistema vea pasar sus comprobaciones, que es cuando la pide, el sistema SHALL avisar de que
deja de seguir la PR, con el estado «necesita intervención» y qué no ha terminado. Si no llegó a pedir
la revisión, el motivo MUST NOT decir que la revisión no ha terminado.

> Traza: `MOO-73`, criterio *una comprobación o la revisión no termina a tiempo*. Los 30 min salen de
> la medición de #57-#68 (comprobaciones hasta 10,5 min, revisión hasta 20,7 min) y los decidió el
> usuario al explorar el change: `docs/umbrales-para-specs.md`, `design.md` decisión 8. Con `MOO-81`
> la revisión empieza al pasar las comprobaciones y no en paralelo: dos relojes de 30 min, decididos
> por el usuario al explorar el change `pr-review-request` (27-oct), su `design.md` decisión 5. El
> reloj desde el relanzamiento: `MOO-155`, criterio *el relanzamiento no llega a dar resultado*.

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

#### Scenario: El relanzamiento no termina a tiempo
- **GIVEN** el sistema ha relanzado `e2e` en el último push de una PR, 20 minutos después de ver ese push
- **WHEN** pasan 30 minutos desde el relanzamiento sin que `e2e` haya terminado
- **THEN** el mantenedor recibe un aviso de que el sistema deja de seguirla, con el estado «necesita intervención» y qué comprobación no ha terminado

#### Scenario: Un relanzamiento dentro de su plazo
- **GIVEN** las comprobaciones del último push de una PR tardan 20 minutos y el sistema relanza entonces `e2e`
- **WHEN** el relanzamiento de `e2e` pasa 15 minutos después
- **THEN** el mantenedor no recibe el aviso de que la comprobación no ha terminado

### Requirement: El sistema solo escribe en GitHub sus peticiones de revisión y el resumen del triaje
Lo único que el sistema SHALL escribir en GitHub son sus peticiones de revisión, el resumen del triaje
de cada push y el relanzamiento de las comprobaciones relanzables: MUST NOT escribir otros comentarios,
revisiones, commits ni merges. Su token de GitHub MUST NOT poder integrar una PR ni subir commits.

> Traza: BE2 y D64 (el sistema no integra); `MOO-81`, *Contexto técnico* (el PAT tiene escritura en
> *Issues* y *Pull requests*, sin *Contents*); `MOO-75`, caso feliz (*la PR tiene un comentario resumen
> del sistema*). Sustituye a «El sistema solo escribe en GitHub para pedir la revisión»: change
> `pr-shadow-triage`. El relanzamiento y *Actions: write*: `MOO-155`, *Contexto técnico*.

#### Scenario: Una PR seguida hasta su estado final
- **GIVEN** el sistema ha seguido una PR hasta avisar de su estado final
- **WHEN** el mantenedor revisa la PR en GitHub
- **THEN** lo único hecho con el token del sistema son sus peticiones de revisión, sus resúmenes de triaje y sus relanzamientos, como mucho uno de cada por push

#### Scenario: El token del sistema no puede integrar
- **GIVEN** el token de GitHub del sistema
- **WHEN** se intenta integrar una PR con él
- **THEN** GitHub lo rechaza y la PR sigue abierta
