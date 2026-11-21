## ADDED Requirements

### Requirement: Si la PR causa el primer fallo de una relanzable, el sistema no la relanza
Si el triaje del primer fallo da con confianza que la PR causa el fallo de alguna relanzable del
último push, el sistema MUST NOT relanzar ninguna y SHALL seguir hasta el estado final sin esperar a
un relanzamiento. Como se relanzan juntos los *jobs* fallidos del run, si la PR causa uno, no se
relanza ninguno.

> Traza: `MOO-169`, caso feliz (*en caso de que pertenezca a la propia PR marque el hallazgo como real
> y no relance*), criterio *el triador pregunta por la causa antes de relanzar* (fila de `test`) y
> criterio *una la causa la PR y la otra no*. Que no se relance ninguna de las dos es *(asumido)* en la
> historia: el relanzamiento es una sola llamada por run (D119, change `pr-check-rerun` decisión 2).
> Qué hacer con el triaje lo decide un nodo propio, sin modelo: decidido por el usuario al explorar el
> change (21-nov), `design.md` decisión 1.

#### Scenario: La PR causa el fallo de test
- **GIVEN** el sistema sigue una PR y `test` ha fallado en su primer intento en el último push
- **WHEN** el triaje de ese fallo da una probabilidad de 0,80 o más de que lo causa la PR
- **THEN** el sistema no relanza `test`
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención» con `test`, sin
  esperar a un relanzamiento

#### Scenario: La PR causa el fallo de test y no el de e2e (asumido)
- **GIVEN** el sistema sigue una PR y `test` y `e2e` han fallado en su primer intento en el último push
- **WHEN** el triaje da que la PR causa con confianza el fallo de `test` y que no causa el de `e2e`
- **THEN** el sistema no relanza ninguna de las dos
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención» con las dos, sin
  esperar a un relanzamiento

#### Scenario: Lo que no se relanza no vuelve a triarse como primer fallo (asumido)
- **GIVEN** el sistema ha decidido no relanzar `test` en el último push de una PR
- **WHEN** las vueltas siguientes ven `test` todavía en su primer intento fallido
- **THEN** el sistema no lo relanza ni vuelve a preguntar por su causa

## MODIFIED Requirements

### Requirement: Una comprobación relanzable que falla en su primer intento se relanza una vez
Si en el último push una relanzable (por defecto `test` y `e2e`; configurable) ha fallado en su
primer intento, el sistema SHALL triar ese fallo en cuanto el run termina, sin esperar a las demás
comprobaciones, y, salvo que el triaje dé que lo causa la PR, relanzar una vez los *jobs* fallidos de
ese run, sobre el mismo commit, y esperar su resultado sin avisar. MUST NOT relanzar una cancelada ni
una ya relanzada en ese push. Si GitHub lo rechaza, SHALL avisar «necesita intervención» con ese
motivo; tras un fallo pasajero SHALL volver a decidir con la foto siguiente, y MUST NOT repetir la
petición si esa foto ya trae el segundo intento ni pasado el tiempo de espera de las comprobaciones.

> Traza: `MOO-155`, caso feliz (*se relanza una vez, sobre el mismo commit*) y criterios *el
> relanzamiento pasa y la PR sigue su camino*, *un push nuevo deja sin efecto el relanzamiento del
> anterior*, *el relanzamiento no llega a dar resultado*, *una comprobación ya relanzada en ese push no
> se vuelve a relanzar* y *una comprobación cancelada no se relanza*; D114. Relanzar los *jobs* que han
> fallado del run, y no uno a uno, y reintentar el fallo pasajero: decidido al explorar el change
> `pr-check-rerun` (20-nov), su `design.md` decisiones 2 y 5. No esperar a las demás: hallado en la
> prueba a mano (20-nov), su `design.md` decisión 3. Decidir el reintento con la foto siguiente:
> hallado en la revisión de la PR de `MOO-170` (20-nov), su `design.md` decisión 5. Triar antes de
> relanzar, y no relanzar si lo causa la PR: `MOO-169`, caso feliz; matiza D119 (D# nueva,
> `design.md` decisión 1).

#### Scenario: Falla un e2e en su primer intento
- **GIVEN** el sistema sigue una PR
- **WHEN** termina el run de su último push y `e2e` ha fallado en su primer intento
- **AND** el triaje de ese fallo no da que lo cause la PR
- **THEN** el sistema relanza los *jobs* que han fallado de ese run, sobre el mismo commit
- **AND** el mantenedor no recibe ningún aviso
- **AND** el sistema no pide la revisión al revisor todavía

#### Scenario: No espera a una comprobación que depende de la que falla
- **GIVEN** el sistema sigue una PR y *SonarCloud Code Analysis* solo se ejecuta si `test` pasa
- **WHEN** termina el run de su último push y `test` ha fallado en su primer intento
- **AND** el triaje de ese fallo no da que lo cause la PR
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
- **AND** el triaje de ese fallo no da que lo cause la PR
- **THEN** el mantenedor recibe el aviso de que el sistema deja de seguirla, con el estado «necesita intervención» y el motivo de que no ha podido relanzar `e2e`

#### Scenario: Un fallo pasajero al relanzar se reintenta (asumido)
- **GIVEN** `e2e` ha fallado en su primer intento en el último push de una PR y el triaje de ese fallo no da que lo cause la PR
- **WHEN** GitHub no responde a la petición de relanzarlo, y la siguiente vuelta lo ve aún en su
  primer intento
- **THEN** el sistema vuelve a pedir el relanzamiento, sin avisar y sin volver a preguntar por su causa

#### Scenario: Un relanzamiento que llegó a GitHub sin respuesta no se repite
- **GIVEN** `e2e` ha fallado en su primer intento en el último push de una PR
- **WHEN** la petición de relanzarlo falla sin respuesta, y la siguiente vuelta lo ve ya en su
  segundo intento, porque la petición llegó a GitHub o porque el mantenedor lo ha relanzado a mano
- **THEN** el sistema no vuelve a pedir el relanzamiento y espera el resultado de ese intento

#### Scenario: Un relanzamiento que sigue fallando sin respuesta no espera para siempre
- **GIVEN** `e2e` ha fallado en su primer intento en el último push de una PR
- **WHEN** las peticiones de relanzarlo fallan sin respuesta durante 30 min desde que el sistema vio el
  push
- **THEN** el sistema deja de pedirlo
- **AND** el mantenedor recibe el aviso del estado final «necesita intervención», porque las
  comprobaciones no han terminado a tiempo

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
- **AND** el triaje del fallo de `e2e` no da que lo cause la PR
- **THEN** el sistema relanza los dos *jobs* de ese run
