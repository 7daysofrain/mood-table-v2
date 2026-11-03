# Spec Delta

## Purpose

Fija cómo clasifica el PR Babysitter, sin actuar, los hallazgos de cada PR que necesita intervención, y
cómo lo ve el mantenedor. Así puede fiarse de su criterio antes de dejarle arreglar (BH2).

## ADDED Requirements

### Requirement: El sistema tría los hallazgos del último push cuando la PR necesita intervención
Cuando el sistema va a avisar de que una PR «necesita intervención» y su último push tiene hallazgos,
SHALL triarlos antes del aviso. Los hallazgos MUST ser los comentarios del revisor sobre ese push y las
comprobaciones que fallan en él, y nada más. Una PR «lista para integrar», o que necesita intervención
sin hallazgos (algo no termina a tiempo), MUST NOT triarse.

> Traza: `MOO-75`, caso feliz (*el sistema tría en modo sombra los hallazgos del último push*) y
> criterio *una comprobación que falla se tría como un hallazgo más*; glosario de PB §8 (*hallazgo*).
> Las incidencias nuevas de SonarQube llegan como la comprobación `sonar-issues`, que las lista en su
> log. Triar justo antes del aviso final, cuando ya están todos los hallazgos del push: decidido por el
> usuario al explorar el change (28-oct), `design.md` decisión 1.

#### Scenario: El revisor tiene hallazgos
- **GIVEN** el sistema sigue una PR, todas sus comprobaciones pasan en el último push y el revisor lo revisa con hallazgos
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la PR tiene un comentario resumen del sistema con cada comentario del revisor sobre ese push, su clase y por qué

#### Scenario: Una comprobación que falla es un hallazgo más
- **GIVEN** el sistema sigue una PR y una comprobación de su último push falla
- **WHEN** el sistema va a avisar de su estado final
- **THEN** la comprobación que falla aparece en el resumen con su clase y por qué, como cualquier otro hallazgo

#### Scenario: Sin hallazgos no hay triaje (asumido)
- **GIVEN** el sistema sigue una PR cuyo último push pasa todas las comprobaciones y el revisor revisa sin hallazgos
- **WHEN** el sistema avisa de que está «lista para integrar»
- **THEN** la PR no tiene comentario resumen de ese push

### Requirement: Cada hallazgo sale real, no aplica o exige criterio según la probabilidad del modelo
Para cada hallazgo, el sistema SHALL preguntar a un modelo de decisión si hay que arreglarlo en esta PR
antes de integrarla, y clasificarlo por la probabilidad del sí: **real** si llega al umbral, **no
aplica** si no pasa de su complemento y **exige criterio** entre los dos. El umbral MUST ser 0,80 y
configurable. Un nit que no merece un commit MUST contar como no aplica.

> Traza: `MOO-75`, caso feliz (*su clase (real, no aplica o exige criterio)*); glosario de PB §8
> (*triaje*). *Exige criterio* cuando el sistema no lo tiene claro y los nits como *no aplica*:
> decididos por el usuario al refinar la historia y al explorar el change (28-oct), `design.md`
> decisiones 3 y 4. El 0,80 es *(asumido)*: `docs/umbrales-para-specs.md`; lo ajusta `MOO-76`.

#### Scenario: El modelo lo tiene claro y hay que arreglarlo
- **GIVEN** una PR que necesita intervención con un hallazgo en su último push
- **WHEN** el modelo da una probabilidad de 0,80 o más de que hay que arreglarlo en esta PR
- **THEN** el resumen da el hallazgo como real, con esa probabilidad

#### Scenario: El modelo lo tiene claro y no hay que arreglarlo
- **GIVEN** una PR que necesita intervención con un hallazgo de severidad baja en su último push
- **WHEN** el modelo da una probabilidad de 0,20 o menos de que hay que arreglarlo en esta PR
- **THEN** el resumen da el hallazgo como no aplica, con esa probabilidad

#### Scenario: El modelo no lo tiene claro
- **GIVEN** una PR que necesita intervención con un hallazgo en su último push
- **WHEN** el modelo da una probabilidad entre 0,20 y 0,80 de que hay que arreglarlo
- **THEN** el resumen da el hallazgo como exige criterio, porque la probabilidad no llega al umbral

### Requirement: Descartar un hallazgo de severidad alta exige criterio
Si el modelo daría como no aplica un hallazgo que el revisor marca de severidad alta, el sistema SHALL
clasificarlo como exige criterio, con ese motivo.

> Traza: política de escalado de PB §4.1 (*descarta un hallazgo de severidad alta*). Como regla en
> código, después del modelo: decidido por el usuario al explorar el change (28-oct), `design.md`
> decisión 4. Severidad alta es la P1 de Codex *(asumido)*: otro revisor (BA3) traduce la suya en su
> adaptador.

#### Scenario: El modelo descartaría un P1
- **GIVEN** una PR que necesita intervención con un comentario P1 del revisor en su último push
- **WHEN** el modelo da una probabilidad de 0,20 o menos de que hay que arreglarlo
- **THEN** el resumen da el hallazgo como exige criterio, porque descartaría un hallazgo de severidad alta

