# Tasks

> Una sola tarea de Linear, así que una sola sección y una sola PR. Cada paso es un commit con
> `Refs MOO-42`, salvo el último, que es de verificación. La PR lleva `Fixes MOO-42` y va **contra
> `main`**: es la primera que sigue la regla nueva.

## 1. MOO-42 · infra

- [x] 1.1 **(TDD, rojo)** Escribir `tooling/ci/sonar-issues.test.ts` con los casos de la parte pura
  (decisión 3 de `design.md`), usando respuestas de ejemplo de la API:
  - leer `ceTaskUrl` de un `report-task.txt`, y error claro si no está;
  - un estado de la tarea de cálculo: `PENDING`/`IN_PROGRESS` → seguir esperando · `SUCCESS` →
    continuar · `FAILED`/`CANCELED` → fallar diciendo que ha fallado el análisis;
  - una respuesta de `api/issues/search` con `total: 0` → pasa;
  - una con incidencias → falla, con una línea por incidencia (regla, `fichero:línea`, mensaje y
    enlace).

  Verificar: `pnpm test` falla porque el módulo aún no existe.
- [x] 1.2 **(verde)** Implementar `tooling/ci/sonar-issues.ts`, solo funciones puras y sin E/S.
  Verificar: los tests de 1.1 pasan, y `pnpm lint` y `pnpm typecheck` siguen en verde.
- [x] 1.3 Implementar `tooling/ci/check-sonar-issues.ts` (E/S, decisión 3):
  - entradas: `SONAR_TOKEN`, `PR_NUMBER`, `SONAR_REPORT_TASK` y `GITHUB_STEP_SUMMARY`;
  - consulta `ceTaskUrl` cada 5 s, con un límite de 5 min;
  - llama a `api/issues/search` con `resolved=false`;
  - una respuesta HTTP que no sea 2xx se convierte en fallo con su código, nunca en «0 incidencias».

  Meter `tooling/ci/**/*.ts` en `coverage.include` de `vitest.config.ts` y en `sonar.sources` de
  `sonar-project.properties`. Excluir `check-sonar-issues.ts` de la cobertura en los dos ficheros,
  con el comentario cruzado.

  Verificar:
  - `pnpm test:coverage` en verde, y `coverage/lcov.info` incluye `sonar-issues.ts` pero no
    `check-sonar-issues.ts`;
  - `node tooling/ci/check-sonar-issues.ts` sin variables de entorno sale con código ≠ 0 y dice qué
    variable falta.
- [ ] 1.4 CI (decisión 2):
  - en el job `test`, subir `.scannerwork/report-task.txt` como artefacto, solo si hay análisis;
  - job `sonar-issues` con `needs: test`, `if` para PR contra `main` con `SONAR_TOKEN`, instalación
    común, descarga del artefacto y `node tooling/ci/check-sonar-issues.ts`;
  - actualizar el comentario de cabecera de `ci.yml`.

  Verificar: en la PR de esta tarea, `sonar-issues` se ejecuta tras `test`, espera al análisis y está
  en verde, con el resumen «0 incidencias nuevas». Si Sonar encuentra alguna en este mismo código, se
  corrige: también es la prueba en rojo.
- [ ] 1.5 Documentar a qué rama va cada PR (requisito «Las PR de las tareas van contra main…»):
  - **`linear.md` §7:**
    - tareas desde y hacia `main`;
    - la rama de entrega es una foto que se integra con merge commit al cerrar;
    - la configuración del *ruleset* (Copilot, hilos y `sonar-issues`), con el sustituto
      `gh pr edit --add-reviewer @copilot` por si el plan no permite la regla;
    - la tarea pasa a *Done* al integrarse en `main`.
  - **`AGENTS.md`:** «Task PRs target `main`», citando `linear.md` §7.
  - **El *Purpose* de `openspec/specs/quality-gates/spec.md`:** las PR de las tareas van a `main`.
    Lo que cambian los requisitos lo aplica el archivado; el *Purpose* no.

  Verificar: `grep -rn "entrega" AGENTS.md docs/instructions/linear.md` ya no dice que las tareas
  vayan a la rama de entrega, y `pnpm exec openspec validate --specs` pasa.
- [ ] 1.6 Documentar el flujo:
  - **`workflow.md`:**
    - §4.2: la rama sale de `main`;
    - §4.4: puertas de la PR (lint, tipos, tests, *quality gate*, incidencias nuevas, Copilot e hilos
      resueltos) y el protocolo del agente con cada hallazgo de Copilot o Sonar (decisión 4);
    - §4.5: la rama `…-archivar-change` sale de `main`.
  - **`course.md` §3:** mecánica de la entrega. Antes del Typeform, PR `main` → rama de entrega con
    merge commit, comprobar que `git diff main <rama>` está vacío, y enviar el enlace `…/tree/`.

  Verificar: los enlaces entre `workflow.md`, `linear.md` y `course.md` apuntan a secciones que
  existen.
- [ ] 1.7 Registrar las decisiones:
  - en `docs/idea-mood-table.md` §10, la decisión D41 (decisión 1 de `design.md`), si el usuario la
    aprueba;
  - en README §2.4, la comprobación de incidencias nuevas entre las puertas de la CI, si §2.4 las
    enumera;
  - entrada en `prompts.md` sobre el diagnóstico de las puertas, la comprobación del plan de Sonar
    y el cambio de flujo, con el formato de `course.md` §5.

  Verificar: la entrada de `prompts.md` tiene como mucho 3 prompts literales y la línea en cursiva.
- [ ] 1.8 **Verificación en GitHub** (sin commit; decisión 5). Pasos de configuración, que hace el
  usuario:
  1. Antes de marcar la PR como lista para revisar: `copilot_code_review` (`review_on_push`, sin
     borradores) y `required_review_thread_resolution: true` en el *ruleset*.
  2. Con el job ya en la rama de la PR: `sonar-issues` como comprobación requerida.

  Comprobaciones:
  - Al marcarla como lista, Copilot la revisa sin que nadie lo pida.
  - Con un hilo de Copilot abierto, el botón de integrar está bloqueado, y al resolverlo se
    desbloquea.
  - El *quality gate* está en verde, y las incidencias y la cobertura de la PR se ven en Sonar.

  Tras integrar:
  - cambiar la base de `7daysofrain/mood-table-v2#10` a `main` y actualizar su rama;
  - `sonar-issues` se pone en rojo y lista sus 5 incidencias;
  - en una sesión nueva de Claude Code, preguntar a qué rama va la PR de una tarea: responde `main`
    citando `linear.md` §7.

  «Cierre de una entrega» se verifica al cerrar la E2 (23-oct; non-goal de esta tarea). Verificar:
  capturas o enlaces de cada comprobación en la descripción de la PR.
