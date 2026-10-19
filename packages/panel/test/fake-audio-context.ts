/**
 * Un `AudioContext` falso para los tests del reproductor y del panel: jsdom no trae Web Audio. El
 * test mueve su reloj, decide su retraso de salida y mira los nodos que se arrancan.
 */
import type { AudioContextLike } from '../src/audio/player.ts';

/** Un nodo de audio falso: apunta cómo lo arrancan y cuándo lo paran. */
export class FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  started: { when: number; offset: number } | undefined;
  stopped = false;
  /** El instante del contexto en que se pidió que parase; `0`, ya. */
  stoppedAt: number | undefined;
  connected = false;
  onended: (() => void) | null = null;

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  start(when: number, offset: number): void {
    this.started = { when, offset };
  }

  stop(when = 0): void {
    this.stopped = true;
    this.stoppedAt = when;
  }
}

/** Un `AudioContext` falso: el test mueve su reloj y decide su retraso de salida. */
export class FakeContext implements AudioContextLike {
  currentTime = 50;
  state: AudioContextState = 'running';
  /** Si es `true`, el navegador no deja reanudar el contexto. */
  resumeFails = false;
  outputLatency: number | undefined = 0.03;
  baseLatency: number | undefined = 0.01;
  readonly destination = {} as AudioDestinationNode;
  readonly nodes: FakeNode[] = [];
  resumed = 0;
  decoded: ArrayBuffer[] = [];

  resume(): Promise<void> {
    this.resumed++;
    if (this.resumeFails) return Promise.reject(new Error('NotAllowedError'));
    this.state = 'running';
    return Promise.resolve();
  }

  decodeAudioData(data: ArrayBuffer): Promise<AudioBuffer> {
    this.decoded.push(data);
    return Promise.resolve({ duration: 4 } as AudioBuffer);
  }

  createBufferSource(): AudioBufferSourceNode {
    const node = new FakeNode();
    this.nodes.push(node);
    return node as unknown as AudioBufferSourceNode;
  }
}
