# pr-triage Specification

## Purpose

Fija cómo clasifica el PR Babysitter, sin actuar, los hallazgos de cada PR que necesita intervención, y
cómo lo ve el mantenedor. Así puede fiarse de su criterio antes de dejarle arreglar (BH2).

## Requirements

### Requirement: El sistema tría los hallazgos de la PR cuando necesita intervención
Cuando el sistema va a avisar de que una PR «necesita intervención» y tiene hallazgos, SHALL triarlos
antes del aviso. Los hallazgos MUST ser:
- los hilos del revisor sin resolver, sobre cualquier push;
- las comprobaciones que fallan en el último push;
- en lugar de la comprobación de incidencias nuevas de SonarQube, cada incidencia que anota;
- y nada más.

Un hilo resuelto MUST NOT ser un hallazgo. Una PR «lista para integrar», o que necesita intervención
sin hallazgos (algo no termina a tiempo), MUST NOT triarse.

> Traza: `MOO-75`, caso feliz (*el sistema tría en modo sombra los hallazgos del último push*) y
> criterio *una comprobación que falla se tría como un hallazgo más*; glosario de PB §8 (*hallazgo*).
> Triar justo antes del aviso final, cuando ya están todos los hallazgos del push: decidido por el
> usuario al explorar el change `pr-shadow-triage` (28-oct), su `design.md` decisión 1. Cada
> incidencia en lugar de la comprobación: `MOO-148`, caso feliz; D114. Los hilos sin resolver de
> cualquier push, en lugar de los comentarios del último push: `MOO-173`, criterios *un comentario
> sin resolver de un push anterior es un hallazgo* y *solo los comentarios sin resolver vuelven al
> triador en cada push*. Lo decidió el usuario al refinar la historia (20-nov), porque un comentario
> puede triarse en un push y resolverse en otro posterior.

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

### Requirement: Descartar un hallazgo de severidad alta exige criterio
Si el triador daría como no aplica un hallazgo que el revisor marca de severidad alta, porque su
arreglo cae fuera del alcance de la PR, el sistema SHALL clasificarlo como exige criterio, con ese
motivo, y el resumen MUST NOT decir que se capturaría.

> Traza: política de escalado de PB §4.1 (*descarta un hallazgo de severidad alta*). Como regla en
> código, después del modelo: decidido por el usuario al explorar el change `pr-shadow-triage`
> (28-oct), su `design.md` decisión 4. Severidad alta es la P0 y la P1 de Codex *(asumido)*: otro
> revisor (BA3) traduce la suya en su adaptador. Que mande sobre «se capturaría»: `MOO-160`, criterio
> *un hallazgo de severidad alta fuera del alcance exige criterio*.

#### Scenario: El modelo descartaría un P1
- **GIVEN** una PR que necesita intervención con un comentario P1 del revisor en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su arreglo cae fuera del alcance de la PR, y menos de 0,80 de que cae dentro
- **THEN** el resumen da el hallazgo como exige criterio, por la regla de severidad alta
- **AND** el resumen no dice que se capturaría

#### Scenario: Un P1 dentro del alcance de la PR es real
- **GIVEN** una PR que necesita intervención con un comentario P1 del revisor en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su arreglo cae dentro del alcance de la PR, y menos de 0,80 de que cae fuera
- **THEN** el resumen da el hallazgo como real

### Requirement: Un hallazgo sin contexto exige criterio sin preguntar al modelo
Si el sistema no tiene lo que señala un hallazgo (el trozo de código que comenta el revisor, o el
contexto de la comprobación que falla), SHALL clasificarlo como exige criterio con ese motivo, MUST NOT
preguntar por él al modelo y MUST seguir con el resto de hallazgos. En una comprobación, el motivo MUST
distinguir si la comprobación no da contexto o si no se ha podido leer.

> Traza: BE4 (cada decisión se puede explicar). Decidido por el usuario al explorar el change `pr-shadow-triage`
> (28-oct), su `design.md` decisión 4: un modelo sin contexto juzga con la misma seguridad que con él.
> Los dos motivos de una comprobación: `MOO-159`, criterio *sin contexto, el triador no pregunta al
> modelo de decisión*; D114 (el estado del contexto separa «no tiene log» de «el log ha caducado»).

