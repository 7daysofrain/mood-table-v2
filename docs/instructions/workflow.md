# Workflow · del PRD al código

> **Cuándo leerlo:** antes de crear o modificar épicas, historias, tareas o specs de OpenSpec, y antes
> de abrir una PR. Sigue la pirámide del Máster AI4Devs (módulo 4): PRD → Epic → Historia → Tarea.

## 1. La cadena

**PRD → Épica → Historia → Tarea → OpenSpec change → PR → archive**

| Nivel | Dónde vive | Qué es | Tamaño | Quién lo escribe |
|---|---|---|---|---|
| **PRD** | `docs/PRD.md` | Qué y por qué del producto: historias H1-H5 y S1-S2, expectativas E1-E9, alcance, glosario | — | Joseba (la IA ayuda) |
| **Épica** | Linear · **Proyecto** (uno por H# / S# del PRD) | Bloque grande de capacidad = una historia del PRD | Días/semanas | Se crea desde el PRD |
| **Historia** | Linear · **Issue** dentro del proyecto | Comportamiento observable, INVEST, criterios de aceptación en GIVEN/WHEN/THEN | 1-2 días | Joseba escribe el caso feliz; la IA busca huecos |
| **Tarea** | Linear · **Sub-issue** de la historia | Unidad de trabajo técnico (backend, frontend, BD, infra…) | Minutos/horas | La puede generar el agente |
| **OpenSpec change** | `openspec/changes/<id>/` | El *cómo*: propuesta, delta de spec (requisitos SHALL/MUST + escenarios), diseño y tareas | Una por historia | La propone el agente; la revisa Joseba |
| **PR** | GitHub | Código + tests; enlaza la historia de Linear | Por historia o por tarea | Agente + revisión de Joseba |

> En el PRD, H1-H5 se llaman "historias" porque son historias *de producto*. En el backlog son
> **épicas**: se descomponen en historias de 1-2 días.

## 2. Fuente de verdad de cada cosa

Cada dato se escribe en **un solo sitio**; en los demás, se enlaza.

| Sitio | Guarda | No guarda |
|---|---|---|
| **PRD** | Qué y por qué | Estado del trabajo, criterios detallados, arquitectura |
| **Linear** | Backlog, jerarquía, prioridad, estimación, estado y los **criterios de aceptación de cada historia (GIVEN/WHEN/THEN)** | El contrato técnico |
| **OpenSpec** | Contrato técnico de cada cambio: requisitos y escenarios derivados de los criterios de la historia, diseño y tareas de implementación | Prioridad ni estado del backlog |
| **README** | Diseño del sistema y lo que exige la entrega del máster | Requisitos de producto (si discrepa del PRD, **manda el PRD**) |
| **Ficha** (`docs/idea-mood-table.md`) | Registro de decisiones con su porqué | Instrucciones de trabajo |

## 3. Vida de una historia

1. **Refinar (Linear).**
   - Como / Quiero / Para.
   - Criterios del **caso feliz** en GIVEN/WHEN/THEN, **escritos por Joseba**.
   - **Poke-holes:** la IA lista casos límite, supuestos y riesgos; Joseba se queda con los 3-5 reales.
   - **INVEST** como filtro: si falla 2 o más criterios, vuelve a refinamiento.
   - Estimación con la IA como *peer*; **non-goals** explícitos; **DoD** según el tipo de trabajo.
2. **Especificar.** La primera tarea técnica de la historia es su **OpenSpec change**
   (`openspec propose`). Joseba la revisa antes de implementar.
3. **Implementar.** El agente trabaja **sobre la OpenSpec**, no sobre el ticket. Rama con el ID de
   Linear (p. ej. `joseba/moo-12-visor`).
4. **PR.** En la descripción, `Fixes MOO-n` (cierra la historia al integrar) o `Refs MOO-n` (cuando la
   historia necesita varias PR). Puertas: lint, tipos, tests, E2E y SonarQube.
5. **Integrar.** La historia pasa sola a *Done* y se archiva el change (`openspec archive`).

## 4. Reglas para agentes

- **El nivel del prompt es la historia, nunca la épica.**
- **No inventar criterios:** marca como *(asumido)* lo que no tenga evidencia en el PRD, la historia o
  el código.
- **Vocabulario del glosario** (PRD §8). Un término nuevo se añade al glosario antes de usarlo.
- **No duplicar:** si algo ya está en otro sitio de la tabla del §2, enlázalo.
