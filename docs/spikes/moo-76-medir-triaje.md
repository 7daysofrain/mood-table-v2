# Spike MOO-76 · Medir el triaje contra PR ya cerradas

> Notas de trabajo del *spike* ([MOO-76](https://linear.app/7daysofrain/issue/MOO-76)). El veredicto
> se escribe al cerrarlo (`/close-spike`).

## Preguntas

0. ¿Hay bastantes hallazgos *no aplica* y *fuera* en las PR cerradas para medir la separación?
1. ¿Cuánto acierta el triaje actual, por fuente, con filas que no se usaron al escribir sus preguntas?
2. ¿Qué acierto basta para dejarle arreglar en modo ensayo, y se mantiene el umbral de 0,80?

## Datos (21-nov)

Sacados con `gh api graphql` y la API pública de SonarCloud, en `.spikes/moo-76/data/`.

- **Revisor:** 50 hilos de Codex en 29 PR cerradas. Todos son *real* salvo uno *fuera* (#88.2), que
  ya se usó en `MOO-120`. De los 50, 10 se usaron al escribir las preguntas de alcance (D114, D116).
- **SonarQube:** las incidencias de las PR resueltas en SonarCloud, con su línea sacada del log de
  `sonar-issues` y el código del push en que salieron. Sin las dos de la #134, que se usaron al
  escribir D118, quedan 22: 19 arregladas (*real*) y 3 aceptadas (*no aplica*), todas de la misma
  regla (S9382, `await` en un bucle). Dos más de la #69 son el mismo bucle que dos filas de D118.
- **Comprobaciones:** los 26 fallos de `test` y `e2e` del historial ya se midieron al escribir D122.

## Resultados (21-nov, `clef:27b`, umbral 0,80, una pasada)

Con el código de producción (`createDecisionModel`, `parseCodexFinding`, `around`): 101 peticiones,
392.000 tokens, unos 0,09 $.

**Revisor, 27 hilos nuevos, todos *real* y dentro del alcance:**

| Pregunta | Real | Exige criterio | No aplica |
|---|---|---|---|
| Alcance (P1 y P2, D116) | 16 | 11 | 0 |

- Ninguno sale *fuera* con confianza: P2 no pasa de 0,34. Los 11 *exige criterio* tienen P1 entre
  0,51 y 0,79.
- **«Ya arreglado» (D120)**, con el código del commit que comentó (no está arreglado): 0 de 27 dicen
  que sí; el más alto, 0,73. Con el código del último commit de la PR, tras un arreglo: 3 de 25 dicen
  que sí. No se equivoca en el caso caro, pero casi nunca reconoce un arreglo: el código alrededor de
  la línea no siempre muestra dónde se arregló.

**SonarQube, 22 incidencias (D118):**

| Etiqueta | Real | Exige criterio | No aplica |
|---|---|---|---|
| Arreglada (19) | 3 | 16 | 0 |
| Aceptada (3) | 0 | 1 | 2 |

- Las dos aceptadas que salen *no aplica* (0,15 y 0,16) son el mismo bucle que dos filas de D118. De
  las nuevas de verdad, #172 sale *no aplica* (0,08) y #101 *exige criterio* (0,44).
- Con las 8 *real* de D118 acertaba en unas 5; con estas 19, en 3. Los criterios se ajustaron a sus
  filas.

**Comprobaciones:** sin filas nuevas. `lint`, `typecheck` y SonarCloud son *real* por regla, y los 26
fallos de `test` y `e2e` del historial ya se usaron en D122.

**Con el umbral en 0,70:** el revisor pasaría a 21 de 27 *real* y SonarQube a 7 de 19, sin ningún
error en esta muestra. Pero casi todas las filas son *real*, así que la muestra no ve el coste de
bajarlo (un *no aplica* que sale *real*).

## Veredicto acordado (21-nov)

El usuario elige mantener el umbral en 0,80 y que `MOO-77` arranque en modo ensayo: no hay ningún
error con confianza en 49 filas nuevas, y en modo ensayo un error no se publica. El precio es el
volumen que llega al mantenedor. Sale una captura: recalibrar los criterios de la pregunta de la regla
de SonarQube (D118), que acierta en 3 de 19 incidencias *real* nuevas.