### Requirement: Un hallazgo sin contexto exige criterio sin preguntar al modelo
Si el sistema no puede reunir lo que señala un hallazgo (el trozo de código que comenta el revisor o el
log de la comprobación que falla), SHALL clasificarlo como exige criterio con ese motivo, MUST NOT
preguntar por él al modelo y MUST seguir con el resto de hallazgos.

> Traza: BE4 (cada decisión se puede explicar). Decidido por el usuario al explorar el change (28-oct),
> `design.md` decisión 4: un modelo sin contexto juzga con la misma seguridad que con él.

#### Scenario: No se puede leer el log de una comprobación que falla (asumido)
- **GIVEN** una PR que necesita intervención porque falla una comprobación, y GitHub no da su log
- **WHEN** el sistema tría los hallazgos del último push
- **THEN** el resumen da esa comprobación como exige criterio, porque no se pudo leer su log
- **AND** el resto de hallazgos se tría con el modelo

### Requirement: El triaje no pasa del tope de gasto de la PR
El sistema SHALL calcular el coste de cada triaje antes de pedírselo al modelo y MUST NOT pasar del tope
de gasto de la PR, que es de 0,05 $ y configurable. Los hallazgos que ya no caben MUST salir como exige
criterio, con ese motivo. El coste de cada triaje MUST quedar registrado en su traza.

> Traza: `MOO-75`, criterio *el triaje se detiene al llegar al tope de gasto de la PR*, ajustado al
> explorar el change (28-oct): lo que no cabe sale *exige criterio* y no «sin triar» (decidido por el
> usuario), y el coste va a la traza y no al resumen (`design.md` decisión 6). BE8. El 0,05 $ es
> *(asumido)*: `docs/umbrales-para-specs.md`.

#### Scenario: El gasto que queda no alcanza para todos los hallazgos
- **GIVEN** una PR con hallazgos en su último push y un gasto acumulado que deja sitio solo para algunos de ellos
- **WHEN** el sistema tría los hallazgos del último push
- **THEN** el resumen da los que caben con la clase del modelo y los demás como exige criterio, porque se ha llegado al tope de gasto
- **AND** el coste del triaje de esa PR queda registrado en su traza

### Requirement: Un comentario que no es del revisor no es un hallazgo ni cambia el triaje
El sistema MUST NOT tratar como hallazgo un comentario de alguien que no sea el revisor, ni dejar que su
texto llegue al modelo de decisión.

> Traza: `MOO-75`, criterio *el comentario de un tercero no dirige el triaje*; BE6. Al modelo solo
> llegan los comentarios del revisor, las comprobaciones y el título y la descripción de la PR, que
> escribe el mantenedor: `design.md` decisión 5.

#### Scenario: Un tercero pide clasificarlo todo como no aplica
- **GIVEN** una PR con hallazgos en su último push y un comentario de alguien que no es el revisor, SonarQube ni el mantenedor que pide clasificarlo todo como «no aplica»
- **WHEN** el sistema tría los hallazgos del último push
- **THEN** ese comentario no aparece como hallazgo en el resumen
- **AND** la clase de los demás hallazgos es la misma que sin ese comentario

### Requirement: El resumen del triaje es un comentario del sistema por push
El sistema SHALL publicar el triaje en un comentario de la PR que diga que es del PR Babysitter y de qué
push es, con cada hallazgo, su clase y por qué: la probabilidad frente al umbral, o la regla que lo ha
decidido. MUST publicar como mucho uno por push; un push nuevo MUST tener el suyo, sin tocar el
anterior.

> Traza: `MOO-75`, caso feliz (*la PR tiene un comentario resumen del sistema*) y criterio *un solo
> resumen por push, aunque los hallazgos lleguen en tandas*; BE4 (sus comentarios en la PR se
> identifican como del sistema); BQ2, resuelta al refinar la historia (28-oct). El porqué como la
> probabilidad frente al umbral, y un comentario nuevo por push: decididos por el usuario al explorar
> el change (28-oct), `design.md` decisiones 3 y 7.

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

### Requirement: El triaje no actúa sobre la PR
Triar MUST NOT arreglar nada, contestar ni resolver hilos, ni cambiar el estado final ni su aviso. Si el
triaje falla, el aviso del estado final MUST llegar igual.

> Traza: `MOO-75`, caso feliz (*el sistema no arregla nada, no contesta y no resuelve ningún hilo*);
> glosario de PB §8 (*modo sombra*); non-goals de la historia (BH3, BH4). Que un triaje que falla no
> retrase el aviso: `design.md` decisión 8 *(asumido)*.

#### Scenario: Tras el triaje todo sigue como estaba
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el sistema ha triado sus hallazgos
- **THEN** no hay commits, respuestas ni hilos resueltos nuevos del sistema
- **AND** el mantenedor recibe el aviso del estado final con el mismo estado y motivo que sin el triaje

#### Scenario: El modelo no responde (asumido)
- **GIVEN** una PR que necesita intervención con hallazgos en su último push
- **WHEN** el modelo de decisión no responde en ninguno de los intentos
- **THEN** el mantenedor recibe igualmente el aviso del estado final
