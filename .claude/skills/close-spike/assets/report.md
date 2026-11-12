# Spike de <tema> · ¿<la pregunta principal>?

**Spike:** [MOO-n](https://linear.app/7daysofrain/issue/MOO-n) · **Hecho:** <fecha> · **Decisiones:**
D# (`docs/idea-mood-table.md`)

## Preguntas

1. ¿…? → **Respondida:** <respuesta en una frase> | **Cerrada sin respuesta:** <lo aprendido; queda
   Q# o captura>

## Veredicto

**<La decisión, en una frase.>**

<El porqué, con las cifras o las fuentes que lo sostienen.>

## Resultados

<Los datos: tablas, medidas, lo que devolvió el prototipo. Solo lo que sostiene el veredicto.>

## Cómo se hizo

<Condiciones y método: dónde, con qué, qué más corría. Lo justo para que otro pueda fiarse del
resultado o repetirlo.>

## Límites del resultado

<Lo que esto no demuestra, y qué haría cambiar el veredicto.>

## Qué sale

- <historia, bug o captura que abre el veredicto>
- <historia que el *spike* bloqueaba y ya se puede refinar>

## Tiempo dedicado frente al *timebox*

<n> día(s) frente a <½ | 1 | 2> día(s). <Por qué se desvió, si se desvió.>

## Cómo repetirlo

El prototipo se borró antes de integrar; está en
[`<sha corto>`](https://github.com/7daysofrain/mood-table-v2/tree/<sha>/.spikes/moo-n), dentro de la
PR [#N](https://github.com/7daysofrain/mood-table-v2/pull/N).

```bash
git clone https://github.com/7daysofrain/mood-table-v2.git && cd mood-table-v2
git fetch origin pull/N/head && git checkout <sha>   # los commits de la PR no están en main
cd .spikes/moo-n && <cómo se ejecuta>
```

<Omite «Resultados», «Cómo se hizo» y «Cómo repetirlo» si el spike no midió nada ni dejó prototipo
(p. ej. uno que solo consultó fuentes); el resto va siempre.>
