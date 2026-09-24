# AGENTS.md — Contexto y reglas de trabajo
## Proyecto Final · Máster AI4Devs (LIDR) · Joseba Alonso

**Proyecto:** ✅ **🎛️ Mood Table** (instrumento de luz para la mesa de DJ) — luz verde del mentor el 22-sep-2026 · *(plan B Pura Belia archivado)* · **Iniciales: JA**
*(Idea anterior, Sutegi Design System, descartada el 09-sep; ver `docs/POSTMORTEM-sutegi.md`.)*
**Repo:** github.com/7daysofrain/mood-table-v2 *(propio, no fork; historial conservado — ficha D32)* · **Rama actual:** `feature/entrega-1-JA`

Este fichero es la memoria viva del proyecto. Cualquier sesión de Claude (Cowork o
Claude Code) debe leerlo antes de trabajar y respetarlo.

### 📚 Índice de instrucciones (`docs/instructions/`)

Léelas **cuando toque**, no todas al empezar. Si una tarea encaja en la columna "Cuándo", lee el fichero antes de actuar.

| Fichero | Qué contiene | Cuándo consultarlo |
|---|---|---|
| [`workflow.md`](docs/instructions/workflow.md) | La cadena PRD → Épica → Historia → Tarea → OpenSpec → PR, la granularidad (tarea → PR, paso → commit), la fuente de verdad de cada cosa y la vida de una historia | Antes de crear o tocar épicas, historias, tareas o specs, y antes de abrir una PR |
| [`linear.md`](docs/instructions/linear.md) | Convenciones de Linear: proyecto único *Mood Table*, épica = issue padre, estados, etiquetas, estimación, plantilla de historia, enlace con GitHub | Antes de crear o editar cualquier cosa en Linear |

Referencias de producto: [`docs/PRD.md`](docs/PRD.md) (fuente de verdad; glosario en §8) · [`docs/idea-mood-table.md`](docs/idea-mood-table.md) (decisiones D1-D35).

---

## 1. Cómo trabajar conmigo (las 4 bases — innegociables)

1. **Producto casi de producción, no una PoC.** Un producto del que Joseba pueda estar
   orgulloso y mostrar en redes. Prioridad: **completo antes que extenso** (flujo cerrado
   y excelente > abarcar mucho). Las ~30 h estimadas por LIDR son orientativas; se pueden
   superar por calidad (muchos alumnos dedican 90-120 h).

2. **Ir a por la nota.** Foco en los criterios de LIDR (ver §3). Pedir validación de
   enfoque cuando haga falta y verificar que se cumplen TODOS los criterios de cada
   entrega antes de darla por buena.

3. **Objetivo didáctico por encima de la velocidad.** Joseba es parte activa de la
   ideación, creación y enfoque. Claude **propone** pero **no toma la iniciativa sin
   consultar antes**. Explicar siempre el *porqué*: el fin es aprender, no solo tener un
   proyecto de 10.

4. **Espíritu crítico.** No dar la razón por defecto. Si una decisión tiene puntos grises
   o riesgos, **parar y avisar**, razonando el porqué y ofreciendo alternativas.

---

## 2. Qué construir (MVP) y alcance

- Un **MVP robusto** de tema libre, con IA integrada en TODAS las fases (idea → doc →
  código → tests → despliegue).
- **No** es una pantalla con un botón: al menos **un flujo end-to-end completo** con
  backend + frontend + base de datos (o su equivalente según perfil/stack).
- Alcance recomendado: **3-5 historias de usuario *must-have*** + **1-2 *should-have***.
  No meter todo lo aprendido de golpe.
- Frontend **no** obligatorio: valen CLI, pipeline, sistema sin UI o hardware, siempre
  que se pueda **verificar que funciona** (para hardware/sin-UI: vídeo de 2-3 min).
- Se puede arrancar de cero (recomendado; mejor arquitectura desde el inicio) o partir de
  un proyecto propio. Migración de legacy: consultar antes con el TA.

---

