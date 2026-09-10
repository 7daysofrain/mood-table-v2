# CLAUDE.md — Contexto y reglas de trabajo
## Proyecto Final · Máster AI4Devs (LIDR) · Joseba Alonso

**Proyecto:** 🟡 pendiente del mentor — **propuesta principal: 🎛️ Mood Table v2** (instrumento de luz para la mesa de DJ) · **plan B: 🎟️ Pura Belia · Zona de clientes** · **Iniciales: JA**
*(Idea anterior, Sutegi Design System, descartada el 09-sep; ver `docs/POSTMORTEM-sutegi.md`.)*
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

## 7bis. Estado de la idea (10-sep-2026)

🟡 **Propuesta principal: Mood Table v2** — es la que Joseba quiere hacer y la que llevará al mentor. Si el mentor confirma que encaja tal como está propuesta (ver las 4 preguntas de §8), se va con ella; si no, se activa el plan B. Reescritura, con método y agentes, del proyecto personal
*Mood Table* (mesa de DJ con LEDs reactivos a la música; repo `7daysofrain/mood-table`, 2021-2024).
**Ficha completa y registro de decisiones en `docs/idea-mood-table.md`** — leerla antes de trabajar.

Resumen: **motor de luces propio en TypeScript, sin navegador**, con fuentes de audio (tarjeta /
fichero) y salidas de luz (Adalight-serie → Light Box, WebSocket → tira virtual, firmware propio
como should-have) como puertos; efectos = código con esquema de parámetros declarado; panel web
que genera sus controles; persistencia = config de tira + estado del instrumento (JSON tras un
puerto). **5 must-have:** ver la música en la tira virtual · tocar parámetros en vivo · pintar la
tira física · configurar la tira · arrancar en el último estado. **2 should-have:** firmware
propio (ESP8266/ESP32) · capa de ambiente. **Sin escenas/presets** (es un instrumento de
*performance*). **Sin IA en el producto**: el eje 3 se cubre con el proceso (specs OpenSpec como
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

- [ ] **Idea de proyecto**: 🟡 Mood Table v2 como propuesta principal (ficha `docs/idea-mood-table.md`,
      36/40); Pura Belia como plan B (ficha `docs/idea-pura-belia.md`, 32/40). Decisión con el mentor.
      Preguntar por separado, no "¿califica?": (1) persistencia sin BD relacional (JSON tras puerto /
      SQLite) ¿vale para README §4 y ticket BD?; (2) evidencia de hardware = vídeo + URL pública con
      tira virtual ¿suficiente?; (3) sin IA en el producto, eje 3 solo con el proceso ¿ok?; (4) front y
      BD pesan poco frente al motor ¿problema para un evaluador que busque full-stack? Si las 4 pasan →
      Mood Table; si alguna falla → plan B.
- [x] **Alcance**: ✅ cerrado (5 must-have + 2 should-have; lista explícita de exclusiones en la
      ficha §11). "Completo, no extenso".
- [x] **Lenguaje del motor**: ✅ TypeScript/Node, **condicionado al spike de rendimiento en la
      Pi 3 B+** (ficha D8/D13). Si el spike falla, reabrir.
- [ ] **Spike de rendimiento** en la Pi 3 B+ (ms/frame a 200/300/600 LEDs) — primera tarea técnica,
      antes de cerrar la spec del motor. Resultado → ficha §10 y `prompts.md`.
- [ ] **Número de LEDs del MVP** (≤ 200-300 por Adalight a 115.200 baudios): fijar tras el spike y
      la prueba con el Light Box.
- [ ] **Stack del front** (React u otro) y del transporte (WebSocket + HTTP): decidir en la sesión
      de arquitectura (README §2).
- [ ] **Persistencia**: JSON tras puerto de inicio; ¿SQLite para blindar README §4 / ticket BD?
      Preguntar al mentor (ficha §9).
- [ ] **Actualizar `docs/PLAN-entregables.md`**: vaciar estado de secciones (era de Sutegi) y
      adaptar el guion a Mood Table (modelo de datos simple, API del panel, tickets back/front/BD).
- [ ] **`readme.md`**: las secciones 2.1-2.3 escritas para Sutegi hay que rehacerlas.

*(Última actualización: 10 sep 2026 — Mood Table v2 propuesta principal, Pura Belia plan B; decisión con el mentor)*
