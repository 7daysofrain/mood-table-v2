# Proposal

> **Origen:** historia [`MOO-131`](https://linear.app/7daysofrain/issue/MOO-131/enchufar-la-mesa-y-que-el-instrumento-arranque-solo)
> · Enchufar la mesa y que el instrumento arranque solo · épica **H5** · expectativa **E6**.
> Tarea: `MOO-134` (arrancar el motor como servicio al encender la Pi, `infra`).

## Why

Hoy el motor de la mesa se arranca a mano desde un portátil, por SSH. Eso contradice la expectativa
E6 («se enchufa y vuelve como estaba, sin portátil ni internet»): sin alguien que lo lance, la mesa
enchufada no pinta nada. Ya está hecho que el motor vuelva al último estado al arrancar (`MOO-25`);
falta que arranque solo al encender la Pi.

## What Changes

- **Un servicio de `systemd` para el motor** (`deploy/moodtable.service`). Al encender la Pi lanza el
  motor desde el repositorio ya instalado, con el usuario `pi` y la configuración de siempre
  (`config/local.json`).
  - **Arranca después de los dispositivos enchufados al encender** (el puerto serie del controlador
    Adalight y la tarjeta de sonido). Así no pierde la carrera contra ellos y no falla por llegar
    antes que ellos.
  - **No espera a la red.** Las tiras pintan aunque no haya red, y el panel se puede abrir en cuanto
    llega, porque el motor de la mesa escucha en todas las interfaces (`server.host`).
  - **No se rearranca solo** si el motor termina o se cuelga. El DJ lo recupera apagando y
    encendiendo la mesa (decisión del DJ al refinar `MOO-131`).
- **El paso único de registrarlo**, documentado en el README: copiar la unidad y habilitarla. Se hace
  una vez, y sobrevive a los reinicios.
- **El README deja de prometer lo que no se hace:**
  - el rearranque automático (`Restart=on-failure`, §2.1 y §2.4);
  - el usuario propio `moodtable` (§2.5): el motor corre como `pi` hasta la historia de instalación,
    y se anota como sacrificio.
- **Una pregunta abierta nueva en el PRD (§7, Q10):** si el motor no llega a arrancar (por ejemplo,
  por un fichero de configuración mal escrito o por una tarjeta de sonido que falta), ¿cómo lo sabe
  el DJ sin portátil, y qué muestra la tira mientras tanto?

## Capabilities

### New Capabilities

- `table-service`: cómo arranca el instrumento en la mesa al encenderla. Cubre que arranca sin
  intervención, después de los dispositivos enchufados al encender, sin esperar a la red y sin
  rearrancarse solo.

### Modified Capabilities

Ninguna. Los requisitos de arranque de `audio-source` (el motor no arranca si no puede abrir la
tarjeta de sonido) y de `physical-strip` (ni si no puede abrir el puerto de una tira física) se
mantienen tal cual. `engine-config` ya permite `server.host`.

## Non-goals

Tomados de la historia `MOO-131`:

- **Volver al último estado** del instrumento: ya es `MOO-25`.
- **Que la mesa sobreviva al desenchufado como sistema** (la tarjeta SD, la red, el sistema
  operativo), **y encontrar el panel en la red** (dirección o nombre fijos): `MOO-121`.
- **Publicar releases y actualizar el instrumento** (`update.sh`, despliegue continuo), **y la demo
  pública** (EC2, Caddy): otras historias.
- **Arrancar solo fuera de la Pi** (el simulador en un portátil).
- **Instalar el instrumento** (`deploy/install.sh`: usuario propio `moodtable`, Node.js,
  dependencias, build del panel y configuración): otra historia, pendiente de crear.
- **Arrancar sin la tarjeta de sonido**: si no puede abrirla, el motor no arranca, como hoy (decisión
  del DJ al explorar el change).
- **Arrancar sin el controlador Adalight y esperarlo** (Q5): `MOO-112`.
- **Rearrancar el motor si se cae o se cuelga**: el DJ apaga y enciende la mesa.

## Impact

- **Código**: ninguno en `packages/`. Ficheros nuevos en `deploy/`: la unidad del servicio.
- **Tests**: un test de Vitest que lee la unidad y comprueba lo que la spec exige de ella. Los
  escenarios completos se prueban a mano en la mesa (`design.md`, decisión 5).
- **API y dependencias**: sin cambios.
- **En la Pi**: el `config/local.json` de la mesa tiene que declarar `server.host` en `0.0.0.0` para
  que el panel se abra desde la red. Se comprueba al probar en la mesa.
- **Documentación**:
  - `README.md` §1.4 (los pasos de la mesa), §2.1 y §2.4 (sin `Restart=on-failure`) y §2.5 (el
    usuario `pi`).
  - `docs/PRD.md` §7: Q10, en el primer commit del change.
  - `docs/idea-mood-table.md`: una D# nueva (`design.md`).
  - `prompts.md`.
