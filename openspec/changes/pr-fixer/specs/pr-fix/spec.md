# Spec Delta

## Purpose

Fija cómo arregla el PR Babysitter los hallazgos reales de cada push y los sube a la rama de la PR: qué
comprueba antes de subirlos, cuándo deja de arreglar, qué no arregla y con qué identidad escribe. Así
la PR llega a lista para integrar sin que el mantenedor escriba los arreglos (BH3).

## ADDED Requirements

### Requirement: El sistema arregla los hallazgos reales y los sube a la PR
Cuando termina el triaje final de un push con al menos un hallazgo *real*, el sistema SHALL arreglar
cada hallazgo real, con un commit por hallazgo, y subirlos a la rama de la PR en un solo push nuevo.
MUST NOT arreglar lo que no sea *real*, y MUST NOT tocar la PR de otra forma.

> Traza: `MOO-77`, caso feliz (*el sistema arregla los hallazgos reales y los sube a la PR*); BE5 (un
> commit por hallazgo, `docs/instructions/workflow.md` §4, *asumido* en la historia). Un solo push por
> trabajo, para lanzar una sola vuelta de CI y de revisión: decidido al explorar el change (27-nov),
> `design.md` decisión 6. En la rama de la PR y no en una aparte: decidido por el usuario al refinar
> la historia (27-nov), matiza D124 (`design.md` decisión 1).

#### Scenario: Un hallazgo real del revisor
- **GIVEN** una PR abierta contra main con las comprobaciones de su último push terminadas
- **WHEN** el triaje de ese push termina con un hallazgo real del revisor
- **THEN** la rama de la PR tiene un push nuevo del sistema con un commit que arregla ese hallazgo

#### Scenario: Varios hallazgos reales
- **GIVEN** una PR cuyo último push tiene una comprobación `lint` que falla y una incidencia nueva de SonarQube, las dos reales
- **WHEN** el triaje de ese push termina
- **THEN** la rama de la PR tiene un solo push nuevo del sistema con dos commits, uno por hallazgo

#### Scenario: Sin hallazgos reales no hay arreglo
- **GIVEN** una PR cuyo último push tiene solo hallazgos que no aplican
- **WHEN** el triaje de ese push termina
- **THEN** la rama de la PR no tiene commits nuevos del sistema
- **AND** el mantenedor recibe el aviso del estado final, como hasta ahora

### Requirement: Cada commit del sistema dice qué hallazgo arregla y que es del sistema
Cada commit que sube el sistema SHALL ir a nombre de la identidad propia del PR Babysitter, no del
mantenedor, y su mensaje SHALL citar el hallazgo que arregla: el hilo del revisor, la comprobación o la
incidencia de SonarQube.

> Traza: BE4 (*cada decisión se puede explicar*, *sus comentarios en la PR se identifican como del
> sistema*); candidato del poke-holes de `MOO-77` que el usuario mandó a la spec al refinar (27-nov).
> *(Asumido)* en la historia.

#### Scenario: El mantenedor ve quién y por qué
- **GIVEN** una PR a la que el sistema ha subido un arreglo
- **WHEN** el mantenedor mira el commit en GitHub
- **THEN** el autor es el PR Babysitter y el mensaje cita el hallazgo que arregla

### Requirement: Un arreglo que no pasa lint, typecheck y test no se sube
Antes de subir un arreglo, el sistema SHALL pasar `lint`, `typecheck` y `test` sobre él. Si no consigue
un arreglo que los pase, MUST NOT subirlo y SHALL avisar al mantenedor de que el hallazgo sigue sin
arreglar, con el motivo. Los demás arreglos del push que sí pasan SHALL subirse. `e2e` MUST NOT pasarse
antes del push: lo pasa la CI de la PR.

> Traza: `MOO-77`, criterio *un arreglo que no pasa las comprobaciones no se sube* (el motivo,
> *asumido* en la historia); BE10. Sin `e2e` antes del push, y que lo pase la CI: decidido por el
> usuario al explorar el change (27-nov), matiza BE10 (`design.md` decisión 5). Que los demás se suban
> es *(asumido)*.

#### Scenario: El arreglo rompe un test
- **GIVEN** un hallazgo real de una PR
- **WHEN** el sistema no consigue un arreglo que pase `test`
- **THEN** el sistema no sube ese arreglo
- **AND** el mantenedor recibe un aviso de que el hallazgo sigue sin arreglar, con el motivo

#### Scenario: Uno de dos arreglos no pasa (asumido)
- **GIVEN** un push con dos hallazgos reales
- **WHEN** el arreglo del primero pasa `lint`, `typecheck` y `test` y el del segundo no
- **THEN** la rama de la PR tiene un push nuevo del sistema con el commit del primero
- **AND** el mantenedor recibe un aviso de que el segundo sigue sin arreglar, con el motivo

