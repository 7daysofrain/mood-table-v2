# Audio

## Demo

`bouncer.wav` es la fuente de audio de `config/demo.json`: la tira de la demo reacciona a él con el
efecto *energía* (change `virtual-strip-audio-file`, `design.md` decisión 9).

| | |
|---|---|
| **Tema** | *Bouncer* |
| **Autor** | Of Far Different Nature |
| **Origen** | [OpenGameArt](https://opengameart.org/node/107501), fichero `Of Far Different Nature - Bouncer (CC0).wav` |
| **Licencia** | [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/) (dominio público), comprobada en la página el 18-oct-2026 |
| **Fichero** | El original, sin cortar ni convertir: WAV PCM de 16 bits, estéreo, 44,1 kHz, 93,8 s |

CC0 no obliga a citar al autor; se cita para dejar trazado de dónde sale.

## Calibración

`calibracion.wav` sirve para comprobar a ojo que una tira física responde como el visor (decisión 8
del change `scroll-effect`). Con el efecto *scroll*, cada golpe es un pulso de un solo color que nace
en el centro y recorre la tira hasta los extremos.

| | |
|---|---|
| **Qué suena** | Un golpe de 30 ms en los segundos 1, 4 y 7: 400 Hz (rojo), 2 kHz (verde) y 8 kHz (azul) |
| **Entre golpes** | Ruido de ±1 LSB, no silencio digital: en silencio, *scroll* apaga la tira y congela el rastro |
| **Fichero** | 9 s en bucle, WAV PCM de 16 bits, mono, 44,1 kHz |
| **Origen** | Generado: `pnpm --filter @moodtable/engine calibration` (`packages/engine/test/fixtures/calibracion.ts`, determinista) |
| **Licencia** | La del repositorio |

**Cómo usarlo:** en una copia del fichero de configuración, pon `"audioSource": { "type": "file",
"path": "config/audio/calibracion.wav" }` y arranca el motor con `MOODTABLE_CONFIG` apuntando a esa
copia. Después elige *Scroll* para la tira. Lo que hay que ver: un pulso por golpe, de un solo color y
en el orden rojo, verde y azul, igual por los dos lados, que avanza sin saltos y tarda en llegar al
extremo lo mismo que en el visor.

Los primeros segundos tras arrancar, mientras se asientan las ganancias, el fondo puede verse tenue.
