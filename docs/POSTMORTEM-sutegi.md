# 🪦 Post-mortem — Sutegi Design System (idea descartada)

**Fecha de la decisión:** 09-sep-2026 · **Autor:** Joseba Alonso (JA)
**Vida de la idea:** 08-sep (seleccionada) → 09-sep (descartada). Dos días.
**Estado:** ❌ **DESCARTADA.** No se retoma sin un motivo nuevo y explícito.

> Este documento existe por dos razones: que nadie —ni Joseba ni una sesión futura de Claude—
> reabra esta discusión desde cero, y porque **un pivote razonado es material de primera para
> `prompts.md`**, que es un tercio de la nota (LIDR pide explícitamente "qué ajustes humanos hubo
> que hacer sobre el output de la IA").

---

## 1. Qué era

Un framework agéntico "one-person" para crear y mantener un design system: agentes especializados,
workflows (foundations, creación E2E de componentes), CLI, runner, motor de validación determinista
y panel de control. Detalle completo en `idea-design-system-agentico.md`.

## 2. Por qué se cayó

La idea no murió por una objeción, sino por **una cadena de objeciones que fueron desmontando la
tesis una capa cada vez**. En orden:

1. **La arquitectura hexagonal estaba sobrevendida.** Al revisarla, el dominio resultó delgado y lo
   que hacía falta era inyección de dependencias, no una capa de dominio. *(Se corrigió; el proyecto
   seguía en pie.)*
2. **El validador determinista no podía conocer la forma del componente.** React + styled-components
   y Angular + Sass no comparten nada; en CSS Modules los valores ni siquiera están en el AST del
   `.tsx`. La respuesta —un extractor por tecnología— era una fábrica de trabajo infinito.
3. **Al quitar el validador determinista, se caía la diferenciación.** La §13 decía que el hueco era
   precisamente "validación determinista sobre código, mientras los demás puntúan con IA". Sin eso,
   el producto era Tidy o FigmaLint en una terminal.
4. **Se replanteó como "Design System Ops"** con una app de escritorio (Electron) como plano de
   control, Storybook embebido para renderizar los componentes y Figma vía MCP para el diseño.
   El encuadre era mejor en producto, pero…
5. **…el bucle agéntico ya no es trabajo.** Conclusión de Joseba, y es correcta: generar el
   componente, capturarlo con Playwright, compararlo contra la imagen del MCP de Figma e iterar
   hasta que casen **se puede montar hoy con skills y un harness medianamente currado**. El proyecto
   se quedaba en ponerle una interfaz a eso.
6. **Lo que sí quedaba como ingeniería de verdad —un motor de comparación visual que atribuya la
   diferencia y la traduzca a propiedades, más el estado del sistema entre ejecuciones— era otro
   proyecto entero**, y no cabía hasta el 11-nov.

## 3. El diagnóstico (lo importante para la siguiente idea)

**El error no fue el dominio: fue el orden.** Se eligió un producto en el que **el valor central lo
entrega el modelo**, y después se fue a buscar algo difícil que construir alrededor. Por eso todo lo
que aparecía era o trivial (el bucle sobre skills) o enorme (comparación visual, análisis
multi-tecnología): no había término medio *porque no lo había por debajo*.

### Filtros para la próxima idea

| Filtro | Formulación |
|---|---|
| 🥇 **Orden correcto** | Que haya **un sistema real que construir**, y que la IA lo haga posible o mucho mejor. Si quitas la IA y no queda nada, es esta trampa otra vez. |
| 🥈 **Eje 2 primero** | La pregunta de cribado es: **¿hay código sustancioso que NO sea el bucle agéntico?** Si la respuesta tarda en llegar, mala señal. |
| ⚠️ **Vara realista** | "Que no se pueda hacer con un harness de fin de semana" **no** es un buen criterio: hoy casi todo lo agéntico se puede. Lleva a resetear una y otra vez. |
| 📅 **Alcance contra calendario** | Comprobar el encaje con las fechas ANTES de enamorarse de la idea, no después. |

## 4. Qué se conserva

- `CLAUDE.md`: bases de trabajo, criterios de LIDR, fechas y reparto de herramientas. **Intacto.**
- `PLAN-entregables.md`: el guion sección por sección de la plantilla y el método de sesiones.
  **Intacto** — solo hay que vaciar el estado.
- La disciplina de método: OpenSpec, decisiones anotadas con su porqué, verificación contra la
  plantilla, y el hábito de separar visión de MVP.
- **Todo el material de `prompts.md`**: el pivote, las rectificaciones (hexagonal → puertos), la
  criba de sacrificios de 10 a 5, y esta decisión. Es exactamente lo que pide el eje 3.
- Decisiones de stack reutilizables si la idea nueva es un CLI en Node: Commander.js 15,
  CLI no interactivo, Node 24 LTS, traza plana + `--json`. Ver §15 de la ficha de idea.

## 5. Qué se tira

El contenido de dominio: `idea-design-system-agentico.md` (se conserva como archivo histórico, no
como fuente viva) y las secciones 2.1, 2.2 y 2.3 ya escritas del `readme.md`.

## 6. Coste real

Dos días de trabajo y 16 días hasta la Entrega 1, que es **100 % documentación y no requiere
código**. Descartar hoy es barato; descartarlo el 20 de octubre habría costado el proyecto.
