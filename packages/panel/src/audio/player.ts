/**
 * Reproductor del fichero de audio en el panel (decisión 3 del change panel-audio-playback): Web
 * Audio, con el fichero entero en memoria. Descarga `/audio` una vez por conexión, lo decodifica y
 * lo hace sonar en bucle con un `AudioBufferSourceNode`, arrancado en el punto exacto que pide la
 * sincronía (`sync.ts`). Un nodo solo se arranca una vez: volver a oír y corregir la deriva crean
 * otro (decisión 4). No sabe nada de React: el control se suscribe a sus cambios de estado.
 *
 * Sin conexión no hay contra qué sincronizar: al perderla calla, suelta el buffer (el motor puede
 * volver con otro fichero) y no vuelve a sonar hasta que el maker lo pide.
 */
import type { EngineConnection } from '../engine/connection.ts';
import {
  type AudioClock,
  audibleAt,
  circularDifference,
  createSync,
  shouldJump,
  type Sync,
  WINDOW_MS,
} from './sync.ts';

/** Callado, preparando el audio (descarga y decodificación) o sonando. */
export type PlayerState = 'silent' | 'preparing' | 'playing';

/** Lo que el reproductor usa de la conexión con el motor. */
export type PlayerConnection = Pick<
  EngineConnection,
  'status' | 'subscribe' | 'subscribePositions'
>;

/** Lo que el reproductor usa de un `AudioContext`: así los tests pueden darle uno falso. */
export type AudioContextLike = Pick<
  AudioContext,
  | 'currentTime'
  | 'state'
  | 'destination'
  | 'resume'
  | 'close'
  | 'decodeAudioData'
  | 'createBufferSource'
> &
  Partial<Pick<AudioContext, 'outputLatency' | 'baseLatency' | 'getOutputTimestamp'>>;

export interface PlayerOptions {
  /** Descarga el fichero. Por defecto, `GET /audio`. */
  fetchAudio?: () => Promise<ArrayBuffer>;
  /** Crea el contexto de audio. Por defecto, un `AudioContext` del navegador. */
  createContext?: () => AudioContextLike;
  /** Reloj en milisegundos. Por defecto, `performance.now()`. */
  now?: () => number;
}

/** Cada cuánto se compara lo que suena con el visor (decisión 4: unas pocas veces por segundo). */
const CHECK_MS = 250;

/**
 * Cuánto por delante del reloj de audio se programa un nodo (s). Arrancar «ya» empieza un poco
 * después con el mismo punto; programado, empieza justo en su punto, y al saltar el viejo para en
 * la misma muestra (decisión 4).
 */
const LEAD = 0.05;

/**
 * Cuánto reloj de audio (s), desde que el maker pide oír, se espera como mucho a que el navegador diga
 * cuándo se oye lo que suena. Pasado, se arranca con el retraso que declara.
 */
const STARTUP = 1;

/** Ruta en la que el motor sirve el fichero de audio. */
const AUDIO_PATH = '/audio';

async function fetchAudioFile(): Promise<ArrayBuffer> {
  const response = await fetch(AUDIO_PATH);
  if (!response.ok) throw new Error(`${AUDIO_PATH} respondió ${String(response.status)}`);
  return response.arrayBuffer();
}

/** El nodo que suena: desde qué punto del fichero y en qué instante del contexto arrancó. */
interface Playing {
  node: AudioBufferSourceNode;
  offset: number;
  startedAt: number;
}

/** Una posición del fichero que llegó del motor, y cuándo (ms de `performance.now()`). */
interface Arrival {
  position: number;
  arrivedAt: number;
}

/** El fichero decodificado y su sincronía con el visor, mientras dura la conexión. */
interface Track {
  buffer: AudioBuffer;
  sync: Sync;
}

/**
 * Si el reloj de audio ya va al paso del panel (decisión 3). Recién creado, el contexto aún no suena:
 * su reloj no va al paso de `performance.now()`, el retraso declarado puede valer 0 y
 * `getOutputTimestamp()` da `performanceTime = 0`. Arrancar entonces suena tarde y la corrección
 * salta enseguida. Si `STARTUP` después de `requestedAt` (el reloj cuando se pidió oír: al volver a
 * oír, el contexto ya es viejo) el navegador sigue sin dar el instante, o no tiene la API, vale el
 * retraso declarado.
 */
