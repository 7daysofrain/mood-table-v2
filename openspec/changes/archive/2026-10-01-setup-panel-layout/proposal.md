# Proposal

> **Origen:** tarea *enabler* [`MOO-29`](https://linear.app/7daysofrain/issue/MOO-29/montar-el-layout-del-panel-con-sus-zonas)
> · Montar el layout del panel con sus zonas · épica técnica `MOO-27` (sin historia de producto ni H#/E#).
> Desbloquea `MOO-18`.

## Why

El panel es hoy una cáscara vacía (`<main />` en `packages/panel/src/App.tsx`). Las historias del MVP
que tocan el front (visor en `MOO-18`, tiras, efectos y controles en las de H2 y H4) necesitan un sitio
fijo donde caer. Si cada una inventa su parte de la página, el panel acaba sin estructura común y con
estilos distintos en cada zona. Esta tarea fija **la estructura del panel y la base visual** (librería
de componentes y estilos) una sola vez, antes de que llegue el primer contenido.

## What Changes

- **Las cinco zonas del panel** de README §1.3, vacías y reconocibles: **cabecera**, **visor**,
  **tiras**, **efectos** y **controles**, colocadas como en el wireframe (`docs/img/panel-wireframe.png`):
  cabecera arriba, visor a todo el ancho y debajo tiras, efectos y controles en tres columnas.
- **Una librería de componentes de UI y su sistema de estilos** instalados y configurados en `panel`,
  para que las historias construyan sus controles (slider, selector de color, desplegable) sobre la
  misma base. La elección y su porqué van en `design.md`.
- **Tests del layout**: cada zona se puede localizar por su nombre accesible, que es también el ancla
  que usarán las historias y sus E2E.

## Capabilities

### New Capabilities

- `panel-layout`: la estructura del panel web: qué zonas tiene, cómo se identifican y cómo se
  reparten la pantalla. Las historias rellenan las zonas; esta capacidad define que existan y dónde
  están.

### Modified Capabilities

Ninguna. `module-boundaries` y `quality-gates` no cambian de requisitos: el panel sigue importando
solo de `shared` y las puertas son las mismas.

## Non-goals

Tomados de la descripción de `MOO-29` («zonas vacías; cada historia rellena su zona») y del reparto
con otras tareas:

- **Contenido de las zonas**: ni tiras, ni efectos, ni controles, ni dibujo del visor (`MOO-18` y las
  historias de H2 y H4). Tampoco datos del motor en la cabecera (conexión, audio, fps).
- **Servir el build del panel desde el motor**: va en `MOO-17`, junto con el servidor que envía los
  frames. Aquí el panel se desarrolla y se prueba con Vite.
- **Aviso de estado restaurado** que aparece en el wireframe: es comportamiento de H5 (`MOO-25`), no
  una zona del panel (README §1.3 no lo cuenta entre ellas).
- **Diseño para móvil o pantalla táctil**: el panel del MVP es de escritorio (PRD §6). La interfaz
  táctil es visión (E5).
- **E2E con Playwright**: esta tarea no tiene un flujo de usuario que recorrer. El primer E2E llega
  con la primera historia que pinte algo en el panel.

## Impact

- **Código**: `packages/panel/src/` (componente raíz y zonas), `packages/panel/index.html` y
  `packages/panel/vite.config.ts` si la librería de estilos lo requiere.
- **Dependencias nuevas** en `panel`: la librería de UI y su sistema de estilos (versiones en el
  catálogo de `pnpm-workspace.yaml`), y las de test del DOM si los tests del layout las necesitan.
- **Configuración de calidad**: posibles cambios en `eslint.config.js` (alias de imports del panel),
  `vitest.config.ts` y `sonar-project.properties` (cobertura del código de componentes generado), a
  decidir en `design.md`.
- **Linear**: la descripción de `MOO-29` todavía dice «el build servido por el motor»; hay que quitarlo
  (acordado con el usuario, opción C1).
