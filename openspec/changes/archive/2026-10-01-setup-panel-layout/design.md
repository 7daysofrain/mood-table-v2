# Design

## Context

`packages/panel` es una cáscara de Vite + React 19 que monta `<main />` (`MOO-28`, tarea 1.3). Su único
test renderiza en Node con `renderToStaticMarkup`: no hay entorno de DOM ni Testing Library. La
regla de fronteras deja al panel importar `shared` y dependencias externas declaradas
(`specs/module-boundaries`); la cobertura excluye solo `packages/panel/src/main.tsx` como raíz de
composición. Motivación y alcance en `proposal.md`; comportamiento exigido en `specs/panel-layout`.

Restricciones que condicionan el enfoque:

- **Sin internet** (PRD §6): el build no puede depender de CDN ni de tipografías remotas.
- **Slider fluido** (E1): los controles que lleguen después no deben pagar estilos calculados en cada
  render.
- **Base que heredan las historias**: lo que se decida aquí (librería, tema, forma de testear) lo usan
  `MOO-18` y las historias de H2 y H4 sin volver a decidirlo.

## Goals / Non-Goals

**Goals:**

- Que cada escenario de `specs/panel-layout` se compruebe con un test automático, salvo la disposición
  visual y la ausencia de peticiones externas, que se comprueban a mano en el build (decisión 6).
- Dejar a las historias un patrón claro para rellenar una zona: un componente dentro de su región,
  probado con Testing Library por su nombre accesible.

**Non-Goals:**

- **Librería de canvas del visor**: se decide en el change de `MOO-13`, que es donde se dibuja.
- **Tema claro o cambio de tema**: el panel solo tiene tema oscuro (decisión 3).
- **Tipografía propia**: se usa la pila de fuentes del sistema que trae Mantine; una fuente propia
  exigiría empaquetarla (sin internet) y no la pide nadie.

## Decisions

### 1. Librería de UI: Mantine 9

`@mantine/core` y `@mantine/hooks` (9.x, que exige React ≥ 19.2; el repo usa 19.3).

**Por qué:** trae ya hechos los controles que generará el esquema de los efectos (README §2.2),
incluido el que menos librerías tienen, el **selector de color** (`ColorPicker`/`ColorInput`), además
de `Slider` y `Select`. Desde la v7 sus estilos son **CSS estático** (sin CSS-in-JS en tiempo de
ejecución), así que mover un slider no recalcula estilos (E1). Usa la fuente del sistema y no pide
nada a internet. Es la opción que antes deja ver el panel funcionando.

**Alternativas** (comparativa completa en la exploración previa al change):

- **shadcn/ui** (Base UI + Tailwind): el código queda copiado en el repo, lo que encaja mejor con la
  propiedad del PRD (D33), pero no trae selector de color y añade Tailwind al stack, código generado
  que contaría en la cobertura de Sonar y un alias que tocar en la regla de fronteras.
- **React Aria Components**: la mejor accesibilidad y el mejor soporte táctil, con selector de color;
  más trabajo de estilos y algo menos conocida por los agentes.
- **MUI 9** y **Chakra v3**: descartadas por usar Emotion en tiempo de ejecución (peor para E1). MUI,
  además, por su peso y su estética Material; Chakra, porque los agentes mezclan las APIs de v2 y v3.

**Coste aceptado:** Mantine es una dependencia, no código propio. Se acepta a cambio de velocidad y de
tener el selector de color sin escribirlo. → **Proponer como D40** en `docs/idea-mood-table.md`.

### 2. Layout con los componentes de Mantine, sin librería de layout

`AppShell` da la estructura de página (cabecera y contenido) y `SimpleGrid` las tres columnas bajo el
visor. Cada zona es un componente `Zone` que renderiza un `<section>` con su título como encabezado y
`aria-labelledby` apuntando a él: eso le da el **nombre accesible** que exige la spec («Visor»,
«Tiras», «Efectos», «Controles»). `AppShell.Header` renderiza un `<header>`, que es la región
*banner* del escenario.

**Por qué:** el layout es fijo (README §1.3) y Mantine ya trae las piezas con el mismo sistema de
espaciado que el resto de componentes. Un solo sistema de maquetación.

**Alternativas:** CSS Grid nativo en un CSS Module (igual de corto, pero mezcla dos formas de
maquetar); `react-grid-layout` o `react-resizable-panels` (paneles que se arrastran o redimensionan:
nadie lo pide).

Va dentro de D40.

### 3. Solo tema oscuro

`MantineProvider` con `forceColorScheme="dark"`: sin selector de tema ni preferencia del sistema.