## 3. Criterios de evaluación — LOS 3 EJES (esto es "la nota")

1. **Idea y arquitectura del producto.**
2. **Calidad del código.**
3. **Cómo se usó la IA a lo largo del proceso** (ver §6). No es un extra: es un tercio
   de la evaluación.

Implicación: la idea elegida debe dar juego en los tres ejes a la vez. Un dominio que
luzca en producto pero no deje mostrar buen uso de IA (o al revés) está desequilibrado.

---

## 4. Las 3 entregas

| # | Entrega | Contenido | Fecha | Revisión |
|---|---------|-----------|-------|----------|
| 1 | Documentación técnica | 100% doc, sin código. Según el doc 99.2: ficha, descripción, arquitectura, modelo de datos, **historias de usuario y tickets de trabajo** (la API no se nombra) | **25 sep 2026** | Automatizada |
| 2 | Código funcional | Scaffolds front+back+BD conectados; flujo principal casi completo; primeras funcionalidades | **23 oct 2026** | Automatizada |
| 3 | Entrega final | E1+E2 unidas; **3-5 funcionalidades completas**; suite de tests (unit + integración + **≥1 E2E del flujo principal**); **despliegue obligatorio** (sin él no hay feedback) + evidencia de funcionamiento; **`prompts.md` completo** | **11 nov 2026** | **Feedback humano** |

Prórroga posible hasta **25 nov** (pedir al TA con antelación). *(El doc 99.2 no la menciona; no reconfirmada.)*

**Estructura REAL de la plantilla oficial** (verificado 08-sep-2026 en el repo):
un solo **`readme.md` con 8 secciones** + **`prompts.md`**:
1. Ficha del proyecto · 2. Descripción general del producto · 3. Arquitectura del sistema ·
4. Modelo de datos (diagrama ER) · 5. Especificación de la API (**formato OpenAPI**) ·
6. Historias de usuario (**3 principales**) · 7. Tickets de trabajo (**3: backend, frontend,
BD**) · 8. Pull requests (**3**, para la entrega final).

⚠️ Los "7 documentos numerados" son la organización propia del *Ejemplo 1*, **NO** un
requisito de la plantilla. (Corrección de un error previo.)

**Implicaciones:** las 5 historias must-have del MVP siguen siendo el backlog, pero en el
README se destacan **3**; los 3 tickets deben cubrir back/front/BD (el panel de control lo
permite); la API del panel se documenta en **OpenAPI** → el panel no es decorativo.

**Mecánica (act. 23-sep, fuente: doc Drive "99.2 - Sesión de acompañamiento — Proyecto Final" +
vídeo de la sesión):**
- **Repo propio, no fork.** `LIDR-academy/AI4Devs-finalproject` ya no se usa para trabajar ni para PR:
  solo es plantilla para copiar `readme.md`/`prompts.md`. → Joseba creará un **repo nuevo** y se moverá
  todo allí (en otra sesión).
- **Rama por entrega** con iniciales (`feature/entrega-1-JA`, `feature/entrega-2-JA`, `final-project-JA`).
- **Typeform** (`lidr.typeform.com/proyectoai4devs`) tras cada entrega (1, 2 y final): se envía **solo
  el link de la rama** en formato `…/tree/nombre-de-la-rama` (**no** el del PR). Sin formulario la
  entrega "no existe".
- **Repo privado → invitar a la cuenta `LIDR-AI4Devs`.** (El nuestro será público.)
- **`readme.md` debe incluir cómo probar el MVP y las credenciales** para loguearse. Mood Table no
  tiene login → decirlo expresamente (README §1.4).
- **Sin despliegue no hay feedback** en la entrega final: no basta el código fuente.
- **Vídeo como sustituto del acceso → sin feedback.** El vídeo de la mesa (hardware) **complementa**
  la demo desplegada; no la sustituye.
- `README.md` y `prompts.md` obligatorios siempre.

