# CLAUDE.md — Contexto y reglas de trabajo
## Proyecto Final · Máster AI4Devs (LIDR) · Joseba Alonso

**Proyecto:** 🔥 **Sutegi Design System** (*sutegi* = fragua en euskera) · **Iniciales: JA**
**Repo:** github.com/7daysofrain/AI4Devs-finalproject · **Rama actual:** `feature/entrega-1-JA`

Este fichero es la memoria viva del proyecto. Cualquier sesión de Claude (Cowork o
Claude Code) debe leerlo antes de trabajar y respetarlo.

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
| 1 | Documentación técnica | 100% doc, sin código. Un `readme.md` con 8 secciones (ver abajo) | **25 sep 2026** | Automatizada |
| 2 | Código funcional | Scaffolds front+back+BD conectados; flujo principal casi completo; primeras funcionalidades | **23 oct 2026** | Automatizada |
| 3 | Entrega final | E1+E2 unidas; **3-5 funcionalidades completas**; suite de tests (unit + integración + **≥1 E2E del flujo principal**); evidencia de despliegue (URL pública/screenshots/vídeo); **`prompts.md` completo** | **11 nov 2026** | **Feedback humano** |

Prórroga posible hasta **25 nov** (pedir al TA con antelación).

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

**Mecánica:** fork de `github.com/LIDR-academy/AI4Devs-finalproject`; rama por entrega con
iniciales (`feature/entrega-1-JA`, `feature/entrega-2-JA`, `final-project-JA`); formulario
Typeform tras cada entrega (pide nombre, email, tipo de entrega y URL del PR; sin
formulario la entrega "no existe"). Repo puede ser privado dando acceso al TA, o entregar
README + vídeo 2-3 min si es confidencial. `README.md` y `prompts.md` obligatorios siempre.

---

## 4bis. Reparto de herramientas (decidido 08-sep-2026)

- **Cowork (aquí):** ideación, investigación (Drive + web), decisiones, revisión crítica y
  **redacción de los documentos**. Escribe y edita ficheros en la carpeta sin problema.
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

## 8. Decisiones abiertas / puntos grises a resolver

- [ ] **Idea de proyecto**: en ideación. Joseba tiene un par de propuestas a evaluar
      críticamente contra los 3 ejes (§3) y el alcance de 3-5 historias must-have.
- [x] **Alcance: "completo, no extenso".** Flujo cerrado de punta a punta > abarcar mucho.
      Horas flexibles.
- [ ] **Stack**: por decidir (libre). Ejemplos del máster: AdonisJS+React, PHP+React,
      Python(FastAPI)+React.
- [ ] **Encaje del eje "uso de IA"**: elegir idea/enfoque que permita lucir SDD/OpenSpec,
      subagentes y skills, y valorar si la IA forma parte del propio producto (tipo RAG).

*(Última actualización: 6 ago 2026)*
