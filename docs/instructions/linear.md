# Linear · convenciones

> **Cuándo leerlo:** antes de crear o editar cualquier cosa en Linear (épicas, historias, tareas,
> etiquetas o estados). El porqué de la jerarquía está en `workflow.md`.

## 1. Estructura

- **Workspace:** Joseba Alonso · **Equipo:** Mood Table · **Clave:** `MOO` (IDs `MOO-12`).
- **Un solo proyecto: *Mood Table*.** Todo el backlog vive en él.
- **Épica = issue padre**, una por historia del PRD, con su mismo título:
  `H1 · Probar el instrumento en el simulador` · `H2 · Tocar los parámetros en vivo` ·
  `H3 · Pintar la tira física` · `H4 · Declarar mis tiras` · `H5 · Arrancar en el último estado` ·
  `S1 · Tira de ambiente` · `S2 · Firmware propio`. Su descripción enlaza la historia del PRD (§4) y
  sus expectativas (E#); no las copia. Las épicas no llevan etiqueta de tipo.
- **Historia = sub-issue de su épica. Tarea = sub-issue de su historia** (tres niveles de anidación).
- **Sin cycles** (una sola persona). Must/should: prioridad de la épica (**High** = must, **Low** =
  should). Dentro del backlog, el orden lo da la **prioridad** nativa de cada historia.

## 2. Estados

`Backlog` → `Todo` → `Spec` → `In Progress` → `In Review` → `Done` (+ `Canceled`, `Duplicate`)

| Estado | Significa | Quién lo mueve |
|---|---|---|
| Backlog | Idea o historia sin refinar | Manual |
| Todo | Refinada: pasa INVEST, tiene criterios, non-goals y estimación | Manual |
| Spec | Su OpenSpec change está en redacción o revisión | Manual |
| In Progress | Implementándose (rama creada o PR en borrador) | GitHub (automático) |
| In Review | PR abierta, esperando revisión y puertas | GitHub (automático) |
| Done | PR integrada | GitHub (automático) |

**Parent auto-close activado:** al cerrarse la última tarea se cierra la historia, y con la última
historia, la épica. *Sub-issue auto-close* desactivado.

## 3. Etiquetas

- **Tipo** (grupo; decide el DoD): `Feature` · `Bug` · `Refactor` · `Spike` (investigación con
  resultado, p. ej. el de rendimiento) · `Chore` (setup, CI, dependencias).
- **Área** (etiquetas **sueltas**, sin grupo: el workspace no admite grupos de selección múltiple):
  `engine` (backend) · `panel` (frontend) · `shared` · `db` (base de datos) · `infra` · `firmware`.
  Una tarea lleva **una** área; una historia puede llevar varias.

## 4. Estimación

- **Talla (IA)** al crear la historia: XS · S · M · L · XL, **solo para priorizar**. Va en la
  descripción, no en el campo *estimate*.
- **Estimación** Fibonacci (1, 2, 3, 5, 8, 13) en el campo *estimate*, por **planning poker** entre el
  humano y la IA, y **separada en el tiempo** de la redacción (curso 04.2, 04.4). Una historia **≤ 8**;
  si sale **13**, se divide (el 13 nunca se guarda). *(24-sep: se amplía de 1-8 a 1-13 para ganar
  resolución dentro de la franja de 1-2 días, no para admitir historias más grandes.)*
- **Qué significa cada carta** (tamaño relativo: complejidad + incertidumbre + esfuerzo; la referencia
  en tiempo es orientativa, no una conversión):

  | Carta | Significa |
  |---|---|
  | 1 | Trivial: cambio acotado y conocido |
  | 2 | Pequeña: poco que decidir, sin sorpresas previsibles |
  | 3 | Media: alguna decisión o pieza nueva, riesgo bajo |
  | 5 | Grande: varias piezas o áreas, alguna incógnita |
  | 8 | Límite de una historia (~2 días): muchas piezas o una incógnita seria |
  | 13 | Demasiado grande: se divide |
- **Las historias se crean en `Backlog` sin estimación Fibonacci**; se estiman tras refinarlas (paso a
  `Todo`).

## 5. Vida de una historia en Linear

Cada paso lo ejecuta una skill de Claude Code (`.claude/skills/`). El **cómo** (plantilla de la
descripción, protocolo, DoD por tipo) vive en la skill; aquí solo el **qué**.

| Paso | Skill | Aporta a la historia | Estado al terminar |
|---|---|---|---|
| Crear | `/create-story <épica>` | Como/quiero/para, épica y E#, talla (IA), non-goals, etiquetas, prioridad | Backlog |
| Refinar | `/refine-story <historia>` | Criterios GIVEN/WHEN/THEN (caso feliz del humano + poke-holes), DoD por tipo, contexto técnico, INVEST y tareas | Backlog |
| Estimar | `/estimate-story <historia>` | Estimación Fibonacci por planning poker | **Todo** |

Toda escritura en Linear pasa por la puerta humana de la skill y por la regla `ask` de `save_issue` (§8).

## 6. Tareas (sub-issues)

**Una tarea = una PR** (ver `workflow.md` §2). Título en imperativo, **una etiqueta de área** y una o
dos líneas de qué se integra. El detalle paso a paso vive en su sección del `tasks.md` del OpenSpec
change (**un paso = un commit**), y la tarea lo enlaza; no lo copia.

## 7. Enlace con GitHub

- Integración nativa con `7daysofrain/mood-table-v2`; **sin** sincronización con GitHub Issues.
- Una rama por tarea, con su ID (Linear la copia con `Cmd+Shift+.`): `7daysofrain/moo-13-lector-wav`.
- PR: `Fixes MOO-n` con el ID de la **tarea**. Commits: `Refs MOO-n` (nunca `Fixes`).
- *Linkbacks* activados también en **repos públicos**, con descripción: la PR muestra la historia de la
  que sale (trazabilidad pública para la evaluación). *Link commits to issues* desactivado (no hace falta).
- Automatizaciones: PR en borrador → `In Progress` · PR abierta → `In Review` · revisión pedida →
  `In Review` · PR integrada → `Done`. La historia se completa cuando se completan todas sus tareas
  (*parent auto-close*).

## 8. MCP (Claude Code)

MCP oficial de Linear. Permisos iniciales **leer + crear** (recomendación del curso); mover estados,
editar o cerrar, solo con confirmación de Joseba.

**Cómo se aplica** (24-sep). Linear no tiene un scope "leer + crear": el OAuth da `read` (solo lectura) o
escritura completa, y en el MCP crear y editar son la misma herramienta (`save_issue`: sin `id` crea, con
`id` edita). Por eso la frontera se pone en Claude Code, versionada en el repo:

- **`.mcp.json`**: servidor `linear` → `https://mcp.linear.app/mcp` (HTTP). Cada persona se autentica una
  vez con `/mcp` en una sesión interactiva de `claude`.
- **`.claude/settings.json`** (precedencia `deny` > `ask` > `allow`; sin comodines parciales, cada
  herramienta por su nombre):
  - `allow`: todas las lecturas (`get_*`, `list_*`, `search_documentation`, `extract_images`).
  - `ask`: `save_issue` y `save_comment`. Crear historias y tareas pide confirmación, y editar o mover
    estados también.
  - `deny`: borrados, etiquetas, proyectos, hitos, documentos, *releases*, diffs y adjuntos. Si hace falta
    alguno, se mueve a `ask` a propósito.
- Las herramientas nuevas que publique Linear no quedan cubiertas: caen en el modo de permisos por
  defecto. Hay que revisar la lista si aparece alguna.
