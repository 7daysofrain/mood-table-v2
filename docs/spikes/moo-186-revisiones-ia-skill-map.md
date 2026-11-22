# Spike de revisiones con IA de skill-map · ¿Mejoran el arnés sin romper sus evals?

**Spike:** [MOO-186](https://linear.app/7daysofrain/issue/MOO-186) · **En curso**

> Notas del experimento. `/close-spike` las convierte en el documento final.

## Cómo funcionan las revisiones con IA de skill-map (1.12.7)

- Cada revisión es un *analyzer* probabilístico (`core/ai-<tipo>-analyzer`) que se encola como trabajo
  con `sm jobs submit <analyzer> -n <nodo>`. skill-map no llama a ningún modelo: renderiza un prompt
  autocontenido y lo deja en una cola.
- Un agente externo procesa la cola con la skill `sm-process-jobs` (`sm agent install` la instala en
  `.claude/skills/`, ignorada por git): `sm jobs claim` → ejecuta el prompt → `sm record` con el
  informe JSON. Los hallazgos quedan en la base de datos local (`sm findings`).
- Cada *analyzer* juzga **un solo nodo**: `redundancy` y `contradiction` no comparan entre ficheros.

## Método

1. Encolar las 5 revisiones sobre 14 nodos (`.spikes/moo-186/submit.sh`): las 6 skills, la referencia
   del subagente de `/capture`, `estimator`, `poke-holes`, `AGENTS.md` y los 4 de
   `docs/instructions/`. 70 trabajos.
2. Procesar la cola con 4 sesiones de Claude Code sin interfaz en paralelo (`.spikes/moo-186/process.sh`,
   `claude -p --output-format json`, Sonnet 5.5), que dan tokens, coste y duración exactos.
3. Contrastar cada hallazgo con el repo y clasificarlo: **real** (cambia lo que hace el agente o quita
   una ambigüedad con efecto), **cosmético** (cierto, pero sin ganancia, o es repetición deliberada
   de una regla crítica) o **falso** (no se sostiene en este repo).

4. **Ampliación (decidida con el usuario):** la pregunta 1 nombraba 5 de las 11 revisiones de skill-map.
   Se pasaron también las otras 6 (`incoherence`, `structure`, `scope`, `prose-to-rules`, `security`,
   `suspicion`), para que el veredicto no se base en menos de la mitad. skill-map llama «de
   optimización» a `scope`, `structure`, `trigger`, `vagueness` y `verbosity`.

## Coste de las pasadas (P3)

Coste equivalente a precio de API (`total_cost_usd` de `claude -p`). Con la cuenta del usuario
(suscripción Team) no se cobra por token: gasta de los límites de uso del plan.

| | 1.ª pasada (5 revisiones) | 2.ª pasada (6 revisiones) | Total |
|---|---|---|---|
| Trabajos | 70, 0 fallidos | 84, 0 fallidos | 154 |
| Tiempo de reloj (4 sesiones en paralelo) | 151 s | 171 s | 322 s |
| Coste | 6,67 $ | 8,55 $ | 15,22 $ |
| Tokens leídos de caché | 32,4 M | 44,9 M | 77,3 M |
| Tokens escritos en caché | 0,73 M | 0,86 M | 1,59 M |
| Tokens de salida | 49 k | 62 k | 111 k |

Unos 0,10 $ por revisión y nodo.

- El coste lo domina la **lectura de caché**: cada sesión acumula en su contexto los prompts de todos
  los trabajos que reclama, así que el coste por trabajo crece con la cola.
- En la 2.ª pasada, `security` intentó dos veces ejecutar `grep` sobre el fichero, aunque el preámbulo
  de skill-map prohíbe ejecutar código; los permisos lo bloquearon.
- **Dos intentos fallidos antes** (1,7 $ tirados, en `.spikes/moo-186/runs-failed/`): permisos. Las
  sesiones añadían `; echo $?` a los comandos `sm` (ya no casaban con `Bash(pnpm exec sm:*)`) y la
  regla `Write(<ruta relativa>)` no casaba con la ruta absoluta que usa la herramienta; hace falta
  `Write(//<ruta absoluta>/**)`. Arrancar una sesión cuesta ~0,15 $ aunque no haga nada.

## Hallazgos (P1)

57 hallazgos: 55 `info` y 2 `warn`.

| Revisión | Hallazgos | Revisión | Hallazgos |
|---|---|---|---|
| `prose-to-rules` | 25 | `trigger` | 1 |
| `vagueness` | 13 | `scope` | 1 |
| `redundancy` | 11 | `contradiction` | 0 |
| `structure` | 4 | `incoherence` | 0 |
| `verbosity` | 2 | `security`, `suspicion` | 0 |

Clasificación provisional (pendiente de que el usuario la confirme): **5 reales, 45 cosméticos, 7 falsos**.

- **Reales:** #9 `refine-story` (`warn`: en INVEST no dice si ⚠️ cuenta como fallo; su eval espera
  «al menos dos ❌»), #14 `poke-holes` («use it sparingly» sin límite), #5 `close-spike` (qué hacer con
  los cambios sin commitear según la respuesta), #27 `capture` (cuántas líneas de log), #21
  `linear.md` (quién revisa los permisos cuando Linear publica herramientas nuevas).
