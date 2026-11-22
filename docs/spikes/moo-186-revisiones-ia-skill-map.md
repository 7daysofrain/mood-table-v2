# Spike de revisiones con IA de skill-map · ¿Mejoran el arnés sin romper sus evals?

**Spike:** [MOO-186](https://linear.app/7daysofrain/issue/MOO-186) · **Hecho:** 22-nov-2026 · **Decisiones:**
D126 (`docs/idea-mood-table.md`)

## Preguntas

1. ¿Qué hallazgos dan las revisiones con IA de skill-map sobre las skills, los subagentes, `AGENTS.md`
   y `docs/instructions/`, y cuántos son reales? → **Respondida:** 57 hallazgos con las 11 revisiones;
   **5 reales (9 %), todos de `vagueness`**, 45 cosméticos y 7 falsos.
2. ¿Aplicar los hallazgos reales de las skills y los subagentes, y `tools` como lista en `poke-holes`,
   mantiene o mejora sus evals? → **Respondida:** las **mantiene, no las mejora**. `refine-story` saca
   54/54 con los cambios y 52/54 sin ellos, un empate en la práctica; los cambios no alteran lo que hace
   el modelo.
3. ¿Cuánto cuesta una pasada de las revisiones y una ronda de evals de una skill? →
   **Respondida:** la pasada completa, 15,22 $ a precio de API y 5,4 min; solo `vagueness`, unos 1,4 $;
   una ronda de evals de una skill, unos 2,3 M tokens y unos 7 min.

## Veredicto

**Las revisiones con IA de skill-map no entran en el flujo de cada PR del arnés: solo 5 de 57 hallazgos
fueron reales, todos de `vagueness`, y aplicarlos no movió las evals de `refine-story`. Se pasa solo
`vagueness`, a mano y de vez en cuando (al cerrar una épica del arnés o tras reescribir una skill), y lo
que salga real entra como *chore* con sus evals; las otras 10 revisiones no se usan.**

Nueve de cada diez hallazgos no compensan el tiempo de revisarlos, y las 10 revisiones que no son
`vagueness` no dieron ninguno real. Las ambigüedades que `vagueness` encuentra son reales, pero el modelo
ya las resuelve bien: escribirlas no cambia su conducta en las evals. Como puerta de cada PR fallaría por
ruido casi siempre, y es probabilística (dos pasadas pueden dar hallazgos distintos). Pasar solo
`vagueness` cuesta poco más de un dólar y capta todo lo que la pasada completa captó.

## Resultados

### Hallazgos (P1)

| Revisión | Hallazgos | Reales | Revisión | Hallazgos | Reales |
|---|---|---|---|---|---|
| `prose-to-rules` | 25 | 0 | `trigger` | 1 | 0 |
| `vagueness` | 13 | **5** | `scope` | 1 | 0 |
| `redundancy` | 11 | 0 | `contradiction` | 0 | 0 |
| `structure` | 4 | 0 | `incoherence` | 0 | 0 |
| `verbosity` | 2 | 0 | `security`, `suspicion` | 0 | 0 |

- **Reales (5):** #9 `refine-story` (`warn`: en INVEST no dice si ⚠️ cuenta como fallo; su eval espera
  «al menos dos ❌»), #14 `poke-holes` («use it sparingly» para `spec`, sin límite), #5 `close-spike`
  (qué hacer con los cambios sin commitear según la respuesta), #27 `capture` (cuántas líneas de log),
  #21 `linear.md` (quién revisa los permisos cuando Linear publica herramientas nuevas).
- **Cosméticos (45):** las 25 de `prose-to-rules` pasan la prosa con su porqué a listas de comprobación,
  con las mismas directivas; las 4 de `structure` reordenan sin cambiar el sentido; el resto son
  repeticiones y estilo. Cinco repeticiones son deliberadas (estimador a ciegas, puerta humana antes de
  Linear, la decisión es del usuario): quitarlas debilita reglas críticas.
