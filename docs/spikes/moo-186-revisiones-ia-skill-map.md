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

## Coste de la pasada (P3)

| | Valor |
|---|---|
| Trabajos | 70 (5 revisiones × 14 nodos), 0 fallidos |
| Tiempo de reloj | 151 s con 4 sesiones en paralelo |
| Coste | 6,67 $ (1,52-2,03 $ por sesión) |
| Tokens | 32,4 M leídos de caché · 0,73 M escritos en caché · 49 k de salida |

- El coste lo domina la **lectura de caché**: cada sesión acumula en su contexto los prompts de todos
  los trabajos que reclama, así que el coste por trabajo crece con la cola.
- **Dos intentos fallidos antes** (1,7 $ tirados, en `.spikes/moo-186/runs-failed/`): permisos. Las
  sesiones añadían `; echo $?` a los comandos `sm` (ya no casaban con `Bash(pnpm exec sm:*)`) y la
  regla `Write(<ruta relativa>)` no casaba con la ruta absoluta que usa la herramienta; hace falta
  `Write(//<ruta absoluta>/**)`. Arrancar una sesión cuesta ~0,15 $ aunque no haga nada.

## Hallazgos (P1)

27 hallazgos en 12 de los 14 nodos: 25 `info` y 2 `warn`. **Ninguna contradicción**; `trigger` solo
dio uno. Sin hallazgos: `create-spike`, `estimate-story`.