#### Scenario: La comprobación no da contexto (asumido)
- **GIVEN** una PR con una comprobación de otra app que falla y que publica un resumen vacío
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa comprobación como exige criterio, porque la comprobación no da contexto
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
- **AND** el resto de hallazgos se tría con el modelo

#### Scenario: No se puede leer el log de una comprobación que falla (asumido)
- **GIVEN** una PR con una comprobación de GitHub Actions que falla, sin anotaciones útiles, y cuyo log ha caducado
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa comprobación como exige criterio, porque no se ha podido leer su contexto
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
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
decidido; y, en una comprobación, de dónde sale su contexto y si se ha cortado. MUST publicar como mucho
uno por push; un push nuevo MUST tener el suyo, sin tocar el anterior.

> Traza: `MOO-75`, caso feliz (*la PR tiene un comentario resumen del sistema*) y criterio *un solo
> resumen por push, aunque los hallazgos lleguen en tandas*; BE4 (sus comentarios en la PR se
> identifican como del sistema); BQ2, resuelta al refinar la historia (28-oct). El porqué como la
> probabilidad frente al umbral, y un comentario nuevo por push: decididos por el usuario al explorar
> el change (28-oct), `design.md` decisiones 3 y 7. El origen del contexto: `MOO-159`, criterio *la
> decisión registra que el contexto sale de <origen>*; que vaya también en el resumen, y no solo en la
> traza, se decidió al explorar el change (13-nov), `design.md` decisión 2.

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

### Requirement: El contexto de una comprobación que falla depende de la app que la ejecuta
Para una comprobación que falla, el sistema SHALL dar al modelo de decisión: si es de GitHub Actions,
sus anotaciones útiles, con todos sus errores, o, si no tiene ninguna, el paso del log que falla,
entero; si es de otra app, el resumen que publica. MUST cortar el contexto a 16 KiB y decir que lo ha
cortado. El resumen del triaje MUST decir de dónde sale el contexto.

> Traza: `MOO-159`, criterio *el modelo de decisión recibe la pregunta de la causa y el error
> completo*; D114. Una anotación es útil salvo un `failure` en `.github` (el genérico de «el proceso
> acabó con error») o un `notice` sin título: `docs/spikes/moo-120-contexto-triaje.md`. El paso
> entero sustituye el corte en el primer `##[error]`, que dejaba fuera el error de Playwright
> (`MOO-154`). El corte de 16 KiB para cualquier origen: decidido al explorar el change (13-nov),
> `design.md` decisión 2 *(asumido)*.

#### Scenario: Una comprobación de Actions con anotaciones útiles
- **GIVEN** una PR con la comprobación `e2e` que falla y que deja dos anotaciones de error de sus tests
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto las dos anotaciones, cada una con su fichero, su línea y su mensaje
- **AND** el resumen dice que el contexto sale de las anotaciones

#### Scenario: Una comprobación de Actions sin anotaciones útiles
- **GIVEN** una PR con la comprobación `test` que falla y cuya única anotación es el error genérico en `.github` de que el proceso acabó con error
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto el paso que falla del log, entero, incluido lo que sigue al primer error
- **AND** el resumen dice que el contexto sale del log

#### Scenario: Una comprobación de otra app
- **GIVEN** una PR con una comprobación de otra app que falla y que publica un título y un resumen
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe como contexto ese título y ese resumen
- **AND** el resumen del triaje dice que el contexto sale del resumen de la app

#### Scenario: Un contexto que no cabe se corta y lo dice (asumido)
- **GIVEN** una PR con una comprobación de Actions sin anotaciones útiles cuyo paso que falla ocupa más de 16 KiB
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe los últimos 16 KiB del paso, con la marca de que se ha cortado
- **AND** el resumen dice que el contexto se ha cortado