**Cambio de impacto (23-sep):** el doc 99.2 sitúa **historias de usuario y tickets en la E1**. Resuelve
la duda enviada a LIDR sobre README §5/§6 (ver §8 y §8bis). La **§4 (API)** no aparece en la lista de
la E1: sigue en espera. No aparecen en el doc (ni confirmado ni anulado): revisión automatizada,
prórroga, 8 secciones exactas del readme.

**Consejos del vídeo (min. 42):** iterar el **PRD** hasta que cubra todo (lo que falte aparecerá en el
desarrollo); **priorizar el backlog** que genere la IA ("vámonos por esas funcionalidades") en vez de
aceptar uno lineal; de ahí los tickets; pensar **qué agentes necesita el flujo** (sistema multiagente,
hooks, elección de modelo por tarea).

---

## 4bis. Reparto de herramientas (decidido 08-sep-2026)

- **Cowork (aquí):** ideación, investigación (Drive + web), decisiones, revisión crítica y
  **redacción de los documentos**. Escribe y edita ficheros en la carpeta sin problema.
- **Borradores:** se escriben en `docs/borradores/` (ignorada en `.gitignore`); al validarse, pasan al `readme.md`.
- **Claude Code / terminal:** todo lo que toca el repo **como repo** — ramas, commits, PRs,
  ejecutar código y tests, comandos de OpenSpec. Y las Entregas 2 y 3 completas.
- ⚠️ **git NO es fiable desde Cowork**: el puente no permite borrar ficheros, así que un
  `git add`/`commit` puede dejar un `.git/index.lock` huérfano que hay que borrar a mano
  (`rm .git/index.lock`). **Haz git desde tu terminal o Claude Code.**
