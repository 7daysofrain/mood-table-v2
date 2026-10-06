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

> Excepción a la cadena: las *chores* que no tocan requisitos van de la tarea a la PR sin OpenSpec
> change (§6).

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

1. **Refinar (Linear):** crear, refinar y estimar la historia. Cada paso es una skill (`linear.md` §5); el
   protocolo vive en ella.
   - **Reparto:** Joseba escribe el caso feliz y elige los criterios; la IA lo traduce a
     GIVEN/WHEN/THEN sin añadir comportamiento y busca huecos.
   - **Sale a *Todo*** cuando pasa INVEST y tiene criterios, non-goals, DoD, estimación y sus
     **tareas** (una por área y por PR, §2).
2. **Especificar** (estado *Todo* → *Spec*). Se crea **desde `main`** la rama con su ID de Linear (la
   que propone Linear, p. ej. `7daysofrain/moo-16-arrancar-el-motor-con-una-tira-virtual-y-el-efecto`) y la historia
   se especifica en un **OpenSpec change** (`/opsx:explore`, `/opsx:propose`), con un `tasks.md` que
   tiene una sección por tarea.
   - **Mientras se define, sigue en *Todo*:** no hay nada en el repo que otra persona pueda ver. Si venía
     de *Backlog* (un *enabler* sin refinar), el agente la pasa a *Todo* al crear la rama.
   - **Joseba revisa el change antes de commitearlo**; las correcciones (p. ej. un escenario
     *(asumido)* que se cae) se hacen con `/opsx:update`.
   - **El commit del change es la aprobación.** Al subirlo, el agente pasa la historia (o la tarea, si es
     un *enabler*) a *Spec*: desde ahí se puede implementar sin más puertas humanas.
3. **Implementar** (`/opsx:apply`). El agente trabaja **sobre la OpenSpec**, no sobre el ticket, en la
   rama de la tarea y con **un commit por paso** del `tasks.md`. Con el primer commit de
   implementación abre la **PR en borrador**, que pasa la tarea a *In Progress* (Linear no reacciona a
   la rama ni al push, solo a la PR).
4. **PR** (una por tarea), **contra `main`**. En la descripción, `Fixes MOO-n` con el ID de la tarea.
   Puertas (`linear.md` §7): lint, tipos, tests, E2E, *quality gate* de SonarQube, incidencias nuevas
   de SonarQube (`sonar-issues`), revisión de Copilot y todos los hilos resueltos. Se pasa a *lista
   para revisar* cuando el `tasks.md` está completo: Copilot no revisa borradores.
   - **Cada hallazgo de Copilot o de SonarQube**, el agente lo **verifica** contra el código (no lo da
     por bueno). Si es real, lo arregla con un commit y contesta en el hilo con el commit; si no aplica,
     contesta por qué. Luego resuelve el hilo. En SonarQube, lo que no aplica lo marca como aceptado
     el usuario, con el motivo.
   - Lo que exige criterio (cambiar el diseño o aceptar una incidencia) se le pregunta al usuario.
   - Antes de integrar, el agente comprueba que hay una revisión de Copilot del último push. Si se ha
     agotado la cuota, Copilot no revisa ni avisa: se pide a mano o se le dice al usuario.
5. **Integrar.** Joseba integra cada PR con el botón de GitHub y la tarea pasa sola a *Done*. Con la
   última, la historia queda completa: `/opsx:verify` comprueba la implementación contra el change y
   `/opsx:archive` la archiva. Como el *ruleset* no deja subir directo a `main`, el archivado va en
   una rama `…-archivar-change` que sale de `main`, con `Refs MOO-n` y una PR pequeña que también
   integra Joseba.

## 5. Reglas para agentes

- **El nivel del prompt es la historia, nunca la épica.**
- **No inventar criterios:** marca como *(asumido)* lo que no tenga evidencia en el PRD, la historia o
  el código.
- **Vocabulario del glosario** (PRD §8). Un término nuevo se añade al glosario antes de usarlo.
- **No duplicar:** si algo ya está en otro sitio de la tabla del §3, enlázalo.
- **Tarea → PR, paso → commit:** no mezclar dos tareas en una PR ni dos pasos en un commit.

## 6. OpenSpec en este repo

- **Comandos instalados** (perfil global de OpenSpec): `/opsx:propose`, `explore`, `apply`, `update`,
  `verify`, `sync` y `archive`. Solo como comandos (`.claude/commands/opsx/`), no como skills.
- **Solo se lanzan a mano.** Claude Code deja que el modelo invoque comandos por su cuenta; una regla
  `ask` en `.claude/settings.json` (`Skill(opsx:*)` y una por comando) le obliga a pedir confirmación.
- **Los comandos son generados:** no se editan a mano. `openspec update` los regenera con la versión
  instalada del CLI (al hacerlo, revisar el diff y si aparecen flujos nuevos).
- **Las convenciones viven en `openspec/config.yaml`** (`rules` por artefacto y guía de `apply`): idioma,
  trazabilidad con Linear, `(asumido)`, una sección por tarea, un paso por commit. Sin `context`: el
  contexto del proyecto está en `AGENTS.md`.
- **Los *enablers* pueden tener su propio change** (sin historia): sus escenarios se trazan contra la
  descripción de la tarea en Linear.
- **Una tarea `Chore` no lleva change** si no añade ni cambia ningún requisito de `openspec/specs/`
  (documentación, arnés, dependencias o configuración que deja las specs como están).
  - El criterio es tocar requisitos, no el tamaño ni si tiene efecto observable.
  - Su plan va en la descripción de la tarea en Linear, y la PR explica por qué no lleva change.
  - **Si hay duda, lleva change.** Un `Refactor` lleva change siempre.