#### Scenario: Una comprobación que se pasa de tiempo es un hallazgo (asumido)
- **GIVEN** una PR con una comprobación que acaba por tiempo o cancelada en su último push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** la comprobación es un hallazgo más, y el modelo de decisión recibe con su contexto cómo acabó

### Requirement: Las comprobaciones deterministas salen reales por regla
Si falla una comprobación de la lista de deterministas (por defecto, `lint`, `typecheck` y
`SonarCloud Code Analysis`; configurable), el sistema SHALL clasificarla como real por esa regla, sin
preguntar al modelo de decisión, y el resumen MUST decir que la ha decidido la regla. La regla MUST
aplicarse antes que la de sin contexto y que el tope de gasto.

> Traza: `MOO-159`, criterio *una comprobación determinista sale real por regla*; D114 (fallan solo
> si algo de la PR incumple su regla). La lista configurable y la regla antes que el contexto y el
> tope: decidido al explorar el change (13-nov), `design.md` decisión 6. Que mande sobre el tope
> estaba *(asumido)* en la historia.

#### Scenario: Falla una comprobación determinista
- **GIVEN** una PR con la comprobación `lint` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla de las comprobaciones deterministas
- **AND** el modelo de decisión no recibe ninguna pregunta sobre él

#### Scenario: La regla no necesita contexto
- **GIVEN** una PR con la comprobación `typecheck` que falla y cuyo log no se puede leer
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla, y no como exige criterio

#### Scenario: La regla no gasta del tope (asumido)
- **GIVEN** una PR cuyo gasto acumulado ya ha llegado al tope, con la comprobación `SonarCloud Code Analysis` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el resumen da el hallazgo como real, decidido por la regla, y no como exige criterio por el tope

### Requirement: Cada hallazgo se pregunta al modelo de decisión en una petición propia
El sistema SHALL preguntar al modelo de decisión por cada hallazgo en una petición propia, con el
título y la descripción de la PR y sin los demás hallazgos. Si la petición de un hallazgo falla, MUST
clasificarlo como exige criterio, con el motivo de que el modelo no ha respondido, y MUST clasificar
los demás con su propia respuesta.

> Traza: `MOO-159`, criterios *cada hallazgo se pregunta al modelo de decisión por separado* y *la
> petición de un hallazgo falla y la de los demás no*; D114, que matiza D91 (en la #116, el `e2e`
> pasó de 0,64 a 0,83 por ir junto a `sonar-issues`). Lo que cobra una petición que falla suma al
> gasto de la PR: `design.md` decisión 5.

#### Scenario: Cada hallazgo va en su petición
- **GIVEN** un push con un comentario del revisor y dos comprobaciones que fallan y que pasan por el modelo de decisión
- **WHEN** el triador los tría
- **THEN** el modelo de decisión recibe tres peticiones, cada una con un solo hallazgo

#### Scenario: La petición de un hallazgo falla y la de los demás no
- **GIVEN** un push con tres hallazgos que pasan por el modelo de decisión
- **AND** el modelo de decisión no responde a la petición de uno de ellos
- **WHEN** el triador los tría
- **THEN** el resumen da ese hallazgo como exige criterio, porque el modelo de decisión no ha respondido
- **AND** los otros dos salen con la clase de su propia respuesta

### Requirement: Una comprobación que falla sale real, no aplica o exige criterio según su causa
Para cada comprobación que falla que no decide una regla, el sistema SHALL preguntar al modelo de
decisión si la causa esta PR, y SHALL clasificarla por la probabilidad del sí: **real** si llega al
umbral, **no aplica** si no pasa de su complemento y **exige criterio** entre los dos. El umbral MUST
ser 0,80 y configurable.

> Traza: sustituye el requisito *Cada hallazgo sale real, no aplica o exige criterio según la
> probabilidad del modelo*, sin cambiar nada de las comprobaciones. `MOO-75`, caso feliz (*su clase
> (real, no aplica o exige criterio)*); glosario de PB §8 (*triaje*). *Exige criterio* cuando el
> sistema no lo tiene claro: change `pr-shadow-triage`, `design.md` decisiones 3 y 4. El 0,80 es
> *(asumido)*: `docs/umbrales-para-specs.md`; lo ajusta `MOO-76`. La pregunta de la causa: `MOO-159`,
> criterio *el modelo de decisión recibe la pregunta de la causa y el error completo*; D114. Una
> comprobación que la PR no causa sale *no aplica* hasta resolver BQ8 (`MOO-155`): change
> `pr-check-triage`, `design.md` decisión 7.

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
- **GIVEN** una PR con la comprobación `e2e` que falla en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe la pregunta de si el fallo de `e2e` lo causa esta PR