- 💡 Usar ambas herramientas es **material para `prompts.md`** (LIDR pide "qué modelos y para
  qué fase"): Opus/Cowork para specs y decisiones, Claude Code para implementación.

## 5. Metodología del máster a respetar (alinearse = parte de la nota)

- **Spec-Driven Development (SDD) con OpenSpec.** La spec es el contrato: `propose →
  apply → archive`. Delta sobre spec viva. Escenarios BDD (GIVEN/WHEN/THEN).
- **Pasarela PRD → Backlog → Spec → Código.** PRD en `docs/PRD.md`; backlog con criterios
  de aceptación en Given/When/Then; OpenSpec para el "cómo"; PR mergeable.
- **IA como *peer*, no oráculo:** "poke-holes" en refinamiento, estimación planning-poker,
  hooks que validan criterios de aceptación.
- **Calidad como diferencial:** documentación exhaustiva, tests, despliegue real.

---

## 6. Registro de uso de IA (evolución de `prompts.md`) — eje de evaluación

Documentar el **flujo de trabajo con IA**, no solo prompts sueltos:
- Herramientas usadas (Claude, Cursor, ChatGPT…).
- Qué modelos y para qué fase (ej.: Opus para especificaciones, Sonnet para codeo).
- Si se usaron skills, subagentes, rules o comandos personalizados.
- Los prompts/workflows más importantes.
- Qué ajustes humanos hubo que hacer sobre el output de la IA.

**Regla (23-sep): al cerrar cada sección del readme, se registra en `prompts.md`.** Formato de la
plantilla: **máx.** 3 prompts por sección (solo los que aporten; si es uno, es uno), **copiados literalmente** (sin corregir ni recortar) + una línea
en cursiva de contexto/resultado. §2.4 rellenada como muestra; las secciones ya cerradas (§0-§3, §2.5)
las rellena Joseba reabriendo las sesiones en las que se escribieron.

---

## 7. Material de referencia

- **Carpeta Drive "Lidr IA4Devs material"** (id `1vvKZjVi11rfGRnhLk5UHTPJZAEutXm-q`):
  material de clase.
- **Subcarpeta "99 - Proyecto FINAL Master AI4Devs"** (id `1SkNcXl8at7C-vrSevfnklid_k9q48PpP`):
  doc de Fase 1 (47 min), Lección 1 (29 min) y doc de ejemplos reales (12 min).
- **Plantilla oficial:** `github.com/LIDR-academy/AI4Devs-finalproject`.
- **Repos de ejemplo (vara de calidad):**
  - Ejemplo 1 — reservas de campings. PHP 8 (Slim) + React 18 + TS. Mock-first,
    Repository Pattern, 7 docs numerados, PHPUnit >85% / Vitest >78%.
  - Ejemplo 2 — chatbot RAG (portfolio + captura de leads). Python (FastAPI) + React +
    Gemini + pgvector + GCP. Optimización de costes LLM, GDPR, CI/CD.

---

## 7bis. Estado de la idea (22-sep-2026)

✅ **Elegida: Mood Table** (sin "v2" en el nombre; D16). El mentor validó el 22-sep las 4 preguntas de §8 (respuestas en la ficha §9 y D15). Decisiones de la sesión de redacción del README (22-sep): D15-D29 en la ficha §10. Reescritura, con método y agentes, del proyecto personal
*Mood Table* (mesa de DJ con LEDs reactivos a la música; repo `7daysofrain/mood-table`, 2021-2024).
**Ficha completa y registro de decisiones en `docs/idea-mood-table.md`** — leerla antes de trabajar.

Resumen (act. 22-sep): **motor de luces propio en TypeScript, sin navegador**, que pinta **N tiras**
(cada una con su efecto; MVP con una tira física —la del Light Box— + la virtual). Fuentes de audio
(tarjeta / fichero) y salidas de luz (Adalight-serie, WebSocket → tira virtual, firmware propio como
should-have) como puertos; **sin Hyperion ni GPIO**. Efectos = código con esquema declarado y
`usesAudio` (reactivo o ambiente, misma interfaz); el motor funciona sin audio. Panel web que genera
sus controles. **Tiras declaradas en fichero de configuración; SQLite solo para el estado** (efecto
activo y valores por tira). **5 must-have:** probar en el simulador · tocar parámetros en vivo ·
pintar la tira física · declarar mis tiras · arrancar en el último estado. **2 should-have:** tira de
ambiente (segunda tira física, no una capa mezclada) · firmware propio (ESP8266/ESP32). **Sin
escenas/presets** (es un instrumento de *performance*). **Sin IA en el producto**: el eje 3 se cubre con el proceso (specs OpenSpec como
contrato, tests y simulador como puertas; se declara que el firmware C++ es una pieza que Joseba no
puede evaluar y se valida desde fuera).

Pasa los filtros del post-mortem: hay un sistema real sin la IA, y hay código sustancioso que no
es bucle agéntico (DSP, motor de frames, protocolo, mezcla, estado).

🎟️ **Plan B: Pura Belia · Zona de clientes** (ficha `docs/idea-pura-belia.md`, scorecard 32/40).
Panel de cliente propio para la empresa de Joseba (plugins de audio; web Astro estática en
`~/Proyectos/pura-belia/static/pura-belia-web`, hoy "Mi cuenta" redirige a Lemon Squeezy).
Ownership de la identidad pasa a Pura Belia; LS queda como tercero detrás de un puerto (motivo:
migración LS → Stripe prevista). **5 must-have:** alta automática por webhook (+ backfill) ·
acceso a la cuenta · licencias y dispositivos (liberar/renombrar) · preferencias de email (Brevo)
· datos y baja RGPD. **1 should-have:** descargas por licencia. Fuera: servidor de licencias
propio (las activaciones siguen en LS; contrato del plugin congelado). Más convencional y de
riesgo técnico bajo; no es trabajo perdido: se hará igualmente en algún momento.

---

## 8. Decisiones abiertas / puntos grises a resolver

- [x] **Idea de proyecto**: ✅ **Mood Table** (22-sep). El mentor respondió a las 4 preguntas:
      (1) JSON/SQLite vale como "BD o equivalente" si README y ticket documentan **modelo, puerto y
      cómo probar la persistencia** (SQLite deja el ticket más "clásico"); (2) vídeo 2-3 min + URL
      con tira virtual es suficiente si el README dice **cómo reproducir la demo web** y el vídeo
      muestra el **E2E en la mesa**; (3) IA en producto y/o proceso, sin problema; (4) no preocupa el
      peso del motor si **front + persistencia + motor cierran un circuito operable** (MVP
      demostrable, no checklist CRUD). Ficha §9 y D15.
- [x] **Alcance**: ✅ cerrado (5 must-have + 2 should-have; lista explícita de exclusiones en la
      ficha §11). "Completo, no extenso".
- [x] **Lenguaje del motor**: ✅ TypeScript/Node, **condicionado al spike de rendimiento en la
      Pi 3 B+** (ficha D8/D13). Si el spike falla, reabrir.
- [ ] **Spike de rendimiento** en la Pi 3 B+ (ms/frame a 200/300/600 LEDs) — primera tarea técnica,
      antes de cerrar la spec del motor. Resultado → ficha §10 y `prompts.md`.
- [ ] **Número de LEDs del MVP** (≤ 200-300 por Adalight a 115.200 baudios): fijar tras el spike y
      la prueba con el Light Box.
- [x] **Stack y arquitectura** ✅ (22-sep, README §2.1): hexagonal ligera (4 puertos: AudioSource,
      LightOutput, Commands, StateStore) con montaje manual en `main.ts`, **sin contenedor de DI**; dos
      planos (tiempo real / control con búfer leído al inicio de cada frame); un solo proceso Node.
      Front React + Vite + TS servido por el motor; API **Fastify + TypeBox** (OpenAPI desde esquemas;
      AdonisJS descartado: framework en el centro vs librería en el borde); HTTP para comandos/config,
      WebSocket motor → navegador para frames y estado (fallback: `setParam` por WS si hay latencia).
- [ ] **Renombrar `CLAUDE.md` → `AGENTS.md`** (Joseba, desde terminal con `git mv`) y crear un
      `CLAUDE.md` mínimo que lo importe (`@AGENTS.md`). Comprometido en README §2.3 (22-sep).
      **Aplazado (23-sep): se hace al pasar a Claude Code.** Riesgo: comprobar que Cowork resuelve `@AGENTS.md`
      (si no, pedir en el prompt que lea `AGENTS.md`). En la E2, separar instrucciones de código y plan del curso.
- [x] **Seguridad (README §2.5)** ✅ (23-sep): por contexto (mesa sin auth por decisión; demo pública
      con estado en memoria, rate limit, máx. WS, HTTPS); TypeBox, helmet, sin CORS; **SonarQube Cloud
      (quality gate en PR) + Dependabot** (Sonar gratis no hace SCA; Snyk descartado).
- [x] **Persistencia** ✅ SQLite solo para estado (`strip_state`, `strip_effects`); tiras en fichero de configuración (22-sep, README §3, ficha D25/D29).
- [ ] **README §5 (historias) y §6 (tickets) van en la E1** (doc 99.2, 23-sep). Siguen sin redactarse en
      Cowork: salen de **PRD → backlog priorizado → 3 historias + 3 tickets (back/front/BD)** en Claude
      Code + OpenSpec, **en el repo nuevo**. PRD ✅ (v1.0, 23-sep). §4 (API) no va en la E1 (confirmado por LIDR).
- [x] **Repo nuevo** ✅ (23-sep): `7daysofrain/mood-table-v2`, público, historial conservado, remoto del fork
      eliminado. Ideas descartadas fuera del árbol (en local: `docs/borradores/descartadas/`); `PLAN-entregables.md`
      borrado. Ficha D32. Pendiente opcional: archivar el fork antiguo en GitHub.
- [x] **Herramienta de gestión** ✅ Linear (23-sep, D35): proyecto único, épicas = issues padre, `docs/instructions/linear.md`.
      Pendiente: **invitar al evaluador** al workspace en la entrega.
- [ ] **`HARDWARE_SETUP.md`** (raíz): montaje de la tira, alimentación, Light Box/Arduino Adalight, tarjeta de
      sonido. Prometido en README §1.4 (D31). Revisión cuidadosa de Joseba (errores de cableado = hardware quemado).
- [x] **URL de clonado** ✅ en README §0.5, §1.4 y árbol de §2.3 (23-sep).
- [ ] **Instrucciones del Proyecto de claude.ai** (Joseba, en claude.ai): aún dicen "7 docs numerados";
      corregir a "readme.md con 8 secciones + prompts.md".
- [ ] **Actualizar `docs/PLAN-entregables.md`**: vaciar estado de secciones (era de Sutegi) y
      adaptar el guion a Mood Table (modelo de datos simple, API del panel, tickets back/front/BD).
- [ ] **`readme.md`** (Entrega 1, 25-sep): ✅ §0, §1.1, §1.2, §2.1, §2.2, §2.3, §2.5, §3 escritas (22-23 sep); §2 de Sutegi
      borrada, estructura de la plantilla original. Siguiente: ver §8bis y cierre (`prompts.md`, verificación contra plantilla).

## 8bis. Plan de las próximas sesiones (act. 23-sep, tarde)

✅ **Sesión del 23-sep (mañana), cerrada:** §4 de este fichero actualizada con el doc 99.2 de LIDR; README
§1.3 (+ wireframe en Claude Design → `docs/img/panel-wireframe.png`), §1.4, §2.4, §2.6 escritas; §1.2 con
códigos H1-H5; §2.5 ajustada (HTTPS con Caddy); decisiones D30-D31 en la ficha; `prompts.md` con formato
acordado (§6 de este fichero) y §1.3, §1.4, §2.4, §2.6 registradas.

**Orden acordado:** el **PRD va antes que la herramienta de gestión** (el setup de la herramienta —épicas,
etiquetas, qué es feature/task— sale del PRD; hacerlo antes es configurar a ciegas). Así lo recomendaba
también el vídeo de LIDR: iterar el PRD → priorizar backlog → tickets.

### Sesión 1 — 23-sep (tarde-noche) · hecha en Cowork (+ terminal de Joseba para git)

**Resultado (act. 23-sep, noche):**
- ✅ **Repo nuevo** `7daysofrain/mood-table-v2` (D32). `AGENTS.md` aplazado a Claude Code.
- ✅ **PRD v1.0** en `docs/PRD.md` (D33, D34): PRD = qué y por qué (sin RF ni GIVEN/WHEN/THEN, que van al backlog y
  OpenSpec); §1 problema + **alternativas (LedFx)**, §2 usuarios (DJ, maker), §3 expectativas **E1-E9**, §4 historias
  H1-H5 + S1-S2 (Como/Quiero/Para), §5 alcance (MVP · should · visión · **fuera por decisión**), §6 supuestos A1-A3 y
  restricciones, §7 preguntas abiertas **Q1-Q6**, §8 glosario. Regla: **el PRD manda**; lo que exige la entrega
  (demo pública) va al README.
- ✅ README alineado con el PRD (visor ≠ tira virtual, respiración, H2 con cambio de efecto, visión/fuera por decisión,
  alternativas en §1.1, `createMemory`). Pendiente: el wireframe aún rotula "Tira virtual".
- ✅ `prompts.md` §5.0 (PRD) con 3 prompts; candidatos descartados en `docs/borradores/prd-prompts-candidatos.md`.
- Umbrales técnicos para la spec del motor (100 ms / 45 ms ITU…) en `docs/borradores/umbrales-para-specs.md`.
- ✅ **Herramienta: Linear** (D35). Workspace `7daysofrain`, equipo *Mood Table*, clave **`MOO`**. **Un solo proyecto
  *Mood Table***; **7 épicas como issues padre** (`MOO-5`…`MOO-11` = H1-H5 *High*, S1-S2 *Low*), en Backlog y sin
  estimar. Estados Backlog → Todo → **Spec** → In Progress → In Review → Done; *parent auto-close*; Fibonacci; sin
  cycles; etiquetas **Tipo** (Feature, Bug, Refactor, Spike, Chore) y **áreas sueltas** (engine, panel, shared, db,
  infra, firmware); GitHub conectado, automatizaciones de PR y *linkbacks* públicos con descripción.
- ✅ **`docs/instructions/`** (`workflow.md`, `linear.md`) + **índice en este fichero**. Granularidad: **tarea de
  Linear = PR; paso de `tasks.md` = commit**. `prompts.md` §6.0 con 3 prompts.
- ⚠️ **Nada de hoy está commiteado**: Joseba hace commit + push desde terminal (los enlaces de Linear al PRD apuntan
  a la rama `feature/entrega-1-JA` y funcionarán tras el push).

**Plan original de la sesión:**


1. **Repo nuevo (propio, no fork)** y mover todo. Decidir en la sesión:
   - **¿Conservar el historial de git?** (recomendable: los commits son evidencia del proceso) o empezar limpio.
   - **Qué se mueve:** `readme.md`, `prompts.md`, `CLAUDE.md` (→ `AGENTS.md` + `CLAUDE.md` con `@AGENTS.md`),
     `.gitignore`, `docs/idea-mood-table.md`, `docs/img/`. Decidir qué hacer con lo de ideas descartadas
     (`POSTMORTEM-sutegi.md`, `idea-design-system-agentico.md`, `idea-pura-belia.md`, `PLANTILLA-idea.md`):
     ¿archivar en `docs/archivo/` (evidencia del proceso de ideación) o dejar fuera? `docs/PLAN-entregables.md`
     (obsoleto) **no se mueve**. `docs/borradores/` sigue ignorada.
   - Rama `feature/entrega-1-JA`; actualizar la URL del repo en README §0.5 y §1.4 y en la cabecera de este fichero.
   - Si el repo es privado: invitar a `LIDR-AI4Devs` (previsto: público).
2. **PRD** (`docs/PRD.md`), iterado hasta que cubra todo, a partir de README §1-§3 y la ficha. **No quedarse en
   la primera iteración.** Revisar vocabulario (nombres de tiras, efectos, parámetros) para que no aparezcan
   luego palabras que no debían en el desarrollo.
3. **Elegir la herramienta de gestión** de historias/features/tasks y hacer su setup. Criterios a valorar:
   - **GitHub Issues + Projects:** historias, PRs (§7) y specs en el mismo sitio; Claude Code lo maneja con `gh`.
   - **Linear:** más cómodo, con MCP, pero otra pieza que sincronizar con OpenSpec.
   - **Jira:** probablemente excesivo para un proyecto de una persona.
   - **Riesgo común: duplicar información** (PRD, herramienta y spec OpenSpec). Decidir qué es la **fuente de
     verdad** de cada cosa (p. ej.: PRD = qué y por qué; herramienta = backlog y estado; OpenSpec = contrato de
     cada cambio).

### Sesión 2 — 24-sep · Claude Code (+ Cowork para revisión)

**Primer paso (acordado 23-sep): crear la skill "crear historia"** en `.claude/` a partir de la plantilla de
`docs/instructions/linear.md` §5 (Como/Quiero/Para, AC GWT con caso feliz de Joseba + *poke-holes*, non-goals, DoD,
contexto técnico al final). Con ella se generan las historias en Linear (sub-issues de las épicas) y de ahí §5/§6.
Antes: renombrar `CLAUDE.md` → `AGENTS.md` + `CLAUDE.md` con `@AGENTS.md` (aplazado a Claude Code) y conectar el
MCP de Linear en Claude Code (permisos iniciales leer + crear).


0. **Formato de §5/§6 según los ejemplos de LIDR** (revisados el 23-sep; la TA los recomienda "para estructurar"):
   - **Ejemplo 1** (`AI4Devs-finalproject-Example1`): el README solo lista los 3 títulos y **enlaza** a
     `5-historias-de-usuario.md` / `6-tickets-de-trabajo.md`.
     - **Historia:** `HU001: título` · **Como / Quiero / Para** · Criterios de aceptación (lista) · Prioridad ·
       Estimación (puntos) · Justificación.
     - **Ticket:** Información general (ID, Tipo back/front/BD, Historia relacionada, Prioridad, Estimación,
       Sprint, Asignado, Estado) · Descripción · Objetivos · Requisitos técnicos · Tareas de desarrollo (con
       puntos y checkbox) · Criterios de aceptación · Dependencias · Riesgos y mitigaciones · Tests.
   - **Ejemplo 2** (`AI4Devs-finalproject-Example2`, `README.md`): historias con Como/Quiero/Para, criterios
     de aceptación, **escenarios de uso** y **métricas de éxito**; tickets con metadatos (tipo, prioridad,
     puntos, sprint), descripción, requisitos funcionales y técnicos, criterios de aceptación y dependencias.
   - **Para Mood Table:** criterios en **Given/When/Then** (lo pide la metodología SDD del máster, §5; los
     ejemplos usan listas). Decidir en la sesión si inline en el README o resumen + enlace (como el Ejemplo 1
     y como ya estaba previsto: "el README resume y enlaza"). Los 3 tickets: **back / front / BD**.
1. **Backlog priorizado en Linear** desde el PRD: historias como sub-issues de las épicas, con la skill (no aceptar
   el backlog lineal que genere la IA: elegir "vámonos por esas funcionalidades"). Las §5/§6 del README salen de ahí:
   3 historias y 3 tareas (áreas `engine` / `panel` / `db`).
2. **README §5** (3 historias principales, Given/When/Then) y **§6** (3 tickets: backend, frontend, BD) —
   **van en la E1** (doc 99.2). Salen del flujo SDD (OpenSpec); el README los resume y enlaza.
3. **`prompts.md`:** sección 0 (flujo de trabajo con IA) y las secciones de esta sesión.
4. **Verificación final contra la plantilla** y los requisitos del doc 99.2 (cómo probar + "sin credenciales" ✅
   en §1.4; link de rama; repo accesible).
5. **Entrega:** PR/merge según convenga y **Typeform con el link de la rama** (`…/tree/feature/entrega-1-JA`).

⚠️ **Plazo:** E1 el **viernes 25-sep**. La sesión 2 va sin margen: si la sesión 1 se alarga, recortar setup de la
herramienta (se puede terminar después de la E1), nunca §5/§6.

### README §4 (API): no requerida en la E1

Confirmado por LIDR el 23-sep (mensaje de la TA: la E1 = ficha, descripción, arquitectura y modelo de datos,
historias y tickets, stack; la API no aparece, igual que en el doc 99.2). Se documenta en OpenAPI en la **E2**,
junto al código. El stack ya está en README §2.1 (tabla "Stack").

### Tareas de Joseba en terminal (antes o durante la sesión 1)

- ~~Borrar `.borrador-2.1.tmp.md`~~ ✅ (ya no existe).
- Revisar en GitHub si el repo actual figura como "forked from LIDR-academy" (informativo: se sustituye igualmente).
- Corregir en claude.ai las instrucciones del Proyecto ("7 docs numerados" → readme con 8 secciones + prompts.md).

**Estado del README (23-sep):** ✅ §0, §1.1, §1.2, §2.1, §2.2, §2.3, §1.3 (wireframe en `docs/img/`), §1.4 (D31), §2.4 (D30), §2.5, §2.6, §3 · ⏸ §4 (en espera de LIDR) · 🔜 §5, §6 (van en E1; Claude Code, otra sesión) · ⛔ §7 (entrega final). Borradores en `docs/borradores/`.
Decisiones D15-D29 en la ficha (`docs/idea-mood-table.md` §10). `docs/PLAN-entregables.md` está
**obsoleto** (era de Sutegi): no usarlo como guía.

*(Última actualización: 23 sep 2026, noche — sesión 1 cerrada: repo nuevo, PRD v1.0, README alineado, Linear montado, `docs/instructions/`. Siguiente (24-sep): skill "crear historia" → backlog en Linear → §5/§6 → prompts.md §0 → verificación y entrega)*
