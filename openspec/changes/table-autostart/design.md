# Design

## Context

El motivo, en `proposal.md`. Lo que hay hoy en la Pi de la mesa, comprobado por SSH el 2026-11-11:

- **Instalación a mano.** Node.js 24 en `/usr/bin/node` (de NodeSource), el repositorio clonado en
  `/home/pi/mood-table-v2`, con el panel construido. El motor se lanza con
  `node packages/engine/src/main.ts`: Node ejecuta el TypeScript directamente, como en `pnpm dev`.
- **Configuración.** `config/local.json` (la ruta por defecto del motor, `adapters/config-file.ts`)
  ya declara `server.host: "0.0.0.0"`. El valor por defecto del motor es `127.0.0.1`.
- **Usuario.** `pi` está en `dialout` (puerto serie) y en `audio` (tarjeta de sonido). También está
  en `sudo`, y mantiene la contraseña de fábrica. `/home/pi` tiene permisos `700`.
- **Orden de arranque medido en un arranque real** (segundos desde el encendido):

  ```
  38.6  puerto serie del controlador Adalight (ttyUSB0)
  39.5  tarjeta de sonido USB (snd-usb-audio)
  43.3  basic.target   <- un servicio normal arranca a partir de aqui
  43.4  sound.target
  48.0  multi-user.target
  52.9  network-online.target
  ```

  Los dos dispositivos se reconocen unos 4 s antes de que pueda arrancar el servicio. Es lo que pasó
  en ese arranque, no una garantía: los drivers se cargan cuando `udev` procesa los dispositivos
  encontrados al encender, en paralelo con el resto del arranque.
- **El motor no captura señales.** Ni `SIGTERM` ni `SIGINT` (`main.ts`): al pararlo, Node termina sin
  más, igual que hoy con `Ctrl+C`.

## Goals / Non-Goals

**Goals:**

- Una unidad de `systemd` que cumple `specs/table-service` sin tocar el código del motor.
- Un paso de registro corto y documentado, que se hace una vez.
- Una comprobación automática de lo que la spec exige de la unidad, para que nadie le añada sin
  querer un `Restart=` o una espera a la red.

**Non-Goals:**

- Generar la unidad según dónde esté instalado el instrumento, o según el usuario: es la historia de
  instalación (`install.sh`).
- Parar el motor de forma ordenada al apagar (guardar un cambio que esté pendiente de escribir):
  desenchufar no manda ninguna señal, y que la mesa sobreviva al desenchufado es `MOO-121`.

## Decisions

### 1. Una unidad de sistema fija, como `pi`, desde el clon que ya está instalado

`deploy/moodtable.service`:

```ini
[Unit]
Description=Mood Table: motor del instrumento

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/mood-table-v2
ExecStartPre=-/usr/bin/udevadm settle --timeout=30
ExecStart=/usr/bin/node packages/engine/src/main.ts
Restart=no

[Install]
WantedBy=multi-user.target
```

- **Unidad de sistema** y no de usuario (`systemctl --user`): un servicio de usuario necesita además
  activar *linger* para arrancar sin sesión, y arranca más tarde. Las dos opciones piden `sudo` una
  vez.
- **Rutas fijas** (`/home/pi/mood-table-v2`, `/usr/bin/node`). Son las del README §1.4 y las de la
  Pi. Generarlas desde la ruta del clon es trabajo de la historia de instalación, que además cambia
  el usuario.
- **Como `pi`**, porque así está instalado hoy el instrumento (decisión del DJ al explorar el change).
  `pi` ya tiene los permisos del puerto serie y de la tarjeta, y puede escribir el estado en `data/`.
  El precio está en *Risks*.
- **Sin `Environment=`**: el motor ya lee `config/local.json` por defecto. `MOODTABLE_CONFIG` sigue
  sirviendo para probar otra configuración a mano.

**Alternativa descartada: el `install.sh` completo**, con el usuario `moodtable` y el código en
`/opt`. Es la instalación, no el arranque, y el DJ la sacó de esta historia.

### 2. Esperar a `udev` antes de lanzar el motor (`udevadm settle`)

`ExecStartPre=-/usr/bin/udevadm settle --timeout=30` espera a que `udev` termine de procesar los
dispositivos encontrados al encender. Cuando acaba, el puerto serie y la tarjeta de sonido ya tienen
su driver, sin que la unidad tenga que saber qué dispositivos declara la configuración.

- **Lleva el prefijo `-`**: si `settle` agota los 30 s, el motor arranca igualmente. En el peor caso
  falla como hoy, diciendo qué no ha podido abrir, en lugar de no llegar a intentarlo.
- **No le hace falta root**: `udevadm settle` como `pi` devuelve `0` en la Pi.
- **Coste:** con los dispositivos ya reconocidos (lo medido), vuelve al momento.

**Alternativas descartadas:**

- **`After=sound.target`**: se alcanza con la primera tarjeta de sonido, y las salidas HDMI de la Pi
  también cuentan. No asegura la tarjeta USB, y no dice nada del puerto serie.
- **`After=`/`Wants=` del dispositivo de cada puerto** (`dev-serial-by\x2did-….device`): exige
  escribir en la unidad los nombres que declara la configuración, y deja de valer si esta cambia.
- **`systemd-udev-settle.service`**: hace lo mismo, pero `systemd` lo marca como obsoleto y avisa en
  cada arranque.
- **Nada, confiar en los 4 s medidos**: sin rearranque automático, perder la carrera deja la mesa a
  oscuras hasta apagarla y encenderla. Cuesta una línea evitarlo.