function running(context: AudioContextLike, clock: AudioClock, requestedAt: number): boolean {
  if (context.state !== 'running') return false;
  return (
    clock.timestamp === undefined ||
    clock.timestamp.performanceTime > 0 ||
    clock.contextTime - requestedAt >= STARTUP
  );
}

export class AudioPlayer {
  private readonly connection: PlayerConnection;
  private readonly fetchAudio: () => Promise<ArrayBuffer>;
  private readonly createContext: () => AudioContextLike;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private unsubscribe: (() => void)[] = [];
  private context: AudioContextLike | undefined;
  private track: Track | undefined;
  /** Sin fichero aún, el último segundo de posiciones: el primer arranque sale de su mediana. */
  private arrivals: Arrival[] = [];
  private playing: Playing | undefined;
  /** El nodo de antes de un salto, que aún suena hasta que arranque el nuevo. */
  private ending: AudioBufferSourceNode | undefined;
  /** El reloj de audio cuando el maker pidió oír. */
  private requestedAt = 0;
  private check: ReturnType<typeof setInterval> | undefined;
  private current: PlayerState = 'silent';
  private lastError: number | undefined;
  private jumpCount = 0;
  /** Cambia con cada petición de oír o callar: lo que prepara una petición anterior se descarta. */
  private request = 0;

  constructor(connection: PlayerConnection, options: PlayerOptions = {}) {
    this.connection = connection;
    this.fetchAudio = options.fetchAudio ?? fetchAudioFile;
    this.createContext = options.createContext ?? (() => new AudioContext());
    this.now = options.now ?? (() => performance.now());
  }

  /** Empieza a escuchar la conexión. Se puede volver a abrir tras cerrarlo. */
  open(): void {
    if (this.unsubscribe.length > 0) return;
    const { connection } = this;
    this.unsubscribe = [
      connection.subscribePositions(({ position }, arrivedAt) => {
        this.arrive(position, arrivedAt);
      }),
      connection.subscribe(() => {
        if (connection.status === 'disconnected') this.forget();
      }),
    ];
  }

  /**
   * Deja de escuchar la conexión, calla y cierra el contexto de audio, que mantiene vivo el hilo de
   * audio del navegador. El siguiente «Oír» crea otro.
   */
  close(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.unsubscribe = [];
    this.forget();
    const { context } = this;
    this.context = undefined;
    void context?.close().catch(() => undefined);
  }

  get state(): PlayerState {
    return this.current;
  }

  /**
   * El último error de sincronía medido (s), antes de corregirlo: el punto que suena menos el del
   * visor. Positivo, el sonido va por delante de la luz. Callado, `undefined`.
   */
  get error(): number | undefined {
    return this.lastError;
  }

  /** Cuántas veces ha saltado para corregir la deriva desde que el maker pidió oír. */
  get jumps(): number {
    return this.jumpCount;
  }

  /** Avisa de cada cambio de estado. Devuelve la función para darse de baja. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Pide oír el fichero. Hay que llamarlo desde el gesto del maker (un clic): el navegador solo
   * deja sonar un contexto de audio creado o reanudado en un gesto.
   */
  play(): void {
    if (this.current !== 'silent' || this.connection.status !== 'connected') return;
    const request = ++this.request;
    this.jumpCount = 0;
    this.context ??= this.createContext();
    this.requestedAt = this.context.currentTime;
    this.context.resume().catch(() => {
      // El navegador no deja sonar: vuelve a callado y el maker puede pedirlo otra vez.
      if (request === this.request) this.stop();
    });
    this.setState('preparing');
    if (this.track) {
      this.start();
      return;
    }
    this.prepare(this.context, request).catch(() => {
      // Sin fichero no hay nada que oír: vuelve a callado y el maker puede pedirlo otra vez.
      if (request === this.request) this.setState('silent');
    });
  }

  /** Deja de oír. El motor sigue: la tira sigue reaccionando. */
  stop(): void {
    this.request++;
    this.silence();
    this.setState('silent');
  }

  private async prepare(context: AudioContextLike, request: number): Promise<void> {
    const data = await this.fetchAudio();
    const buffer = await context.decodeAudioData(data);
    // Mientras, el maker ha callado o se ha perdido la conexión: lo descargado ya no sirve.
    if (request !== this.request) return;
    // La sincronía arranca con lo que ha llegado mientras tanto, no con una sola llegada.
    const sync = createSync(buffer.duration);
    for (const { position, arrivedAt } of this.arrivals) sync.add(position, arrivedAt);
    this.arrivals = [];
    this.track = { buffer, sync };
    this.start();
  }