- **Cosméticos:** las 25 de `prose-to-rules` (pasan la prosa con su porqué a listas de comprobación;
  mismas directivas, sin cambio de conducta), las 4 de `structure`, y repeticiones y estilo. Cinco
  repeticiones son deliberadas (estimador a ciegas, puerta humana antes de Linear, la decisión es del
  usuario): quitarlas debilita reglas críticas.
- **Falsos:** #12 `trigger` (las skills llevan `disable-model-invocation: true`: la descripción no
  decide cuándo se lanzan), #17 y #18 `AGENTS.md` (criterio dejado a propósito, que la propia revisión
  excluye), #23 y #24 `course.md` (reglas del máster citadas), #2 `capturer.md` (el propio hallazgo
  admite que está resuelto), #53 `scope` en `linear.md` (las puertas viven ahí por diseño y
  `workflow.md` §4 enlaza a ellas).

Límites: cada revisión mira **un solo nodo**, así que no ve deriva entre `AGENTS.md` y
`docs/instructions/`; y no conoce el contexto del repo (claves propias de Claude Code, reglas citadas,
repeticiones deliberadas).

## Evals con los hallazgos aplicados (P2)

Solo dos hallazgos reales caen en algo con evals: #9 y #14, más `tools` como lista en `poke-holes`. Los
tres se aplicaron a una copia de `refine-story` y `poke-holes` (`.spikes/moo-186/evals/cambios.diff`), y
se pasaron los 6 casos de `refine-story` con la versión actual (línea base) y con la copia cambiada,
siguiendo `.claude/evals/README.md`. `poke-holes` se emuló en las dos versiones con un subagente
`general-purpose` en `opus` que lee su fichero (MOO-71), para que el cambio de `tools` no dependiera
de reiniciar la sesión. Lo demás no tiene evals: `close-spike` y `linear.md` no tienen ninguna, y las
de `capture` prueban `capturer.md`, no el `SKILL.md` de #27.

| | Con cambios | Versión actual |
|---|---|---|
| Afirmaciones superadas | 54/54 (100 %) | 52/54 (97,5 %) |
| Tiempo medio por caso | 127 s | 124 s |
| Tokens medios por caso | 117 k | 115 k |

- **Empate en la práctica.** Los dos fallos de la versión actual son el mismo caso límite: el ejecutor
  pasó a `poke-holes` también el título y la línea Épica/Expectativas. En la versión con cambios pasó
  lo mismo y el calificador lo dio por bueno. Es varianza del ejecutor y del calificador, no efecto de
  los cambios.
- **#9 no cambia la conducta:** con la versión actual, ejecuciones con 2-3 ⚠️ y ningún ❌ ya seguían
  adelante. El cambio deja escrito lo que el modelo ya hacía.
- **#14 no cambia la conducta:** `spec` sale 0 o 1 vez en las 6 respuestas de `poke-holes`, en las dos
  versiones.
- **`tools` como lista YAML es seguro:** probado aparte con dos subagentes de prueba; reciben las
  mismas herramientas con la lista que con el texto separado por comas.
- **Los evals no discriminan estos cambios:** ningún caso cae en la zona ambigua de #9 (0-1 ❌ con
  varios ⚠️) ni empuja a `poke-holes` a varias preguntas de diseño. Los calificadores apuntaron más
  huecos de los evals en sus `grading.json`.
- **Una ejecución contaminada, descartada:** la del caso 1 con cambios guardó una descripción idéntica
  byte a byte a la de la otra versión, 12 s después. Se repitió aislada, fuera del *workspace*. Lección
  para el README de las evals: las ejecuciones en paralelo del mismo caso pueden leerse entre sí.

## Coste de una ronda de evals (P3)

| | Valor |
|---|---|
| Ejecuciones | 12 (6 casos × 2 versiones) + 1 repetida |
| Tokens de los ejecutores | 1,39 M (válidas) + 0,14 M (contaminada) |
| Tokens de los calificadores | 0,76 M |
| Tiempo de reloj | ~7 min en paralelo (ejecución más larga 4,3 min + calificación 2 min), ~15 min con la repetición |

Las ejecuciones corrieron como subagentes de esta sesión (Opus 5.5, con `poke-holes` en `opus`), que no
dan coste en dólares, solo tokens totales.