- **Falsos (7):** #12 `trigger` (las skills llevan `disable-model-invocation: true`, así que la
  descripción no decide cuándo se lanzan); #17 y #18 en `AGENTS.md` (margen de criterio dejado a
  propósito, que la propia revisión dice no marcar); #23 y #24 en `course.md` (reglas del máster
  citadas); #2 en `capturer.md` (el propio hallazgo admite que está resuelto); #53 `scope` en
  `linear.md` (las puertas viven ahí por diseño y `workflow.md` §4 enlaza a ellas).

### Evals con los hallazgos aplicados (P2)

Solo #9 y #14, más `tools` como lista en `poke-holes`, caen en algo con evals: los 6 casos de
`refine-story`. `close-spike` y `linear.md` no tienen evals, y las de `capture` prueban `capturer.md`, no
el `SKILL.md` de #27.

| | Con cambios | Versión actual |
|---|---|---|
| Afirmaciones superadas | 54/54 (100 %) | 52/54 (97,5 %) |
| Tiempo medio por caso | 127 s | 124 s |
| Tokens medios por caso | 117 k | 115 k |

- **Empate en la práctica.** Los dos fallos de la versión actual son el mismo caso límite: el ejecutor
  pasó a `poke-holes` también el título y la línea Épica/Expectativas. En la versión con cambios pasó lo
  mismo, y el calificador lo dio por bueno.
- **#9 no cambia la conducta:** con la versión actual, las ejecuciones con 2-3 ⚠️ y ningún ❌ ya seguían
  adelante. **#14 tampoco:** `spec` sale 0 o 1 vez en las 6 respuestas de `poke-holes` de las dos
  versiones.
- **`tools` como lista YAML es seguro:** con dos subagentes de prueba, uno con lista y otro con el texto
  separado por comas, los dos reciben exactamente las mismas herramientas. Quita el aviso
  `frontmatter-invalid` de `sm check`.
- **Los evals no distinguen estos cambios:** ningún caso cae en la zona ambigua de #9 (0-1 ❌ con varios
  ⚠️) ni empuja a `poke-holes` a varias preguntas de diseño.

### Coste (P3)

Coste equivalente a precio de API (`total_cost_usd` de `claude -p`). Con la cuenta del usuario
(suscripción Team) no se cobra por token: gasta de los límites de uso del plan.

| | 1.ª pasada (5 revisiones) | 2.ª pasada (6 revisiones) | Total |
|---|---|---|---|
| Trabajos | 70, 0 fallidos | 84, 0 fallidos | 154 (≈ 0,10 $ cada uno) |
| Tiempo de reloj (4 sesiones en paralelo) | 151 s | 171 s | 322 s |
| Coste | 6,67 $ | 8,55 $ | 15,22 $ |
| Tokens leídos de caché | 32,4 M | 44,9 M | 77,3 M |
| Tokens de salida | 49 k | 62 k | 111 k |

Antes hubo dos arranques fallidos, que costaron 1,7 $ (ver *Límites*).

| Ronda de evals de `refine-story` | Valor |
|---|---|
| Ejecuciones | 12 (6 casos × 2 versiones) + 1 repetida |
| Tokens de los ejecutores | 1,39 M (válidas) + 0,14 M (descartada) |
| Tokens de los calificadores | 0,76 M |
| Tiempo de reloj | ~7 min en paralelo; ~15 min con la repetición |

Las evals corrieron como subagentes de la sesión (Opus 5.5, con `poke-holes` en `opus`): dan tokens, no
dólares.

## Cómo se hizo

- **Cómo revisa skill-map (1.12.7).** Cada revisión es un *analyzer* probabilístico
  (`core/ai-<tipo>-analyzer`) que se encola con `sm jobs submit <analyzer> -n <nodo>`. skill-map no llama
  a ningún modelo: compone un prompt autocontenido (preámbulo antiinyección, instrucciones, el fichero
  dentro de `<user-content>` y el esquema JSON del informe) y lo deja en una cola SQLite. Un agente lo
  reclama (`sm jobs claim`), lo ejecuta y lo cierra con `sm record`, que valida el informe y guarda los
  hallazgos. La skill `sm-process-jobs` (`sm agent install`) enseña ese protocolo. Está pensado para un
  bucle interactivo con la UI (`sm`) y una sesión residente; aquí se usó en lote para poder medir.
- **Nodos (14):** las 6 skills, `capture/references/capturer.md`, `estimator`, `poke-holes`,
  `AGENTS.md` y los 4 de `docs/instructions/`.
