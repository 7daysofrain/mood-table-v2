## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: El sistema no escribe en GitHub
**Reason**: Para pedir la revisión (BH5, D68), el sistema tiene que comentar en la PR.
**Migration**: Lo sustituye «El sistema solo escribe en GitHub para pedir la revisión», que mantiene lo
que protegía este requisito: el sistema no hace commits ni merges, y su token no puede integrar (BE2,
D64). El PAT pasa a tener escritura en *Issues* y *Pull requests* (change `pr-review-request`, `design.md`, *Migration Plan*).