  /** Una posición del motor: a la sincronía, o a la espera del fichero. */
  private arrive(position: number, arrivedAt: number): void {
    const { track } = this;
    if (!track) {
      this.arrivals.push({ position, arrivedAt });
      while ((this.arrivals[0]?.arrivedAt ?? arrivedAt) < arrivedAt - WINDOW_MS) {
        this.arrivals.shift();
      }
      return;
    }
    track.sync.add(position, arrivedAt);
    // Preparado, solo faltaba saber por dónde va el visor.
    if (this.current === 'preparing') this.start();
  }

  /**
   * Programa un nodo, un poco por delante del reloj de audio, en el punto que mostrará el visor
   * cuando se oiga. Si ya sonaba otro, lo para en ese mismo instante.
   */
  private start(): void {
    const { context, track } = this;
    if (this.current !== 'preparing' && !this.playing) return;
    if (!context || !track) return;
    const clock = this.clock(context);
    // Arranca con la siguiente posición que llegue, cuando el reloj ya vaya.
    if (!running(context, clock, this.requestedAt)) return;
    const when = clock.contextTime + LEAD;
    const offset = track.sync.pointAt(audibleAt(clock, when));
    // Sin posiciones todavía: arrancará con la primera que llegue.
    if (offset === undefined) return;

    const previous = this.playing?.node;
    if (previous) {
      this.jumpCount++;
      this.ending = previous;
      previous.onended = () => {
        previous.disconnect();
        if (this.ending === previous) this.ending = undefined;
      };
      previous.stop(when);
    }
    const node = context.createBufferSource();
    node.buffer = track.buffer;
    node.loop = true;
    node.connect(context.destination);
    node.start(when, offset);
    this.playing = { node, offset, startedAt: when };
    this.check ??= setInterval(() => {
      this.correct();
    }, CHECK_MS);
    this.setState('playing');
  }

  /**
   * Compara lo que suena con lo que muestra el visor y, si se han separado más del umbral, salta al
   * punto bueno (decisión 4).
   */
  private correct(): void {
    const { context, track, playing } = this;
    if (!context || !track || !playing) return;
    // Parado (Safari lo interrumpe con una llamada), su reloj no avanza: el error crecería solo.
    if (context.state !== 'running') return;
    const clock = this.clock(context);
    const sounding = playing.offset + (clock.contextTime - playing.startedAt);
    const viewer = track.sync.pointAt(audibleAt(clock, clock.contextTime));
    if (viewer === undefined) return;
    this.lastError = circularDifference(sounding, viewer, track.buffer.duration);
    if (shouldJump(this.lastError)) this.start();
  }

  private clock(context: AudioContextLike): AudioClock {
    // Se leen juntos: el reloj de audio y el del panel en el mismo momento.
    const timestamp = context.getOutputTimestamp?.();
    const declared = (context.outputLatency ?? 0) + (context.baseLatency ?? 0);
    return {
      contextTime: context.currentTime,
      now: this.now(),
      outputLatency: declared,
      timestamp:
        timestamp?.contextTime === undefined || timestamp.performanceTime === undefined
          ? undefined
          : { contextTime: timestamp.contextTime, performanceTime: timestamp.performanceTime },
    };
  }

  /** Para los nodos que suenan, si hay alguno, y la comprobación de la deriva. */
  private silence(): void {
    const { playing, ending } = this;
    this.playing = undefined;
    this.ending = undefined;
    this.lastError = undefined;
    clearInterval(this.check);
    this.check = undefined;
    // El de antes de un salto también, ya: no puede seguir sonando hasta que arrancase el nuevo.
    for (const node of [ending, playing?.node]) {
      if (!node) continue;
      node.stop();
      node.disconnect();
    }
  }

  /** Sin conexión: calla y suelta el fichero, que el motor de después puede no tener. */
  private forget(): void {
    this.track = undefined;
    this.arrivals = [];
    this.jumpCount = 0;
    this.stop();
  }

  private setState(state: PlayerState): void {
    if (state === this.current) return;
    this.current = state;
    for (const listener of this.listeners) listener();
  }
}
