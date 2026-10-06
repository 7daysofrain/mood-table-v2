# Design

## Context

La motivación está en `proposal.md`, en *Why*. El estado del que se parte:

- **CI** (`.github/workflows/ci.yml`, decisión 6 del change archivado
  `2026-10-01-setup-monorepo-quality-gates`):
  - tres jobs: `lint`, `typecheck` y `test`;
  - `test` lanza el análisis con `SonarSource/sonarqube-scan-action@v8`, sin esperar al resultado;
  - SonarQube Cloud publica aparte la comprobación *SonarCloud Code Analysis*.
- **El *ruleset* «ramas de integración»** cubre `~DEFAULT_BRANCH` y `refs/heads/feature/entrega-*`:
  - exige `lint`, `typecheck`, `test` y *SonarCloud Code Analysis*;
  - exige una PR, pero 0 aprobaciones, y no exige resolver hilos;
  - permite los tres métodos de integración.
- **`main` contiene ya toda la E2** (PR `7daysofrain/mood-table-v2#11`, con merge commit), así que hoy
  su contenido coincide con el de `feature/entrega-2-JA`.
- **SonarQube Cloud, plan gratuito:**
  - solo deja usar *Sonar way*: los *quality gates* propios son de los planes Team y Enterprise
    ([documentación](https://docs.sonarsource.com/sonarqube-cloud/standards/managing-quality-gates/managing-custom-quality-gates));
  - solo enseña los datos de las PR contra `main`.
- **`tooling/`** es un paquete del workspace con su proyecto de Vitest. Hoy solo tiene tests: no está
  en la cobertura (`coverage.include` es `packages/*/src/**`) ni en `sonar.sources`.

## Goals / Non-Goals

**Goals:**

- Que una incidencia nueva de Sonar ponga la PR en rojo, sin plan de pago.
- Que las puertas nuevas, Copilot y los hilos, no dependan de que alguien se acuerde de pedirlas.
- Que el código nuevo de la CI cumpla las mismas reglas que el del producto: tests, cobertura y
  análisis de Sonar.

**Non-Goals:**

- Hacer que el *quality gate* de Sonar tenga en cuenta las incidencias. La comprobación nueva va al
  lado del gate y no lo sustituye.
- Restringir los métodos de integración del *ruleset* (ver Riesgos).
- Analizar en Sonar el resto de `tooling/`: los tests de fronteras siguen siendo solo tests.

## Decisions

### 1. Las tareas se integran en `main`; la rama de entrega es una foto

Ahora el flujo es: tarea → `main` por PR. Al cerrar la entrega, una PR `main` →
`feature/entrega-N-JA` integrada con **merge commit**. Como en `main` no entra nada que no venga de
la entrega, el contenido de las dos ramas coincide (`git diff main feature/entrega-N-JA` vacío). Los
commits no coinciden: la rama de entrega se queda con un merge commit de más, y eso no importa.

- **`final-project-JA` (E3)** no existe todavía. La primera foto puede ser crear la rama desde
  `main` en lugar de una PR. Se decide al cerrar la E3; no cambia la spec, que habla de las ramas que
  ya existen.
- **El *ruleset*** sigue protegiendo las dos ramas con las mismas comprobaciones. La CI sigue
  disparándose en las dos, sin cambios en `on:`.
- **Alternativas:**
  - Mantener las tareas contra la rama de entrega y pagar Sonar: descartada, es un non-goal de la
    tarea.
  - Mirar las incidencias desde la rama de entrega después de integrar: descartada, porque se
    detectan tarde, cuando el código ya está dentro.
- **Propuesta de D#:** como **D41** («las tareas se integran en `main`; la rama de entrega es una
  foto»), con el porqué de Sonar.

### 2. Incidencias nuevas: job propio que consulta la API de SonarQube Cloud

Job `sonar-issues` en `ci.yml`:

- **Cuándo se ejecuta:** `needs: test` y `if: github.event_name == 'pull_request' &&
  github.base_ref == 'main' && <hay SONAR_TOKEN>`.
- **Dos pasos:**
  1. **Esperar al análisis.** El job `test` sube `.scannerwork/report-task.txt` como artefacto. Ese
     fichero lo escribe el escáner y trae `ceTaskUrl`. `sonar-issues` lo descarga y consulta esa URL
     hasta que la tarea de cálculo queda en `SUCCESS`. Si termina en `FAILED` o `CANCELED`, o si pasan
     **5 minutos**, falla con un mensaje que lo dice: falla por el análisis, no por las incidencias.
  2. **Contar las incidencias.** Llama a `api/issues/search?componentKeys=<proyecto>&pullRequest=<n>&resolved=false`.
     En el análisis de una PR, todas las incidencias son de código nuevo. `resolved=false` deja fuera
     las aceptadas y los falsos positivos. Si `total > 0`, lista cada una (regla, `fichero:línea`,
     mensaje y enlace a Sonar) en el log y en el resumen del job, y falla.
- **Por qué un job y no un paso de `test`:** el CI separa los jobs para que la PR diga *qué* ha
  fallado y para poder hacerlos requeridos uno a uno (`ci.yml`, cabecera). `test` en rojo seguiría
  significando «un test ha fallado».
- **Por qué el artefacto y no `sonar.qualitygate.wait=true`:** esa opción haría esperar al escáner,
  pero también pondría `test` en rojo cuando falla el gate, y el gate ya tiene su propia comprobación.
- **Fuera de `main`** (la PR de la foto) el job no se ejecuta, porque Sonar gratis no daría los datos.
  GitHub da por superada una comprobación requerida cuando su job se salta por `if`. Así la PR de la
  foto pasa «las mismas comprobaciones», y su código ya se revisó en las PR contra `main`.
- **Alternativas:**
  - *Quality gate* propio con «New issues > 0»: no lo permite el plan gratuito.
  - `SonarSource/sonarqube-quality-gate-action`: solo mira el gate, que no ve las incidencias.
  - El *webhook* de Sonar hacia GitHub: necesita un servicio que lo reciba.

### 3. El script, en TypeScript, con su parte pura probada

El script va en `tooling/ci/`, con el mismo patrón que D38:

- **`tooling/ci/sonar-issues.ts` (puro):**
  - lee `report-task.txt`;
  - decide qué hacer con un estado de la tarea de cálculo: seguir esperando, continuar o fallar;
  - convierte la respuesta de `api/issues/search` en el resultado: pasa o falla, y las líneas del
    informe.
  - Tests en `tooling/ci/sonar-issues.test.ts`, con respuestas de ejemplo de la API.
- **`tooling/ci/check-sonar-issues.ts` (E/S):** lee las variables de entorno (`SONAR_TOKEN`, número
  de PR, ruta del informe), hace los `fetch`, espera entre consultas, escribe en
  `$GITHUB_STEP_SUMMARY` y fija el código de salida. Node 24 lo ejecuta directamente
  (`node tooling/ci/check-sonar-issues.ts`, con *type stripping*), sin compilar ni añadir
  dependencias.
- **Cobertura y Sonar:**
  - `tooling/ci/**/*.ts` entra en `coverage.include` y en `sonar.sources`;
  - `check-sonar-issues.ts` queda excluido de la cobertura en los dos sitios, con el comentario
    cruzado que ya existe (como las raíces de composición).
  - Así el código que decide si una PR entra cumple el mismo ≥ 80 %.
- **Alternativa:** `curl` + `jq` en el YAML. Son menos líneas, pero lógica sin tests en la puerta que
  juzga a los demás, y la espera con reintentos en bash es frágil.
- **Ficha:** no hace falta una D# nueva, porque aplica D38 a la CI.

### 4. Copilot y los hilos, en el *ruleset*

El usuario añade al *ruleset* «ramas de integración»:

- la regla `copilot_code_review`, con `review_on_push: true` y `review_draft_pull_requests: false`;
- `required_review_thread_resolution: true` en la regla `pull_request`;
- `sonar-issues` (GitHub Actions) en `required_status_checks`.

Es configuración de la cuenta, no del repo, como el *ruleset* original. Queda documentada en
`linear.md` §7.

- **Por qué no un check de «OK de Copilot»:** Copilot no puede aprobar ni pedir cambios, porque sus
  revisiones son siempre *Commented*. La puerta real es «todos los hilos resueltos».
- **Protocolo del agente con cada hallazgo** (`workflow.md` §4.4):
  1. Lo verifica contra el código, sin darlo por bueno.
  2. Lo arregla con un commit, o contesta en el hilo por qué no aplica.
  3. Resuelve el hilo.
- **En Sonar**, lo mismo: lo corrige, o lo marca como aceptado con el motivo.

### 5. Orden de la puesta en marcha

1. Configurar en el *ruleset* Copilot y los hilos **antes de abrir la PR de esta tarea**. Así la
   propia PR es la primera prueba del escenario de Copilot.
2. Añadir `sonar-issues` como comprobación requerida **cuando el job ya esté en la rama de la PR**.
   Antes, GitHub esperaría un check que nadie publica.
3. Integrar esta PR (merge commit).
4. Cambiar la base de `7daysofrain/mood-table-v2#10` a `main` y actualizar su rama desde `main`.
   Así recibe el job y sus 5 incidencias la ponen en rojo. Es la verificación del escenario «PR con
   una incidencia nueva».

## Risks / Trade-offs

- **[El plan de GitHub no permite la regla `copilot_code_review`]** → sustituto: el agente pide la
  revisión al abrir la PR con `gh pr edit <n> --add-reviewer @copilot`, documentado en
  `workflow.md` §4.4. El escenario «sin que nadie lo pida» dejaría de cumplirse y se cambiaría con
  `/opsx:update`. Se comprueba en el paso 1 de la puesta en marcha.
- **[Copilot no revisa sin avisar]** La regla solo pide la revisión si el autor tiene acceso a Copilot
  code review y le quedan peticiones *premium* del mes. Sin revisión no hay hilos, así que ninguna
  puerta lo detecta → antes de integrar, el agente comprueba que la PR tiene una revisión de Copilot
  del último push. Si no la tiene, la pide a mano o se lo dice al usuario.
- **[Una PR antigua sin el job `sonar-issues`]** Una PR cuya rama no lo tiene se queda esperando ese
  check requerido → se actualiza la rama desde `main`. Hoy solo afecta a la #10, que se actualiza de
  todos modos.
- **[Tiempo de espera de 5 minutos]** Una cola lenta en SonarQube Cloud pone la PR en rojo sin culpa
  del código → el mensaje dice que es un *timeout* del análisis, y basta con relanzar el job. Si
  ocurre a menudo, se sube el límite.
- **[`SONAR_TOKEN` con permisos de lectura de incidencias]** El token de análisis es de usuario y lee
  el proyecto. Si fuera un token de proyecto sin permiso de lectura, la API respondería 401/403 → el
  script falla con ese código en el mensaje, y nunca se interpreta como «0 incidencias».
- **[Escapar de la puerta marcando incidencias como aceptadas]** Es la válvula intencionada, igual
  que resolver un hilo de Copilot. Queda registrada en Sonar con autor y motivo.
- **[Integrar la foto con squash o rebase por error]** El *ruleset* permite los tres métodos, y un
  squash rompería la coincidencia de historia, aunque no la de contenido → el método queda escrito en
  `course.md` §3. Restringir a solo merge commit en el *ruleset* afectaría también a las PR de las
  tareas. Se deja anotado, sin cambiarlo aquí.
- **[Dependabot]** Sus PR ya iban a `main`, así que ahora pasan también por `sonar-issues` y Copilot.
  El secreto de Dependabot ya existe.

## Migration Plan

Los pasos están en la decisión 5. Para volver atrás:

1. Revertir la PR.
2. Quitar `sonar-issues` de las comprobaciones requeridas.
3. Desactivar las dos opciones del *ruleset*.

Las ramas de las tareas en curso (solo la #10) ya apuntan a `main`.
