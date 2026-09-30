# Definition of Done por tipo

> Asset de la skill `refine-story`: copia **tal cual** a la historia el bloque de su tipo (etiqueta
> **Tipo** de Linear, `linear.md` §3). Está en español porque va directo a Linear. Una vez copiado, el
> DoD de cada historia vive en Linear; cambiar este fichero no reescribe las ya refinadas. Un solo DoD
> para todo es un anti-patrón (curso, 04.6).

Común a todos los tipos: **PR con revisión humana** y **`Fixes MOO-n`** con el ID de la tarea.

## Feature

- [ ] OpenSpec change aprobado; archivado tras el merge
- [ ] Tests que cubren todos los escenarios (GIVEN/WHEN/THEN) de la historia
- [ ] Lint, tipos, E2E y quality gate de SonarQube en verde
- [ ] Glosario del PRD actualizado si aparece un término nuevo
- [ ] README actualizado si cambia el diseño, la instalación o la API (OpenAPI)

## Bug

- [ ] Test que reproduce el fallo, en rojo **antes** del arreglo (commit propio)
- [ ] El mismo test en verde tras el arreglo; ningún otro test roto
- [ ] Causa raíz anotada en la PR (qué pasó y por qué no lo pilló la suite)
- [ ] Lint, tipos y quality gate de SonarQube en verde

## Refactor

- [ ] Sin cambio de comportamiento observable: la suite pasa **sin tocar** tests de comportamiento
- [ ] Objetivo del refactor medible y cumplido (p. ej. menos acoplamiento, regla de lint núcleo ↛ adaptadores)
- [ ] Lint, tipos y quality gate de SonarQube en verde (sin empeorar deuda ni cobertura)

## Spike

- [ ] Pregunta del spike respondida con datos (medidas, prototipo o fuentes)
- [ ] Hallazgos y decisión registrados en la ficha (`docs/idea-mood-table.md`, nueva D#) y en `prompts.md` si la IA intervino
- [ ] Tiempo invertido anotado frente al *timebox* acordado
- [ ] Código del spike descartado o aislado (no llega a `main` como producto)
- [ ] Historias o preguntas del PRD (Q#, A#) afectadas actualizadas

## Chore

- [ ] El cambio funciona en CI (o en el entorno afectado) y está verificado
- [ ] Documentación de uso actualizada si cambia cómo se instala, arranca o despliega
- [ ] Sin cambios de comportamiento del producto
