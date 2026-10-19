/**
 * Un `AudioContext` falso para los tests del reproductor y del panel: jsdom no trae Web Audio. El
 * test mueve su reloj, decide su retraso de salida y mira los nodos que se arrancan.
 */
import type { AudioContextLike } from '../src/audio/player.ts';

/** Un nodo de audio falso: apunta cómo lo arrancan y si lo paran. */
export class FakeNode {
  buffer: AudioBuffer | null = null;
  loop = false;
  started: { when: number; offset: number } | undefined;
  stopped = false;
  connected = false;

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }

  start(when: number, offset: number): void {
    this.started = { when, offset };
  }

  stop(): void {
    this.stopped = true;
  }
}

/** Un `AudioContext` falso: el test mueve su reloj y decide su retraso de salida. */
export class FakeContext implements AudioContextLike {
  currentTime = 50;
  outputLatency: number | undefined = 0.03;
  baseLatency: number | undefined = 0.01;
  readonly destination = {} as AudioDestinationNode;
  readonly nodes: FakeNode[] = [];
  resumed = 0;
  decoded: ArrayBuffer[] = [];

  resume(): Promise<void> {
    this.resumed++;
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
