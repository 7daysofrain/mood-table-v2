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
- **SonarQube:** incidencias de las PR resueltas en SonarCloud: 22 arregladas (*real*) y 6 aceptadas
  (*no aplica*). D118 se escribió con 12 filas, 4 de ellas aceptadas.
- **Comprobaciones:** los 26 fallos de `test` y `e2e` del historial ya se midieron al escribir D122.