### Requirement: Un hallazgo del revisor se clasifica por el alcance de la PR
Por cada comentario del revisor que no decide una regla, el sistema SHALL preguntar al modelo de
decisión, en una petición, si su arreglo cae dentro del alcance de la PR y si es trabajo de otra tarea
o historia, y SHALL clasificarlo con el umbral: **real** si solo llega la primera, **no aplica** (se
capturaría) si solo llega la segunda y **exige criterio** si no llega ninguna o llegan las dos.

> Traza: `MOO-160`, caso feliz (*el triaje clasifica un hallazgo del revisor según el alcance de la
> PR*), con el umbral de 0,80 en los dos sentidos; los extremos cuentan dentro de su caso
> *(asumido)*. «Se capturaría» y no una captura de verdad: modo sombra, decidido por el usuario al
> refinar la historia (19-nov). Dos preguntas en una petición, y la contradicción como exige
> criterio: decididos por el usuario al explorar el change (20-nov), `design.md` decisiones 1 y 2,
> con la medición de las 10 filas del *spike* `MOO-120`.

#### Scenario: El arreglo cae dentro del alcance de la PR
- **GIVEN** una PR que necesita intervención con un comentario del revisor en su último push
- **WHEN** el modelo de decisión da 0,80 o más de que su arreglo cae dentro del alcance de la PR, y menos de 0,80 de que es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como real

#### Scenario: El arreglo es trabajo de otra tarea
- **GIVEN** una PR que necesita intervención con un comentario del revisor de severidad normal en su último push
- **WHEN** el modelo de decisión da 0,80 o más de que su arreglo es trabajo de otra tarea, y menos de 0,80 de que cae dentro del alcance de la PR
- **THEN** el resumen da el hallazgo como no aplica y dice que se capturaría

#### Scenario: Ninguna pregunta llega al umbral
- **GIVEN** una PR que necesita intervención con un comentario del revisor en su último push
- **WHEN** el modelo de decisión da menos de 0,80 a las dos preguntas
- **THEN** el resumen da el hallazgo como exige criterio, porque ninguna llega al umbral

#### Scenario: Las dos preguntas llegan al umbral
- **GIVEN** una PR que necesita intervención con un comentario del revisor en su último push
- **WHEN** el modelo de decisión da 0,80 o más a las dos preguntas
- **THEN** el resumen da el hallazgo como exige criterio, porque las respuestas se contradicen

#### Scenario: Las dos preguntas van en la misma petición
- **GIVEN** una PR con un comentario del revisor en su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe una sola petición sobre él, con la pregunta de si su arreglo cae dentro del alcance de la PR y la de si es trabajo de otra tarea o historia

### Requirement: Un hallazgo del revisor de una PR sin descripción exige criterio sin preguntar al modelo
Si la descripción de la PR está vacía o solo tiene espacios, el sistema SHALL clasificar cada
comentario del revisor como exige criterio, porque la PR no dice su alcance, sin preguntar por él al
modelo de decisión.

> Traza: `MOO-160`, criterio *un hallazgo de una PR que no dice su alcance exige criterio*. Solo la
> descripción vacía: una escueta la decide la confianza *(asumido)*. Encaja con la regla de PB §8
> (*exige criterio*: «no ha podido reunir su contexto»). Las comprobaciones no la necesitan: su
> pregunta es la de la causa, no la del alcance.

#### Scenario: La PR no tiene descripción
- **GIVEN** una PR con la descripción vacía, un comentario del revisor y una comprobación que falla en su último push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da el comentario del revisor como exige criterio, porque la PR no dice su alcance
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ese comentario
- **AND** la comprobación que falla se tría con el modelo

