## MODIFIED Requirements

### Requirement: Las comprobaciones son las que exige la rama main
Las comprobaciones de una PR SHALL ser las que el *ruleset* de `main` exige en el momento de leerlas.
Han terminado cuando cada una tiene un resultado sobre el último push; una falla si su resultado no es
correcto, neutro ni saltado. Una comprobación exigida que aún no ha empezado MUST contar como no
terminada, salvo que no vaya a ejecutarse.

Una comprobación exigida no va a ejecutarse cuando no tiene resultado ni está en cola ni en curso,
otra del último push ha fallado, ninguna está en cola ni en curso y el sistema lleva 2 minutos viendo
la PR así. Entonces las comprobaciones MUST contar como terminadas, sin esperar al plazo de 30
minutos, y el aviso MUST nombrar las que no han llegado a ejecutarse, sin decir que no han terminado.
Si algo entra en cola o en curso durante esos 2 minutos, MUST esperarse a que termine, y los 2
minutos vuelven a empezar después. Una comprobación que falla y se va a relanzar no cuenta como
fallada hasta que termina su relanzamiento (requisito *Una comprobación relanzable que falla en su
primer intento se relanza una vez*).

> Traza: glosario de PB §8 (*comprobación*); decidido por el usuario al explorar el change (25-oct),
> `design.md` decisión 6. *Saltada cuenta como superada*: `linear.md` §7 (`sonar-issues`). El aviso de
> comprobaciones terminadas solo llega si pasan todas: `MOO-81`, decidido por el usuario al explorar
> el change `pr-review-request` (27-oct). Las que no van a ejecutarse: `MOO-164`, criterios *una
> comprobación falla y las que quedan no van a ejecutarse*, *el aviso espera a las comprobaciones que
> aún van a terminar*, *una comprobación relanzada que pasa no deja aviso* y *el aviso dice qué falla
> y qué no llegó a ejecutarse*. Los 2 minutos y que cuenten desde que el sistema lo ve: decididos al
> explorar el change `pr-checks-not-run` (20-nov), su `design.md` decisiones 2 y 3, con la medición de
> `docs/umbrales-para-specs.md`.

#### Scenario: Terminan las comprobaciones del último push
- **GIVEN** el sistema sigue una PR
- **WHEN** terminan las comprobaciones del último push y pasan todas
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que sus comprobaciones han terminado

#### Scenario: Una comprobación exigida aún no ha empezado (asumido)
- **GIVEN** el sistema sigue una PR y todas las comprobaciones del último push han terminado y pasado salvo una exigida por `main` que aún no ha empezado
- **WHEN** el sistema vuelve a leer la PR
- **THEN** el mantenedor no recibe el aviso de comprobaciones terminadas
- **AND** el sistema sigue esperando esa comprobación hasta el plazo de 30 minutos

#### Scenario: Una comprobación falla y las que quedan no van a ejecutarse
- **GIVEN** el sistema sigue una PR y una comprobación del último push que no se relanza ha fallado
- **AND** ninguna otra está en cola ni en curso, y una exigida por `main` no ha empezado
- **WHEN** pasan 2 minutos así
- **THEN** el mantenedor recibe un aviso, que identifica la PR, de que el sistema deja de seguirla, con el estado «necesita intervención», sin esperar al plazo de 30 minutos
- **AND** el resumen del triaje de ese push llega con el aviso

#### Scenario: Antes de los 2 minutos no hay aviso
- **GIVEN** el sistema sigue una PR y una comprobación del último push que no se relanza ha fallado
- **AND** ninguna otra está en cola ni en curso, y una exigida por `main` no ha empezado
- **WHEN** el sistema vuelve a leer la PR antes de que pasen 2 minutos así
- **THEN** el mantenedor no recibe el aviso «necesita intervención»

#### Scenario: El aviso espera a una comprobación en curso
- **GIVEN** el sistema sigue una PR, una comprobación del último push ha fallado y otra está en curso
- **WHEN** el sistema vuelve a leer la PR
- **THEN** el mantenedor no recibe el aviso «necesita intervención» hasta que esa comprobación termine o venza el plazo de 30 minutos

#### Scenario: El aviso espera a una comprobación en cola
- **GIVEN** el sistema sigue una PR, una comprobación del último push ha fallado y otra está en cola, esperando para empezar
- **WHEN** el sistema vuelve a leer la PR
- **THEN** el mantenedor no recibe el aviso «necesita intervención» hasta que esa comprobación termine o venza el plazo de 30 minutos

#### Scenario: Una comprobación que entra en cola durante los 2 minutos se espera
- **GIVEN** el sistema sigue una PR, una comprobación del último push ha fallado y ninguna otra está en cola ni en curso
- **WHEN** antes de que pasen 2 minutos entra en cola otra comprobación exigida
- **THEN** el mantenedor no recibe el aviso «necesita intervención» hasta que esa comprobación termine y pasen otros 2 minutos sin nada en cola ni en curso

#### Scenario: Una comprobación relanzada que pasa no deja aviso
- **GIVEN** el sistema sigue una PR y ha relanzado una comprobación del último push que falló
- **WHEN** el relanzamiento pasa
- **THEN** el mantenedor no recibe el aviso «necesita intervención» por ese fallo
- **AND** el sistema espera a las comprobaciones que quedan como si no hubiera fallado ninguna

#### Scenario: El aviso dice qué falla y qué no llegó a ejecutarse
- **GIVEN** el sistema sigue una PR, una comprobación del último push ha fallado y otra exigida no va a ejecutarse
- **WHEN** el sistema avisa de que la PR necesita intervención
- **THEN** el motivo nombra la comprobación que falla
- **AND** nombra la que no ha llegado a ejecutarse
- **AND** no dice que alguna comprobación no ha terminado
