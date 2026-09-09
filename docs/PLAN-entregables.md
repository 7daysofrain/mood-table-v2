> # 🔄 RESET DE IDEA — 09-sep-2026
> La idea "Sutegi Design System" se descartó el 09-sep (ver
> [`POSTMORTEM-sutegi.md`](./POSTMORTEM-sutegi.md)).
> **El método, el guion por secciones y la definición de "entregado" de este plan siguen siendo
> válidos**; lo que queda obsoleto es el estado de las secciones y las decisiones transversales,
> que eran de la idea anterior.
> **Filtro para la idea nueva:** que haya un sistema real que construir y que la IA lo haga posible
> o mucho mejor — no un producto donde el valor central lo entrega el modelo. Pregunta de cribado:
> *¿hay código sustancioso que no sea el bucle agéntico?*

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
| 2.1 | Diagrama de arquitectura | ✅ **cerrada** (revisada por JA, 09-sep) | — |
| 2.2 | Componentes principales | ✅ | — (stack del panel marcado como pendiente en el texto) |
| 2.3 | Estructura de ficheros | ✅ | — |
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
| ~~Stack del CLI~~ | — | ✅ Commander.js 15 · no interactivo · Node 24 LTS (09-sep) |
| **Stack del panel** (front/back/BD) | 1.4, 2.4, 3, 4 | Da las 3 capas que pide LIDR. ⚠️ **Es ahora el bloqueo principal**: aplazado en la sesión de la sección 2, pero 3 (modelo de datos), 4 (API) y 6 (tickets) no se pueden cerrar sin él |
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

### 2.1 Diagrama de arquitectura ✅ CERRADA (08-sep · revisada y aprobada por JA el 09-sep)
Dos diagramas Mermaid (contenedores + secuencia del golden loop), patrón declarado **por niveles**
con el **bucle de control** como titular, justificación, beneficios y **10 sacrificios y déficits**.
⚠️ *Revisado el 09-sep:* se rebajó "arquitectura hexagonal" a **puertos + inyección de dependencias**
y se documenta explícitamente por qué NO se aplica la capa de dominio. Ver ficha de idea §14.4.
💡 El diagrama de secuencia es **reutilizable en 1.3**, donde la UX no es visual.

### 2.2 Componentes principales ✅ HECHO (08-sep, revisado 09-sep)
CLI, core (runner · puertos/adaptadores · definiciones), validator (AST · alias DTCG · reglas),
panel (ingesta · API · front · BD) y los tres artefactos (tokens DTCG · `DESIGN.md` · runs).
⚠️ *Revisado el 09-sep:* 4 paquetes en vez de 3; `harness` pasa a `core` y el motor de validación
se extrae a `validator`. Ver ficha de idea §14.3.
⚠️ El **stack del panel** queda marcado explícitamente como pendiente dentro del texto → hay que
volver a esta sección cuando se decida.

### 2.3 Estructura de ficheros ✅ HECHO (08-sep, revisado 09-sep)
Se documentan **dos** estructuras: el monorepo de Sutegi (4 paquetes) y la **huella que
`sutegi init` crea en el repo del usuario** (esta segunda es el contrato público del producto).
Incluye la dirección de dependencias `cli → core → validator`, verificable con linting.
⚠️ La subcarpeta `src/` de `packages/panel/` es provisional hasta cerrar el stack.

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