### Requirement: El sistema deja de arreglar cuando las vueltas no acaban
El sistema MUST NOT arreglar más en una PR, y SHALL avisar al mantenedor con el motivo, cuando la misma
comprobación falla dos veces seguidas tras un arreglo cada vez, o cuando ya ha subido N arreglos
(N = 3) desde el último push que no es suyo. Un push del mantenedor SHALL volver a dejarle arreglar.

> Traza: `MOO-77`, criterio *el sistema deja de arreglar cuando las vueltas no acaban* (que vuelva a
> arreglar tras un push del mantenedor, *asumido* en la historia); PB §4.1 (*se agotan N iteraciones o
> la misma comprobación falla dos veces seguidas*). N = 3 *(asumido)*, configurable, hasta la prueba a
> mano: decidido por el usuario al explorar el change (27-nov), `design.md` decisión 7. Fallar al
> relanzarla no cuenta (PB §4.1, `MOO-155`).

#### Scenario: La misma comprobación falla tras dos arreglos
- **GIVEN** una PR a la que el sistema ha subido un arreglo y `typecheck` ha vuelto a fallar
- **WHEN** el sistema sube otro arreglo y `typecheck` vuelve a fallar
- **THEN** el sistema no arregla más en esa PR
- **AND** el mantenedor recibe el aviso «necesita intervención» con el motivo

#### Scenario: Se agotan las vueltas
- **GIVEN** una PR a la que el sistema ha subido 3 arreglos desde el último push del mantenedor
- **WHEN** el triaje del último push termina con un hallazgo real
- **THEN** el sistema no lo arregla
- **AND** el mantenedor recibe el aviso «necesita intervención» con el motivo

#### Scenario: Un push del mantenedor vuelve a dejarle arreglar (asumido)
- **GIVEN** una PR en la que el sistema ha dejado de arreglar porque se agotaron las vueltas
- **WHEN** el mantenedor sube un push y su triaje termina con un hallazgo real
- **THEN** la rama de la PR tiene un push nuevo del sistema con el arreglo

### Requirement: El arreglo no pasa del tope de gasto de la PR
El sistema MUST NOT gastar en arreglar una PR más de su tope (2 $ por PR, configurable). Si un arreglo
no cabe, MUST NOT empezarlo y SHALL avisar al mantenedor con el motivo. El coste de cada arreglo SHALL
quedar registrado.

> Traza: BE8 (*cada PR tiene un tope de gasto y su coste queda registrado*); candidato del poke-holes
> de `MOO-77` que el usuario mandó a la spec al refinar (27-nov). 2 $ *(asumido)*, configurable, hasta
> la prueba a mano: decidido por el usuario al explorar el change (27-nov), `design.md` decisión 8.

#### Scenario: Se agota el tope
- **GIVEN** una PR cuyos arreglos ya han gastado su tope
- **WHEN** el triaje de su último push termina con un hallazgo real
- **THEN** el sistema no lo arregla
- **AND** el mantenedor recibe el aviso «necesita intervención» con el motivo

#### Scenario: El coste queda registrado (asumido)
- **GIVEN** una PR a la que el sistema ha subido un arreglo
- **WHEN** el mantenedor mira la traza de ese push
- **THEN** ve cuánto ha costado el arreglo y cuánto lleva gastado la PR

### Requirement: El sistema no sube un arreglo si la PR ha cambiado mientras arreglaba
Si mientras el sistema arregla llega un push nuevo a la PR, alguien la detiene, o se cierra o se
integra, el sistema MUST NOT subir su arreglo. Un push nuevo SHALL seguirse y triarse como cualquier
otro.

> Traza: `MOO-77`, criterio *la PR cambia mientras el sistema arregla*; BE11 (*puedo pararlo*); glosario
> de PB §8 (*estado final*: cada push tiene el suyo).

#### Scenario: Llega un push del mantenedor
- **GIVEN** el sistema está arreglando los hallazgos reales de un push
- **WHEN** llega un push nuevo a la PR
- **THEN** el sistema no sube su arreglo
- **AND** el commit del mantenedor sigue en la rama de la PR

#### Scenario: Alguien detiene la PR
- **GIVEN** el sistema está arreglando los hallazgos reales de un push
- **WHEN** alguien pone la etiqueta `babysitter:stop` a la PR
- **THEN** el sistema no sube su arreglo

#### Scenario: La PR se cierra o se integra
- **GIVEN** el sistema está arreglando los hallazgos reales de un push
- **WHEN** la PR se cierra o se integra
- **THEN** el sistema no sube su arreglo

### Requirement: Una comprobación que la PR no causa no se arregla en la PR
Una relanzable que sale *real* por regla porque ha vuelto a fallar al relanzarla MUST NOT arreglarse en
la PR: el sistema SHALL avisar al mantenedor de que falla una comprobación que la PR no causa. Los demás
hallazgos reales del push SHALL arreglarse igual.

> Traza: `MOO-77`, criterio *una comprobación que la PR no causa no se arregla en la PR*; D119 (sale
> *real* por regla). Una relanzable se relanza solo si el triaje del primer fallo no da que la causa la
> PR (`MOO-169`), así que la que ha fallado dos veces no la causa la PR o no está claro: las dos se
> avisan sin arreglar *(asumido)*, `design.md` decisión 11. La captura en *Triage* es `MOO-166`.

