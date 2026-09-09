> # ❌ IDEA DESCARTADA — 09-sep-2026
> **No es la fuente viva del proyecto. Se conserva como archivo histórico.**
> El razonamiento completo de por qué se cayó, y los filtros para la idea siguiente, están en
> [`POSTMORTEM-sutegi.md`](./POSTMORTEM-sutegi.md). No reabrir esta discusión sin leerlo antes.
> Lo único reutilizable tal cual es la §15 (decisiones de stack de CLI).

<!-- WIP · idea en evaluación. Se rellena punto por punto en conversación. -->

# 🔥 Sutegi Design System

> **Pitch (1 frase):** un **framework agéntico "one-person"** para crear y mantener un
> design system, que aporta los agentes, los workflows, la ejecución y la gobernanza del
> proceso, apoyándose en primitivas de terceros (headless, tokens, Figma MCP).

**Estado:** 🟢 **IDEA ELEGIDA** · **Nombre:** ✅ Sutegi DS (08-sep-2026) · **Autor:** Joseba Alonso (JA)

> **Sobre el nombre:** *sutegi* es "fragua" en euskera. Metáfora elegida por tres razones:
> raíz personal, sonoridad internacional (su-TE-gi se pronuncia bien en inglés), y porque una
> fragua es donde se forja una pieza **y** donde se lleva a reparar — los dos verbos del
> proyecto: crear y mantener. Verificado libre en npm y sin colisión de producto.
> Descartados: *Atelier* (dos proyectos en el barrio), *Keystone* (KeystoneJS),
> *Obrador* (López Obrador), *Steward*/*Conservator* (no convencían).

---

## 1. Problema y usuario
- **Problema:** mantener un design system requiere un equipo dedicado. Los equipos
  pequeños no pueden permitírselo y el DS **se degrada** (*drift* entre Figma, código y
  documentación). [Experiencia propia.]
- **Usuario:** dev o equipo pequeño **sin** equipo de DS dedicado; startups; mantenedor
  en solitario ("one man army").
- **Por qué importa:** el *drift* silencioso destruye el valor del DS; hoy se combate con
  disciplina humana que no escala.

---

## 2. VISIÓN COMPLETA del framework (*want to be*)

**a) Agentes** — perfiles especializados que actúan dentro de los workflows:
- *Design System UI Architect*: cuida la forma y las foundations; advisor; valida que las
  propuestas de componentes cumplan las foundations de diseño.
- *A11Y Advisor*: revisa el DS desde la accesibilidad.
- *Engineering Architect*: buenas prácticas, SOLID, salud técnica del sistema.

**b) Workflows** — flujos propios de un DS, integrados con SDD (OpenSpec vía adaptador):
- *Design Foundations*: foundations, tokens, escalas y grids al iniciar el DS.
- *E2E Component Creation*, con subflujos:
  1. Definición y alcance
  2. UI Design (componente en Figma vía MCP)
  3. Component Coding (desarrollo; ampliable a documentación, testing E2E…)

**c) Skills** — mezcla de skills existentes (oficiales de Figma) + skills propias de
conocimiento sobre partes del framework.

**d) CLI** — instalación e inicialización del framework sobre los coding agents más
conocidos (Claude, Codex, GitHub Copilot…).

**e) Runner** — código que **invoca los agentes programáticamente** (no depende de que un
humano los lance desde un cliente). Es la columna vertebral: convierte definiciones en
sistema ejecutable, componible y **testeable**.

**f) Panel de control del DS** — inventario de componentes, estado de foundations,
resultados de validación, drift, histórico.

**g) Orquestador web en la nube** — UI para ejecutar el runner remotamente. *(Roadmap.)*

---

## 3. MVP — qué se entrega

**Las tres piezas de código que sostienen el eje 2:**
- **Runner** (motor de ejecución) — MUST. Invocación programática de agentes/workflows.
- **Motor de validación determinista** (motor de criterio) — MUST. Analiza el código
  (AST), comprueba uso de tokens vs hardcodeados, asserts de accesibilidad, contraste
  contra las foundations declaradas. Aporta: código sustancioso, tests unitarios, test E2E
  viable y **agentes fundamentados en hechos, no en opinión**.
- **Panel de control** (la cara visible) — MUST. Front + back + BD; es lo que se demuestra.
- **CLI** — MUST (init/instalación), aunque de menor peso técnico (I/O + plantillas).

**Fuera del MVP (roadmap):** UI de orquestación en la nube, multi-coding-agent, drift
continuo.

> Nota de calibración: hay un **gradiente de interés técnico** para el eje 2 →
> CLI (scaffolding) < Runner (arquitectura de ejecución) < Motor de validación (AST,
> reglas, tests). Los tres suman, no puntúan igual.

## 4. Historias de usuario (CERRADAS)

**Must-have (5):**
1. **Scaffolding** del harness y carpetas básicas. *Determinista, sin IA.*
2. **Design Foundations** — workflow de IA que genera las foundations, la **fuente de
   verdad de tokens** y un `DESIGN.md`. *Workflow de IA.*
3. Crear un componente *end-to-end* (**golden loop, CON Figma**).
4. Validar un componente contra foundations y accesibilidad (motor).
5. Ver el estado del DS en el panel de control.

**Should-have (1):**
6. Detección de *drift*.

✅ **5 + 1 está DENTRO del rango de LIDR** (3-5 must + 1-2 should). Es el techo, no un
exceso. Decisión consciente de Joseba: ser ambiciosos.

**1 y 2 son historias distintas** (confirmado): scaffolding es determinista y estructural;
foundations es un workflow de IA que produce decisiones de diseño. Valor distinto,
naturaleza distinta.

### 🧱 Pieza angular: la fuente de verdad de tokens ✅ DECIDIDA (investigado 08-sep-2026)

Todo cuelga de este artefacto: el **motor de validación** valida *contra* él, el **flujo de
Figma** lee *de* él, los **componentes** lo consumen y el **panel** muestra su estado.

**Tres capas distintas (no confundir):**
1. **Formato/esquema** de los tokens.
2. **Pipeline** de transformación (a CSS, TS, iOS…).
3. **Superficie de autoría** (dónde se crean/editan).

**1) Formato → DTCG (W3C Design Tokens Community Group), versión `2025.10`.**
- Primera **versión estable** publicada el 28-oct-2025 (antes era borrador móvil → ahora es
  apuesta segura).
- Incluye: espacios de color modernos (Display P3, Oklch), alias y referencias, temas
  (claro/oscuro, multimarca, variantes a11y) sin duplicar ficheros, y *token resolvers*.
- Soportado por Figma, Penpot, Sketch, Tokens Studio, Style Dictionary y Terrazzo.
- No hay versión posterior a mediados de 2026.
- ✅ **No hay que inventar formato propio.**

**2) Pipeline → DIFERIDO sin riesgo (es una dependencia hoja).**
DTCG es solo el formato; el pipeline resuelve alias/referencias, aplica transforms
(px→rem, hex→UIColor) y **emite artefactos por plataforma** (CSS vars, TS, Tailwind,
iOS, Android). Sin él, eso lo escribes tú.
- **Style Dictionary v4**: el maduro (Amazon), ecosistema enorme de transforms/formats.
  ⚠️ No cubre del todo la 2025.10 (en curso para v5).
- **Terrazzo**: DTCG-nativo, más al día con la spec, menos ecosistema.

> 📐 **Principio:** se decide pronto lo que **sostiene al resto** (el formato lo tocaba todo)
> y se aplazan las **hojas** (el pipeline corre en build y escupe ficheros; cambiarlo es
> tocar una config y un script).

⚠️ Nota: el **motor de validación** también necesitará resolver alias de tokens → decidir si
reutiliza el resolver del pipeline o implementa el suyo.

**3) Autoría/dirección → CODE-FIRST.** La verdad vive en JSON DTCG versionado en el repo;
**Figma es una proyección** (el framework escribe variables vía plugin/MCP). Razones:
- *diffeable* en git,
- directamente legible por los agentes,
- **validable por el motor** — si la verdad viviera en Figma, el motor no tendría contra qué
  contrastar sin salir a la red.

### 🔑 Figma: dos cuestiones distintas ✅ RESUELTAS (verificado 08-sep-2026)

**(a) Qué le exige el PRODUCTO a sus usuarios** — arquitectura, no aplazable:
- **REST API de Variables → requiere Enterprise** (asiento *Full*, scopes
  `file_variables:read/write`). Inviable para el usuario objetivo.
- **Camino plugin/MCP → NO requiere Enterprise.** ✅ Decisión confirmada.
- ➡️ Requisito público del framework: **Figma Professional con asiento Dev/Full**. Honesto
  y vendible. Es una restricción de negocio que **justifica** una decisión técnica →
  material de lucimiento para la Entrega 1.

**(b) Qué necesita JOSEBA para desarrollar y demostrar** — cuotas reales del MCP de Figma:
| Plan / asiento | Cuota MCP |
|---|---|
| Starter (gratis), View/Collab | **20 llamadas al MES** → inservible |
| Professional, Dev/Full | **200/día** (10/min) |
| Organization, Dev/Full | 200/día (15/min) |
| Enterprise, Dev/Full | 600/día (20/min) |

➡️ **NO hace falta Enterprise.** Enterprise es más cuota, no más capacidad.
➡️ ✅ **Decisión: comprar licencia personal Professional con asiento Dev.** Coherente con la
separación de la empresa ya decidida (§4bis). **No atar la viabilidad al asiento corporativo**:
perderlo a mitad de octubre dejaría el proyecto tirado en plena Entrega 2.

⚠️ **Aviso operativo:** 200 llamadas/día es un presupuesto real cuando un agente itera sobre
Figma. Hay que **agrupar operaciones y cachear**, y no quemar llamadas en bucles de prueba y
error. Da para una decisión de diseño lucida en la Entrega 1.

### 📄 `DESIGN.md` ≠ fuente de verdad, y **NO es un artefacto generado** (corrección doble)
- **Tokens DTCG** = contrato **legible por máquina**, contra el que valida el motor.
  Contienen **valores**.
- **`DESIGN.md`** = guía **legible por humanos y agentes**: principios, criterios, cuándo
  usar qué, el porqué. Contiene **criterio**.

⚠️ **`DESIGN.md` NO se deriva de los tokens.** De `#D32F2F` no se puede deducir "este color
solo para acciones destructivas irreversibles": esa frase es una decisión humana que no está
en el dato. Es un artefacto **autorado** por el workflow de Foundations (con Joseba en el
bucle) que *referencia* los tokens.

**Consecuencia práctica:** si se trata como generado, cualquier regeneración **borra las
decisiones**. Tratarlo como artefacto de primera clase versionado, con las secciones
autogeneradas (p.ej. tabla de tokens disponibles) claramente delimitadas.

**Por qué importa:** los agentes advisors leen `DESIGN.md` para **juzgar**, y juzgar requiere
criterio — que vive ahí, no en el JSON.

**Fuentes:** [DTCG: primera versión estable](https://www.w3.org/community/design-tokens/2025/10/28/design-tokens-specification-reaches-first-stable-version/) ·
[Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/) ·
[Style Dictionary — soporte DTCG](https://styledictionary.com/info/dtcg/) ·
[Figma REST API — Variables (Enterprise)](https://developers.figma.com/docs/rest-api/variables/) ·
[Figma MCP — cuotas y acceso por plan](https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/)

### 🛟 Plan B: orden de sacrificio ✅ VALIDADO
Punto de control: **Entrega 2, 23 de octubre.** Si el golden loop no respira, se ejecuta
sin dramas:
1. Cae el **drift** (should-have).
2. El **panel** se reduce a solo lectura.
3. Lo último que se toca es el **golden loop**.

*Criterio reutilizable:* se sacrifica primero lo más lejano a la tesis, y **se degrada
antes que se elimina** (el panel no se borra: se reduce a solo lectura y conserva la demo).
El golden loop es intocable porque *es* la tesis.

## 4bis. ✅ RESUELTO — Propiedad intelectual del flujo Figma
Joseba construyó en su trabajo un flujo agéntico de creación de componentes Figma sobre
OpenSpec. **Decisión: reimplementar de cero.** El *conocimiento* es suyo y viaja con él; el
código se queda en la empresa. Precaución: partir de hoja en blanco, sin copiar ficheros.

Efecto colateral positivo: haber recorrido el camino hace que meter Figma en el golden loop
sea ambición **fundada**; y el `prompts.md` de esa parte queda completo (1/3 de la nota).

## 5. Stack tentativo
- **Primitivas:** React + headless (Radix/React-Aria/shadcn); tokens (Style Dictionary);
  docs (Storybook).
- **Framework:** CLI + runner + motor de validación (código propio) + agentes/workflows/skills.
- **Figma:** MCP oficial + skills oficiales (riesgo de viabilidad rebajado: hay camino soportado).
- **Panel:** front + back + BD.

## 6. Uso de IA — *eje de nota*
- **En el proceso:** SDD con OpenSpec, subagentes, skills, comandos. Sin riesgo, puro
  beneficio para el eje 3. Documentar en `prompts.md`.
- **En el producto:** núcleo absoluto — el producto ES un artefacto de ingeniería de IA.

## 7. El Runner: qué es y qué NO es (aclaración clave)

**Origen:** captura de referencia aportada por Joseba = un `APIClient` con `requests.post`
contra `/api/generate` de **Ollama** (`llama3.2`, seed, temperature, stream).

⚠️ **Eso es una llamada de completado a un modelo, no un agente ni un runner.** Un agente
necesita: herramientas (leer/escribir ficheros del repo, ejecutar comandos, MCP de Figma,
invocar el motor de validación), bucle multi-turno con manejo de resultados, gestión de
contexto y control de errores. Construir eso sobre un `requests.post` = reimplementar un
harness de agentes. **No es el diferenciador del proyecto.**

**Decisión:** apoyarse en un runtime existente — **Claude Agent SDK** (agentes
programáticos con herramientas y subagentes) o invocación *headless* de coding agents.

**Lo que sí es código propio (y es el corazón del eje 2):** la **lógica de orquestación** —
máquina de estados del workflow, encadenado de subflujos, paso de contexto entre agentes y,
sobre todo, el **bucle generar → validar → corregir**: si el componente no pasa las
foundations, vuelve al agente con el informe de errores del motor. Testeable y sustancioso.

**Riesgos asociados:**
- ✅ **DECIDIDO — sin modelos locales en el MVP.** Ollama/local pasa a la visión de producto
  (roadmap). Se usa runtime de agentes con modelos de proveedor.
- ✅ **DECIDIDO — CLI implementa solo Claude.** Los demás (Codex, Copilot) se mostrarán
  marcados explícitamente como *roadmap* (en la doc y/o al arrancar el CLI), para que se
  lea como decisión y no como bug.

*Diferencia `requests.post` vs SDK de agentes (para el `prompts.md`):* con una llamada cruda
mandas texto y recibes texto; si el modelo necesita leer un fichero o llamar a Figma no
puede — tendrías que programar tú el bucle petición→ejecución→resultado, el parseo, los
errores y el contexto. El SDK te da ese bucle hecho y probado; tú solo declaras qué
herramientas existen. Construir el motor vs conducir el coche.

## 8. Decisión de arquitectura: OpenSpec vía adaptador
Separar dos cosas que se confunden:
1. **Usar OpenSpec como proceso propio de desarrollo** → sin riesgo, hazlo.
2. **Que los workflows del framework dependan de OpenSpec en runtime** → acoplamiento.

**Resolución:** modelo de spec interno propio (capability / requirement / scenario) +
**un adaptador** que lee y escribe formato OpenSpec. El núcleo no conoce OpenSpec.
Es inversión de dependencias (ports & adapters) → suma en ejes 1 y 2, y permite soportar
spec-kit u otro mañana. ⚠️ **Un adaptador, no un sistema de plugins de formatos**: la
abstracción universal en un MVP es sobreingeniería.

## 9. Riesgos y puntos grises
- ⚠️ **Alcance del golden loop** (ver decisión abierta en §4). Es lo que decide si el
  calendario es realista.
- ⚠️ **Dependencia de terceros**: bien para no reinventar, pero el "meat" propio (runner,
  validación, panel) debe llevar el peso técnico.
- 💡 **Oportunidad**: *dogfooding* — usar el framework para construir su propio panel.
  Gran narrativa para redes y `prompts.md`; ojo con la circularidad.
- ✅ **Verificabilidad resuelta** por el motor de validación (output determinista).
- ✅ **Eje 2 cubierto**: runner + motor + panel + CLI es código real y sustancioso.
- ❌ Fuera de scope: gestión de incidencias (descartado).

## 10. Atractivo (orgullo / redes)
- Muy alto: framework agéntico + design systems es tema candente; el panel da output
  visual y el dogfooding da narrativa.

---

## 11. Veredicto y selección

✅ **IDEA SELECCIONADA — decisión tomada el 08-sep-2026.** No se desarrolla una segunda idea.

**Cumplimiento de los criterios de LIDR (verificado punto por punto):**
| Criterio | ¿Cumple? |
|---|---|
| MVP robusto (no "una pantalla con un botón") | ✅ |
| ≥1 flujo E2E con back + front + BD | ✅ (panel = 3 capas; golden loop = el flujo) |
| 3-5 historias must-have + 1-2 should-have | ✅ 5+1 (en el techo, dentro) |
| IA en todas las fases | ✅ sobresaliente |
| Tests unit + integración + ≥1 E2E | ✅ el motor de validación los hace naturales |
| Despliegue + evidencia | ✅ |
| `prompts.md` / registro de IA | ✅ de los ricos |
| Eje 1 idea+arquitectura / Eje 2 código / Eje 3 IA | fuerte / suficiente / sobresaliente |

**Razones de cerrar sin comparar con una 2ª idea:**
- ⏱️ **8-sep → Entrega 1 el 25-sep = 17 días.** El coste de seguir comparando ya supera al
  beneficio; toca escribir documentación.
- 💪 **Motivación como criterio legítimo**: es el día a día de Joseba, tiene continuidad como
  proyecto personal. Sostiene el tramo duro de octubre-noviembre.
- El scorecard existía para **comparar**; con una sola idea sería ceremonia. Se sustituye por
  la lectura de fortalezas/debilidades de abajo.

**Dónde estamos fuertes:** eje 3 (uso de IA), atractivo/redes, motivación.

**Dónde estamos débiles (aquí va la atención):**
1. 🔴 **Factibilidad en fechas** — mucha superficie (CLI, runner, motor AST, flujo Figma,
   foundations, panel 3 capas, 3 agentes, tests, despliegue) para una persona hasta el 11-nov.
   *Mitigación: plan B / orden de sacrificio ya validado (§4).*
2. 🟠 **Eje 2 (calidad de código)** — suficiente, pero exige que **runner y motor lleven el
   peso técnico real**, no el CLI.
3. 🟠 **Riesgo técnico** — cuotas de Figma (200/día) y fiabilidad de los agentes.

## 11bis. Scorecard (no aplicado — sin comparación)
[Pendiente — al cerrar el golden loop.]

## 12. Preguntas abiertas
- ✅ Fuente de verdad de tokens: **DTCG 2025.10, code-first**. Pendiente menor: pipeline
  (Style Dictionary v4/v5 vs Terrazzo).
- ✅ Figma resuelto: camino plugin/MCP, licencia personal **Professional + asiento Dev**.
- Pipeline de tokens (Style Dictionary vs Terrazzo) → diferido, es dependencia hoja.
- Rellenar el **scorecard** (§11) — Joseba primero, luego contraste.
- ¿Nombre definitivo? ("Design System" es defendible porque la gobernanza es central.)

---

## 13. Estado del arte y diferenciación (investigado 08-sep-2026)

La categoría existe y se llama **"Agentic Design Systems"**. Está **emergiendo**, no consolidada:
se define ahora mismo mediante charlas, cursos y experimentación real (AI Design Systems
Conference 2026), no mediante productos comerciales maduros.

### Quién está en el espacio

**Soluciones puntuales (hacen UNA cosa):**
| Proyecto | Qué hace | Solapa con |
|---|---|---|
| **Tidy** (Romina Kavcic) | Plugin de Figma, 66 herramientas MCP; audita nomenclatura, puntúa salud del sistema, valida tokens | Validación (lado Figma) |
| **FigmaLint** | Plugin; analiza componentes con IA, puntúa uso de tokens y accesibilidad | Validación + a11y (lado Figma) |
| **`lifesized/figma-design-sync`** | Skills de agente para sincronizar DS entre código y Figma. Code-first, token-bound | Sync / drift |
| **Observatory** | Dashboard de grafos de conocimiento del ecosistema de diseño | Panel |

**Sistemas internos de empresas grandes (no son productos instalables):**
- **GitHub Primer** — MCP público con subagentes de accesibilidad y QA diaria.
- **Spotify Encore** — arquitectura de componentes por capas + framework de evaluación con MCP.
- **Indeed** — 77 componentes a metadatos JSON, 4.300 prototipos IA en 4 meses.

### Dónde está el hueco (el *wedge*)

1. **Ciclo integrado vs solución puntual.** Foundations + creación + validación + gobernanza
   en un mismo harness instalable. `figma-design-sync` declara explícitamente que **NO cubre
   gobernanza, ni dashboard, ni framework de validación** — justo las tres piezas del MVP.
2. **Validación determinista sobre CÓDIGO.** Casi todo lo demás vive del lado de Figma y
   **juzga con IA**. Aquí se analiza el AST contra tokens DTCG: falla un test, no "puntúa".
3. **Posicionamiento "one-person".** GitHub, Spotify e Indeed construyeron esto **teniendo
   equipo**. El usuario objetivo aquí es quien **no lo tiene**. Nadie de esa lista le sirve.

### Riesgos reales (no endulzar en la Entrega 1)
- ⚠️ El espacio **se mueve rápido**; Figma ha abierto su canvas a los agentes → parte de esto
  puede commoditizarse.
- ⚠️ `figma-design-sync` está cerca de la pieza de sync/drift → **mirárselo como estado del
  arte** y citarlo honestamente.

### Uso en la Entrega 1
LIDR **no evalúa la novedad** (los ejes son idea+arquitectura, código, uso de IA). Pero la
sección 2.1 pide justificar la arquitectura **y sus déficits**: situar el proyecto en este
panorama y enunciar el hueco en una frase es lo que distingue una entrega pensada.

**Fuentes:** [Agentic Design Systems — panorama](https://www.intodesignsystems.com/agentic-design-systems) ·
[lifesized/figma-design-sync](https://github.com/lifesized/figma-design-sync) ·
[Figma abre el canvas a los agentes](https://www.figma.com/blog/the-figma-canvas-is-now-open-to-agents/)

---

## 14. Decisiones de arquitectura ✅ CERRADAS (08-sep-2026, sesión de la sección 2)

Tomadas al redactar 2.1/2.2/2.3 del `readme.md`. No rediscutir sin motivo nuevo.

**14.1 · Cómo se alimenta el panel → artefacto en repo + ingesta.**
El runner **no** escribe en la BD del panel. Escribe artefactos de ejecución versionados
(`.sutegi/runs/*.json`) y el panel los **ingiere**. La BD es un **read model derivado y
reconstruible**: se puede borrar y regenerar reingiriendo el repo.
*Por qué:* mantiene la coherencia con code-first (la verdad vive en el repo), evita duplicar la
verdad, y el flujo principal funciona con el panel apagado.
*Déficit asumido:* el panel muestra lo ingerido, no el estado del disco del desarrollador; hasta la
ingesta, ambos discrepan. (Redactado así el 09-sep: enunciarlo como "no hay tiempo real" era
criticarse por no tener una funcionalidad que nunca estuvo en el alcance.)
*Bloquea/desbloquea:* define la sección 3 (modelo de datos = proyección) y la 4 (la API del panel
es de **lectura** + un endpoint de ingesta, no de escritura desde el runner).

**14.2 · Extensibilidad asimétrica → solo las reglas del validador.**
El motor carga reglas propias del proyecto desde `.sutegi/rules/`. Agentes y workflows **no** son
extensibles en el MVP.
*Por qué:* el criterio de un DS es específico de cada equipo y el contrato de una regla es pequeño
y estable (AST + foundations → hallazgos); un sistema de extensión de workflows sería una
abstracción universal difícil de acertar sin usuarios reales.
*Consecuencia:* **no** se declara microkernel como patrón (habría entrado en tensión con la
decisión de §8 de "un adaptador, no un sistema de plugins"). "Dónde el sistema es extensible y
dónde decide no serlo" se usa como argumento en 2.1.

**14.3 · Monorepo de 4 paquetes: `core`, `validator`, `cli`, `panel`.**
⚠️ *Rectificado el 09-sep-2026.* Inicialmente se decidieron 3 (`harness`, `cli`, `panel`).
Se cambió por dos motivos: el nombre "harness" sugería "carpeta de prompts" e indujo a error al
propio autor, y meter el motor de validación —el grueso del código, y sin relación con los
agentes— dentro de un paquete llamado así era una frontera mal puesta.
*Efectos:* hace visible dónde está el peso técnico, da al validador suite de tests propia, y lo
vuelve **utilizable por sí solo como un linter**, sin agentes de por medio.
*Dirección de dependencias (verificable con linting):* `cli → core → validator`; `panel` no depende
de nadie (solo lee artefactos del repo).
*Propiedad clave:* **el `validator` no hace entrada/salida** — recibe código, tokens ya resueltos y
reglas, y devuelve un informe. Lee del disco `core`, a través de sus puertos.

**14.4 · El patrón se declara POR NIVELES, y el titular es el BUCLE DE CONTROL.**
⚠️ *Rectificado el 09-sep-2026.* La primera versión ponía el titular en "arquitectura hexagonal".
**Estaba sobrevendido.** Lo que el proyecto necesita de verdad es *inyección de dependencias* en las
fronteras (para poder testear sin Figma ni modelos), no la estratificación `domain`/`application`
que acompaña a hexagonal. Se descarta la capa de dominio por tres razones, documentadas en 2.1:
el dominio es delgado (tokens, reglas y hallazgos son estructuras de datos, no un modelo con
comportamiento); los puertos ya dan el aislamiento buscado; y declarar un patrón que el código
luego no respeta es peor que no declararlo.
*Los cuatro niveles:* 0) monorepo · 1) paquetes por capacidad · 2) `core`: puertos + inyección ·
`validator`: motor de reglas · `panel`: capas · 3) **bucle de control cerrado** ← titular.
*Argumento de nota:* saber justificar por qué **no** se aplica un patrón conocido demuestra más
criterio que aplicarlo por inercia, y encaja en el apartado de sacrificios que pide la plantilla.
*Insight reutilizable:* "monorepo vs hexagonal" es una falsa disyuntiva — los patrones operan en
niveles distintos; es como preguntar si una casa es de ladrillo o tiene tres plantas.

**14.5 · Los cinco puertos (interfaces inyectables de `core`).**
`SpecRepository` (OpenSpec) · `AgentRuntime` (Claude Agent SDK) · `DesignSurface` (Figma MCP) ·
`TokenSource` (DTCG en ficheros) · `RunSink` (artefactos de ejecución).
*Efecto de calidad:* el núcleo se puede testear entero sin red, sin Figma y sin modelos.
*Cada puerto tiene dos implementaciones: la real y un doble de pruebas.*
**Dos razones de primer orden, no una** (rectificado el 09-sep, 2ª vez): la **modularidad** es la
razón de producto —soportar otro coding agent u otro formato de SDD está en el alcance declarado,
§2d y §8— y la **testabilidad** es la razón de ingeniería. Ordenarlas como "testabilidad primero,
portabilidad como efecto colateral" era un error: contradecía §8, donde el adaptador de OpenSpec se
decidió explícitamente para poder soportar spec-kit mañana.
*Déficit asumido:* un solo adaptador **real** por puerto → la abstracción **no está probada**; un
puerto con un único implementador tiende a adoptar su forma.

**14.6 · El golden loop se nombra correctamente: bucle *generate-and-test* con verificador
determinista externo al modelo.**
Es la tesis y el diferencial frente al estado del arte (Tidy, FigmaLint **puntúan con IA** desde el
lado de Figma; aquí **falla un test** sobre el código).
*Comportamiento al agotar el tope:* se detiene, escribe el artefacto de ejecución con el último
informe y devuelve el control con el componente a medio corregir.
⚠️ *La no convergencia NO se lista como sacrificio* (decidido 09-sep): es inherente a cualquier
bucle generate-and-test con generador estocástico, no consecuencia de esta arquitectura. Listar
limitaciones heredadas del estado del arte como si fueran propias es relleno.

**14.7 · Supuesto de stack (pendiente de confirmación): TypeScript sobre Node** para los cuatro
paquetes. Implícito en el ecosistema ya elegido (React, headless, Style Dictionary, Storybook,
distribución por npm), pero **no se había decidido formalmente**. Escrito así en 2.2.

**14.8 · Disciplina de la API del componente y escotillas de escape ✅ (09-sep-2026).**
⚠️ *Rectificado.* La primera versión listaba "valores que entran por props" como punto ciego del
motor. **No lo es: es una regla que el motor debe comprobar.** Un componente del DS expone `variant`
y `size`, no un `color` libre. Y las escotillas (`className`, `style`, props de paso) **no se
prohíben** —un DS las necesita y usarlas es legítimo—: se **detectan y se marcan como excepción
explícita**, y el panel muestra cuántas acumula cada componente. Excepción contada = gobernanza;
excepción invisible = principio del drift. *(Razonamiento aportado por Joseba.)*

**14.8bis · Nota de implementación para la Entrega 2 (no es un sacrificio declarado).** Lo que sí
queda fuera del alcance de un recorrido de AST de un solo fichero: (a) un valor definido en otro
módulo e importado (`import { BRAND_RED } from '../constants'`), (b) nombres de clase compuestos en
ejecución (`` `text-[${n}px]` ``), (c) estilos que trae un componente de terceros renderizado
dentro. Se decidió **no listarlo como déficit** en 2.1 —el caso (a) es resoluble siguiendo los
imports— pero hay que tenerlo presente al implementar el motor: o se resuelven los imports, o se
asume el hueco conscientemente.

**14.9 · Deuda declarada al renunciar a la capa de dominio (09-sep-2026).** La lógica de negocio
vive repartida entre el runner y las reglas. Es lo correcto al tamaño actual, pero si el dominio
engorda —versionado de foundations, negociación entre agentes, reglas con estado— habrá que
refactorizar. Escrito como sacrificio nº 6 en 2.1.

**14.10 · Coste asumido: no hay patrón uniforme (09-sep-2026).** Cada paquete usa el suyo
(inyección en `core`, motor de reglas en `validator`, capas en `panel`). Adecuado a cada problema,
pero obliga a aprender tres modelos mentales. Escrito como sacrificio nº 7 en 2.1.

---

## 15. Decisiones de stack (paquete a paquete)

**15.1 · `@sutegi/cli` → Commander.js 15** ✅ (09-sep-2026).
*Datos del día de la decisión:* 28,4k ⭐ · 451M descargas/semana · v15.0.0 publicada el 29-may-2026 ·
sin dependencias en runtime.
*Alternativas evaluadas:* yargs (11,5k ⭐), oclif (9,6k), cac (3,1k), meow (3,7k), gluegun (3,1k),
clipanion (1,3k, **en RC desde sep-2024**), citty (1,3k, **pre-1.0**), Stricli (1,1k), sade (dormido
desde 2022), cmd-ts (nicho).
*Por qué:* (a) se descartan los frameworks completos (oclif, gluegun) porque su valor diferencial
—sistema de plugins y distribución con auto-actualización— no aplica: los workflows no son
extensibles (§14.2) y la distribución es un paquete npm; (b) frente a clipanion/Stricli, que tipan
mejor los comandos, pesó la **experiencia previa de Joseba con Commander**: con un solo
desarrollador y fecha cerrada, la familiaridad reduce riesgo y la ventaja rival era marginal.
⚠️ *Ojo al leer descargas de npm:* miden presencia en `node_modules` (dependencia transitiva), no
elección deliberada. Las estrellas son mejor proxy de adopción consciente.
📌 *Cabo suelto conocido:* el tipado de `opts()` en Commander es flojo. Mitigación prevista: parsear
y validar la entrada del CLI en un objeto tipado en la frontera antes de llamar a `core` — coherente
con "el CLI no tiene lógica de negocio".

**15.2 · CLI NO interactivo** ✅ (09-sep-2026). Sin prompts: toda la entrada por argumentos, con
valores por defecto razonables (sin asistente, los defaults importan más).
*Razón principal — no es simplicidad, es propósito:* un CLI interactivo **no corre en un pipeline**,
y para un producto de gobernanza la CI es donde la gobernanza se ejerce (`sutegi validate` en un
hook o en una acción). *Efecto secundario:* testear el CLI = ejecutarlo y mirar salida y exit code,
sin simular un pseudo-terminal.
*Descartadas:* @clack/prompts (8,0k ⭐), @inquirer/prompts (21,6k ⭐), ink (39,2k ⭐).

**15.3 · Salida del CLI: traza de texto plano + `--json`** ✅ (09-sep-2026).
`core` emite eventos de progreso; el CLI los imprime como líneas planas según llegan (subflujo,
iteración, hallazgos restantes). Sin biblioteca interactiva, sobrevive a redirección y a CI.
Con `--json` emite el mismo artefacto que se escribe en `.sutegi/runs/` — coste casi nulo, el
artefacto ya existe por §14.1.
💡 **Reutilización en 1.3:** sin pantallas, esa traza **es** la UX del producto. Una transcripción de
terminal del golden loop es el material de la sección 1.3, junto al diagrama de secuencia de 2.1.

**15.4 · Node 24 LTS como mínimo** ✅ (09-sep-2026). Es un **requisito público del producto**, igual
que Figma Professional con asiento Dev. Se gana soporte nativo de TypeScript y APIs recientes (menos
herramienta de build); se asume que excluye a quien no haya migrado — barrera acumulada sobre la de
Figma, a vigilar en 1.4.

**15.5 · `@sutegi/validator` → motor propio con parser de terceros** ✅ (09-sep-2026).
*Pregunta de partida de Joseba: "¿un plugin de ESLint?".* Se descarta como forma principal por tres
motivos: (a) el informe **alimenta el bucle de control** y debe ser un objeto estructurado propio,
no una derivación de la salida de un linter; (b) ESLint razona fichero a fichero y aquí la unidad es
el **componente contra unas foundations**; (c) el validador es la pieza que debe llevar el peso
técnico del eje 2, y como plugin ese peso se diluye en el framework de otro.
*Lo que SÍ se reutiliza:* el recorrido del AST — escribir un parser contradiría el principio de no
reinventar (§2.2 "qué NO construye Sutegi").
*Las tres capas de código propio:* (1) resolución DTCG con alias encadenados, temas y modos;
(2) índice de valores legales por propiedad; (3) evaluación de reglas + aritmética de color para
contraste (Oklch / Display P3 de la 2025.10).
*Roadmap declarado:* plugin de ESLint que envuelva las mismas reglas → subrayado en editor. Barato
una vez las reglas son funciones puras.
⚠️ *Corrección de una contradicción en 2.2:* decía a la vez que el validador "resuelve los alias" y
que "recibe los tokens ya resueltos". Correcto: **`core` lee del disco, el `validator` resuelve el
contenido**. E/S fuera, lógica dentro.
📌 *Pendiente:* elegir el parser de AST y la librería de color.
