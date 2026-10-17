# Spike de rendimiento · ¿Aguanta la Pi 4 el motor en tiempo real?

**Historia:** [MOO-12](https://linear.app/7daysofrain/issue/MOO-12) · **Tarea:** [MOO-54](https://linear.app/7daysofrain/issue/MOO-54) ·
**Medido:** 17-oct-2026 en la Pi 4 de la mesa · **Decisiones:** D8, D42, D47 (`docs/idea-mood-table.md`)

## Pregunta

¿Puede un motor escrito en TypeScript (D8) calcular los frames con análisis de audio en la Pi 4 de la
mesa a tiempo, antes de construir el análisis de audio de verdad (MOO-14)?

## Veredicto

**TypeScript para el motor (D8) se confirma con margen.**

En la peor configuración, dos tiras de 300 LEDs a la vez, una con *espectro* y otra con *energía*, a
60 fps y con análisis de audio, el resultado es este:

| Cifra | Resultado | Objetivo | Mínimo |
|---|---|---|---|
| Mediana | **0,457 ms** | < 8 ms | — |
| p95 | **0,513 ms** | < 16,6 ms | < 33,3 ms |
| Máximo | 8,531 ms | (no decide) | — |

La mediana está unas 17 veces por debajo del objetivo, y el p95, unas 32 veces por debajo de su
umbral. Ningún frame de ninguna pasada pasó de 16,6 ms, y todas sacaron los frames que tocaban. La
regla es la de MOO-12: decide la peor configuración, y las pasadas de una tira son solo dato.

## Resultados

Cada pasada dura 3 minutos. Los tiempos son los que tarda el prototipo en calcular cada frame: el
análisis de audio más todas las tiras.

| LEDs | Efecto | fps | Frames (esperados) | Mediana (ms) | p95 (ms) | Máx. (ms) | > 16,6 ms | Frenada |
|---|---|---|---|---|---|---|---|---|
| 200 | espectro | 30 | 5 401 (5 400) | 0,395 | 0,448 | 7,716 | 0 | no |
| 200 | espectro | 60 | 10 801 (10 800) | 0,395 | 0,448 | 7,929 | 0 | no |
| 200 | energía | 30 | 5 401 (5 400) | 0,387 | 0,437 | 7,803 | 0 | no |
| 200 | energía | 60 | 10 801 (10 800) | 0,390 | 0,445 | 6,889 | 0 | no |
| 300 | espectro | 30 | 5 401 (5 400) | 0,412 | 0,466 | 7,917 | 0 | no |
| 300 | espectro | 60 | 10 801 (10 800) | 0,423 | 0,478 | 8,165 | 0 | no |
| 300 | energía | 30 | 5 401 (5 400) | 0,407 | 0,459 | 7,807 | 0 | no |
| 300 | energía | 60 | 10 801 (10 800) | 0,407 | 0,457 | 7,878 | 0 | no |
| 600 | espectro | 30 | 5 401 (5 400) | 0,491 | 0,547 | 8,968 | 0 | no |
| 600 | espectro | 60 | 10 801 (10 800) | 0,490 | 0,557 | 8,985 | 0 | no |
| 600 | energía | 30 | 5 401 (5 400) | 0,463 | 0,519 | 8,602 | 0 | no |
| 600 | energía | 60 | 10 801 (10 800) | 0,484 | 0,549 | 8,656 | 0 | no |
| **300 + 300** | **espectro + energía** | **60** | **10 801 (10 800)** | **0,457** | **0,513** | **8,531** | **0** | **no** |

Cada pasada saca un frame más de los esperados porque el arnés cuenta también el del instante 0. Es
un detalle del arnés, no del motor.

**Lo que se lee en la tabla:**
- **El coste casi no depende de los LEDs.** De 200 a 600 LEDs sube unos 0,1 ms, y la segunda tira
  añade unos 0,05 ms. Casi todo el tiempo se va en el análisis de audio (unos 0,35 ms, estimado
  por diferencia: no se midió aparte), que se calcula una vez por frame para todas las tiras. Cuadra con el diseño del README §2.2.
- **El máximo ronda los 8-9 ms en todas las pasadas**, sea cual sea la configuración. Eso apunta a
  pausas puntuales (el recolector de basura de Node o la compilación de V8 en los primeros frames) y
  no al trabajo de cada frame. Aun así, queda por debajo de 16,6 ms, y el p95 ni se entera.
- **Para Q1** (cuántos LEDs por tira con fluidez): por CPU, la Pi llega con al menos 600 LEDs por
  tira, con margen de sobra. Q1 queda resuelta solo en parte: falta Adalight (A2, H3), que será el
  límite real.

## ¿Se frenó la Pi?

No. Durante las 13 pasadas se apuntó cada segundo `vcgencmd get_throttled`, la temperatura y la
frecuencia de la CPU (unas 176 muestras por pasada):

- `get_throttled` dio `0x0` en todas las muestras: ni subtensión, ni frecuencia limitada, ni frenado,
  ni límite blando de temperatura.
- La temperatura máxima fue de **60,3 °C**, muy lejos de los ~80 °C a los que la Pi 4 empieza a
  frenarse.
- La frecuencia osciló entre 600 y 1 800 MHz. Es el gobernador `ondemand`, que la baja cuando hay
  poca carga, y la carga es mínima. Parte de los frames se calcularon por tanto a frecuencia baja, así
  que las cifras son, si acaso, conservadoras.

Todas las mediciones cuentan para el veredicto.

## Condiciones de la prueba

| | |
|---|---|
| Máquina | Raspberry Pi 4 Model B Rev 1.4, 8 GB (7,6 GiB visibles) |
| Sistema | Raspberry Pi OS Lite de 64 bits: Debian 13 (*trixie*) 13.7, kernel 6.18.50+rpt-rpi-v8, `aarch64` |
| Node | v24.22.0 (NodeSource), sin opciones |
| FFT | `fft.js` 4.0.4 |
| Gobernador de la CPU | `ondemand` (el de serie; no se tocó) |
| Qué más corría | Nada: el sistema base, `sshd` y el propio `ps` (lista completa en `results/conditions.txt`) |
| Código | commit `7531b72` |
| Duración y orden | 13 pasadas de 180 s con 20 s de pausa entre ellas. La peor configuración fue la última, con la Pi más caliente |

## Método

El prototipo (`.spikes/moo-12/bench.ts`) hace el trabajo del motor con análisis de audio, sin enviar
los frames a ninguna salida:

1. **Audio sintético:** una pista de 10 s en bucle a 44,1 kHz, con bombo a 120 BPM, bajo, tonos
   medios y charles. Se genera al arrancar.
2. **Análisis de audio, una vez por frame:** las últimas 2 048 muestras con ventana de Hann, FFT
   (`fft.js`, `realTransform`), 32 bandas en escala logarítmica de 30 Hz a 16 kHz, energía con
   ganancia automática y detección de golpes. Responde al audio: alrededor del 13 % de los frames caen
   dentro de un golpe.
3. **Efectos por tira:** *espectro* (las bandas repartidas a lo largo de la tira, con caída suave) y
   *energía* (brillo que sigue a la energía y destello en cada golpe, abriéndose desde el centro).
4. **Límite de potencia por tira:** estima la corriente del frame y escala el brillo si pasa de lo
   declarado.

El ritmo lo marca el temporizador real del motor (`startTicker`, `packages/engine/src/adapters/ticker.ts`).
Cada frame se mide con `performance.now()`. Como la salida es nula, se acumula una suma de control de
los frames para que V8 no pueda saltarse el trabajo; la suma salió distinta de cero en todas las
pasadas.

## Límites del resultado

- **Los efectos son aproximaciones** de los de la v1, no los definitivos (MOO-14 para *energía*, H2
  para *espectro*). Lo que se mide es el orden de magnitud del coste.
- **Se mide solo el cálculo del frame.** No entran el envío al visor por WebSocket (MOO-17), Adalight,
  la API ni la persistencia. El margen que queda (unos 16 ms de 16,6 a 60 fps) es para eso.
- **No se mide Adalight ni la latencia del sonido a la luz (E2):** quedan para H3 (A2).
- **No se comprueba la captura de la tarjeta de sonido:** el audio es sintético. Va con MOO-15.
- **La FFT es `fft.js`:** con este resultado queda validada para MOO-14 (README §2.2 dejaba la elección
  al spike). No hace falta una implementación propia.

## Tiempo invertido frente al *timebox*

**Algo más de 1 hora frente a un *timebox* de 2 días.** Fue desde que se empezó la tarea, el 17-oct a
las 07:22, hasta el documento, hacia las 08:30:
- el prototipo y el script, unos 15 minutos;
- la medición en la Pi, unos 45 minutos sin intervención;
- el documento.

El refinamiento y la estimación de MOO-12 no cuentan.

## Cómo repetirlo

El código y los datos en crudo están en el commit
[`9d0005a`](https://github.com/7daysofrain/mood-table-v2/tree/9d0005a6cd96032a39ada46b171f027be1cfc713/.spikes/moo-12).
El prototipo se borra antes de integrar, porque no forma parte del producto, pero **sirve de
referencia**: si el motor real rinde peor de lo esperado, se compara con estas cifras y, si hace falta,
se vuelve a ejecutar desde ese commit. Ahí el prototipo y el `ticker.ts` contra el que corre están
congelados juntos. Copiado a `main`, se rompería en cuanto el motor cambiara.

Para comparar de verdad, lo que hay que medir es el **motor real con la misma carga** (audio, dos tiras
de 300 LEDs con *espectro* y *energía*, 60 fps) y ponerlo al lado de la tabla de arriba.

```bash
git clone https://github.com/7daysofrain/mood-table-v2.git && cd mood-table-v2
git checkout 9d0005a6cd96032a39ada46b171f027be1cfc713
cd .spikes/moo-12 && npm install
nohup ./run.sh > run.log 2>&1 &          # ~45 min; resultados en results/
node bench.ts 300:spectrum,300:energy 60 180   # una sola pasada
```

Para probarlo corto: `SECONDS_PER_RUN=2 PAUSE_SECONDS=0 ./run.sh`.
