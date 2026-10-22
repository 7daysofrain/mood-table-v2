/**
 * Fuente de audio *tarjeta de sonido* (specs/audio-source, decisiones 4, 5 y 6 del change
 * soundcard-audio-source): `arecord` graba de la cadena de ALSA declarada y entrega s16le mono a
 * 48 kHz por su salida; cada bloque va a un búfer circular, y en cada pulso `read` copia lo último
 * que ha llegado, sin mirar el instante (D50). Esta es la parte pura: lanzar el proceso de verdad
 * es cosa de `soundcard.hardware.ts`, y los tests usan un proceso en memoria.
 *
 *   arecord --> bloques s16le --> (300 ms descartados) --> búfer circular de 0,5 s --> read()
 *
 * El motor solo no arranca si `arecord` termina antes de entregar el primer bloque: no puede abrir
 * el dispositivo. Que no llegue música no es un fallo. Si termina con el motor en marcha, la fuente
 * da silencio desde ese momento y lo dice una vez en el log. Después, cada segundo vuelve a lanzar
 * `arecord` con la misma cadena, sin límite: el primer bloque la recupera, se dice en el log y se
 * empieza de cero, con el búfer vacío y otros 300 ms descartados; un intento que termina antes no
 * dice nada (decisiones 1 y 2 del change soundcard-reconnect). Quien se suscribe sabe si está
 * conectada o perdida. Si el motor no llega a arrancar por otra cosa (el servidor no puede
 * escuchar), para la fuente: un `arecord` vivo, o un intento pendiente, mantendría el proceso en
 * marcha.
 *
 *   grabando --arecord termina--> perdida --cada 1 s--> intento --primer bloque--> grabando
 *                                    ^                     |
 *                                    +--termina antes------+
 */
import type { AudioSourceConfig, SourceStatus } from '@moodtable/shared';

import type { AudioSource } from '../core/audio/audio-source.ts';

export type SoundcardConfig = Extract<AudioSourceConfig, { type: 'soundcard' }>;

/**
 * Cómo termina el proceso: con su código, con la señal que lo paró, o con el error al lanzarlo (sin
 * `arecord`, `ENOENT`).
 */
export interface CaptureExit {
  code: number | null;
  signal?: string | null;
  error?: Error & { code?: string };
}

/** Lo mínimo de un proceso hijo que necesita la fuente. */
export interface CaptureProcess {
  onData(listener: (chunk: Uint8Array) => void): void;
  onStderr(listener: (chunk: Uint8Array) => void): void;
  /** Se llama una sola vez. */
  onExit(listener: (exit: CaptureExit) => void): void;
  /** Termina el proceso. */
  stop(): void;
}

export type SpawnCapture = (command: string, args: readonly string[]) => CaptureProcess;

/** Programa `callback` dentro de `ms` milisegundos y devuelve cómo cancelarlo. */
export type Schedule = (callback: () => void, ms: number) => () => void;

/**
 * `stop` para `arecord` y el intento pendiente, y deja la fuente en silencio, sin contarlo como una
 * pérdida. `onStatus` da el estado actual al momento y después cada cambio.
 */
export type OpenedSoundcard =
  | {
      ok: true;
      source: AudioSource;
      stop: () => void;
      onStatus: (listener: (status: SourceStatus) => void) => void;
    }
  | { ok: false; error: string };

/** Lo que la tarjeta de la mesa graba sin conversión (design.md, contexto). */
const SAMPLE_RATE = 48_000;
/** El chasquido al abrir la tarjeta de la mesa dura unos 250 ms (medido el 21-oct). */
const DISCARD_SAMPLES = 0.3 * SAMPLE_RATE;
/** De sobra para la ventana del análisis (40 ms) y para un bloque grande de `arecord`. */
const BUFFER_SAMPLES = 0.5 * SAMPLE_RATE;
/** Escala de s16le a muestras de -1 a 1. */
const FULL_SCALE = 32_768;
/** Entre dos intentos de recuperar la tarjeta (decisión 1 del change soundcard-reconnect). */
const RETRY_MS = 1000;

const scheduleTimeout: Schedule = (callback, ms) => {
  const timeout = setTimeout(callback, ms);
  return () => clearTimeout(timeout);
};

/**
 * Mono a 48 kHz en s16le. Periodos de 10 ms para que el audio llegue pronto (decisión 1) y un búfer
 * de ALSA de 4 periodos para absorber algún retraso del proceso sin *overrun*.
 */
export function arecordArgs(device: string): string[] {
  return [
    '-q',
    '-D',
    device,
    '-t',
    'raw',
    '-f',
    'S16_LE',
    '-c',
    '1',
    '-r',
    String(SAMPLE_RATE),
    '--period-time=10000',
    '--buffer-time=40000',
  ];
}

/**
 * Lanza `arecord` con la tarjeta de `config` y se resuelve en cuanto llega el primer bloque, o con el
 * error si termina antes. `log` recibe la línea de cada pérdida en plena sesión y de cada
 * recuperación; `schedule` programa los intentos de recuperarla.
 */
