# Spec Delta

## ADDED Requirements

### Requirement: El sistema solo escribe en GitHub sus peticiones de revisión y el resumen del triaje
Lo único que el sistema SHALL escribir en GitHub son sus peticiones de revisión y el resumen del triaje
de cada push: MUST NOT escribir otros comentarios, revisiones, commits ni merges. Su token de GitHub
MUST NOT poder integrar una PR ni subir commits.

> Traza: BE2 y D64 (el sistema no integra); `MOO-81`, *Contexto técnico* (el PAT tiene escritura en
> *Issues* y *Pull requests*, sin *Contents*); `MOO-75`, caso feliz (*la PR tiene un comentario resumen
> del sistema*). Sustituye a «El sistema solo escribe en GitHub para pedir la revisión»: change
> `pr-shadow-triage`.

#### Scenario: Una PR seguida hasta su estado final
- **GIVEN** el sistema ha seguido una PR hasta avisar de su estado final
- **WHEN** el mantenedor revisa la PR en GitHub
- **THEN** lo único hecho con el token del sistema son sus peticiones de revisión y sus resúmenes de triaje, como mucho uno de cada por push

#### Scenario: El token del sistema no puede integrar
- **GIVEN** el token de GitHub del sistema
- **WHEN** se intenta integrar una PR con él
- **THEN** GitHub lo rechaza y la PR sigue abierta

## REMOVED Requirements

### Requirement: El sistema solo escribe en GitHub para pedir la revisión
**Reason**: Para el modo sombra de BH2, el sistema publica en la PR el resumen de su triaje (`MOO-75`,
BQ2).
**Migration**: Lo sustituye «El sistema solo escribe en GitHub sus peticiones de revisión y el resumen
del triaje», que mantiene lo que protegía este requisito: nada de otros comentarios, revisiones,
commits ni merges, y un token que no puede integrar (BE2, D64). El PAT no cambia de permisos.
