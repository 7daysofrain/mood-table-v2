# Máster AI4Devs · requisitos del proyecto final

> **Cuándo leerlo:** al preparar o verificar una entrega, al decidir el alcance de algo y al registrar
> prompts en `prompts.md`. Fuentes: plantilla oficial de LIDR, doc de Drive "99.2 - Sesión de
> acompañamiento — Proyecto Final" y su vídeo (act. 23-sep-2026).

## 1. Qué construir

- Un **MVP robusto** de tema libre, con IA en **todas** las fases (idea → doc → código → tests →
  despliegue).
- **No** es una pantalla con un botón: al menos **un flujo end-to-end completo** con backend +
  frontend + base de datos (o su equivalente según el stack).
- Alcance recomendado: **3-5 historias *must-have*** + **1-2 *should-have***. Completo antes que extenso.
- Para hardware o sistemas sin UI se acepta un vídeo de 2-3 min, pero **complementa** la demo
  desplegada; no la sustituye (sin acceso no hay feedback).

## 2. Criterios de evaluación: los 3 ejes

1. **Idea y arquitectura del producto.**
2. **Calidad del código.**
3. **Cómo se usó la IA a lo largo del proceso** (§5). Es un tercio de la nota, no un extra.

Cada decisión debe dar juego en los tres ejes a la vez.

## 3. Entregas

| # | Entrega | Contenido | Fecha | Revisión |
|---|---|---|---|---|
| 1 | Documentación técnica | Sin código: ficha, descripción, arquitectura, modelo de datos, historias de usuario y tickets | 25-sep-2026 ✅ enviada | Automatizada |
| 2 | Código funcional | Scaffolds front + back + BD conectados; flujo principal casi completo; primeras funcionalidades; **README §4 (API en OpenAPI)** | **23-oct-2026** | Automatizada |
| 3 | Entrega final | E1 + E2; **3-5 funcionalidades completas**; tests (unit + integración + **≥ 1 E2E del flujo principal**); **despliegue obligatorio** + evidencia; **`prompts.md` completo**; README §7 (3 PR) | **11-nov-2026** | **Feedback humano** |

Prórroga posible hasta el 25-nov, pidiéndola al TA con antelación (el doc 99.2 no la menciona; sin
reconfirmar).

**Plantilla oficial:** un `readme.md` con 8 secciones + `prompts.md`.
1. Ficha del proyecto · 2. Descripción general · 3. Arquitectura · 4. Modelo de datos (ER) ·
5. API (**OpenAPI**) · 6. Historias de usuario (**3 principales**) · 7. Tickets (**3: backend,
frontend, BD**) · 8. Pull requests (**3**, entrega final).

*(La numeración interna del `readme.md` del proyecto va de §0 a §7; los "7 documentos numerados" del
Ejemplo 1 no son un requisito.)*

**Mecánica de cada entrega:**
- **Repo propio, no fork.** `LIDR-academy/AI4Devs-finalproject` solo es la plantilla.
- **Rama por entrega** con iniciales: `feature/entrega-1-JA`, `feature/entrega-2-JA`, `final-project-JA`.
  Cómo convive con las ramas por tarea: `linear.md` §7.
- **Typeform** (`lidr.typeform.com/proyectoai4devs`) tras cada entrega, con **solo el enlace de la
  rama** (`…/tree/<rama>`, no el de la PR). Sin formulario, la entrega "no existe".
- Repo privado → invitar a `LIDR-AI4Devs` (el nuestro es público).
- El `readme.md` explica **cómo probar el MVP** y las credenciales; Mood Table no tiene login y lo dice
  (README §1.4).
- `readme.md` y `prompts.md`, obligatorios siempre.

**Consejos del vídeo:** iterar el PRD hasta que lo cubra todo; **priorizar** el backlog que genere la IA
("vámonos por esas funcionalidades") en vez de aceptar uno lineal; pensar qué agentes necesita el flujo
(multiagente, hooks, modelo por tarea).

## 4. Metodología del máster (alinearse puntúa)

- **SDD con OpenSpec:** la spec es el contrato (`propose → apply → archive`), delta sobre spec viva,
  escenarios GIVEN/WHEN/THEN.
- **PRD → backlog → spec → código** (detalle en `workflow.md`).
- **IA como *peer*, no oráculo:** *poke-holes* al refinar, planning poker, hooks que validan criterios.
- **Calidad como diferencial:** documentación, tests, despliegue real.

## 5. `prompts.md` (eje 3)

Documenta el **flujo de trabajo con IA**, no solo prompts sueltos: herramientas, modelos y para qué fase,
skills/subagentes/hooks/comandos, los prompts clave y **qué ajustes humanos hubo** sobre lo que dio la IA.

**Regla:** al cerrar una sección del README o un hito del arnés, se registra en `prompts.md`.
**Formato:** como mucho **3 prompts** por sección (solo los que aporten), **copiados literalmente** (sin
corregir ni recortar), y **una línea en cursiva** con el contexto y el resultado.

## 6. Material de referencia

- **Drive "Lidr IA4Devs material"** (id `1vvKZjVi11rfGRnhLk5UHTPJZAEutXm-q`): material de clase.
  Subcarpeta **"99 - Proyecto FINAL Master AI4Devs"** (id `1SkNcXl8at7C-vrSevfnklid_k9q48PpP`).
- **Plantilla:** `github.com/LIDR-academy/AI4Devs-finalproject`.
- **Ejemplos (vara de calidad):**
  - `AI4Devs-finalproject-Example1`: reservas de campings. PHP 8 (Slim) + React 18 + TS; mock-first,
    Repository Pattern; PHPUnit > 85 %, Vitest > 78 %.
  - `AI4Devs-finalproject-Example2`: chatbot RAG. FastAPI + React + Gemini + pgvector + GCP; costes de
    LLM, GDPR, CI/CD.
