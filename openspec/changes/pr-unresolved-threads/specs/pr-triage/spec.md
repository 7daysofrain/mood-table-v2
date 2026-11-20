# Spec Delta

## RENAMED Requirements

- FROM: `### Requirement: El sistema tría los hallazgos del último push cuando la PR necesita intervención`
- TO: `### Requirement: El sistema tría los hallazgos de la PR cuando necesita intervención`

## MODIFIED Requirements

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

## ADDED Requirements

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
y de cuál. En uno sobre el último push MUST NOT decirlo.

> Traza: `MOO-173`, criterio *el mantenedor sabe de qué push viene cada hallazgo*. El push, por su SHA
> corto, como el resumen nombra el suyo.

#### Scenario: Un hallazgo de un push anterior
- **GIVEN** una PR cuyo último push no tiene hallazgos y que tiene un comentario sin resolver del revisor sobre el push `576b496`
- **WHEN** el sistema publica el triaje de su último push
- **THEN** la fila de ese comentario dice que es de un push anterior, el `576b496`

#### Scenario: Un hallazgo del último push
- **GIVEN** una PR con un comentario del revisor sobre su último push
- **WHEN** el sistema publica el triaje de ese push
- **THEN** la fila de ese comentario no dice de qué push es
