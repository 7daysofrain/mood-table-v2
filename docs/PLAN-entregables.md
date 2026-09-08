# 📋 Plan de entregables — Proyecto Final AI4Devs
**Proyecto:** Sutegi Design System · **Autor:** Joseba Alonso (JA)
**Creado:** 08-sep-2026 · **Repo:** github.com/7daysofrain/AI4Devs-finalproject

---

## Cómo usar este plan

Este documento es **el hilo entre sesiones**. Cada sesión de Cowork arranca en frío, así que
antes de trabajar hay que leer, en este orden:

1. `CLAUDE.md` (raíz) — bases de trabajo, criterios de LIDR, fechas.
2. `docs/idea-design-system-agentico.md` — la idea, el MVP y todas las decisiones tomadas.
3. **Este plan** — qué está hecho, qué falta y qué decisión bloquea qué.

Al terminar una sesión: **actualizar el estado** de abajo y anotar decisiones nuevas en la
ficha de idea.

---

## 🔄 Cómo arrancar una sesión nueva

Pega esto al empezar cualquier sesión de trabajo sobre los entregables:

> Trabajo en el Proyecto Final del Máster AI4Devs. Antes de nada lee, en este orden:
> `CLAUDE.md` (raíz), `docs/idea-design-system-agentico.md` y `docs/PLAN-entregables.md`.
> Respeta las 4 bases de trabajo del `CLAUDE.md` — sobre todo: propón pero no tomes la
> iniciativa sin consultarme, explícame siempre el porqué, y sé crítico conmigo.
> Hoy vamos a trabajar en: **[SECCIÓN]**.

Al terminar: actualizar el estado de este plan y anotar decisiones nuevas en la ficha de idea.

## ⚠️ Realidad de la Entrega 1

La Entrega 1 (**25-sep**, quedan 17 días) es **100% documentación, sin código**. Pero varias
secciones de la plantilla presuponen producto construido. Hay que distinguir:

- **Se pueden completar ya:** 0, 1.1, 1.2, 2.1, 2.2, 2.3, 2.5, 3, 4, 5, 6.
- **Provisionales / planeadas:** 1.3 (mockups en vez de capturas), 1.4 (instalación
  planeada), 2.4 (infraestructura prevista), 2.6 (estrategia de tests).
- **No aplica todavía:** 7 (pull requests) → se rellena en la entrega final.

Escribir en tono "así está diseñado" y no fingir que existe. La honestidad puntúa; inventar
capturas, no.

---

## 🚦 Estado global

| # | Sección | Estado | Bloqueado por |
|---|---|---|---|
| 0 | Ficha del proyecto | ⬜ | — (nombre ya decidido) |
| 1.1 | Objetivo | 🟨 material listo | — |
| 1.2 | Características y funcionalidades | 🟨 material listo | — |
| 1.3 | Diseño y experiencia de usuario | ⬜ | Mockups del panel |
| 1.4 | Instrucciones de instalación | ⬜ | Stack del panel |
| 2.1 | Diagrama de arquitectura | ⬜ | — |
| 2.2 | Componentes principales | 🟨 material listo | — |
| 2.3 | Estructura de ficheros | ⬜ | — |
| 2.4 | Infraestructura y despliegue | ⬜ | Dónde se despliega |
| 2.5 | Seguridad | ⬜ | — |
| 2.6 | Tests | ⬜ | — |
| 3 | Modelo de datos | ⬜ | Esquema DTCG + BD del panel |
| 4 | Especificación de la API | ⬜ | Endpoints del panel |
| 5 | Historias de usuario (3) | 🟨 hay 5, elegir 3 | — |
| 6 | Tickets de trabajo (3) | ⬜ | Secciones 2, 3 y 4 |
| 7 | Pull requests | ⛔ entrega final | — |

Leyenda: ⬜ pendiente · 🟨 material disponible, falta redactar · ✅ hecho · ⛔ no aplica

---

## 🔎 Tareas de investigación pendientes