### Requirement: El resumen dice el porqué de cada hallazgo del revisor
En un comentario del revisor, el resumen MUST dar como porqué:
- si es real o no aplica, la pregunta que ha llegado al umbral, con su probabilidad, y, si no aplica,
  que se capturaría o que ya está arreglado;
- si exige criterio por probabilidad, la probabilidad de cada pregunta de su petición y el umbral;
- si exige criterio por una regla, la regla, sin probabilidad.

> Traza: `MOO-160`, criterios *el resumen dice por qué un hallazgo del revisor exige criterio* y *el
> resumen dice qué se capturaría*; BE4. De qué trataría la captura son el revisor, el fichero, la línea
> y el título, que el resumen ya da del hallazgo, y la pregunta que ha llegado al umbral: el modelo de
> decisión no redacta un motivo (D90). Decidido por el usuario al explorar el change
> `pr-reviewer-scope` (20-nov), su `design.md` decisión 3. «Ya está arreglado» y las tres
> probabilidades de un comentario de un push anterior: `MOO-173`, criterio *un comentario sin
> resolver que el último push ya arregla*; `design.md` decisión 5.

#### Scenario: El resumen dice qué se capturaría
- **GIVEN** una PR con un comentario P2 del revisor en `graph.ts:88`, titulado «Conservar el gasto al detener», y la descripción de la PR no vacía
- **WHEN** el modelo de decisión da 0,85 de que su arreglo es trabajo de otra tarea y 0,10 de que cae dentro
- **THEN** la fila del hallazgo nombra al revisor, `graph.ts:88` y el título
- **AND** dice que es no aplica porque es trabajo de otra tarea, con 0,85 frente a 0,80, y que se capturaría

#### Scenario: El resumen dice hacia qué lado iba
- **GIVEN** una PR con un comentario del revisor en su último push
- **WHEN** el modelo de decisión da 0,58 de que su arreglo cae dentro y 0,32 de que es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como exige criterio, con las dos probabilidades y el umbral de 0,80

#### Scenario: El resumen da las tres probabilidades de un comentario de un push anterior
- **GIVEN** una PR con un comentario sin resolver del revisor sobre un push anterior
- **WHEN** el modelo de decisión da 0,40 de que el último push ya lo arregla, 0,58 de que su arreglo cae dentro y 0,32 de que es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como exige criterio, con las tres probabilidades y el umbral de 0,80

#### Scenario: Una regla se explica sin probabilidad
- **GIVEN** una PR con un comentario P1 del revisor en su último push
- **WHEN** el modelo de decisión da 0,90 de que su arreglo es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como exige criterio por la regla de severidad alta, sin la probabilidad

### Requirement: Cada incidencia nueva de SonarQube se tría como un hallazgo propio
Si falla la comprobación de incidencias nuevas de SonarQube, el sistema SHALL triar cada incidencia que
anota como un hallazgo propio, con su fichero y su línea, y MUST NOT triar la comprobación entera. El
modelo de decisión MUST recibir cada incidencia en una petición propia, con la pregunta de si su regla
se cumple en ese código y con el código alrededor de su línea en el commit del push.

> Traza: `MOO-148`, caso feliz (*cada incidencia nueva de SonarQube se tría como un hallazgo propio*).
> La pregunta de la premisa de la regla y el código como contexto: decidido al refinar la historia
> (20-nov), con una prueba de 12 filas contra Clef (7 de 12 con código, 5 sin él, ninguna con confianza
> del lado equivocado); `design.md` decisiones 3 y 4. Que el resumen muestre la clase de cada una es
> *(asumido)* en la historia.

#### Scenario: Una incidencia nueva de SonarQube
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 1 incidencia nueva de SonarQube
- **WHEN** el triador tría los hallazgos del último push
- **THEN** la incidencia es un hallazgo, con su fichero y su línea, y la comprobación no lo es
- **AND** el modelo de decisión recibe la pregunta de si su regla se cumple en ese código, con el código alrededor de su línea
- **AND** el resumen muestra la incidencia con su clase y por qué

