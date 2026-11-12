# Design

## Context

El motivo, en `proposal.md`. Lo que hay hoy, en el código y en la Pi de la mesa:

- **Instalar es tener el repositorio entero.** La unidad lanza `node packages/engine/src/main.ts`:
  Node ejecuta el TypeScript directamente, el motor importa `@moodtable/shared` por el enlace del
  *workspace* (hace falta `pnpm install`) y sirve el build del panel desde `packages/panel/dist`
  (hace falta construirlo). El `engines` de la raíz exige Node `>=24.15 <25`, con `engineStrict`; el
  Raspberry Pi OS de la mesa (trixie) trae Node 20.
- **Rutas relativas a la raíz del repositorio.** `config/local.json` (siempre, D44), el fichero de
  audio de `config/demo.json` y el estado del instrumento, que por defecto va a
  `data/instrument-state.db` (`InstrumentStateConfigSchema`). Borrar el estado es borrar `data/`.
- **`server.host` vale `127.0.0.1` por defecto** (decisión 13 del change del panel), y `demo.json` no
  lo declara: con la demo tal cual, el panel solo se abre desde la propia Pi.
- **La mesa hoy** (design de `table-autostart`): Node 24 de NodeSource en `/usr/bin/node`, el clon en
  `/home/pi/mood-table-v2` (con permisos `700`), y `deploy/moodtable.service` registrada en
  `/etc/systemd/system/` como `pi`. El usuario `pi` tiene `sudo`.
- **El test de la unidad** (`tooling/moodtable-service.test.ts`) comprueba hoy `User=pi` y
  `WorkingDirectory=/home/pi/mood-table-v2`.

## Goals / Non-Goals

**Goals:**

- Un solo fichero, `deploy/install.sh`, que cumple `specs/table-install` en una Pi limpia y sobre una
  instalación existente.
- Que un fallo a mitad de la instalación no deje la instalación existente rota.
- Que el script no pueda integrarse con errores típicos de bash.

**Non-Goals:**

- Elegir la versión que se instala más allá de una rama o etiqueta de git: no hay releases
  (`update.sh` es otra historia).
- Detectar instalaciones que no sigan uno de los dos modelos conocidos (la del script en
  `/opt/moodtable` o un clon lanzado por la unidad de `MOO-131`).
- Tests automáticos del script más allá del análisis estático (decisión 8).

## Decisions

### 1. Un solo script de bash, como excepción a «un solo lenguaje»

El script lo es todo: instala Node, clona, construye y registra el servicio. Va en bash porque, cuando
el maker lanza el `curl`, Node todavía no existe en la Pi, y porque el maker prefiere una sola pieza
en este punto (decisión al explorar). La excepción de PRD §6.2 se amplía al script de instalación.

- **Descartado, de momento: arranque mínimo en bash + instalador en TypeScript.** Dejaría la lógica
  con criterio (detectar, preguntar, la copia `.bck`) con tests de Vitest y cobertura, que es lo que
  pide la DoD. Son dos piezas en lugar de una. Si la lógica de reinstalar crece, se pasa a este modelo.

### 2. Clon superficial de una rama de git, `main` por defecto

`git clone --depth 1 --branch <ref>` del repositorio público. `<ref>` es `main` salvo que el maker
pase otra rama o etiqueta como argumento (`curl … | sudo bash -s -- <ref>`). Contesta la Q12: lo
último de `main`, mientras no haya versiones publicadas.

- **Por qué un clon y no un tarball de GitHub:** el commit instalado se puede consultar con
  `git log -1` sin inventar un fichero de versión, el `update.sh` futuro solo tendrá que hacer
  `fetch` y `checkout`, y es el modelo que ya tiene la mesa. Cuesta instalar `git`, un paquete pequeño.
- **Por qué el argumento `<ref>`:** las pruebas en la mesa (decisión 8) instalan la rama de la PR
  antes de integrarla. El script se descarga de la URL de esa misma rama.

### 3. Node.js 24 desde NodeSource

