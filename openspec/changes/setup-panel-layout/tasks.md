# Tasks

> Una sola tarea de Linear, así que una sola sección y una sola PR. Cada paso es un commit con
> `Refs MOO-29`; la PR lleva `Fixes MOO-29` y va contra `feature/entrega-2-JA`.

## 1. MOO-29 · panel

- [x] 1.1 Instalar Mantine (decisión 1 de `design.md`): `@mantine/core` y `@mantine/hooks` 9.x en el
  catálogo de `pnpm-workspace.yaml` y en `packages/panel` (`"catalog:"`); `src/theme.ts` con el tema;
  `main.tsx` importa `@mantine/core/styles.css` y envuelve `<App />` en
  `MantineProvider` con `forceColorScheme="dark"`; `index.html` con
  `data-mantine-color-scheme="dark"` en `<html>` (decisión 3). Si una versión tiene menos de un día,
  fijar la anterior, sin nuevas excepciones de antigüedad. Verificar: `pnpm install`, `pnpm lint`,
  `pnpm typecheck` y `pnpm --filter @moodtable/panel build` pasan, y el test actual sigue en verde.
- [x] 1.2 Montar los tests del DOM (decisión 5): `jsdom`, `@testing-library/react`,
  `@testing-library/dom` y `@testing-library/jest-dom` en el catálogo y en `panel`; entorno `jsdom` y
  `setupFiles` en el proyecto de Vitest del panel; `packages/panel/test/setup.ts` (jest-dom y
  simulación de `matchMedia` y `ResizeObserver`) y `packages/panel/test/render.tsx` (render envuelto
  en `MantineProvider` con el mismo tema y esquema que `main.tsx`); `packages/panel/test/` añadido a
  `sonar.tests` y `sonar.exclusions` con comentario cruzado. Pasar el test de `App` de
  `renderToStaticMarkup` a Testing Library. Verificar: `pnpm test:coverage` en verde, y
  `coverage/lcov.info` no incluye ficheros de `packages/panel/test/`.
- [x] 1.3 **(TDD, rojo)** Escribir los tests de `specs/panel-layout` en
  `src/layout/PanelLayout.test.tsx`: hay exactamente una región con cada nombre («Visor», «Tiras»,
  «Efectos», «Controles») y una cabecera (*banner*) y ninguna región más; el título del visor es
  «Visor»; el orden en el documento es cabecera, visor, tiras, efectos, controles; cada zona solo
  contiene su título; renderizar no escribe nada en `console.error`. Verificar: los tests fallan
  porque `PanelLayout` aún no existe o no tiene las zonas.
- [x] 1.4 **(verde)** Implementar `src/layout/Zone.tsx` (`<section>` con título y `aria-labelledby`)
  y `src/layout/PanelLayout.tsx` (`AppShell` con la cabecera «Mood Table», el visor a todo el ancho y
  `SimpleGrid` de tres columnas con tiras, efectos y controles), y montarlo desde `App.tsx`
  (decisiones 2 y 4). Verificar: los tests de 1.3 pasan y `pnpm lint`, `pnpm typecheck` y
  `pnpm test:coverage` siguen en verde.
- [ ] 1.5 Comprobación manual en el build (decisión 6): `pnpm --filter @moodtable/panel build` y
  `vite preview`; en una ventana de escritorio, el visor ocupa el ancho bajo la cabecera y las tres
  zonas aparecen en columnas debajo; en la pestaña de red de DevTools no hay peticiones a dominios
  distintos de `localhost`, y con la red en *offline* tras la primera carga la página se repinta igual.
  Verificar: captura de la página y de la pestaña de red, para adjuntar a la PR.
- [ ] 1.6 Documentar: en README §2.1, la fila del panel en la tabla del stack incluye Mantine y el
  tema oscuro; en `docs/idea-mood-table.md` §10, la decisión D40 (Mantine como librería de UI, layout
  con sus componentes y solo tema oscuro, con las alternativas de `design.md`) si el usuario la
  aprueba; entrada en `prompts.md` sobre la elección de la librería (exploración, comparativa y
  decisión). Verificar: los enlaces de README y ficha apuntan a secciones que existen.