#### Scenario: Dos incidencias nuevas de SonarQube
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 2 incidencias nuevas de SonarQube en ficheros distintos
- **WHEN** el triador tría los hallazgos del último push
- **THEN** cada incidencia es un hallazgo propio, con su fichero y su línea
- **AND** el modelo de decisión recibe cada una en una petición propia, sin la otra
- **AND** el resumen muestra cada una con su propia clase

### Requirement: Una incidencia nueva de SonarQube sale real, no aplica o exige criterio según si su regla se cumple
El sistema SHALL clasificar una incidencia nueva de SonarQube por la probabilidad de que su regla se
cumpla en ese código: **real** si llega al umbral, **no aplica** si no pasa de su complemento y **exige
criterio** entre los dos, con el umbral de siempre. Cuando sale no aplica, el resumen MUST decir que la
incidencia se aceptaría en SonarQube, con esa probabilidad.

> Traza: `MOO-148`, criterio *una incidencia cuya regla no se cumple en ese código sale no aplica*. Que
> salga *no aplica* y no *exige criterio* es *(asumido)* hasta resolver BQ9 (PB §7): aceptar una
> incidencia es motivo para escalar (PB §4.1). El umbral: `docs/umbrales-para-specs.md`.

#### Scenario: El código tiene el problema que describe la regla
- **GIVEN** una PR con una incidencia nueva de SonarQube en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como real, con esa probabilidad

#### Scenario: Seguir la regla rompería lo que el código debe hacer
- **GIVEN** una PR con una incidencia nueva de SonarQube cuyo código muestra que seguir la regla rompería lo que el código debe hacer
- **WHEN** el modelo de decisión da una probabilidad de 0,20 o menos de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como no aplica, con esa probabilidad
- **AND** dice que la incidencia se aceptaría en SonarQube

#### Scenario: El modelo no lo tiene claro
- **GIVEN** una PR con una incidencia nueva de SonarQube en su último push
- **WHEN** el modelo de decisión da una probabilidad entre 0,20 y 0,80 de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como exige criterio, porque la probabilidad no llega al umbral

### Requirement: Descartar una incidencia de SonarQube de severidad alta exige criterio
Si el modelo de decisión daría como no aplica una incidencia nueva de SonarQube de severidad alta, el
sistema SHALL clasificarla como exige criterio, por la regla de severidad alta, y el resumen MUST NOT
decir que se aceptaría en SonarQube. Severidad alta MUST ser `BLOCKER` o `HIGH` en SonarQube.

> Traza: `MOO-148`, criterio *una incidencia de severidad alta que se descartaría exige criterio*;
> política de escalado de PB §4.1 (*descarta un hallazgo de severidad alta*). Que sean `BLOCKER` o
> `HIGH` es *(asumido)* en la historia: son las dos más altas de los *impacts* de SonarQube.

#### Scenario: El modelo descartaría una incidencia bloqueante
- **GIVEN** una PR con una incidencia nueva de SonarQube de severidad `BLOCKER` en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,20 o menos de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como exige criterio, por la regla de severidad alta
- **AND** no dice que se aceptaría en SonarQube

#### Scenario: Una incidencia de severidad alta que se cumple es real
- **GIVEN** una PR con una incidencia nueva de SonarQube de severidad `HIGH` en su último push
- **WHEN** el modelo de decisión da una probabilidad de 0,80 o más de que su regla se cumple en ese código
- **THEN** el resumen da la incidencia como real

### Requirement: Una incidencia sin código legible exige criterio sin preguntar al modelo
Si el sistema no puede leer el código de una incidencia nueva de SonarQube en el commit del push, SHALL
clasificarla como exige criterio con ese motivo, MUST NOT preguntar por ella al modelo de decisión y
MUST triar el resto de hallazgos.

> Traza: `MOO-148`, criterio *una incidencia sin contexto legible exige criterio* (fila *el código de
> una incidencia no se puede leer en el commit del push*). Mismo principio que *un hallazgo sin
> contexto exige criterio*: un modelo sin contexto juzga con la misma seguridad que con él.

