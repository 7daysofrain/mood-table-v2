## ADDED Requirements

### Requirement: El primer fallo de una relanzable se tría antes de relanzarla
Cuando una relanzable ha fallado en su primer intento y su run ha terminado, el sistema SHALL triar
ese fallo con la pregunta de la causa antes de decidir si la relanza, y solo ese hallazgo: ni los
hilos del revisor ni las demás comprobaciones. Un caso evidente, una comprobación sin contexto y una
que no cabe en el tope MUST NOT llegar al modelo. Este triaje MUST NOT publicar resumen.

> Traza: `MOO-169`, caso feliz (*quiero que se evalúe si el problema que ha aparecido pertenece a la
> propia PR o a main*) y criterios *el triador pregunta por la causa antes de relanzar*, *un caso
> evidente se relanza sin preguntar* y *la pregunta no llega a dar respuesta* (los dos, *(asumido)* en
> la historia). La pregunta, la de producción sin la lista de ficheros: prueba del 21-nov en la
> historia; D114. Solo las relanzables y sin resumen: decidido al explorar el change (21-nov),
> `design.md` decisiones 2 y 7.

#### Scenario: La PR causa el fallo
- **GIVEN** el sistema sigue una PR y `test` ha fallado en su primer intento en el último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que lo causa la PR
- **THEN** el triador da el fallo de `test` como real, con esa probabilidad

#### Scenario: La PR no causa el fallo
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento en el último push
- **WHEN** el modelo de decisión da una probabilidad de 0,20 o menos de que lo causa la PR
- **THEN** el triador da que el fallo de `e2e` no lo causa la PR y que se capturaría

#### Scenario: No está claro (asumido)
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento en el último push
- **WHEN** el modelo de decisión da una probabilidad entre 0,20 y 0,80 de que lo causa la PR
- **THEN** el triador no da ninguna clase al fallo hasta que se sepa el resultado del relanzamiento

#### Scenario: Un caso evidente no se pregunta (asumido)
- **GIVEN** el sistema sigue una PR y `test` ha fallado en su primer intento con un *timeout*
- **WHEN** el triador tría ese fallo
- **THEN** el modelo de decisión no recibe ninguna pregunta sobre él
- **AND** la decisión registra el caso evidente: *timeout*

#### Scenario: Sin contexto no se pregunta (asumido)
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento sin un contexto que se pueda reunir
- **WHEN** el triador tría ese fallo
- **THEN** el modelo de decisión no recibe ninguna pregunta sobre él
- **AND** la decisión registra que no se ha podido reunir su contexto

#### Scenario: El modelo de decisión falla (asumido)
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento
- **WHEN** el modelo de decisión no responde a la pregunta de su causa
- **THEN** la decisión registra que el modelo de decisión no ha respondido

#### Scenario: El tope de gasto no alcanza (asumido)
- **GIVEN** el sistema sigue una PR que ha llegado al tope de gasto y `e2e` ha fallado en su primer intento
- **WHEN** el triador tría ese fallo
- **THEN** el modelo de decisión no recibe ninguna pregunta sobre él
- **AND** la decisión registra que no cabe en el tope de gasto de la PR

#### Scenario: Solo se tría la relanzable (asumido)
- **GIVEN** una PR con un hilo del revisor sin resolver de un push anterior y `e2e` fallado en su primer intento en el último push
- **WHEN** el triador tría ese primer fallo
- **THEN** el modelo de decisión solo recibe la pregunta de la causa de `e2e`

#### Scenario: El triaje del primer fallo no publica resumen (asumido)
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento en el último push
- **WHEN** el triador ha triado ese fallo y el sistema lo relanza
- **THEN** la PR no tiene todavía resumen del triaje de ese push

### Requirement: El triaje final no vuelve a preguntar lo que respondió el primero
Antes del aviso final, una relanzable que ya se trió en su primer fallo en ese push MUST NOT volver a
preguntarse al modelo de decisión. Si no se relanzó, SHALL salir con la clase del primer triaje; si se
relanzó y ha vuelto a fallar, sigue saliendo real por regla. Un push nuevo SHALL triarse desde cero.