| Tarea | Para qué | Cuándo |
|---|---|---|
| **Explorar herramientas existentes del espacio** — Tidy (66 herramientas MCP), FigmaLint, `lifesized/figma-design-sync`, Observatory, GitHub Primer | Robar ideas y, sobre todo, evaluar si alguna es **integración** en vez de competencia. Alimenta la sección 2.1 (justificación y déficits) | Antes de cerrar arquitectura |
| Verificar Plugin API de Figma con cuenta propia | Dependencia crítica | Antes de la Entrega 2 |

## 🔑 Decisiones transversales pendientes

| Decisión | Bloquea | Notas |
|---|---|---|
| ~~Nombre del proyecto~~ | — | ✅ **Sutegi Design System** (08-sep) |
| ~~Iniciales~~ | — | ✅ **JA** · rama `feature/entrega-1-JA` creada |
| **Stack del panel** (front/back/BD) | 1.4, 2.x, 3, 4 | Da las 3 capas que pide LIDR |
| **Dónde se despliega el panel** | 2.4 | Necesario para la evidencia de la entrega final |
| **Pipeline de tokens** (Style Dictionary vs Terrazzo) | 2.2 | Diferible: es dependencia hoja |

---

## 📑 Guion sección por sección

### 0. Ficha del proyecto
**Pide:** nombre completo, nombre del proyecto, descripción breve, URL del proyecto, URL del repo.
**Tenemos:** URL del repo. **Falta:** nombre del proyecto; la URL del producto llegará con el despliegue.
**Sesión:** 15 min, al final (cuando el nombre esté decidido).

### 1.1 Objetivo · 1.2 Características
**Pide:** propósito, valor, qué resuelve y para quién; y la lista de funcionalidades.
**Tenemos:** todo en la ficha de idea (§1 problema/usuario, §2 visión, §3 MVP).
**Ojo:** separar bien **visión** de **MVP** para que no parezca que se promete de más.
**Sesión:** 1 sesión corta de redacción.

### 1.3 Diseño y experiencia de usuario
**Pide:** imágenes y/o vídeo del recorrido del usuario.
**Falta:** mockups del panel + una representación del *golden loop*.
⚠️ **Peculiaridad:** buena parte de la UX aquí **no es visual** (es un flujo de agente en
terminal). Decidir cómo representarlo: diagrama de secuencia + transcripción de ejemplo.
**Sesión:** 1 sesión (mockups) — puede apoyarse en Figma.

### 1.4 Instrucciones de instalación
**Pide:** cómo instalar y arrancar en local.
**Falta:** stack cerrado. Escribir la versión **planeada** y marcarla como tal.
**Sesión:** 30 min, tras cerrar stack.

### 2.1 Diagrama de arquitectura
**Pide:** diagrama, patrón seguido, justificación, beneficios **y sacrificios/déficits**.
⚠️ **Piden explícitamente los déficits** → aquí la honestidad puntúa. Material que ya tenemos:
ports & adapters (OpenSpec y tokens), separación runner/motor/panel, apoyo en primitivas de
terceros, y los sacrificios (dependencia de Figma, cuota de 200 llamadas/día, un solo coding
agent soportado).
**Sesión:** 1 sesión completa. Es la sección más importante para el eje 1.

### 2.2 Componentes principales
**Tenemos:** agentes, workflows, skills, CLI, runner, motor de validación, panel.
**Sesión:** se redacta junto con 2.1.

### 2.3 Estructura de ficheros
**Falta:** diseñarla (monorepo con paquetes: `cli`, `runner`, `validator`, `panel`, `agents`…).
**Sesión:** 30 min, junto con 2.1.

### 2.4 Infraestructura y despliegue
**Falta:** decidir dónde vive el panel y cómo se despliega. Incluir diagrama.
**Sesión:** 30 min.

