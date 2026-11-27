## MODIFIED Requirements

### Requirement: El triaje no actúa sobre la PR
Triar MUST NOT arreglar nada, contestar ni resolver hilos, relanzar comprobaciones, ni cambiar el
estado final ni su aviso. Qué se hace con el resultado del triaje SHALL decidirlo el sistema aparte,
por reglas y sin el modelo de decisión, y la decisión MUST quedar registrada junto con la regla que la
toma. Esa decisión puede ser arreglar los hallazgos reales (capacidad `pr-fix`). Si el triaje falla,
el aviso del estado final MUST llegar igual.

> Traza: `MOO-75`, caso feliz (*el sistema no arregla nada, no contesta y no resuelve ningún hilo*);
> glosario de PB §8 (*modo sombra*); non-goals de la historia (BH3, BH4). Que un triaje que falla no
> retrase el aviso: `design.md` decisión 8 del change `pr-shadow-triage` *(asumido)*. Separar qué pasa
> (el triaje) de qué se hace (una decisión por reglas): decidido por el usuario al explorar el change
> `pr-first-failure-triage` (21-nov), su `design.md` decisión 1; BE4. Que la decisión pueda ser
> arreglar: `MOO-77`, caso feliz; change `pr-fixer`, `design.md` decisión 3.

#### Scenario: Tras el triaje todo sigue como estaba
- **GIVEN** una PR que necesita intervención con hallazgos en su último push, ninguno real
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

#### Scenario: La decisión de arreglar queda registrada (asumido)
- **GIVEN** una PR cuyo triaje final tiene un hallazgo real
- **WHEN** el sistema decide qué hacer con ese triaje
- **THEN** la traza del sistema registra que arregla, o por qué no, y qué regla lo ha decidido