> Traza: `MOO-169`, criterio *el triador pregunta por la causa antes de relanzar* (fila de `test`: *el
> hallazgo sale real*) y criterio *la nota «se capturaría» se mantiene tras el relanzamiento* (fila
> *vuelve a fallar*); D119. No repetir la pregunta ni su gasto: decidido al explorar el change
> (21-nov), `design.md` decisión 4.

#### Scenario: La PR causa el fallo y no se ha relanzado
- **GIVEN** una PR cuyo `test` ha fallado en su primer intento en el último push, el triaje de ese fallo lo ha dado como real con p = 0,93 y el sistema no lo ha relanzado
- **WHEN** el sistema tría los hallazgos antes del aviso final
- **THEN** el resumen da `test` como real, con p = 0,93
- **AND** el modelo de decisión no recibe otra pregunta sobre `test`

#### Scenario: Un push nuevo vuelve a preguntar
- **GIVEN** una PR cuyo `e2e` se trió en su primer fallo en un push anterior
- **WHEN** `e2e` falla en su primer intento en un push nuevo
- **THEN** el modelo de decisión recibe de nuevo la pregunta de la causa de `e2e`

### Requirement: El resumen dice qué respondió el primer triaje de cada relanzable relanzada
Para cada relanzable que el sistema relanzó en el push, el resumen SHALL decir qué respondió el triaje
de su primer fallo: que se capturaría si no lo causa la PR, la probabilidad si no estaba claro, el caso
evidente, o por qué no ha habido respuesta. MUST decirlo tanto si el relanzamiento pasa como si vuelve
a fallar o no llega a dar resultado.

> Traza: `MOO-169`, criterios *la nota «se capturaría» se mantiene tras el relanzamiento*, *un caso
> evidente se relanza sin preguntar* (*la decisión registra el caso evidente*) y *la pregunta no llega
> a dar respuesta* (*el resumen dice que no se ha podido preguntar por la causa, y por qué*); BE4. Que
> sea una nota y no una clase: una comprobación exigida en rojo no puede ser *no aplica* (BQ8, D119).

#### Scenario: El relanzamiento pasa
- **GIVEN** una PR cuyo `e2e` ha fallado en su primer intento, el triaje de ese fallo ha dado que no lo causa la PR y el relanzamiento ha pasado
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen dice que `e2e` se relanzó y pasó, y que el fallo se capturaría
- **AND** `e2e` no sale como hallazgo

#### Scenario: El relanzamiento vuelve a fallar
- **GIVEN** una PR cuyo `e2e` ha fallado en su primer intento, el triaje de ese fallo ha dado que no lo causa la PR y el relanzamiento ha vuelto a fallar
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen da `e2e` como real, decidido por una regla, porque ha fallado dos veces
- **AND** dice que el fallo se capturaría

#### Scenario: El relanzamiento no llega a dar resultado
- **GIVEN** una PR cuyo `e2e` ha fallado en su primer intento, el triaje de ese fallo ha dado que no lo causa la PR y el relanzamiento no ha terminado a tiempo
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen da `e2e` como exige criterio, con el motivo de que el relanzamiento no ha terminado
- **AND** dice que el fallo se capturaría

#### Scenario: La PR causa uno y no el otro (asumido)
- **GIVEN** una PR cuyos `test` y `e2e` han fallado en su primer intento, y el triaje ha dado que la PR causa con confianza el de `test` y no el de `e2e`
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen da `test` como real, con su probabilidad
- **AND** dice que el fallo de `e2e` se capturaría

#### Scenario: Un caso evidente
- **GIVEN** una PR cuyo `test` ha fallado en su primer intento con un *timeout* y el relanzamiento ha pasado
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen dice que `test` se relanzó y pasó, y que el primer fallo era un caso evidente: *timeout*

