# Proposal

> **Origen:** historia [`MOO-25`](https://linear.app/7daysofrain/issue/MOO-25/volver-al-ultimo-estado-del-instrumento-tras-reiniciar-el-motor)
> · Volver al último estado del instrumento tras reiniciar el motor · épica **H5** · expectativa **E6**.
> Tareas: `MOO-26` (base de persistencia, `db`), `MOO-129` (restaurar al arrancar, `engine`) y
> `MOO-130` (guardar cada cambio, `engine`).

## Why

Hoy el estado del instrumento (el efecto activo de cada tira y los valores de todos sus efectos) vive
solo en la memoria del motor: cualquier reinicio, también un corte de luz, devuelve cada tira al
efecto del fichero de configuración con sus valores por defecto, y el DJ tiene que preparar la mesa
otra vez. Es lo que pide H5 y la mitad de E6 (*se enchufa y vuelve como estaba*). El modelo ya está
diseñado (README §3) y el búfer de control ya guarda el estado con esa forma, así que falta guardarlo
en disco y recuperarlo al arrancar.

## What Changes

- **Cada tira vuelve como la dejó el DJ** tras reiniciar el motor, aunque sea por un corte de luz: el
  mismo efecto activo, con los mismos valores, y los valores de sus otros efectos.
- **El estado se guarda cuando el DJ deja de tocar**: 500 ms después del último cambio, venga del
  mando que venga. Un corte solo se lleva lo cambiado en esos 500 ms o un arrastre a medias.
- **Primer arranque y estado dañado**: sin estado guardado, cada tira arranca como hasta ahora (el
  efecto del fichero, con valores por defecto), sin aviso. Si el estado guardado está dañado, el motor
  lo aparta, arranca igual que la primera vez, lo deja escrito en su registro y sigue guardando.
- **Reconciliación con el fichero de tiras**: una tira nueva arranca con su efecto declarado; una que
  se quita conserva su estado por si vuelve; cambiar el nombre, el nº de LEDs o la salida no la hace
  otra tira; cambiar su identificador, sí.
- **Lo que dejó el DJ manda sobre el efecto del fichero**, salvo que el efecto guardado necesite una
  fuente de audio y el fichero ya no la declare: entonces, el del fichero.
- **Unos valores que ya no encajan** (tras actualizar el código: un parámetro nuevo, un rango que
  cambia, un efecto que desaparece) se completan o vuelven a los de por defecto, efecto por efecto.
- **Campo nuevo y opcional `instrumentState`** en el fichero de configuración: dónde se guarda el
  estado (`sqlite` con `path`) o que no se guarde (`memory`). Sin el campo, se guarda en
  `data/instrument-state.db`.
- La API, el protocolo del visor y el panel **no cambian**.

## Capabilities

### New Capabilities

- `instrument-state`: guardar el estado del instrumento y recuperarlo al arrancar, la reconciliación
  con el fichero de tiras y qué pasa cuando no hay estado o está dañado.

### Modified Capabilities

- `effects`: *Cada tira arranca con el efecto que declara el fichero* pasa a valer solo cuando no hay
  estado guardado de esa tira.
- `engine-config`: el campo opcional `instrumentState`.

`instrument-control` no cambia: el DJ toca el instrumento igual, y lo nuevo (que el estado se guarde)
cuelga del aviso de cambios que ya da el búfer de control.

## Non-goals

Tomados de la historia `MOO-25`:

- **Que el motor arranque solo al encender la Pi** (servicio del sistema): es `MOO-131`. Aquí el
  reinicio se prueba matando el proceso (`kill -9`) y arrancándolo a mano.
- **Que la mesa sobreviva al corte como sistema** (la SD, la red, el sistema operativo): es `MOO-121`.
- **Escenas o presets**: fuera por decisión (PRD §5.4).
- **Editar tiras desde el panel**: fuera por decisión.
- **Persistencia en la demo pública**: allí el estado va en memoria (README §2.5).
- **Un aviso en el panel de que el estado se ha restaurado** (README §1.3), y tampoco de que no se ha
  podido restaurar: decidido al explorar, el aviso va solo al registro del motor (`design.md`,
  decisión 4).

Fuera también, decidido al explorar el change:

- **Escribir desde otro hilo**: la escritura es síncrona, en el hilo del motor. Si algún día diera
  tirones, se buscaría solución entonces (`design.md`, decisión 3).
- **Que la intensidad (`MOO-97`) vuelva tras reiniciar**: queda como pregunta abierta del PRD (Q9).

## Impact

- **Código**:
  - `packages/shared`: el esquema de `instrumentState` en el fichero de configuración y los tipos del
    estado del instrumento.
  - `packages/engine`: el puerto `StateStore` (núcleo), sus adaptadores SQLite y en memoria, la
    reconciliación al arrancar, el guardador con su retardo y la raíz de composición (`main.ts`). El
    búfer de control (`core/control.ts`) arranca desde un estado dado y lo deja leer.
- **API**: ninguna ruta nueva ni cambio de esquema.
- **Dependencias nuevas**: ninguna. `node:sqlite` viene con Node; `engines` sube a `>=24.15`, la
  versión en que es *release candidate* (la Pi tiene la 24.22).
- **Documentación**:
  - En el commit de este change: `docs/PRD.md` (*identificador de la tira* en el glosario y la
    pregunta Q9 sobre la intensidad), `docs/idea-mood-table.md` (D103 y D104) y
    `docs/umbrales-para-specs.md` (E6: el último valor fijado).
  - En las tareas: README §1.4 (dónde se guarda el estado), §2.2, §2.4, §2.5 y §3 (el modelo sin
    `schema_version`, el campo `instrumentState`, cómo se prueba), y `prompts.md`.
- **Tests E2E**: los existentes declaran `instrumentState: memory`; uno nuevo arranca el motor con
  estado en disco, cambia una tira, lo mata y comprueba que vuelve igual.
