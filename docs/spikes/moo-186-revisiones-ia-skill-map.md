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
