# Spec Delta

## ADDED Requirements

### Requirement: Una comprobación relanzable que ha fallado dos veces sale real por regla
Si una comprobación relanzable vuelve a fallar tras relanzarse en ese push, a mano o por el sistema, el
sistema SHALL clasificarla como real por regla, sin el modelo de decisión, antes que la regla de sin
contexto y que el tope. La decisión MUST registrar que ha fallado dos veces y, si el error del último
intento es un caso evidente, cuál.

> Traza: `MOO-155`, criterios *la comprobación vuelve a fallar al relanzarla* y *una comprobación ya
> relanzada en ese push no se vuelve a relanzar* (un relanzamiento a mano cuenta, *(asumido)* en la
> historia); D114. Resuelve BQ8: una comprobación exigida en rojo bloquea el merge, así que hay que
> atenderla en la PR aunque no la cause (D# nueva, `design.md` decisión 1). El caso evidente con el
> error del último intento, y no al relanzar: decidido al explorar el change (20-nov), `design.md`
> decisión 6.

#### Scenario: El relanzamiento vuelve a fallar
- **GIVEN** una PR cuya comprobación `e2e` ha fallado en su último push y ha vuelto a fallar al relanzarla
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por una regla, y dice que ha fallado dos veces
- **AND** el modelo de decisión no recibe ninguna pregunta sobre él

#### Scenario: Un relanzamiento a mano cuenta (asumido)
- **GIVEN** una PR cuya comprobación `test` ha relanzado a mano el mantenedor en su último push y ha vuelto a fallar
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por una regla, y dice que ha fallado dos veces

#### Scenario: El error del último intento es un timeout
- **GIVEN** una PR cuya comprobación `e2e` ha vuelto a fallar al relanzarla, con el error `Test timeout of 30000ms exceeded`
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, dice que ha fallado dos veces y que es un caso evidente: *timeout*

#### Scenario: El error del último intento es de infraestructura
- **GIVEN** una PR cuya comprobación `test` ha vuelto a fallar al relanzarla, en el paso que instala las dependencias
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, dice que ha fallado dos veces y que es un caso evidente: infraestructura

#### Scenario: El error del último intento no es un caso evidente
- **GIVEN** una PR cuya comprobación `e2e` ha vuelto a fallar al relanzarla, con una aserción (p. ej., 104,7 ms frente a un límite de 100)
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real y dice que ha fallado dos veces, sin caso evidente

#### Scenario: La regla no necesita contexto
- **GIVEN** una PR cuya comprobación `test` ha vuelto a fallar al relanzarla y cuyo log no se puede leer
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por una regla, y no como exige criterio

### Requirement: Una comprobación relanzable sin resultado tras relanzarla exige criterio
Si una comprobación relanzable no se ha podido relanzar, no ha terminado tras relanzarla o se ha
cancelado, el sistema SHALL clasificarla como exige criterio, sin el modelo de decisión, y el resumen
MUST decir cuál de los tres motivos es.

> Traza: `MOO-155`, criterios *el relanzamiento no llega a dar resultado* y *una comprobación cancelada
> no se relanza* (las clases, *(asumido)* en la historia); glosario de PB §8 (*exige criterio*: el
> sistema no lo decide solo).

#### Scenario: GitHub rechaza el relanzamiento
- **GIVEN** una PR cuya comprobación `e2e` ha fallado en su último push y GitHub ha rechazado relanzarla
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como exige criterio, con el motivo de que el sistema no ha podido relanzarla

#### Scenario: El relanzamiento no termina a tiempo
- **GIVEN** una PR cuyo relanzamiento de `e2e` no ha terminado 30 minutos después de pedirlo
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como exige criterio, con el motivo de que el relanzamiento no ha terminado

#### Scenario: La comprobación se ha cancelado
- **GIVEN** una PR cuya comprobación `e2e` del último push ha acabado cancelada
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como exige criterio, con el motivo de que se ha cancelado
- **AND** el modelo de decisión no recibe ninguna pregunta sobre él

## MODIFIED Requirements

### Requirement: El resumen del triaje es un comentario del sistema por push
El sistema SHALL publicar el triaje en un comentario de la PR que diga que es del PR Babysitter y de qué
push es, con cada hallazgo, su clase y por qué: la probabilidad frente al umbral, o la regla que lo ha
decidido; y, en una comprobación, de dónde sale su contexto y si se ha cortado. El resumen SHALL decir
también qué comprobaciones se relanzaron y pasaron, y MUST publicarse aunque la PR acabe lista para
integrar si alguna se relanzó y pasó. MUST publicar como mucho uno por push; un push nuevo MUST tener el
suyo, sin tocar el anterior.

> Traza: `MOO-75`, caso feliz (*la PR tiene un comentario resumen del sistema*) y criterio *un solo
> resumen por push, aunque los hallazgos lleguen en tandas*; BE4 (sus comentarios en la PR se
> identifican como del sistema); BQ2, resuelta al refinar la historia (28-oct). El porqué como la
> probabilidad frente al umbral, y un comentario nuevo por push: decididos por el usuario al explorar
> el change (28-oct), `design.md` decisiones 3 y 7. El origen del contexto: `MOO-159`, criterio *la
> decisión registra que el contexto sale de <origen>*; que vaya también en el resumen, y no solo en la
> traza, se decidió al explorar el change (13-nov), `design.md` decisión 2. Lo relanzado que pasa:
> `MOO-155`, criterios *la comprobación pasa al relanzarla* y *el relanzamiento pasa y la PR sigue su
> camino*; en el resumen de la PR y no en el aviso de Linear, decidido por el usuario al explorar el
> change `pr-check-rerun` (20-nov).

#### Scenario: El resumen se identifica y dice de qué push es
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el sistema publica su triaje
- **THEN** el comentario dice que es del PR Babysitter y a qué push se refiere

#### Scenario: Reintentar no duplica el resumen (asumido)
- **GIVEN** una PR que ya tiene el resumen del triaje de su último push
- **WHEN** el sistema vuelve a publicar el triaje de ese mismo push, tras un fallo
- **THEN** la PR sigue teniendo un solo resumen de ese push

#### Scenario: Un push nuevo tiene su propio resumen
- **GIVEN** una PR con el resumen del triaje de un push anterior
- **WHEN** el sistema tría los hallazgos de un push nuevo
- **THEN** la PR tiene un resumen nuevo para ese push y el del anterior sigue como estaba

#### Scenario: Una comprobación relanzada que pasa en una PR lista para integrar
- **GIVEN** una PR cuya comprobación `e2e` ha fallado en su último push y ha pasado al relanzarla
- **WHEN** la PR llega a lista para integrar
- **THEN** la PR tiene un resumen de ese push que dice que `e2e` se relanzó y pasó, sin hallazgos

#### Scenario: Una comprobación relanzada que pasa junto a otros hallazgos
- **GIVEN** una PR cuya comprobación `e2e` ha pasado al relanzarla y cuya comprobación `lint` falla en su último push
- **WHEN** el sistema publica su triaje
- **THEN** el resumen da `lint` como real y dice que `e2e` se relanzó y pasó

#### Scenario: Una PR sin relanzamientos ni hallazgos no tiene resumen
- **GIVEN** una PR cuyas comprobaciones pasan todas a la primera en su último push
- **WHEN** la PR llega a lista para integrar
- **THEN** la PR no tiene resumen del triaje de ese push

### Requirement: Una comprobación que falla sale real, no aplica o exige criterio según su causa
Para cada comprobación que falla que no decide una regla y que no es relanzable, el sistema SHALL
preguntar al modelo de decisión si la causa esta PR, y SHALL clasificarla por la probabilidad del sí:
**real** si llega al umbral, **no aplica** si no pasa de su complemento y **exige criterio** entre los
dos. El umbral MUST ser 0,80 y configurable.

> Traza: sustituye el requisito *Cada hallazgo sale real, no aplica o exige criterio según la
> probabilidad del modelo*, sin cambiar nada de las comprobaciones. `MOO-75`, caso feliz (*su clase
> (real, no aplica o exige criterio)*); glosario de PB §8 (*triaje*). *Exige criterio* cuando el
> sistema no lo tiene claro: change `pr-shadow-triage`, `design.md` decisiones 3 y 4. El 0,80 es
> *(asumido)*: `docs/umbrales-para-specs.md`; lo ajusta `MOO-76`. La pregunta de la causa: `MOO-159`,
> criterio *el modelo de decisión recibe la pregunta de la causa y el error completo*; D114. Las
> relanzables quedan fuera: `MOO-155`, criterio *la comprobación vuelve a fallar al relanzarla* (real
> por regla, sin el modelo). Una comprobación que la PR no causa sigue saliendo *no aplica* en las que
> se preguntan: BQ8 se resuelve con la regla de las relanzables, que eran el caso que la abrió.

#### Scenario: El modelo lo tiene claro y la causa la PR
- **GIVEN** una PR que necesita intervención con una comprobación que falla en su último push y que no decide una regla
- **WHEN** el modelo da una probabilidad de 0,80 o más de que la causa esta PR
- **THEN** el resumen da el hallazgo como real, con esa probabilidad

#### Scenario: El modelo lo tiene claro y no la causa la PR
- **GIVEN** una PR que necesita intervención con una comprobación que falla en su último push y que no decide una regla
- **WHEN** el modelo da una probabilidad de 0,20 o menos de que la causa esta PR
- **THEN** el resumen da el hallazgo como no aplica, con esa probabilidad

#### Scenario: El modelo no lo tiene claro
- **GIVEN** una PR que necesita intervención con una comprobación que falla en su último push y que no decide una regla
- **WHEN** el modelo da una probabilidad entre 0,20 y 0,80 de que la causa esta PR
- **THEN** el resumen da el hallazgo como exige criterio, porque la probabilidad no llega al umbral

#### Scenario: Una comprobación que falla se pregunta por la causa
- **GIVEN** una PR con una comprobación exigida que no es determinista ni relanzable, p. ej. una nueva, `build` (asumido), que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe la pregunta de si el fallo de `build` lo causa esta PR

#### Scenario: Una comprobación relanzable no se pregunta por la causa
- **GIVEN** una PR con la comprobación `e2e` que ha vuelto a fallar al relanzarla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión no recibe ninguna pregunta sobre él
