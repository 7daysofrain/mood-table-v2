# Spec Delta

## MODIFIED Requirements

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

## ADDED Requirements

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
En un comentario del revisor, el resumen MUST dar como porqué: si es real o no aplica, la pregunta que
ha llegado al umbral, con su probabilidad, y si no aplica, que se capturaría; si exige criterio por
probabilidad, las dos probabilidades y el umbral; y si exige criterio por una regla, la regla, sin
probabilidad.

> Traza: `MOO-160`, criterios *el resumen dice por qué un hallazgo del revisor exige criterio* y *el
> resumen dice qué se capturaría*; BE4. De qué trataría la captura son el revisor, el fichero, la línea
> y el título, que el resumen ya da del hallazgo, y la pregunta que ha llegado al umbral: el modelo de
> decisión no redacta un motivo (D90). Decidido por el usuario al explorar el change (20-nov),
> `design.md` decisión 3.

#### Scenario: El resumen dice qué se capturaría
- **GIVEN** una PR con un comentario P2 del revisor en `graph.ts:88`, titulado «Conservar el gasto al detener», y la descripción de la PR no vacía
- **WHEN** el modelo de decisión da 0,85 de que su arreglo es trabajo de otra tarea y 0,10 de que cae dentro
- **THEN** la fila del hallazgo nombra al revisor, `graph.ts:88` y el título
- **AND** dice que es no aplica porque es trabajo de otra tarea, con 0,85 frente a 0,80, y que se capturaría

#### Scenario: El resumen dice hacia qué lado iba
- **GIVEN** una PR con un comentario del revisor en su último push
- **WHEN** el modelo de decisión da 0,58 de que su arreglo cae dentro y 0,32 de que es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como exige criterio, con las dos probabilidades y el umbral de 0,80

#### Scenario: Una regla se explica sin probabilidad
- **GIVEN** una PR con un comentario P1 del revisor en su último push
- **WHEN** el modelo de decisión da 0,90 de que su arreglo es trabajo de otra tarea
- **THEN** el resumen da el hallazgo como exige criterio por la regla de severidad alta, sin la probabilidad

## REMOVED Requirements

### Requirement: Cada hallazgo sale real, no aplica o exige criterio según la probabilidad del modelo
**Reason**: Los comentarios del revisor dejan la pregunta «¿hay que arreglarlo en esta PR?» (y con
ella la regla de que un nit no aplica) y pasan a clasificarse por el alcance de la PR: se dan por
buenos, y lo que se decide es si su arreglo es de esta PR (`MOO-160`, D114).
**Migration**: Las comprobaciones que fallan siguen igual, en *Una comprobación que falla sale real, no
aplica o exige criterio según su causa*. Los comentarios del revisor, en *Un hallazgo del revisor se
clasifica por el alcance de la PR*.
