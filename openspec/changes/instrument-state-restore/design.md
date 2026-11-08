# Design

> Decisiones tomadas con el DJ al explorar `MOO-25` (6-nov), salvo la 7, en su segunda mitad, y la 8,
> que se proponen aquí. Dos pasan a D# en el commit de este change: **D103** (cómo y cuándo se
> guarda: decisiones 1-3) y **D104** (sin `schema_version`: decisión 5). Las demás son detalle de este
> change. D99-D102 los reserva el change `instrument-intensity` (`MOO-97`), aún sin integrar.

## Context

- **El búfer de control ya guarda el estado con la forma de `strip_effects`.** `createControl`
  (`core/control.ts`) tiene, por tira, un mapa de efecto a valores, también de los no activos, y la
  ranura del efecto activo (change `strip-effect-recall`). Hoy arranca siempre desde el fichero: el
  efecto de `strip.effect` y los valores por defecto.
- **`watch()` avisa de cada cambio**, venga del mando que venga, sin decir cuál. El servidor ya lo usa
  para mandar el estado de las tiras a los paneles. Es el punto donde se engancha el guardado (README
  §2.2).
- **Mientras se arrastra un control, llegan decenas de cambios por segundo**: el panel manda un `PUT`
  en cuanto vuelve el anterior (`panel/src/engine/strip-requests.ts`).
- **El bucle de frames y el servidor comparten hilo.** Lo que bloquee el hilo retrasa el frame
  siguiente (presupuesto: 16,6 ms a 60 fps; el frame tarda 0,46 ms en la Pi, A1).
- **Solo la respiración tiene parámetros** (`color`, `period`); los demás efectos guardan `{}`. El
  estado entero de una mesa son unos pocos cientos de bytes.
- **La Pi tiene Node 24.22**; `node:sqlite` es *release candidate* desde Node 24.15.
- **Hoy el motor no arranca si no abre un puerto serie** (`main.ts`): la parte de Q5 que dice que lo
  espera aún no está hecha, así que el candidato *el controlador Adalight aparece después* del
  refinamiento no aplica. La restauración vive en el búfer, que no depende de las salidas.

Motivación y alcance: `proposal.md`. Requisitos: `specs/instrument-state`, `specs/engine-config` y
`specs/effects`.

## Goals / Non-Goals

**Goals:**

- Que el núcleo solo conozca el puerto `StateStore`, nunca SQLite (README §2.1, regla de fronteras).
- Que la restauración sea una función pura del núcleo (fichero + estado guardado → estado inicial),
  probada sin disco.
- Que la API, el protocolo del visor y el panel no cambien.

**Non-Goals:**

- **Guardar al apagar ordenadamente** (`SIGTERM`): un `systemctl restart` justo después de un cambio
  pierde esos 500 ms, como un corte. Ver *Risks*.
- **Migrar valores entre versiones de un efecto** con código propio (decisión 5).

## Decisions

### 1. `node:sqlite`, sin dependencias nativas

`DatabaseSync` de `node:sqlite`, que viene con Node: nada que compilar ni que descargar para arm64.
`engines` sube de `>=24` a `>=24.15`, la versión en que deja de ser experimental y pasa a *release
candidate*. Modo WAL, `synchronous = FULL` y `foreign_keys = ON` al abrir (README §3).

Alternativa descartada: `better-sqlite3`, con binarios precompilados para arm64. Es otra dependencia
nativa, como `serialport`, y no aporta nada que haga falta aquí (las dos son síncronas).

### 2. Se guarda 500 ms después del último cambio (debounce, en el motor)

Un guardador escucha `watch()`. Cada cambio reinicia un temporizador de 500 ms; cuando vence, toma una
foto del estado entero del búfer y la guarda en **una transacción**. Lo que se pierde con un corte es
lo cambiado en los últimos 500 ms, o un arrastre a medias, que todavía no era un valor fijado.

```
cambios:  x x x x x x x x x . . . . . .        (el DJ suelta)
                            |<-500 ms->| save(foto del estado entero)
```