export function openSoundcard(
  config: SoundcardConfig,
  spawn: SpawnCapture,
  log: (line: string) => void,
  schedule: Schedule = scheduleTimeout,
): Promise<OpenedSoundcard> {
  const label = `tarjeta de sonido «${config.name}» (${config.device})`;
  const source = new SoundcardSource(config.silenceThreshold);
  const listeners: ((status: SourceStatus) => void)[] = [];
  let status: SourceStatus = 'connected';
  let capture: CaptureProcess | undefined;
  let cancelRetry: (() => void) | undefined;
  let stopped = false;

  function setStatus(next: SourceStatus): void {
    status = next;
    for (const listener of listeners) listener(next);
  }

  const opened: OpenedSoundcard = {
    ok: true,
    source,
    stop() {
      stopped = true;
      cancelRetry?.();
      source.lose();
      capture?.stop();
    },
    onStatus(listener) {
      listeners.push(listener);
      listener(status);
    },
  };

  return new Promise((resolve) => {
    /** Lanza `arecord`. El primero decide el arranque; los demás, si se ha recuperado la tarjeta. */
    function attempt(startup: boolean): void {
      const current = spawn('arecord', arecordArgs(config.device));
      capture = current;
      const stderr = new LastLine();
      let recording = false;
      let exited = false;
      current.onStderr((chunk) => stderr.push(chunk));
      current.onData((chunk) => {
        if (exited || stopped) return;
        // Lo que `arecord` dijo antes de este bloque no explica cómo acabe (un *overrun*, y sigue).
        stderr.forget();
        if (!recording) {
          recording = true;
          if (startup) {
            resolve(opened);
          } else {
            source.restart();
            log(`Se ha recuperado la ${label}.`);
            setStatus('connected');
          }
        }
        source.write(chunk);
      });
      current.onExit((exit) => {
        if (exited || stopped) return;
        exited = true;
        if (recording) {
          source.lose();
          log(`Se ha perdido la ${label}: ${reasonOf(exit, stderr)}. El motor sigue con silencio.`);
          setStatus('lost');
          retry();
        } else if (startup) {
          resolve({ ok: false, error: `${label}: ${startupProblem(exit, stderr)}` });
        } else {
          retry();
        }
      });
    }

    function retry(): void {
      cancelRetry = schedule(() => {
        cancelRetry = undefined;
        attempt(false);
      }, RETRY_MS);
    }

    attempt(true);
  });
}

function startupProblem(exit: CaptureExit, stderr: LastLine): string {
  if (exit.error?.code === 'ENOENT') {
    return (
      'necesita Linux con ALSA (no se encuentra arecord); ' +
      'en este equipo, usa un fichero de audio'
    );
  }
  return `no se puede abrir (${reasonOf(exit, stderr)})`;
}

/** Lo que dice `arecord` al terminar; si no dice nada, su código o la señal que lo paró. */
function reasonOf(exit: CaptureExit, stderr: LastLine): string {
  if (exit.error) return exit.error.message;
  if (stderr.line) return stderr.line;
  if (exit.code !== null) return `arecord ha terminado con el código ${exit.code}`;
  return exit.signal ? `arecord ha terminado por la señal ${exit.signal}` : 'arecord ha terminado';
}

/**
 * La última línea no vacía de `stderr` desde el último bloque de audio, aunque llegue partida en
 * varios bloques.
 */
class LastLine {
  line = '';
  private readonly decoder = new TextDecoder();
  private pending = '';

  push(chunk: Uint8Array): void {
    const lines = (this.pending + this.decoder.decode(chunk, { stream: true })).split('\n');
    this.pending = lines.pop() ?? '';
    for (const each of [...lines, this.pending]) if (each.trim()) this.line = each.trim();
  }

  forget(): void {
    this.line = '';
  }
}

/** El búfer circular y la conversión de s16le: lo que se lee en cada pulso. */
class SoundcardSource implements AudioSource {
  readonly sampleRate = SAMPLE_RATE;
  readonly silenceThreshold: number | undefined;
  private readonly buffer = new Float32Array(BUFFER_SAMPLES);
  /** Siguiente posición del búfer en la que escribir. */
  private next = 0;
  /** Muestras escritas en el búfer, hasta llenarlo. */
  private filled = 0;
  /** Muestras que aún hay que tirar al abrir la tarjeta. */
  private toDiscard = DISCARD_SAMPLES;
  /** El primer byte de una muestra que ha quedado partida entre dos bloques. */
  private low: number | undefined;
  private lost = false;

  constructor(silenceThreshold: number | undefined) {
    this.silenceThreshold = silenceThreshold;
  }

  write(chunk: Uint8Array): void {
    if (this.lost) return;
    for (const byte of chunk) {
      if (this.low === undefined) {
        this.low = byte;
        continue;
      }
      // s16le: el byte bajo primero; `<< 24 >> 16` extiende el signo del alto.
      const sample = ((byte << 24) >> 16) | this.low;
      this.low = undefined;
      if (this.toDiscard > 0) {
        this.toDiscard--;
        continue;
      }
      this.buffer[this.next] = sample / FULL_SCALE;
      this.next = (this.next + 1) % BUFFER_SAMPLES;
      this.filled = Math.min(this.filled + 1, BUFFER_SAMPLES);
    }
  }

  lose(): void {
    this.lost = true;
  }

  /** Vuelve a empezar como al abrir la tarjeta: sin nada de antes del corte y descartando 300 ms. */
  restart(): void {
    this.lost = false;
    this.next = 0;
    this.filled = 0;
    this.toDiscard = DISCARD_SAMPLES;
    this.low = undefined;
  }

  /** Las últimas `out.length` muestras, sin mirar `time` (D50); ceros delante si aún no hay. */
  read(_time: number, out: Float32Array): void {
    const available = this.lost ? 0 : Math.min(this.filled, out.length);
    const zeros = out.length - available;
    out.fill(0, 0, zeros);
    let index = (this.next - available + BUFFER_SAMPLES) % BUFFER_SAMPLES;
    for (let offset = zeros; offset < out.length; offset++) {
      out[offset] = this.buffer[index] ?? 0;
      index = index + 1 === BUFFER_SAMPLES ? 0 : index + 1;
    }
  }
}