El repositorio de apt de NodeSource para la rama 24.x, que deja Node en `/usr/bin/node` (la ruta de
la unidad) y recibe parches con `apt upgrade` sin salir de la 24. Si `/usr/bin/node` ya es una 24,
no se toca (es el caso de la mesa). pnpm sale de `packageManager` con `corepack enable`, que sigue
dentro de Node 24.

- **Descartado: el tarball oficial de nodejs.org.** Lo deja en `/usr/local/bin`, sin parches
  automáticos, y fijar la versión no aporta nada: `.nvmrc` solo dice `24`.

### 4. El usuario `moodtable`, dueño de toda la instalación

Usuario de sistema, sin shell de entrada (`/usr/sbin/nologin`), en los grupos `dialout` (puerto
serie) y `audio` (`arecord`), y en ningún grupo con permisos de administrador. Toda
`/opt/moodtable` es suya. Las dependencias y el build se hacen como root durante la instalación, y
al final se le da la propiedad.

- **Descartado: código de root y solo `data/` escribible por `moodtable`.** Protegería el código si
  alguien comprometiera el motor, pero la API ya no puede escribir ficheros (README §2.5) y para el
  maker no cambia nada: necesita `sudo` en los dos casos para editar la configuración. No compensa
  (decisión del maker al explorar).

### 5. El fichero de configuración base: la demo, escuchando en todas las interfaces

El script copia `config/demo.json` a `config/local.json` y le pone `server.host` en `0.0.0.0`, con
`node` (ya instalado), sin crear un fichero nuevo en el repositorio. Así lo que distingue la mesa de
la demo queda en un solo sitio, el `host`, y la demo sigue siendo la fuente única de la tira virtual
y del fichero de audio de ejemplo.

- **Descartado: un `deploy/config/mesa.json` propio.** Más legible en el repo, pero duplica casi toda
  la demo.

### 6. Reinstalar: preguntar primero, construir aparte y cambiar al final

Orden del script:

```
1. detectar instalación existente      /opt/moodtable                    -> del script
                                       unidad con otro WorkingDirectory   -> anterior de la mesa
                                       ninguna                            -> Pi limpia
2. si existe: preguntar (de /dev/tty)  conservar | sobrescribir | otra cosa -> salir sin tocar nada
3. Node, git, usuario moodtable
4. clonar y construir en /opt/moodtable.new
5. configuración: la conservada, o la base (+ .bck de la anterior)
6. parar el servicio, retirar la instalación del script, mover .new -> /opt/moodtable
7. registrar la unidad, arrancarla y decir la dirección del panel
```

- **La instalación anterior se reconoce por la unidad**: su `WorkingDirectory` dice dónde está el
  clon (hoy `/home/pi/mood-table-v2`) y, con él, su `config/local.json`. No se da por hecho
  `/home/pi`.
- **La pregunta se lee de `/dev/tty`**, porque con `curl … | sudo bash` la entrada estándar es el
  propio script. Solo valen las dos respuestas; una vacía, otra cosa o una lectura que falla (sin
  terminal) terminan el script con `set -e` antes del paso 3. Nunca cuenta como sobrescribir.
- **Construir aparte** (`/opt/moodtable.new`) hace que un fallo de red o de disco en los pasos 3-5
  deje la instalación existente funcionando. El cambio del paso 6 es lo único que no se puede
  interrumpir sin consecuencias, y dura segundos.
- **La copia `.bck`** queda junto al fichero nuevo, en `/opt/moodtable/config/local.json.bck`, venga
  de la instalación del script o de la anterior.
- **El estado empieza de cero** porque `data/` no se copia: la instalación del script se retira
  entera y la anterior no se toca.
- **El clon anterior se queda** (decisión del maker al explorar): se sigue usando para desarrollar.
  Al terminar, el script dice que el servicio ya no lo usa.

### 7. La unidad pasa a `moodtable` y a `/opt/moodtable`

`deploy/moodtable.service` cambia `User=` y `WorkingDirectory=`, y su comentario de registro pasa a
decir que lo hace el script. Todo lo demás (el `udevadm settle`, sin esperar a la red,
`Restart=no`) se queda, porque es lo que exige `table-service`. El script la copia a
`/etc/systemd/system/` y hace `daemon-reload` y `enable --now`; si el servicio ya estaba registrado,
lo reinicia con la instalación nueva.

