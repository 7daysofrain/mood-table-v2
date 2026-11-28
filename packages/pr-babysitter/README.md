# PR Babysitter

Conduce cada PR desde que se abre hasta dejarla **lista para integrar**: espera a las comprobaciones,
pide la revisión, tría cada hallazgo, arregla lo que es real y pregunta al mantenedor solo lo que exige
criterio. **El merge siempre es del mantenedor.**

El qué y el porqué están en [`docs/pr-babysitter.md`](../../docs/pr-babysitter.md) (documento `PB`:
expectativas, política de escalado, glosario). Las decisiones técnicas, en
[`docs/idea-mood-table.md`](../../docs/idea-mood-table.md) §10, de D63 en adelante. Este README solo
enseña cómo encajan las piezas.

## Quién habla con quién

![Arquitectura: GitHub, el compose con driver, grafo, triador y arreglador, Linear y el mantenedor](docs/arquitectura.svg)

- **GitHub** es la fuente de verdad. El sistema lo consulta por polling y no abre nada hacia dentro.
- **Driver:** en cada vuelta lee las PR abiertas, saca una foto de cada una y reanuda su hilo del grafo.
- **Grafo de LangGraph:** un hilo por PR, con estado entre pushes y pausas con `interrupt()`.
- **Triador:** clasifica cada hallazgo con un modelo de decisión (Clef) y reglas en código.
- **Arreglador (*fixer*):** otro servicio del mismo compose, al que el grafo pide el arreglo por HTTP
  interno y no espera bloqueado. Arregla cada hallazgo real con un agente del Claude Agent SDK y lo
  sube a la rama de la PR con su propia GitHub App, que no puede integrar.
- **Linear:** avisa al mantenedor y recoge su respuesta cuando escala.

En el código, `src/core` tiene el grafo, el driver y el triaje sin E/S; `src/adapters`, las
integraciones (GitHub, Linear, modelo de decisión, el cliente del *fixer*), y `src/main.ts` los une.
`src/fixer` es el *fixer*, con su propia raíz de composición (`src/fixer/main.ts`); de `src/core` solo
toma el contrato del trabajo, y `src/core` no sabe nada de él.

## Qué pasa con cada push

![Bucle de cada push: esperar comprobaciones, pedir revisión, esperar al revisor, triar, arreglar, contestar o escalar, publicar y volver a empezar](docs/bucle.svg)

Cada push recorre el grafo hasta un estado final. Si el arreglador publica, hay un push nuevo y el bucle
vuelve a empezar, hasta que la PR queda lista o hace falta el mantenedor. Qué hace cada nodo lo fijan las
specs [`pr-tracking`](../../openspec/specs/pr-tracking/spec.md) y
[`pr-triage`](../../openspec/specs/pr-triage/spec.md).

> A 27-nov-2026 funcionan el seguimiento, la petición de revisión, el relanzamiento, el triaje y el
> arreglo de los hallazgos reales (BH3, `MOO-77`). Faltan contestar y resolver los hilos (`MOO-78`), los
> límites de vueltas y el reintento del arreglo (`MOO-194`), y escalar (BH4).
