# Workflow · del PRD al código

> **Cuándo leerlo:** antes de crear o modificar épicas, historias, tareas o specs de OpenSpec, y antes
> de abrir una PR. Sigue la pirámide del Máster AI4Devs (módulo 4): PRD → Epic → Historia → Tarea.

## 1. La cadena

**PRD → Épica → Historia → Tarea → OpenSpec change → PR → archive**

| Nivel | Dónde vive | Qué es | Tamaño | Quién lo escribe |
|---|---|---|---|---|
| **PRD** | `docs/PRD.md` | Qué y por qué del producto: historias H1-H5 y S1-S2, expectativas E1-E9, alcance, glosario | — | Joseba (la IA ayuda) |
| **Épica** | Linear · **issue padre** en el proyecto *Mood Table* (una por H# / S# del PRD, más la épica técnica de *enablers*, que cuelga tareas sin historia: `linear.md` §1) | Bloque grande de capacidad = una historia del PRD | Días/semanas | Se crea desde el PRD |
| **Historia** | Linear · **sub-issue** de su épica | Comportamiento observable, INVEST, criterios de aceptación en GIVEN/WHEN/THEN | 1-2 días | Joseba describe el caso feliz; la IA lo traduce a GIVEN/WHEN/THEN y busca huecos |
| **Tarea** | Linear · **sub-issue** de su historia | Cambio coherente de **un área** (backend, frontend, BD, infra…) que se revisa e integra: **una tarea = una PR** | Horas | Se planifica con la historia; la puede proponer el agente |
| **OpenSpec change** | `openspec/changes/<id>/` | El *cómo*: propuesta, delta de spec (requisitos SHALL/MUST + escenarios), diseño y `tasks.md` con **una sección por tarea**; **cada paso = un commit** | Uno por historia | La propone el agente; la revisa Joseba |
| **PR** | GitHub | Código + tests de **una tarea**; enlaza su sub-issue de Linear | Una por tarea | Agente + revisión de Joseba |

> En el PRD, H1-H5 se llaman "historias" porque son historias *de producto*. En el backlog son
> **épicas**: se descomponen en historias de 1-2 días.

## 2. Granularidad: tarea → PR, paso → commit

| | Tarea (sub-issue de Linear) | Paso del `tasks.md` (OpenSpec) |
|---|---|---|
| **Qué es** | Lo que se **revisa e integra**: un cambio coherente de un área | Un paso del agente **dentro** de esa tarea |
| **Se materializa en** | **Una PR** | **Un commit** |
| **Tamaño** | Horas | Minutos |
| **Se crea** | Al planificar la historia | Al escribir la spec, cuando ya hay diseño |
| **Estado** | Automático, con su PR | Casilla que marca el agente; Linear no lo ve |

- El `tasks.md` del change se organiza **en una sección por tarea** (`## 1. MOO-16 · engine`,
  `## 2. MOO-17 · engine`, `## 3. MOO-18 · panel`). La tarea de Linear enlaza su sección; no la copia.
- Cada paso se escribe con **tamaño de commit**: un cambio con sentido propio que deja el código
  compilando. Si se trabaja con TDD, el commit con el test en rojo se marca como tal.
- En los commits se usa `Refs MOO-n` (nunca `Fixes`): solo la PR cierra la tarea.
- La historia tiene **varias PR** (una por tarea). El `openspec archive` se hace al integrar la
  **última**.

## 3. Fuente de verdad de cada cosa

Cada dato se escribe en **un solo sitio**; en los demás, se enlaza.

| Sitio | Guarda | No guarda |
|---|---|---|
| **PRD** | Qué y por qué | Estado del trabajo, criterios detallados, arquitectura |
| **Linear** | Backlog, jerarquía, prioridad, estimación, estado y los **criterios de aceptación de cada historia (GIVEN/WHEN/THEN)** | El contrato técnico |
| **OpenSpec** | Contrato técnico de cada cambio: requisitos y escenarios derivados de los criterios de la historia, diseño y tareas de implementación | Prioridad ni estado del backlog |
| **README** | Diseño del sistema y lo que exige la entrega del máster | Requisitos de producto (si discrepa del PRD, **manda el PRD**) |
| **Ficha** (`docs/idea-mood-table.md`) | Registro de decisiones con su porqué | Instrucciones de trabajo |

## 4. Vida de una historia

1. **Refinar (Linear).**
   - Como / Quiero / Para.
   - **Caso feliz descrito por Joseba en lenguaje natural**; la IA lo traduce a GIVEN/WHEN/THEN sin añadir comportamiento.
   - **Poke-holes:** la IA lista casos límite, supuestos y riesgos; Joseba se queda con los 3-5 reales.
   - **INVEST** como filtro: si falla 2 o más criterios, vuelve a refinamiento.
   - Estimación con la IA como *peer*; **non-goals** explícitos; **DoD** según el tipo de trabajo.
   - Planificar sus **tareas** (sub-issues), una por área y por PR.
2. **Especificar** (estado *Spec*). La historia se especifica en un **OpenSpec change**
   (`openspec propose`), con un `tasks.md` que tiene una sección por tarea. Joseba lo revisa antes de
   implementar.
3. **Implementar.** El agente trabaja **sobre la OpenSpec**, no sobre el ticket: una rama por tarea
   con su ID de Linear (la que propone Linear, p. ej. `7daysofrain/moo-16-arrancar-el-motor-con-una-tira-virtual-y-el-efecto`) y **un commit por paso** del `tasks.md`.
4. **PR** (una por tarea). En la descripción, `Fixes MOO-n` con el ID de la tarea. Puertas: lint,
   tipos, tests, E2E y SonarQube.
5. **Integrar.** Cada tarea pasa sola a *Done* al integrar su PR. Con la última, la historia queda
   completa y se archiva el change (`openspec archive`).

## 5. Reglas para agentes

- **El nivel del prompt es la historia, nunca la épica.**
- **No inventar criterios:** marca como *(asumido)* lo que no tenga evidencia en el PRD, la historia o
  el código.
- **Vocabulario del glosario** (PRD §8). Un término nuevo se añade al glosario antes de usarlo.
- **No duplicar:** si algo ya está en otro sitio de la tabla del §3, enlázalo.
- **Tarea → PR, paso → commit:** no mezclar dos tareas en una PR ni dos pasos en un commit.