#### Scenario: e2e falla dos veces
- **GIVEN** una PR cuya comprobación `e2e` ha fallado en su primer intento, el triaje no da que la cause la PR, y ha vuelto a fallar al relanzarla
- **WHEN** el triaje final de ese push termina
- **THEN** el sistema no arregla `e2e`
- **AND** el mantenedor recibe un aviso de que falla una comprobación que la PR no causa

#### Scenario: La PR causa el fallo de test
- **GIVEN** una PR cuya comprobación `test` ha fallado en su primer intento y el triaje da con confianza que la causa la PR
- **WHEN** el triaje final de ese push termina
- **THEN** la rama de la PR tiene un push nuevo del sistema con el arreglo de `test`

### Requirement: Los hallazgos reales se arreglan aunque haya otros que exigen criterio
En un push con hallazgos reales y otros que exigen criterio, el sistema SHALL arreglar y subir los
reales y avisar al mantenedor de los que exigen criterio, sin tocarlos.

> Traza: `MOO-77`, criterio *los hallazgos reales se arreglan aunque haya otros que exigen criterio*
> (el aviso, *asumido* en la historia); PB §4, nota de BH4 (*hasta BH4, un hallazgo que exige criterio
> no se toca: el sistema avisa al mantenedor*).

#### Scenario: Uno real y uno que exige criterio
- **GIVEN** un push con un hallazgo real y otro que exige criterio
- **WHEN** el triaje de ese push termina
- **THEN** la rama de la PR tiene un push nuevo del sistema con el arreglo del real
- **AND** el mantenedor recibe un aviso con el hallazgo que exige criterio

### Requirement: Las PR de Dependabot no se arreglan
El sistema SHALL arreglar solo en las PR que sigue, las del mantenedor (`pr-tracking`). En una PR de
Dependabot, que no sigue, MUST NOT subir arreglos.

> Traza: non-goal de `MOO-77` (*arreglar las PR de Dependabot*); BQ3, que pasa a la captura
> `MOO-191`. La historia decía que en ellas «el sistema avisa en vez de arreglar», pero hoy no las
> sigue (`pr-tracking`, *El sistema sigue las PR del mantenedor…*), así que tampoco avisa: hallado
> al implementar `MOO-193` (27-nov). Seguirlas es de `MOO-191`.

#### Scenario: Una PR de Dependabot con una comprobación que falla
- **GIVEN** una PR de Dependabot contra main cuya comprobación `test` falla
- **WHEN** terminan las comprobaciones de su último push
- **THEN** la rama de la PR no tiene commits nuevos del sistema

### Requirement: Un arreglo interrumpido se reintenta una vez
Si el arreglo se interrumpe porque el servicio que arregla se reinicia, el sistema SHALL reintentarlo
una vez, desde cero, si el último push de la PR sigue siendo el mismo. Si se vuelve a interrumpir,
SHALL avisar al mantenedor con el motivo.

> Traza: decidido por el usuario al explorar el change (27-nov), para evitar ruido (`design.md`
> decisión 9). *(Asumido)*: la historia no lo cubre.

#### Scenario: El servicio se reinicia a mitad de un arreglo
- **GIVEN** el sistema está arreglando los hallazgos reales de un push
- **WHEN** el servicio que arregla se reinicia y el último push de la PR sigue siendo el mismo
- **THEN** el sistema vuelve a arreglarlos y los sube
- **AND** el mantenedor no recibe ningún aviso del reinicio

#### Scenario: Se interrumpe dos veces
- **GIVEN** un arreglo que ya se ha reintentado una vez tras un reinicio
- **WHEN** el servicio que arregla vuelve a reiniciarse a mitad
- **THEN** el mantenedor recibe el aviso «necesita intervención» con el motivo

### Requirement: La identidad que sube los arreglos no puede integrar
La identidad con la que el sistema sube los arreglos SHALL poder subir commits a la rama de una PR, y
MUST NOT poder integrar una PR ni actualizar `main`. El mantenedor SHALL seguir integrando como hasta
ahora.

> Traza: BE2 y D64 (el sistema no integra); BQ7, resuelta al explorar el change (27-nov) y verificada
> ese día en un repo de prueba (`design.md` decisión 2).

#### Scenario: La identidad del sistema intenta integrar
- **GIVEN** una PR con las comprobaciones en verde
- **WHEN** se intenta integrar con la identidad del sistema
- **THEN** GitHub lo rechaza y la PR sigue abierta

#### Scenario: La identidad del sistema intenta subir a main
- **GIVEN** la identidad del sistema
- **WHEN** se intenta subir un commit directo a `main` con ella
- **THEN** GitHub lo rechaza

#### Scenario: El mantenedor integra como siempre
- **GIVEN** una PR con las comprobaciones en verde y los hilos resueltos
- **WHEN** el mantenedor la integra con el botón de GitHub
- **THEN** la PR queda integrada