### 3. No esperar a la red: las dependencias por defecto y `0.0.0.0`

La unidad no lleva `After=` ni `Wants=` de `network-online.target`. Con las dependencias por defecto,
un servicio de sistema arranca tras `basic.target` (43 s en la medida), sin esperar a la red (53 s).

El panel se puede abrir en cuanto llega la red porque el motor escucha en `0.0.0.0`, todas las
interfaces, incluidas las que todavía no tienen dirección. No hay que reiniciar nada cuando la red
llega. Es configuración de la mesa (`config/local.json`), no un cambio del valor por defecto: el
`127.0.0.1` protege el panel sin contraseña en el simulador (README §2.5). El README §1.4 lo dice en
el paso de la configuración.

### 4. `Restart=no`, escrito aunque sea el valor por defecto

Es el comportamiento por defecto de `systemd`, pero se escribe para que la decisión se vea en la
unidad y el test la pueda comprobar. Si el motor no arranca (una configuración mal escrita, la
tarjeta de sonido que falta) o se cae, el servicio queda en `failed` y el motivo está en el registro
(`journalctl -u moodtable -b`). Cómo se entera el DJ sin portátil es la Q10, abierta.

### 5. Un test de la unidad y la prueba en la mesa

- **Test de Vitest** en `tooling/` (`moodtable-service.test.ts`): lee `deploy/moodtable.service` y
  comprueba lo que exige `specs/table-service` y se puede ver en el fichero:
  - se habilita en `multi-user.target`;
  - lleva el `udevadm settle` con prefijo `-`, antes de lanzar el motor;
  - no espera a la red (ni `network-online.target` ni `network.target`);
  - no se rearranca (`Restart=no`, y ninguna otra línea `Restart=`);
  - lanza `packages/engine/src/main.ts` con el usuario `pi`.

  Va en `tooling/` porque `deploy/` no es un paquete, y `tooling` ya es un proyecto de Vitest con
  tests de ficheros del repositorio (`boundaries.test.ts`).
- **Prueba en la mesa**, a mano, con un escenario por cada uno de la spec: registrar la unidad,
  desenchufar y enchufar, sin red (el router apagado o la WiFi fuera de alcance), sin la tarjeta y con
  el motor matado. Como el *journal* de la Pi es volátil (`40-rpi-volatile-storage.conf`), el
  registro de cada arranque se lee antes de volver a apagarla.

`systemd-analyze verify` no entra en CI: los runners de GitHub no tienen `/home/pi/mood-table-v2` ni
el usuario `pi`, y fallaría por eso. Se ejecuta en la Pi, en la prueba en la mesa.

### 6. Registrar la unidad: copiarla y habilitarla, documentado en el README

```bash
sudo cp deploy/moodtable.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now moodtable
```

Copiarla, y no enlazarla con `systemctl link`: el enlace apunta a `/home/pi`, que pertenece a un
usuario, y un `git checkout` de otra rama cambiaría el servicio sin que nadie lo vuelva a registrar.
El precio es que, si la unidad cambia en el repo, hay que volver a copiarla. Es una línea del README.

Sin script: son tres órdenes, y un script para tres órdenes es el comienzo del `install.sh`, que es
de la historia de instalación.

### Nueva D#

Las decisiones 1, 2 y 4 deberían ser una **D106** en `docs/idea-mood-table.md`: *la mesa arranca con
una unidad de `systemd` como `pi`, tras `udevadm settle` y sin rearranque; la tarjeta de sonido
sigue siendo obligatoria al arrancar*. Corrige lo que el README daba por hecho (`Restart=on-failure`,
el usuario `moodtable`), y deja el porqué escrito para cuando llegue la historia de instalación.

## Risks / Trade-offs

- **El motor corre como `pi`, que tiene `sudo` con la contraseña de fábrica.** Si alguien
  comprometiera el motor desde la red local, podría hacerse root. → Red doméstica de confianza y sin
  datos personales (README §2.5). Se anota como sacrificio en §2.5 hasta la historia de instalación,
  que trae el usuario propio.
- **Si el motor no arranca, la mesa queda a oscuras y el DJ no sabe por qué.** → Es la Q10. Mientras
  tanto, el motivo está en el registro del arranque, que se pierde al apagar (el *journal* es
  volátil).
- **Rutas fijas en la unidad.** Si el repositorio se clona en otra ruta, el servicio falla al
  arrancar. → El README §1.4 da la ruta en el `git clone`, y el fallo queda en el registro.
- **Un cambio de la unidad en el repo no llega solo a la Pi.** → El README dice que hay que volver a
  copiarla. `update.sh` lo resolverá.
- **Apagar con `systemctl stop` o reiniciar desde el sistema puede perder el último cambio** (el
  guardado agrupa durante 500 ms, D103), porque el motor no captura `SIGTERM`. → Igual que hoy con
  `Ctrl+C`. En la mesa se apaga desenchufando, y eso es `MOO-121`.

## Migration Plan

1. Integrar la PR.
2. En la Pi: `git pull` en `/home/pi/mood-table-v2` y los tres pasos de la decisión 6. `--now` lo
   arranca sin reiniciar. Antes, parar a mano el motor que esté corriendo, porque si no, el del
   servicio no podría abrir la tarjeta de sonido («Device or resource busy»).

**Vuelta atrás:** `sudo systemctl disable --now moodtable` y
`sudo rm /etc/systemd/system/moodtable.service`. El motor se vuelve a arrancar a mano, como hoy.