#### Scenario: La línea de la incidencia no está en el fichero
- **GIVEN** una PR con dos incidencias nuevas de SonarQube, una de ellas en una línea que no existe en el fichero del commit del push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa incidencia como exige criterio, porque no se ha podido leer su código
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella
- **AND** la otra incidencia se tría con el modelo

#### Scenario: GitHub no da el fichero (asumido)
- **GIVEN** una PR con una incidencia nueva de SonarQube cuyo fichero GitHub no devuelve en el commit del push
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da esa incidencia como exige criterio, porque no se ha podido leer su código

### Requirement: La comprobación de incidencias nuevas sin incidencias legibles exige criterio
Si la comprobación de incidencias nuevas de SonarQube falla sin anotar ninguna incidencia legible, el
sistema SHALL triar la comprobación entera como un hallazgo, clasificarla como exige criterio con ese
motivo y MUST NOT preguntar por ella al modelo de decisión.

> Traza: `MOO-148`, criterio *una incidencia sin contexto legible exige criterio* (fila *la
> comprobación no lista ninguna incidencia legible*), y glosario de PB §8 (*hallazgo*: la comprobación,
> solo cuando no lista ninguna).

#### Scenario: El análisis de SonarQube no termina a tiempo
- **GIVEN** una PR cuya comprobación `sonar-issues` falla porque el análisis no ha terminado, sin anotar ninguna incidencia
- **WHEN** el triador tría los hallazgos del último push
- **THEN** el resumen da la comprobación como exige criterio, porque no anota ninguna incidencia legible
- **AND** el modelo de decisión no recibe ninguna pregunta sobre ella

### Requirement: El resumen dice si la comprobación trae más incidencias de las triadas
Si la comprobación de incidencias nuevas de SonarQube trae más incidencias de las que anota, el sistema
SHALL triar cada incidencia anotada como un hallazgo propio, y el resumen MUST decir cuántas trae la
comprobación y cuántas se han triado.

> Traza: `MOO-148`, criterio *la comprobación trae más incidencias de las que puede listar*. Que el
> resumen dé las dos cifras es *(asumido)* en la historia. Cuántas anota: `quality-gates`, requisito
> *una PR contra main con incidencias nuevas de SonarQube queda en rojo*.

#### Scenario: Doce incidencias nuevas (asumido)
- **GIVEN** una PR con la comprobación `sonar-issues` que falla con 12 incidencias nuevas de SonarQube, de las que anota 10
- **WHEN** el triador tría los hallazgos del último push
- **THEN** cada una de las 10 incidencias anotadas es un hallazgo propio
- **AND** el resumen dice que la comprobación trae 12 incidencias y se han triado 10

### Requirement: A un comentario de un push anterior se le pregunta si el último push ya lo arregla
Por cada comentario sin resolver del revisor sobre un push anterior que no decide una regla, el
sistema SHALL preguntar al modelo de decisión, en la misma petición que las del alcance, si el código
del último push ya lo arregla, con ese código alrededor de su línea. Si llega al umbral, MUST
clasificarlo como no aplica, porque ya está arreglado; si no, por el alcance.

> Traza: `MOO-173`, criterio *un comentario sin resolver que el último push ya arregla* (*sale no
> aplica, con el motivo de que ya está resuelto*, (asumido) en la historia). Triar contra el código
> del último push, como con SonarQube (D117): decidido por el usuario al refinar la historia
> (20-nov). Una pregunta más en la misma petición, y no una regla sin modelo: decidido por el usuario
> al proponer el change (20-nov), `design.md` decisiones 3 y 4. El umbral de 0,80 es el de siempre,
> sin medir para esta pregunta *(asumido)*: lo calibra `MOO-76`.

#### Scenario: El último push ya lo arregla
- **GIVEN** una PR con un comentario P2 sin resolver del revisor sobre un push anterior
- **AND** el código del último push ya lo arregla
- **WHEN** el modelo de decisión da 0,80 o más de que el último push ya lo arregla
- **THEN** el resumen da el hallazgo como no aplica, porque ya está arreglado, con esa probabilidad

