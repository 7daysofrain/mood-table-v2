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
  'currentTime' | 'destination' | 'resume' | 'decodeAudioData' | 'createBufferSource'
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

/** El fichero decodificado y su sincronía con el visor, mientras dura la conexión. */
interface Track {
  buffer: AudioBuffer;
  sync: Sync;
}

export class AudioPlayer {
  private readonly connection: PlayerConnection;
  private readonly fetchAudio: () => Promise<ArrayBuffer>;
  private readonly createContext: () => AudioContextLike;
  private readonly now: () => number;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[];
  private context: AudioContextLike | undefined;
  private track: Track | undefined;
  private playing: Playing | undefined;
  private check: ReturnType<typeof setInterval> | undefined;
  private current: PlayerState = 'silent';
  private lastError: number | undefined;
  /** Cambia con cada petición de oír o callar: lo que prepara una petición anterior se descarta. */
  private request = 0;

  constructor(connection: PlayerConnection, options: PlayerOptions = {}) {
    this.connection = connection;
    this.fetchAudio = options.fetchAudio ?? fetchAudioFile;
    this.createContext = options.createContext ?? (() => new AudioContext());
    this.now = options.now ?? (() => performance.now());
    this.unsubscribe = [
      connection.subscribePositions(({ position }, arrivedAt) => {
        this.track?.sync.add(position, arrivedAt);
        // Preparado, solo faltaba saber por dónde va el visor.
        if (this.current === 'preparing' && this.track) this.start();
      }),
      connection.subscribe(() => {
        if (connection.status === 'disconnected') this.forget();
      }),
    ];
  }

  get state(): PlayerState {
    return this.current;
  }

  /**
   * El último error de sincronía medido (s): el punto que suena menos el del visor. Positivo, el
   * sonido va por delante de la luz. Callado, `undefined`.
   */
  get error(): number | undefined {
    return this.lastError;
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
    this.context ??= this.createContext();
    void this.context.resume();
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

  /** Deja de escuchar la conexión y calla. */
  dispose(): void {
    for (const unsubscribe of this.unsubscribe) unsubscribe();
    this.stop();
  }

  private async prepare(context: AudioContextLike, request: number): Promise<void> {
    const data = await this.fetchAudio();
    const buffer = await context.decodeAudioData(data);
    // Mientras, el maker ha callado o se ha perdido la conexión: lo descargado ya no sirve.
    if (request !== this.request) return;
    // Arranca con la primera posición que llegue: la sincronía empieza a contar desde ahora.
    this.track = { buffer, sync: createSync(buffer.duration) };
  }

  /** Arranca un nodo en el punto que muestra el visor cuando empiece a oírse. */
  private start(): void {
    const { context, track } = this;
    if (!context || !track) return;
    const clock = this.clock(context);
    const offset = track.sync.pointAt(audibleAt(clock, clock.contextTime));
    // Sin posiciones todavía: arrancará con la primera que llegue.
    if (offset === undefined) return;

    this.silence();
    const node = context.createBufferSource();
    node.buffer = track.buffer;
    node.loop = true;
    node.connect(context.destination);
    node.start(clock.contextTime, offset);
    this.playing = { node, offset, startedAt: clock.contextTime };
    this.lastError = 0;
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

  /** Para el nodo que suena, si hay alguno, y la comprobación de la deriva. */
  private silence(): void {
    const { playing } = this;
    this.playing = undefined;
    this.lastError = undefined;
    clearInterval(this.check);
    this.check = undefined;
    if (!playing) return;
    playing.node.stop();
    playing.node.disconnect();
  }

  /** Sin conexión: calla y suelta el fichero, que el motor de después puede no tener. */
  private forget(): void {
    this.track = undefined;
    this.stop();
  }

  private setState(state: PlayerState): void {
    if (state === this.current) return;
    this.current = state;
    for (const listener of this.listeners) listener();
  }
}