### 8. Cómo se prueba: ShellCheck y la mesa

- **ShellCheck dentro de `pnpm lint`**, con el paquete de npm `shellcheck` fijado en el catálogo.
  Descarga el binario la primera vez que se ejecuta, sin script de instalación (encaja con
  `allowBuilds`), y así local y CI ejecutan lo mismo (`quality-gates`). Un binario del sistema
  rompería esa igualdad: la CI de GitHub lo trae y el Mac del maker no.
- **El test de la unidad** pasa a `User=moodtable` y `WorkingDirectory=/opt/moodtable`.
- **Los escenarios de la spec, a mano en la Pi de la mesa**, sobre la SD de la mesa y después de
  copiarla entera con `dd` al Mac (ver *Migration Plan*). Es el mismo precedente que `table-service`:
  lo que solo pasa en la Pi se prueba en la Pi.
- **Se aparta de la DoD** («tests que cubren todos los escenarios»): la cobertura de los escenarios
  es la prueba manual, con su resultado en la PR. Es el precio de la decisión 1.

### Nueva D#

Las decisiones 1 a 4 deberían ser una **D110** en `docs/idea-mood-table.md`: *el instrumento se
instala con un solo script de bash que clona `main` en `/opt/moodtable`, instala Node 24 de
NodeSource y lo ejecuta con un usuario de sistema `moodtable` (`dialout`, `audio`) dueño de toda la
instalación; bash como excepción a «un solo lenguaje», de momento*. Corrige lo que el README daba por
hecho (Node LTS, `install.sh` copiando un fichero de configuración del entorno).

## Risks / Trade-offs

- **`curl … | sudo bash` ejecuta como root lo que sirve GitHub.** → Es el patrón habitual para este
  tipo de instalación, el repositorio es público y el script se puede leer antes en la misma URL. El
  README lo dice.
- **Dos makers que instalan en días distintos tienen versiones distintas.** → Aceptado mientras no
  haya releases (Q12). `git log -1` en `/opt/moodtable` dice cuál es.
- **Sin tests automáticos de la lógica de reinstalar.** → ShellCheck, el orden de la decisión 6 (nada
  se cambia antes de responder) y la prueba en la mesa. Si la lógica crece, se pasa al modelo
  descartado de la decisión 1.
- **Construir el panel en la Pi tarda y pide memoria.** → En la Pi 4 de la mesa, unos minutos. Una
  Pi con poca RAM podría quedarse sin memoria; no es el hardware de referencia (PRD §6.2).
- **NodeSource es un repositorio de terceros.** → Es la forma habitual de tener Node 24 en Debian y
  la que ya usa la mesa.
- **El estado del instrumento de la mesa se pierde al pasar a la instalación nueva.** → Aceptado
  (non-goal). Sigue en `data/` del clon anterior y en la copia de la SD.
- **`pnpm dev` en el clon de `/home/pi` choca con el servicio** (puerto serie, tarjeta de sonido y
  8080). → El README dice que se pare el servicio antes (`sudo systemctl stop moodtable`).

## Migration Plan

La prueba de la decisión 8 es también el paso de la mesa a la instalación nueva. Va en dos PR
(`tasks.md`), porque la primera todavía no sabe reinstalar:

1. **PR de `MOO-143`:** apagar la mesa, copiar la SD entera al Mac con `dd`, grabar Raspberry Pi OS
   limpio en la misma SD y lanzar el script de la rama de la PR: Pi limpia, sin hardware y con el
   hardware de la mesa declarado.
2. **PR de `MOO-144`:** relanzar el script sobre esa instalación (preguntar, sin respuesta,
   sobrescribir). Después, restaurar con `dd` la copia de la SD, que es la instalación anterior, y
   lanzarlo eligiendo conservar.
3. La mesa se queda con la instalación nueva y el clon de `/home/pi` para desarrollar.

**Volver atrás:** restaurar la copia de la SD con `dd`.