#### Scenario: El último push no lo arregla
- **GIVEN** una PR con un comentario sin resolver del revisor sobre un push anterior
- **WHEN** el modelo de decisión da menos de 0,80 de que el último push ya lo arregla, y 0,80 o más de que su arreglo cae dentro del alcance de la PR y menos de 0,80 de que es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como real

#### Scenario: Las tres preguntas van en la misma petición
- **GIVEN** una PR con un comentario sin resolver del revisor sobre un push anterior
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe una sola petición sobre él, con la pregunta de si el último push ya lo arregla y las dos del alcance de la PR
- **AND** la petición lleva el código del último push alrededor de su línea

#### Scenario: Un comentario del último push no se pregunta si ya está arreglado
- **GIVEN** una PR con un comentario del revisor sobre su último push
- **WHEN** el triador tría ese hallazgo
- **THEN** el modelo de decisión recibe solo las dos preguntas del alcance de la PR

### Requirement: Descartar por ya arreglado un hallazgo de severidad alta exige criterio
Si el triador daría como no aplica, porque el último push ya lo arregla, un comentario que el revisor
marca de severidad alta, el sistema SHALL clasificarlo como exige criterio, por la regla de severidad
alta.

> Traza: política de escalado de PB §4.1 (*descarta un hallazgo de severidad alta*), como la regla de
> severidad alta del alcance. Que valga también para «ya arreglado» es *(asumido)*: `design.md`
> decisión 4.

#### Scenario: El modelo daría por arreglado un P1
- **GIVEN** una PR con un comentario P1 sin resolver del revisor sobre un push anterior
- **WHEN** el modelo de decisión da 0,80 o más de que el último push ya lo arregla
- **THEN** el resumen da el hallazgo como exige criterio, por la regla de severidad alta

### Requirement: Un comentario de un push anterior sin código legible en el último push exige criterio sin preguntar
Si el sistema no puede leer, en el último push, el código alrededor de la línea de un comentario sin
resolver del revisor sobre un push anterior, SHALL clasificarlo como exige criterio con ese motivo,
MUST NOT preguntar por él al modelo de decisión y MUST triar el resto de hallazgos.

> Traza: mismo principio que *un hallazgo sin contexto exige criterio* y que *una incidencia sin
> código legible exige criterio*: un modelo sin contexto juzga con la misma seguridad que con él.
> `design.md` decisión 4 *(asumido)*.

#### Scenario: El fichero ya no está en el último push (asumido)
- **GIVEN** una PR con un comentario sin resolver del revisor sobre un push anterior, en un fichero que el último push borra
- **AND** una comprobación que falla en su último push
- **WHEN** el triador tría los hallazgos
- **THEN** el resumen da ese comentario como exige criterio, porque no se ha podido leer su código en el último push
- **AND** el modelo de decisión no recibe ninguna pregunta sobre él
- **AND** la comprobación que falla se tría con el modelo

### Requirement: El resumen dice de qué push viene cada hallazgo del revisor
En un comentario del revisor sobre un push anterior, el resumen MUST decir que es de un push anterior
y de cuál, o solo lo primero si GitHub ya no da ese commit. En uno sobre el último push MUST NOT
decirlo.

> Traza: `MOO-173`, criterio *el mantenedor sabe de qué push viene cada hallazgo*. El push, por su SHA
> corto, como el resumen nombra el suyo. Sin SHA tras un *force push*: hallazgo de Codex en la PR de
> `MOO-175`, `design.md` decisión 1.

#### Scenario: Un hallazgo de un push anterior
- **GIVEN** una PR cuyo último push no tiene hallazgos y que tiene un comentario sin resolver del revisor sobre el push `576b496`
- **WHEN** el sistema publica el triaje de su último push
- **THEN** la fila de ese comentario dice que es de un push anterior, el `576b496`

#### Scenario: Un hallazgo del último push
- **GIVEN** una PR con un comentario del revisor sobre su último push
- **WHEN** el sistema publica el triaje de ese push
- **THEN** la fila de ese comentario no dice de qué push es