#### Scenario: No ha habido respuesta (asumido)
- **GIVEN** una PR cuyo `e2e` ha fallado en su primer intento, el modelo de decisión no ha respondido sobre él y el relanzamiento ha pasado
- **WHEN** el sistema publica el resumen del triaje de ese push
- **THEN** el resumen dice que `e2e` se relanzó y pasó, y que no se ha podido preguntar por su causa porque el modelo de decisión no ha respondido

## MODIFIED Requirements

### Requirement: El sistema tría los hallazgos de la PR cuando necesita intervención
Cuando el sistema va a avisar de que una PR «necesita intervención» y tiene hallazgos, SHALL triarlos
antes del aviso. Los hallazgos MUST ser:
- los hilos del revisor sin resolver, sobre cualquier push;
- las comprobaciones que fallan en el último push;
- en lugar de la comprobación de incidencias nuevas de SonarQube, cada incidencia que anota;
- y nada más.

Un hilo resuelto MUST NOT ser un hallazgo. Una PR «lista para integrar», o que necesita intervención
sin hallazgos (algo no termina a tiempo), MUST NOT triarse antes del aviso. Aparte, el primer fallo de
una relanzable SHALL triarse antes de relanzarla (requisito propio).

> Traza: `MOO-75`, caso feliz (*el sistema tría en modo sombra los hallazgos del último push*) y
> criterio *una comprobación que falla se tría como un hallazgo más*; glosario de PB §8 (*hallazgo*).
> Triar justo antes del aviso final, cuando ya están todos los hallazgos del push: decidido por el
> usuario al explorar el change `pr-shadow-triage` (28-oct), su `design.md` decisión 1. Cada
> incidencia en lugar de la comprobación: `MOO-148`, caso feliz; D114. Los hilos sin resolver de
> cualquier push, en lugar de los comentarios del último push: `MOO-173`, criterios *un comentario
> sin resolver de un push anterior es un hallazgo* y *solo los comentarios sin resolver vuelven al
> triador en cada push*. Lo decidió el usuario al refinar la historia (20-nov), porque un comentario
> puede triarse en un push y resolverse en otro posterior. El triaje del primer fallo: `MOO-169`.

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la PR tiene un comentario resumen del sistema con cada hilo sin resolver del revisor, su clase y por qué

#### Scenario: Un comentario sin resolver de un push anterior es un hallazgo
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor lo revisa sin hallazgos
- **AND** el revisor tiene un comentario sin resolver sobre un push anterior
- **WHEN** el sistema va a avisar de su estado final
- **THEN** el resumen del triaje de ese push incluye ese comentario, con su clase y por qué

#### Scenario: Un comentario sin resolver vuelve a triarse en cada push
- **GIVEN** una PR con un comentario del revisor sobre un push anterior, ya triado en el resumen de ese push, y su hilo sin resolver
- **WHEN** el sistema va a avisar del estado final de un push nuevo
- **THEN** ese comentario vuelve a triarse y aparece en el resumen de ese push

#### Scenario: Un comentario resuelto no es un hallazgo
- **GIVEN** una PR con un comentario del revisor sobre un push anterior y su hilo resuelto
- **AND** una comprobación que falla en su último push
- **WHEN** el sistema va a avisar del estado final de ese push
- **THEN** ese comentario no aparece en el resumen de ese push

#### Scenario: Una comprobación que falla es un hallazgo más
- **GIVEN** el sistema sigue una PR y una comprobación de su último push falla
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la comprobación que falla aparece en el resumen con su clase y por qué, como cualquier otro hallazgo

#### Scenario: Sin hallazgos no hay triaje (asumido)
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones, el revisor revisa sin hallazgos y no le queda ningún hilo sin resolver
- **WHEN** el sistema avisa de que está «lista para integrar»
- **THEN** la PR no tiene comentario resumen de ese push

