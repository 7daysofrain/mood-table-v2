# Proposal

> **Origen:** historia [`MOO-137`](https://linear.app/7daysofrain/issue/MOO-137/instalar-el-instrumento-en-la-mesa-con-un-solo-script)
> · Instalar el instrumento en la mesa con un solo script · épica **H5** · expectativa **E6**.
> Tareas: `MOO-143` (instalar en una Pi limpia con un solo comando, `infra`) y `MOO-144` (reinstalar
> sobre una instalación existente, `infra`).

## Why

Hoy instalar el instrumento en una Raspberry es una lista de pasos a mano (README §1.4): instalar
`git` y Node.js 24, clonar, instalar dependencias, construir el panel, escribir `config/local.json`
y registrar la unidad de `MOO-131`. Además, el motor corre como `pi`, que tiene `sudo` (lo anotó como
sacrificio el change `table-autostart`). Esta historia lo deja en un solo comando que cualquier maker
puede lanzar en su Pi recién instalada, con un usuario propio que solo llega al hardware que necesita.

## What Changes

- **Un script de instalación** (`deploy/install.sh`) que el maker lanza por SSH con un solo comando
  (`curl … | sudo bash`), sin clonar antes el repositorio. En una Pi recién instalada:
  - instala Node.js 24 (NodeSource) y `git`;
  - crea el **usuario propio** `moodtable`, de sistema, con acceso al puerto serie (`dialout`) y a la
    tarjeta de sonido (`audio`), y sin permisos de administrador;
  - clona `main` en `/opt/moodtable` (clon superficial), instala las dependencias y construye el
    panel;
  - deja un **fichero de configuración base**: el de la demo (una tira virtual y un fichero de audio
    de ejemplo) escuchando en todas las interfaces, para que el panel se abra desde la red local;
  - registra y arranca la unidad de `systemd` de `MOO-131`, que pasa a `moodtable` y a
    `/opt/moodtable`.
- **Reinstalar sobre una instalación existente**, sea la del propio script o la anterior de la mesa
  (el clon en `/home/pi` que lanza la unidad como `pi`). Antes de tocar nada, el script pregunta si
  conservar o sobrescribir el fichero de configuración:
  - **conservar**: la instalación nueva se queda con ese fichero;
  - **sobrescribir**: usa el fichero base y deja una copia del anterior con extensión `.bck`.

  En los dos casos el estado del instrumento empieza de cero. El clon de `/home/pi` no se borra: el
  script avisa de que el servicio ya no lo usa.
- **La unidad `deploy/moodtable.service`** pasa al usuario `moodtable` y a `/opt/moodtable`. Sus
  requisitos (`table-service`) no cambian.
- **ShellCheck en `pnpm lint`**, para que el script no pueda integrarse con errores típicos de bash,
  en local y en la CI por igual.
- **En el PRD** (primer commit del change):
  - §6.2: la excepción a «un solo lenguaje, TypeScript» se amplía al script de instalación
    (decisión del maker al explorar), y «funciona sin internet» se precisa como restricción de uso,
    no de instalación;
  - §7: nueva **Q12**, «¿qué versión instala el script?», contestada al explorar: lo último de
    `main`, mientras no haya versiones publicadas;
  - §8: «script de instalación» y «usuario propio» entran en el glosario.

## Capabilities

### New Capabilities

- `table-install`: cómo se instala y se reinstala el instrumento en una Raspberry: con un solo
  comando, con un usuario propio sin permisos de administrador, con un fichero de configuración base
  que funciona sin hardware y conservando o sobrescribiendo la configuración al reinstalar.

### Modified Capabilities

Ninguna. `table-service` sigue igual: la unidad cambia de usuario y de ruta, pero no lo que exige su
spec (arrancar al encender, tras los dispositivos, sin esperar a la red, sin rearranque).
`engine-config` tampoco cambia: `server.host` sigue siendo `127.0.0.1` por defecto, y es el script
quien lo pone en `0.0.0.0` en la mesa. `quality-gates` ya exige lint en local y en la CI; ShellCheck
entra dentro de `pnpm lint`.

## Non-goals

Tomados de la historia `MOO-137`:

- **Que el motor arranque al encender** (la unidad de `systemd`, sin rearranque): es `MOO-131`.
- **Actualizar a una versión nueva** (`update.sh`, releases, despliegue continuo) **y la demo
  pública** (EC2, Caddy): otras historias.
- **Que la mesa sobreviva al desenchufado como sistema** (la SD, la red): es `MOO-121`.
- **Instalar el sistema operativo y montar el hardware**: `HARDWARE_SETUP.md`.
- **Pasar el estado del instrumento de la mesa actual** (el clon en `/home/pi`) a la instalación
  nueva: el script la trata como cualquier instalación existente.
- **Una imagen de SD lista para grabar**: se valoró al refinar y se descartó para esta historia.

## Impact

- **Código**: ninguno en `packages/`. En `deploy/`: el script nuevo y la unidad, con otro usuario y
  otra ruta. En la raíz: `pnpm lint` añade ShellCheck, con una dependencia de desarrollo nueva.
- **Tests**: el test de la unidad (`tooling/moodtable-service.test.ts`) pasa al usuario y la ruta
  nuevos. El script se prueba con ShellCheck y, sus escenarios, a mano en la Pi de la mesa, sobre una
  copia de la SD (`design.md`, decisión 8).
- **API**: sin cambios.
- **En la mesa**: el servicio deja de correr como `pi` desde `/home/pi/mood-table-v2` y pasa a
  `moodtable` desde `/opt/moodtable`. El clon de `/home/pi` se queda para desarrollar, con el
  servicio parado mientras se usa `pnpm dev`.
- **Documentación**:
  - `README.md` §1.4 (los pasos de la mesa pasan a un solo comando), §2.4 (proceso de despliegue y
    servicio) y §2.5 (el usuario propio deja de ser un sacrificio).
  - `docs/PRD.md` §6.2, §7 (Q12) y §8, en el primer commit del change.
  - `docs/idea-mood-table.md`: una D# nueva (`design.md`).
  - `prompts.md`.