### 2.5 Seguridad
**Falta todo, pero hay mucho que contar:** custodia del token de Figma y de las claves de
modelos, y sobre todo **la ejecución de código generado por agentes** (sandboxing, límites,
revisión humana antes de escribir en el repo). Es una sección donde este proyecto puede
lucir más que un CRUD.
**Sesión:** 45 min.

### 2.6 Tests
**Pide:** describir algunos tests.
**Estrategia:** unitarios del motor de validación (reglas, AST), integración del runner
(workflow completo con agente simulado), **E2E del golden loop**.
**Sesión:** 30 min.

### 3. Modelo de datos
**Pide:** diagrama ER (**recomiendan mermaid**) con PK/FK + descripción de entidades con
atributos, tipos, relaciones y restricciones.
⚠️ **Aquí hay una peculiaridad importante: el modelo es DOBLE.**
1. **Tokens DTCG** — ficheros versionados, no tablas. Se documenta su esquema.
2. **BD del panel** — sí es relacional: componentes, ejecuciones, resultados de validación,
   drift, histórico. Aquí va el diagrama ER.
Documentar ambos y explicar por qué son dos cosas distintas.
**Sesión:** 1 sesión completa.

### 4. Especificación de la API
**Pide:** endpoints principales en **OpenAPI**, **máximo 3**, con ejemplo de petición y respuesta.
**Falta:** diseñar los 3 del panel. Candidatos: listar componentes con su estado, disparar
una validación, consultar el resultado de una ejecución.
**Sesión:** 45 min.

### 5. Historias de usuario (3)
**Pide:** 3 historias principales con buenas prácticas de producto.
**Tenemos 5 must-have** → elegir 3. Candidatas fuertes: golden loop, validación, panel.
Escribir con criterios de aceptación en Given/When/Then (metodología del máster).
**Sesión:** 45 min.

### 6. Tickets de trabajo (3)
**Pide:** 3 tickets **uno de backend, uno de frontend y uno de BD**, con todo el detalle.
⚠️ Esto asume forma de app web clásica → **los tres salen del panel**, que es lo que tiene
las tres capas. Depende de tener cerradas las secciones 2, 3 y 4.
**Sesión:** 1 sesión, al final.

### 7. Pull requests
⛔ No aplica a la Entrega 1. Se documentan en la entrega final.

---

## 🗓️ Agrupación propuesta en sesiones

| Sesión | Contenido |
|---|---|
| 1 | Decisiones transversales: nombre, iniciales, stack del panel |
| 2 | Arquitectura (2.1, 2.2, 2.3) — la más importante |
| 3 | Modelo de datos (3) — doble modelo |
| 4 | API (4) + Historias de usuario (5) |
| 5 | Seguridad (2.5), Tests (2.6), Infraestructura (2.4) |
| 6 | UX y mockups (1.3) + Instalación (1.4) |
| 7 | Descripción (1.1, 1.2) + Ficha (0) + Tickets (6) |
| 8 | Revisión completa contra criterios + PR + Typeform |

---

## ✅ Definición de "entregado" (Entrega 1)

- [ ] `readme.md` con las 8 secciones completas (7 marcada como no aplicable aún)
- [ ] `prompts.md` con el registro de IA de esta fase
- [ ] Rama `feature/entrega-1-JA` con los commits
- [ ] Pull request abierta contra el repo
- [ ] **Formulario de Typeform enviado** (sin él la entrega no existe formalmente)

---

## 🔭 Hitos de las Entregas 2 y 3 (grueso, se detalla más adelante)

**Entrega 2 — 23-oct.** Scaffolds de front, back y BD conectados; flujo principal casi
completo. **Es el punto de control del plan B**: si el golden loop no respira, se ejecuta el
orden de sacrificio (drift → panel a solo lectura → nunca el golden loop).

**Entrega 3 — 11-nov.** 3-5 funcionalidades completas, suite de tests con al menos un E2E,
despliegue con evidencia, `prompts.md` completo y las 3 PRs documentadas. Única entrega con
feedback humano. Prórroga posible hasta el 25-nov pidiéndola al TA con antelación.