- **El estado entero, no lo que cambió**: son pocos cientos de bytes, y así una escritura nunca deja
  medio estado. Se hace *upsert* de las filas de las tiras declaradas y **nunca se borra** ninguna: el
  estado de una tira que ya no se declara se conserva (reconciliación, README §3).
- **El temporizador se inyecta**, como el del bucle (`adapters/ticker.ts`), para probar el guardador
  con un reloj falso.

Alternativas descartadas:

- **Guardar cada cambio**: decenas de escrituras por segundo en la SD mientras se arrastra.
- **Guardar como mucho cada X ms mientras se arrastra (*throttle*)**: guarda valores intermedios que
  no le importan a nadie (decisión del DJ).
- **Que el panel marque el último cambio al soltar**: cambia la API y el panel, y no vale para un
  encoder, que no se suelta (E5).

### 3. Escritura síncrona, en el hilo del motor; la lenta, al log

`save()` es síncrono y corre en el hilo del bucle. Con el debounce se escribe poco y solo cuando el
DJ ha dejado de tocar. Si un guardado tarda más de 10 ms (más de medio frame con margen), el motor lo
dice en el log, con lo que ha tardado: si algún día da tirones, se verá.

Alternativas descartadas:

- **Un *worker thread*** que escriba aparte: más piezas para un problema que no se ha visto (decisión
  del DJ).
- **`synchronous = NORMAL`**: la transacción no espera al disco, pero tras un corte se puede perder lo
  que Linux no haya escrito aún (hasta ~30 s), y se rompe el margen de 500 ms.

### 4. Sin fichero, primer arranque; dañado, se aparta

Al abrir el estado hay cuatro casos:

| Caso | Qué hace el motor | Log |
|---|---|---|
| No existe el fichero | Lo crea (y su carpeta) y arranca como la primera vez | Nada |
| SQLite dice que está dañado (`SQLITE_CORRUPT`, `SQLITE_NOTADB`) o falla `PRAGMA quick_check` | Lo renombra a `<fichero>.dañado-<fecha ISO>` (con sus `-wal` y `-shm`), crea uno nuevo y arranca como la primera vez | Que no ha podido recuperar el estado, por qué, y dónde ha dejado el dañado |
| No lo puede crear ni abrir (permiso, solo lectura) | Arranca **sin guardar**, como con `memory` | Qué fichero no puede usar y por qué |
| Tiene migraciones que este motor no conoce (se ha vuelto a una versión anterior) | Arranca sin guardar y **no toca el fichero**, para no perder el estado de la versión nueva | Que el estado es de una versión más nueva del motor |

El DJ se entera por el log, no por el panel (decisión del DJ: el aviso en el panel es un non-goal).
Un fichero borrado no se distingue de un primer arranque.

### 5. Sin `schema_version`: se valida al leer contra el esquema actual

La columna `schema_version` de `strip_effects` (README §3) se quita. Al cargar, los valores de cada
efecto pasan por su esquema TypeBox actual: `Value.Default` (los campos que falten toman su valor
por defecto) y `Value.Clean` (se quitan los que sobren), y después `Value.Check`. Si aun así no lo
cumplen, ese efecto vuelve a sus valores por defecto; los demás efectos de la tira, no. Un efecto que
ya no está en el catálogo se ignora, y su fila se conserva.

Es la misma validación que ya hace `setValues` con cada `PUT`, y cubre el caso más habitual (un
parámetro nuevo) sin perder lo demás. Con una versión por efecto habría que acordarse de subirla y
escribir migraciones para dos parámetros. Pasa a **D104** porque cambia un modelo ya diseñado.

### 6. La restauración es una función pura del núcleo

`restore(strips, efectos, hayFuenteDeAudio, guardado)` devuelve, por tira, el efecto activo y los
valores de cada efecto, más los avisos para el log:

```
por cada tira declarada (por su id):
  sin estado guardado        -> efecto del fichero, valores por defecto
  con estado guardado        -> valores de cada efecto validados (decisión 5)
                                efecto activo guardado, salvo que:
                                  - ya no exista              -> efecto del fichero
                                  - necesite audio y no haya  -> efecto del fichero + aviso
tiras guardadas que no se declaran -> se ignoran (y se conservan en disco)
```