### Requirement: El triaje no actúa sobre la PR
Triar MUST NOT arreglar nada, contestar ni resolver hilos, relanzar comprobaciones, ni cambiar el
estado final ni su aviso. Qué se hace con el resultado del triaje SHALL decidirlo el sistema aparte,
por reglas y sin el modelo de decisión, y la decisión MUST quedar registrada junto con la regla que la
toma. Si el triaje falla, el aviso del estado final MUST llegar igual.

> Traza: `MOO-75`, caso feliz (*el sistema no arregla nada, no contesta y no resuelve ningún hilo*);
> glosario de PB §8 (*modo sombra*); non-goals de la historia (BH3, BH4). Que un triaje que falla no
> retrase el aviso: `design.md` decisión 8 del change `pr-shadow-triage` *(asumido)*. Separar qué pasa
> (el triaje) de qué se hace (una decisión por reglas): decidido por el usuario al explorar el change
> `pr-first-failure-triage` (21-nov), su `design.md` decisión 1; BE4.

#### Scenario: Tras el triaje todo sigue como estaba
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el sistema ha triado sus hallazgos
- **THEN** no hay commits, respuestas ni hilos resueltos nuevos del sistema
- **AND** el mantenedor recibe el aviso del estado final con el mismo estado y motivo que sin el triaje

#### Scenario: El modelo no responde (asumido)
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el modelo de decisión no responde en ninguno de los intentos
- **THEN** el mantenedor recibe igualmente el aviso del estado final

#### Scenario: La decisión queda registrada aparte del triaje (asumido)
- **GIVEN** el sistema sigue una PR y `e2e` ha fallado en su primer intento en el último push
- **WHEN** el sistema ha triado ese fallo y ha decidido si lo relanza
- **THEN** la traza del sistema registra, aparte de la clase del hallazgo, si se relanza y qué regla lo ha decidido

### Requirement: Una comprobación que falla sale real, no aplica o exige criterio según su causa
Para cada comprobación que falla que no decide una regla y que no es relanzable, o que es relanzable y
está en su primer intento, el sistema SHALL preguntar al modelo de decisión si la causa esta PR, y
SHALL clasificarla por la probabilidad del sí: **real** si llega al umbral, **no aplica** si no pasa de
su complemento y **exige criterio** entre los dos. El umbral MUST ser 0,80 y configurable.

> Traza: sustituye el requisito *Cada hallazgo sale real, no aplica o exige criterio según la
> probabilidad del modelo*, sin cambiar nada de las comprobaciones. `MOO-75`, caso feliz (*su clase
> (real, no aplica o exige criterio)*); glosario de PB §8 (*triaje*). *Exige criterio* cuando el
> sistema no lo tiene claro: change `pr-shadow-triage`, `design.md` decisiones 3 y 4. El 0,80 es
> *(asumido)*: `docs/umbrales-para-specs.md`; lo ajusta `MOO-76`. La pregunta de la causa: `MOO-159`,
> criterio *el modelo de decisión recibe la pregunta de la causa y el error completo*; D114. Las
> relanzables que han vuelto a fallar quedan fuera: `MOO-155`, criterio *la comprobación vuelve a
> fallar al relanzarla* (real por regla, sin el modelo). Una comprobación que la PR no causa sigue
> saliendo *no aplica* en las que se preguntan: BQ8 se resuelve con la regla de las relanzables, que
> eran el caso que la abrió. Las relanzables en su primer intento vuelven a preguntarse: `MOO-169`.

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

#### Scenario: Una relanzable en su primer intento se pregunta por la causa
- **GIVEN** una PR cuya comprobación `e2e` ha fallado en su primer intento en el último push
- **WHEN** el triador tría ese primer fallo
- **THEN** el modelo de decisión recibe la pregunta de si el fallo de `e2e` lo causa esta PR

#### Scenario: Una comprobación relanzable no se pregunta por la causa
- **GIVEN** una PR con la comprobación `e2e` que ha vuelto a fallar al relanzarla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión no recibe ninguna pregunta sobre él