**Por qué:** el panel se usa en una mesa de DJ con poca luz, y los LEDs del visor resaltan sobre fondo
oscuro. Un solo tema supone menos código y menos casos que probar. `forceColorScheme` en lugar de
`defaultColorScheme` evita que Mantine lea o guarde la preferencia en `localStorage`. El `<html>` de
`index.html` lleva `data-mantine-color-scheme="dark"` desde el principio, para que no se vea un
destello claro antes de que React monte.

Va dentro de D40.

### 4. Dónde vive cada pieza

```
packages/panel/
  src/
    main.tsx        raíz de composición: estilos de Mantine + MantineProvider(theme) + <App />
    theme.ts        tema de Mantine (único sitio para colores y espaciados propios)
    App.tsx         <PanelLayout />
    layout/
      PanelLayout.tsx   AppShell: cabecera + visor + SimpleGrid(tiras, efectos, controles)
      Zone.tsx          <section aria-labelledby> con su título
      *.test.tsx
  test/
    setup.ts        jest-dom + simulación de matchMedia y ResizeObserver (jsdom no los trae)
    render.tsx      render de Testing Library envuelto en MantineProvider(theme)
```

El `MantineProvider` va en `main.tsx`, no en `App`: así `App` es un componente normal que los tests
envuelven con el mismo tema que producción (`test/render.tsx`), y la raíz de composición sigue sin
lógica propia (ya está excluida de la cobertura).

Las zonas, en este change, solo tienen título. Cada historia añade su contenido **dentro** de su
`Zone`, sin tocar `PanelLayout` más que para pasarle el componente.

### 5. Tests del DOM con jsdom y Testing Library

El proyecto de Vitest del panel pasa a entorno `jsdom`, con `test/setup.ts` como `setupFiles`. Se
añaden `jsdom`, `@testing-library/react`, `@testing-library/dom` y `@testing-library/jest-dom`. Es la
receta oficial de Mantine para Vitest.

Los tests buscan por **rol y nombre accesible** (`getByRole('region', { name: 'Visor' })`,
`getByRole('banner')`), los mismos selectores que usarán los E2E de Playwright de las historias.

`packages/panel/test/` queda fuera de `src/`, así que la cobertura de Vitest no lo cuenta (su
`include` es `packages/*/src/**`). En `sonar-project.properties` se saca de las fuentes
(`sonar.exclusions`) y se cuenta como test (`sonar.test.inclusions`; `sonar.tests` ya cubre
`packages`), con un comentario que explica por qué.

**Alternativa:** seguir con `renderToStaticMarkup` y comparar HTML. Descartada: ata los tests al
marcado interno de Mantine y no permite buscar por rol.

### 6. Qué se comprueba a mano

Dos escenarios de la spec no se pueden comprobar en jsdom, que no calcula el layout ni hace
peticiones reales:

- **Disposición en una ventana de escritorio**: captura del build (`vite preview`) en la PR.
- **Panel abierto sin internet**: el build en `vite preview` con la red de DevTools en *offline* para
  dominios externos, comprobando que no hay peticiones fuera de `localhost`.

Pasarán a E2E de Playwright cuando la primera historia lo monte (non-goal de este change).

### 7. Sin PostCSS por ahora

La guía de Mantine recomienda `postcss-preset-mantine`, pero solo hace falta para escribir CSS propio
con sus funciones (`rem`, `light-dark`, *mixins*). Este change no escribe CSS: todo sale de las *props*
de Mantine y de `theme.ts`. Se añade con el primer CSS Module que lo necesite.

## Risks / Trade-offs

- **[Dependencia en lugar de código propio]** → El panel depende de las versiones de Mantine. Se
  mitiga con la versión fijada en el catálogo de pnpm y con Dependabot (ya activo).
- **[Peso del bundle servido por la Pi]** → `@mantine/core` es grande, pero se importa por
  componente y Vite elimina lo que no se usa; el CSS (`@mantine/core/styles.css`) va entero. Se
  acepta: la Pi sirve ficheros estáticos en red local, y es una sola descarga.
- **[Simulaciones de jsdom]** → Simular `matchMedia` y `ResizeObserver` puede esconder un fallo que
  solo aparece en un navegador real. Lo cubren la comprobación manual (decisión 6) y, más adelante,
  los E2E.
- **[Versiones recién publicadas]** → pnpm rechaza versiones con menos de un día (`MOO-32`). Si una
  versión de Mantine o de Testing Library es demasiado reciente, se fija la anterior en lugar de
  añadir otra excepción a `minimumReleaseAgeExclude`.

## Migration Plan

No aplica: no hay usuarios ni datos. El panel pasa de `<main />` a las cinco zonas en una sola PR.
