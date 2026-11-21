# Spike de medir el triaje · ¿Acierta lo suficiente para dejarle arreglar?

**Spike:** [MOO-76](https://linear.app/7daysofrain/issue/MOO-76) · **Hecho:** 21-nov-2026 · **Decisiones:**
D124 (`docs/idea-mood-table.md`)

## Preguntas

0. ¿Hay bastantes hallazgos *no aplica* y *fuera* en las PR cerradas para medir la separación entre
   clases? → **Respondida: no.** Del revisor hay un solo *fuera* (#88.2), ya usado en `MOO-120`; de
   SonarQube, 3 incidencias aceptadas nuevas, todas de la misma regla. Se mide si el triaje se
   equivoca con confianza y cuánto deja al mantenedor, no la separación (BA4).
1. ¿Cuánto acierta el triaje actual, por fuente, con filas que no se usaron al escribir sus preguntas?
   → **Respondida:** con 49 filas nuevas, ningún error con confianza. El alcance del revisor acierta en
   16 de 27 y la regla de SonarQube en 3 de 19 *real*; el resto queda en *exige criterio*. Las
   comprobaciones no tienen filas nuevas.
2. ¿Qué acierto basta para dejarle arreglar en modo ensayo, y se mantiene el umbral de 0,80? →
   **Respondida:** basta con no equivocarse con confianza, y el umbral se queda en 0,80 (BQ5).

## Veredicto

**El triaje acierta lo suficiente para que el sistema empiece a arreglar en modo ensayo (`MOO-77`),
con el umbral en 0,80.**

En modo ensayo un arreglo no se publica: el mantenedor lo ve en una rama antes. El error que importa es
el que el triaje toma con confianza, y no aparece en ninguna de las 49 filas: con 0 de 49, ese error
queda por debajo del 6 % (al 95 %). Lo que no sabe lo deja en *exige criterio*, y eso tiene un precio en
volumen: un 41 % de los hallazgos del revisor y un 84 % de las incidencias de SonarQube irían al
mantenedor. Bajar el umbral a 0,70 recortaría ese volumen sin errores en esta muestra, pero casi todas
sus filas son *real*, así que no ve lo que cuesta.

## Resultados

Con el código de producción (`createDecisionModel`, `parseCodexFinding`, `around`) contra `clef:27b`,
umbral 0,80, una pasada: 101 peticiones, 392.000 tokens, unos 0,09 $.

**Revisor, 27 hilos de Codex nuevos, todos *real* y dentro del alcance de su PR:**

| Pregunta | Real | Exige criterio | No aplica |
|---|---|---|---|
| Alcance (P1 y P2, D116) | 16 | 11 | 0 |

- Ninguno sale *fuera* con confianza: P2 no pasa de 0,34. Los 11 *exige criterio* tienen P1 entre
  0,51 y 0,79.
- **«Ya arreglado» (D120).** Con el código del commit que comentó, sin arreglar: ninguno de 27 sale
  arreglado (el más alto, 0,73). Con el código del último commit de la PR, ya arreglado: 3 de 25. No se
  equivoca en el caso caro, pero casi nunca reconoce un arreglo, porque el código alrededor de la
  línea no siempre muestra dónde se arregló.

**SonarQube, 22 incidencias (D118):**

| Etiqueta | Real | Exige criterio | No aplica |
|---|---|---|---|
| Arreglada (19) | 3 | 16 | 0 |
| Aceptada (3) | 0 | 1 | 2 |

- Las dos aceptadas que salen *no aplica* (0,15 y 0,16, en la #69) son el mismo bucle que dos filas de
  D118. De las nuevas de verdad, la de la #172 sale *no aplica* (0,08) y la de la #101, *exige
  criterio* (0,44).
- Con las 8 *real* de D118 acertaba en unas 5; con estas 19, en 3. Los criterios se ajustaron a sus
  filas.

**Comprobaciones:** sin filas nuevas. `lint`, `typecheck` y SonarCloud son *real* por regla, y los 26
fallos de `test` y `e2e` del historial ya se usaron en D122.

**Con el umbral en 0,70:** el revisor pasaría a 21 de 27 *real* y SonarQube a 7 de 19, sin ningún
error en esta muestra.

## Cómo se hizo

- **Filas.** Los hilos de revisión de las 190 PR cerradas, por GraphQL: 50 de Codex, 27 en PR
  integradas sin contar los 10 que se usaron al escribir D114 y D116. Las incidencias de SonarQube de
  cada PR, de la API pública de SonarCloud (arreglada o aceptada), con su línea sacada del log de
  `sonar-issues` y el código del push en que salieron; fuera las dos de la #134, que usó D118.
- **Etiqueta:** lo que se hizo en la PR. Un hilo arreglado con un commit es *real* y dentro del
  alcance; una incidencia arreglada es *real* y una aceptada en SonarCloud, *no aplica*.
- **«Ya arreglado».** Cada hilo se pregunta dos veces como si fuera de un push anterior: con el código
  del commit que comentó (etiqueta: no) y, si se arregló con un commit, con el del último commit de la
  PR (etiqueta: sí), alrededor de la línea que GitHub le sigue.
- **Peticiones:** una por hallazgo, como en producción, con el título y la descripción de su PR.

## Límites del resultado

- **El lado *no aplica* casi no se mide:** 3 incidencias nuevas de una sola regla, y ninguna del
  revisor. El veredicto se apoya en que no hay errores con confianza en las *real*.
- **Una pasada, sin repetir.** El ruido medido en `MOO-120` es de unos 0,07: las filas cerca del corte
  pueden cambiar de clase, pero ninguna *real* se acerca al de *no aplica*.
- **Etiquetas de lo que se hizo en la PR.** Un hallazgo arreglado puede no haber hecho falta.
- **Haría cambiar el veredicto** un error con confianza en modo ensayo: un *real* que el mantenedor
  descarta o un *no aplica* que había que arreglar.

## Qué sale

- **`MOO-77` queda desbloqueada:** se puede refinar.
- **Captura:** recalibrar los criterios de la pregunta de la regla de SonarQube (D118), que acierta en
  3 de 19 incidencias *real* nuevas frente a unas 5 de 8 de las filas con las que se escribieron.

## Tiempo dedicado frente al *timebox*

½ día frente a ½ día.

## Cómo repetirlo

El prototipo se borró antes de integrar; está en
[`34604d1`](https://github.com/7daysofrain/mood-table-v2/tree/34604d1cbb539eb89bf4f503a67a12baed36f714/.spikes/moo-76),
dentro de la PR [#193](https://github.com/7daysofrain/mood-table-v2/pull/193).

```bash
git clone https://github.com/7daysofrain/mood-table-v2.git && cd mood-table-v2
git fetch origin pull/193/head && git checkout 34604d1cbb539eb89bf4f503a67a12baed36f714   # los commits de la PR no están en main
pnpm install   # el prototipo usa el código de packages/pr-babysitter
bash .spikes/moo-76/fetch-threads.sh       # hilos de las PR cerradas, a data/prs.jsonl
# con DECISION_MODEL_API_KEY en packages/pr-babysitter/.env (el prototipo lee el del checkout principal):
node .spikes/moo-76/reviewer.ts --dry      # tamaños, sin llamar
node .spikes/moo-76/reviewer.ts            # alcance y «ya arreglado» de los hilos de Codex
node .spikes/moo-76/sonar.ts               # regla de las incidencias de SonarQube
```

Las líneas de `sonar-issues` (`data/sonar-log-lines.tsv`) salen de los logs de la CI, que GitHub borra
a los 90 días; los datos de esta medida están en el commit. Las llamadas añaden líneas a `out/*.jsonl`.
