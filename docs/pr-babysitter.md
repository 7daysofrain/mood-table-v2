# PR Babysitter · qué y por qué

**ID:** `PB` ([documentos fuente](instructions/workflow.md#3-fuente-de-verdad-de-cada-cosa)) · **Versión:** 1.0 · **Fecha:** 22-oct-2026 · **Autor:** Joseba Alonso
**Estado:** documento vivo: se actualiza a medida que avanza la épica; el historial de cambios está en
git. Es la fuente de verdad de la épica técnica *PR Babysitter* (`MOO-67` en Linear).

> **Qué es este documento.** El *qué* y el *porqué* de la épica: el problema, para quién, qué se
> espera y qué historias salen de aquí. Hace para esta épica lo que el PRD hace para el producto, y
> no forma parte del PRD porque **no es producto**: es herramienta de desarrollo. **No** contiene
> criterios GIVEN/WHEN/THEN (viven en Linear y en OpenSpec) ni arquitectura (las decisiones técnicas
> están en `docs/idea-mood-table.md` §10 y el diseño se decide en el OpenSpec change de cada historia).
> Lo marcado *(asumido)* no tiene evidencia todavía y hay que confirmarlo.

---

## 1. Problema

### 1.1 De dónde viene

Cuando se abre una PR empieza un bucle que hoy conduce una persona: esperar a que pasen las
comprobaciones (`lint`, `typecheck`, `test`, `e2e`, SonarQube) y a que Codex revise el último push;
leer cada hallazgo, comprobarlo contra el código, arreglarlo o contestar por qué no aplica, resolver
el hilo y volver a esperar. El protocolo está escrito (`workflow.md` §4.4) y un agente de código
puede seguirlo, pero **solo cuando el mantenedor se lo pide**, en una sesión abierta y vigilando cada
vuelta.

Para el mantenedor es un proceso **tedioso**, que **exige atención** y es **propenso a fallos**. Y
casi todo es **automatizable**: la mayoría de las vueltas no piden criterio, solo atención.

**La puerta depende de que alguien mire.** En octubre, Copilot agotó su cuota. Avisaba con una
review de que no había podido revisar, pero una PR podía integrarse sin revisión si nadie se fijaba
(MOO-50).

**Objetivo:** que la atención humana se dedique **solo a lo que exige criterio**.

### 1.2 Alternativas y por qué se construye

| Alternativa | Por qué no basta |
|---|---|
| Seguir como hoy (agente en sesión, a petición) | Es el problema del §1.1 |
| Auto-fix de Claude Code | Arregla la CI y los comentarios, pero no tiene puertas, ni triaje, ni política de escalado |
| Codex | Solo revisa y comenta; no conduce la PR hasta el final |
| Un revisor propio | Codex ya revisa; competir con él no aporta |

Se construye por tres razones:

1. **Aprendizaje, el motivo principal.** El máster pide pensar qué agentes necesita el flujo
   (multiagente, modelo por tarea: `course.md` §3). Diseñar un sistema así, con estado, pausas y
   evaluación, es la mejor forma de aprenderlo.
2. **Ninguna herramienta cubre el flujo completo.** Lo valioso no es arreglar, sino **decidir** qué
   merece la pena, qué no aplica y qué exige criterio humano, con el contexto de este repo
   (OpenSpec, D#, `AGENTS.md`).
3. **Eje 3 de la evaluación** (uso de la IA en el proceso): un sistema así, medido y documentado,
   es la pieza más visible del arnés.

## 2. Usuarios y valor

| Usuario | Quién es | Qué necesita | Historias |
|---|---|---|---|
| **Mantenedor** | Quien integra las PR del repo. Hoy, el autor. | Que cada PR llegue **lista para integrar** sin vigilarla; que le avisen **solo** cuando hace falta criterio; poder entender y auditar qué se decidió y por qué. | BH1-BH5 |

## 3. Qué se espera

| # | Expectativa | Cómo sabremos que se cumple |
|---|---|---|
| BE1 | **Solo intervengo cuando hace falta.** | Las PR llegan a *lista para integrar* sin el mantenedor, salvo los casos de la política de escalado (§4.1). |
| BE2 | **El merge es mío.** | El sistema nunca integra una PR; no tiene permiso para hacerlo. |
| BE3 | **Juzga bien antes de actuar.** | Antes de dejarle arreglar, su triaje se mide contra PR ya cerradas y acierta lo suficiente. |
| BE4 | **Cada decisión se puede explicar.** | Para cada PR se ve qué decidió cada agente, por qué y cuánto costó. Sus comentarios en la PR se identifican como del sistema. Cuando decide un modelo de decisión, el porqué es su probabilidad frente al umbral, o la regla que ha decidido por él (`MOO-75`). |
| BE5 | **Respeta las reglas del repo.** | Sigue el protocolo de la PR de `workflow.md` §4.4 y no se sale del alcance de la PR. |
| BE6 | **Un comentario ajeno no lo controla.** | Solo atiende a Codex, SonarQube y el mantenedor; un comentario de otra persona no le hace cambiar código ni publicar nada. |
| BE7 | **Se recupera solo.** | Si la máquina se apaga, al volver retoma cada PR donde estaba. |
| BE8 | **Coste acotado y visible.** | Cada PR tiene un tope de gasto y su coste queda registrado. |
| BE9 | **Me entero cuando una PR está lista.** | Cuando una PR llega a *lista para integrar*, el sistema avisa al mantenedor por el mismo canal que cuando escala. |
| BE10 | **Sus arreglos no rompen nada.** | Ningún arreglo se publica sin pasar antes, en local, `lint`, `typecheck`, `test` y `e2e`; SonarQube lo comprueba la PR después, como en cualquier otra. |
| BE11 | **Puedo pararlo.** | El mantenedor puede detener el sistema en una PR concreta o del todo, y vuelve a ponerlo en marcha cuando quiere. |
| BE12 | **No gasta revisiones en balde.** | El sistema pide la revisión del revisor cuando las comprobaciones del último push están en verde, y no la pide dos veces para el mismo push. |

Como en el PRD del producto, las expectativas no llevan números: los umbrales (cuánto es "lo
suficiente", cuántas iteraciones, qué tope de gasto) se fijan en la spec de cada historia.

## 4. Historias

Cada BH# es una necesidad del mantenedor, como las H# del PRD. Cómo se parte en historias de Linear,
su tamaño y su orden se deciden en el backlog, no aquí.

- **BH1 · Saber en qué punto está cada PR.** Como **mantenedor**, quiero que el sistema siga cada PR
  abierta y me avise de su estado (lista para integrar, con hallazgos o sin revisión de Codex del
  último push), para no tener que vigilarlas yo. *(BE6, BE7, BE9, BE11)*
  - El canal por el que avisa se decide aquí; lo reutilizan las demás historias.
- **BH2 · Triar los hallazgos en modo sombra.** Como **mantenedor**, quiero ver cómo clasificaría el
  sistema cada hallazgo, sin que actúe, para confiar en su criterio antes de dejarle arreglar.
  *(BE3, BE4, BE8)*
  - Dónde ve el mantenedor esas decisiones (un comentario resumen en la PR o solo en las trazas) se
    decide en su spec.
- **BH3 · Arreglar y publicar.** Como **mantenedor**, quiero que el sistema arregle los hallazgos
  reales, conteste y resuelva sus hilos, para que la PR llegue lista para integrar. *(BE1, BE2, BE4,
  BE5, BE6, BE8, BE10)*
- **BH4 · Escalar cuando hace falta.** Como **mantenedor**, quiero que el sistema se pause en los
  casos de la política, me pregunte y siga con mi respuesta, para decidir lo que exige criterio sin
  vigilar. *(BE1)*
  - Hasta BH4, un hallazgo que exige criterio no se toca: el sistema avisa al mantenedor por el canal
    de BH1.
- **BH5 · Pedir la revisión cuando toca.** Como **mantenedor**, quiero que el sistema pida la revisión
  del revisor cuando las comprobaciones del último push estén en verde, para no gastar revisiones en
  código que va a cambiar ni tener que pedirla yo. *(BE4, BE11, BE12)*
  - La *Automatic review* de Codex sigue activada hasta que BH5 esté integrada; después la apaga el
    mantenedor en los ajustes de Codex.

### 4.1 Política de escalado

Sale de `workflow.md` §4.4. El sistema escala al mantenedor cuando:

- el arreglo cambia el diseño, contradice una D# o toca la spec del change;
- hay que **aceptar** una incidencia de SonarQube;
- descarta un hallazgo de severidad alta;
- el arreglo se sale del alcance de la PR o el diff crece por encima de un umbral;
- se agotan N iteraciones o la misma comprobación falla dos veces seguidas;
- Codex no revisa el último push o hay un comentario humano en la PR.

## 5. Alcance

### 5.1 Primera versión

BH1-BH5.

**Qué PR atiende:** todas las PR contra `main` del mantenedor (de tarea, *chores* sin change y de
archivar un change) y las de **Dependabot**. En las que no tienen spec, el alcance lo da el plan de
la *chore* en su tarea de Linear o la actualización de la dependencia.

**Mínimo útil:** BH1. Ya quita al mantenedor el papel de reloj.

La Entrega 3 (11-nov) **no depende** de esta épica (prioridad *should*): lo integrado para entonces se
cuenta en `prompts.md` y el resto sigue después.

### 5.2 Visión (fuera de la primera versión)

- Integrar sin el mantenedor en tipos de PR concretos (p. ej. las de archivar un change), cuando
  los datos lo justifiquen.
- Un revisor propio en local (p. ej. con Ollama), que quitaría la dependencia de BA7. Choca con §5.3
  y §6.2, y se valoraría tras BH2, con su medición.

### 5.3 Fuera por decisión

- **Integrar PR** en la primera versión (BE2).
- **PR de otras personas o de forks:** el repo es público (BE6).
- **PR de entrega** (`main` → `feature/entrega-N-JA`): son una foto de `main`, no hay nada que arreglar.
- **Revisar código** por su cuenta: lo hace Codex.
- Webhooks o un *runner* de GitHub propio (repo público); el despliegue gestionado de LangGraph.
- Ejecutarse en la Raspberry Pi del instrumento.

## 6. Supuestos y restricciones

### 6.1 Supuestos

| # | Supuesto |
|---|---|
| BA1 | Codex revisa cada push y su comentario se puede leer por máquina (bloque `codex-review-state`). |
| BA2 | Codex también revisa las PR de Dependabot *(asumido: comprobarlo)*. Si no, en esas PR los hallazgos solo vienen de la CI y de SonarQube. |
| BA3 | **El revisor puede cambiar** (en octubre pasó de Copilot a Codex): cambiar de revisor no debe obligar a rehacer el sistema. |
| BA4 | Hay suficientes PR cerradas con hallazgos y respuestas para medir el triaje *(asumido: se cuentan al especificar BH2)*. |
| BA5 | Hay un presupuesto mensual para los modelos *(asumido: la cifra se fija en la spec)*. |
| BA6 | El sistema está en marcha cuando hay PR abiertas *(asumido)*. |
| BA7 | El revisor atiende a la petición de revisión del sistema: en Codex, un comentario `@codex review`. **Solo se cumple si lo escribe una cuenta vinculada a Codex** (comprobado el 27-oct en la #77): el de una GitHub App lo rechaza y pide «create a Codex account». Por eso el sistema lo escribe con el token del mantenedor. |

### 6.2 Restricciones

- El repo es **público**.
- La revisión de código la hace un revisor externo (hoy, Codex).
- No se ejecuta en la Raspberry Pi del instrumento.
- Modelos de pago por uso (API o Bedrock), no la suscripción.
- Token de GitHub limitado a este repo y sin permiso de merge.
- Prioridad *should*: no compite con el producto en la Entrega 3 (11-nov).

Las decisiones técnicas (TypeScript, LangGraph.js, contenedor, polling) no son restricciones: van al
registro de decisiones como D# nuevas, con su porqué. Durante el desarrollo se ejecuta en una
máquina de casa; si luego compensa, puede pasar a la nube.

## 7. Preguntas abiertas

Solo las que cambian lo que nota el mantenedor. Las de diseño se deciden en el OpenSpec change de
cada historia.

| # | Pregunta | Se resuelve en |
|---|---|---|
| BQ1 | Por dónde avisa el sistema al mantenedor | BH1. ✅ **Resuelta (25-oct, `MOO-73`):** por Linear, con un comentario de una app propia en la tarea de la PR que menciona al mantenedor; lo que no tiene tarea va a un issue buzón (D70) |
| BQ2 | Dónde ve el mantenedor las decisiones del modo sombra (un comentario resumen en la PR o solo en las trazas) | BH2. ✅ **Resuelta (28-oct, `MOO-75`):** en un comentario resumen en la PR, firmado por el sistema, uno por push |
| BQ3 | Qué hace con las PR de Dependabot si subir commits a su rama hace que Dependabot deje de mantenerla *(asumido: comprobarlo en su documentación)*: escalar en vez de arreglar, o pedirle a Dependabot que la rehaga | BH3 |
| BQ4 | Por dónde contesta el mantenedor cuando el sistema escala | BH4 |
| BQ5 | Los umbrales de BE3, BE8 y de la política (§4.1) | La spec de cada historia |
| BQ6 | ¿Refleja el sistema en Linear el estado de cada PR (mover la historia o la tarea), además de comentar? Hoy los estados los mueve la integración de GitHub, y dos escritores sobre el mismo estado se pisarían | Una historia propia de PB |
| BQ7 | Cómo hace push el sistema sin poder integrar: en GitHub, el permiso `Contents: write` del token que hace falta para subir commits también deja integrar PR por la API, y BE2 y D64 piden que no pueda | BH3 |

## 8. Glosario

Términos nuevos de esta épica (documentos en español, código en inglés).

| Término | En código | Definición |
|---|---|---|
| **PR Babysitter** | `pr-babysitter` | Nombre propio del sistema (no se traduce): conduce cada PR desde que se abre hasta dejarla lista para integrar. |
| **Mantenedor** | `maintainer` | Quien integra las PR del repo. |
| **Revisor** | `reviewer` | El servicio externo que revisa el código de la PR y deja comentarios (hoy, Codex). |
| **Comprobación** | `check` | Cada puerta automática de la PR: `lint`, `typecheck`, `test`, `e2e` y SonarQube. |
| **Alcance de la PR** | `prScope` | Lo que la PR debe cambiar: su tarea y su spec, el plan de la *chore* o la actualización de la dependencia. Salirse de él es motivo para escalar. |
| **Hallazgo** | `finding` | Algo que una PR debe atender: un comentario del revisor, una incidencia nueva de SonarQube o una comprobación que falla. |
| **Triaje** | `triage` | Clasificar un hallazgo en **real** (`valid`), **no aplica** (`notApplicable`) o **exige criterio** (`needsJudgment`). La pregunta es si hay que arreglarlo en esta PR antes de integrarla: *real* es que sí. |
| **No aplica** | `notApplicable` | Hallazgo que no hay que arreglar en esta PR: está equivocado, ya está resuelto, cae fuera del alcance de la PR o es un nit (una cuestión de gusto o una mejora menor que no merece un commit). |
| **Exige criterio** | `needsJudgment` | Hallazgo que el sistema no decide solo. Sale cuando su confianza no llega al umbral, o por una regla: descartaría un hallazgo de severidad alta, no ha podido reunir su contexto o se ha llegado al tope de gasto de la PR. |
| **Arreglo** | `fix` | Cambio que atiende un hallazgo. |
| **Modo sombra** | `shadowMode` | El sistema decide y registra, pero no actúa. |
| **Modo ensayo** | `dryRun` | El sistema arregla en local y deja el arreglo en una rama para revisarlo, pero no publica. |
| **Escalar** | `escalate` | Pausar una PR y pedir criterio al mantenedor. |
| **Política de escalado** | `escalationPolicy` | Los casos en los que el sistema escala (§4.1). |
| **Lista para integrar** | `readyToMerge` | Comprobaciones en verde, revisión del revisor del último push e hilos resueltos. |
| **Necesita intervención** | `needsIntervention` | El otro estado final de una PR, cuando no está lista para integrar: falla una comprobación, el revisor tiene hallazgos o algo no termina a tiempo. El aviso dice el motivo, y la PR queda en manos del mantenedor. |
| **PR detenida** | `stopped` | PR cuyo seguimiento ha detenido alguien con permiso de escritura en el repo: el sistema no avanza en ella hasta que se reanuda. No es lo mismo que *escalar*, donde es el sistema quien pausa la PR. |
| **Issue buzón** | `inboxIssue` | Issue fijo de Linear donde el sistema avisa de lo que no tiene tarea: una PR sin tarea enlazada o un fallo del propio sistema (`linear.md` §9). |