- **Revisiones:** las 5 que nombraba la pregunta 1 y, con el acuerdo del usuario, las otras 6, para no
  decidir con menos de la mitad.
- **Proceso:** `.spikes/moo-186/submit.sh` encola; `.spikes/moo-186/process.sh` lanza 4 sesiones de
  Claude Code sin interfaz (`claude -p --output-format json`, Sonnet 5.5) que procesan la cola en paralelo
  y devuelven tokens, coste y duración.
- **Clasificación:** cada hallazgo contrastado con el repo por la IA y confirmado por el usuario.
- **Evals:** según `.claude/evals/README.md`, con la versión actual como línea base y una copia con los
  tres cambios. `poke-holes` se emuló en las dos con un subagente `general-purpose` en `opus` que lee su
  fichero (`MOO-71`), para que el cambio de `tools` no dependiera de reiniciar la sesión.

## Límites del resultado

- **Un nodo por revisión:** ninguna compara ficheros, así que no ven deriva entre `AGENTS.md` y
  `docs/instructions/`, que es donde más se desvía un arnés. Tampoco conocen el contexto del repo, y de
  ahí salen los 7 falsos.
- **Una sola pasada** con un solo modelo (Sonnet 5.5): otra pasada puede dar hallazgos distintos.
- **Los evals no cubren los cambios:** el empate dice que no rompen nada, no que no ayuden en casos que
  los evals no tienen.
- **Fricciones de uso en lote:** el primer intento falló por la sesión OAuth caducada; el segundo, por
  permisos (las sesiones añadían `; echo $?` a los comandos `sm` y la regla `Write(<ruta relativa>)` no
  casaba; hace falta `Write(//<ruta absoluta>/**)`). `security` intentó ejecutar `grep` aunque el
  preámbulo lo prohíbe.
- **Una ejecución de evals contaminada, descartada:** la del caso 1 con cambios guardó una descripción
  idéntica byte a byte a la de la otra versión, 12 s después; se repitió aislada. Las ejecuciones en
  paralelo del mismo caso pueden leerse entre sí.
- Haría cambiar el veredicto una revisión que compare ficheros, o que `vagueness` empiece a dar hallazgos
  que sí cambien la conducta en las evals.

## Qué sale

- Aplicar de golpe los 5 hallazgos reales de `vagueness` y `tools` como lista en `poke-holes`, con las
  evals de `refine-story` y `capture` antes de la PR. `tools` de `estimator` espera a `MOO-153`:

  ```text
  /capture Aplicar de golpe los 5 hallazgos reales de vagueness del spike MOO-186 (#9 INVEST en refine-story, #14 spec en poke-holes, #5 en close-spike, #27 en capture, #21 en linear.md) y tools como lista en poke-holes, pasando antes las evals de refine-story y capture. tools de estimator espera a MOO-153. Detalle en docs/spikes/moo-186-revisiones-ia-skill-map.md
  ```

## Tiempo dedicado frente al *timebox*

½ día frente a ½ día.

## Cómo repetirlo

El prototipo se borró antes de integrar; está en
[`c95cd45`](https://github.com/7daysofrain/mood-table-v2/tree/c95cd450cbdd1f80e566c0df5fff1f2d67901c1a/.spikes/moo-186),
dentro de la PR [#200](https://github.com/7daysofrain/mood-table-v2/pull/200), con los scripts, los
informes de las 154 revisiones, `findings.json`, el resumen de las evals (`evals/benchmark.md`,
`evals/review.html`) y el diff de los tres cambios (`evals/cambios.diff`).

```bash
git clone https://github.com/7daysofrain/mood-table-v2.git && cd mood-table-v2
git fetch origin pull/200/head && git checkout c95cd45   # los commits de la PR no están en main
pnpm install && pnpm exec sm agent install && pnpm exec sm scan --full
.spikes/moo-186/submit.sh                                              # 5 revisiones
FINDERS="incoherence structure scope prose-to-rules security suspicion" .spikes/moo-186/submit.sh
.spikes/moo-186/process.sh 4 claude-sonnet-5-5                         # necesita `claude` con sesión iniciada
pnpm exec sm findings
```