`createControl` recibe ese estado inicial en lugar de partir siempre del fichero, y gana un método que
devuelve la foto del estado para el guardador. Una tira se reconoce por su `id`: cambiar `name`,
`ledCount` u `output` no la hace otra.

El efecto del fichero sirve de reserva porque siempre se puede pintar: el fichero ya no deja declarar
un efecto reactivo sin `audioSource` (`specs/engine-config`).

### 7. `instrumentState` en el fichero: `sqlite` por defecto, `memory` para la demo y los E2E

Campo opcional, discriminado por `type` como `output` y `audioSource`:

- `{ "type": "sqlite", "path": "…" }`: ruta absoluta o relativa a la raíz del repositorio (D44).
- `{ "type": "memory" }`: el adaptador en memoria; nada en disco.
- **Sin el campo**: SQLite en `data/instrument-state.db`, que git ignora. Así la mesa y el simulador
  recuerdan sin declarar nada, y a la mesa no se le puede «olvidar» H5.

Si el fichero no se puede crear ni abrir, el motor arranca sin guardar (decisión 4): un instrumento
que no arranca es peor que uno que no recuerda. Esta mitad se propone aquí, no salió del explore.

El nombre sale del glosario (*estado del instrumento* = `instrumentState`). La ruta configurable
deja sitio a `MOO-121`, que puede dejar la raíz del sistema en solo lectura.

### 8. Dónde vive cada pieza

```
packages/shared   ConfigFileSchema + instrumentState
packages/engine
  core/
    state-store.ts   puerto StateStore + tipos del estado del instrumento
    restore.ts       decisión 6 (pura)
    state-saver.ts   decisión 2 (temporizador inyectado)
    control.ts       arranca desde un estado y da su foto
  adapters/
    sqlite-state-store.ts   node:sqlite, migraciones, decisión 4
    memory-state-store.ts   demo y tests
  main.ts            elige el adaptador, restaura, crea el búfer y engancha el guardador
```

- **Los tipos del estado van en el núcleo, no en `shared`**: solo los usa el motor. La descripción de
  `MOO-26` decía `shared`; no hace falta ensanchar su API.
- **El puerto es síncrono**: `load()` devuelve el estado guardado (vacío si no hay nada), y
  `save(estado)` lo escribe entero. Lo que ha pasado al abrir (decisión 4) lo dice la apertura del
  adaptador SQLite, con el aviso para el log: el puerto no sabe de ficheros.
- **Las migraciones** son una lista numerada en el adaptador; una tabla de control guarda las
  aplicadas. La 1 crea `strip_state` y `strip_effects` (README §3, sin `schema_version`).
- **El adaptador SQLite no es `*.hardware.ts`**: se prueba con ficheros temporales, sin hardware.

## Risks / Trade-offs

- [Una escritura en una SD lenta retrasa un frame] → se ve en el log (decisión 3); la salida, si
  hace falta, es un *worker*, solo en el adaptador.
- [La SD de la mesa ya da errores EXT4] → SQLite deja el dato anterior o el nuevo, y si el fichero se
  daña igualmente, el motor arranca (decisión 4). Que el sistema sobreviva es `MOO-121`.
- [Un `systemctl restart` justo después de un cambio pierde esos 500 ms] → aceptado, como un corte. Si
  se echa en falta, el motor guardaría lo pendiente al recibir `SIGTERM`.
- [Vitest con `node:sqlite`] → se comprueba en el primer paso de `MOO-26`, antes de construir encima.
- [Los E2E escribirían en `data/` y se pisarían entre ejecuciones] → declaran `memory`; el de
  `kill -9` usa una ruta temporal propia.
- [Un fichero dañado que se aparta en cada arranque llenaría el disco] → solo se aparta si está
  dañado, y el nuevo ya no lo está; no se limpian los apartados.

## Migration Plan

Nada que migrar: hoy no hay estado en disco. El primer arranque con este change crea
`data/instrument-state.db` y se comporta como siempre. Volver atrás es quitar el fichero o usar la
versión anterior del motor, que lo ignora.
