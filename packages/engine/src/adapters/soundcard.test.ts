import { describe, expect, it } from 'vitest';

import {
  arecordArgs,
  type CaptureExit,
  type CaptureProcess,
  openSoundcard,
  type SoundcardConfig,
} from './soundcard.ts';

const MIXER: SoundcardConfig = {
  type: 'soundcard',
  name: 'Mixer de la mesa',
  device: 'plughw:CARD=Device,DEV=0',
  silenceThreshold: -60,
};

/** Muestras que se descartan al abrir la tarjeta: 300 ms a 48 kHz. */
const DISCARDED = 14_400;

/** Un proceso `arecord` en memoria: el test decide cuándo entrega bloques y cuándo termina. */
class FakeCapture implements CaptureProcess {
  private data?: (chunk: Uint8Array) => void;
  private stderr?: (chunk: Uint8Array) => void;
  private exit?: (exit: CaptureExit) => void;
  stopped = false;

  onData(listener: (chunk: Uint8Array) => void): void {
    this.data = listener;
  }

  onStderr(listener: (chunk: Uint8Array) => void): void {
    this.stderr = listener;
  }

  onExit(listener: (exit: CaptureExit) => void): void {
    this.exit = listener;
  }

  stop(): void {
    this.stopped = true;
  }

  emit(chunk: Uint8Array): void {
    this.data?.(chunk);
  }

  emitStderr(text: string): void {
    this.stderr?.(new TextEncoder().encode(text));
  }

  terminate(exit: CaptureExit): void {
    this.exit?.(exit);
  }
}

/** Lanza un `FakeCapture` nuevo cada vez, como el `arecord` de verdad, y los guarda en orden. */
class FakeArecord {
  readonly spawned: { command: string; args: readonly string[] }[] = [];
  readonly processes: FakeCapture[] = [];

  spawn = (command: string, args: readonly string[]): CaptureProcess => {
    this.spawned.push({ command, args });
    const capture = new FakeCapture();
    this.processes.push(capture);
    return capture;
  };

  /** El último que se ha lanzado. */
  get current(): FakeCapture {
    const last = this.processes.at(-1);
    if (!last) throw new Error('No se ha lanzado arecord');
    return last;
  }
}

/** Un reloj que solo avanza cuando el test lo dice. */
class FakeClock {
  private now = 0;
  private timers: { at: number; callback: () => void }[] = [];

  schedule = (callback: () => void, ms: number): (() => void) => {
    const timer = { at: this.now + ms, callback };
    this.timers.push(timer);
    return () => {
      this.timers = this.timers.filter((each) => each !== timer);
    };
  };

  get pending(): number {
    return this.timers.length;
  }

  advance(ms: number): void {
    const until = this.now + ms;
    for (;;) {
      const next = this.timers.filter((timer) => timer.at <= until).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      this.timers = this.timers.filter((timer) => timer !== next);
      this.now = next.at;
      next.callback();
    }
    this.now = until;
  }
}

/** Las muestras como las entrega `arecord -f S16_LE`: enteros de 16 bits, little-endian. */
function s16le(samples: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
  return bytes;
}

/** Abre la tarjeta con el proceso falso y le hace entregar `first` para que arranque. */
async function opened(first: Uint8Array = new Uint8Array(2 * DISCARDED)) {
  const arecord = new FakeArecord();
  const clock = new FakeClock();
  const logs: string[] = [];
  const pending = openSoundcard(MIXER, arecord.spawn, (line) => logs.push(line), clock.schedule);
  const capture = arecord.current;
  capture.emit(first);
  const result = await pending;
  if (!result.ok) throw new Error(result.error);
  return { arecord, capture, clock, logs, ...result };
}

/** Lo que se tira al abrir la tarjeta y una muestra a 0,25: lo justo para oír algo. */
const AFTER_DISCARD = s16le([...Array.from({ length: DISCARDED }, () => 20_000), 8192]);

function read(source: { read(time: number, out: Float32Array): void }, length: number): number[] {
  const out = new Float32Array(length).fill(9);
  source.read(0, out);
  return Array.from(out);
}

describe('los argumentos de arecord', () => {
  it('graban de la cadena declarada, en mono a 48 kHz, con periodos de 10 ms', () => {
    expect(arecordArgs('plughw:CARD=Device,DEV=0')).toEqual([
      '-q',
      '-D',
      'plughw:CARD=Device,DEV=0',
      '-t',
      'raw',
      '-f',
      'S16_LE',
      '-c',
      '1',
      '-r',
      '48000',
      '--period-time=10000',
      '--buffer-time=40000',
    ]);
  });

  it('con varias tarjetas, lanza arecord con la declarada', async () => {
    const { arecord } = await opened();

    expect(arecord.spawned).toEqual([{ command: 'arecord', args: arecordArgs(MIXER.device) }]);
  });
});

describe('el arranque', () => {
  it('se resuelve con el primer bloque, aunque sea silencio', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.emit(new Uint8Array(4));

    expect((await pending).ok).toBe(true);
  });

  it('si arecord termina antes, falla con nombre, cadena y su última línea de error', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.emitStderr('arecord: main:850: audio open error: ');
    capture.emitStderr('No such file or directory\n');
    capture.terminate({ code: 1 });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(arecord: main:850: audio open error: No such file or directory)',
    });
  });

  it('si arecord termina sin decir nada, el motivo es su código', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.terminate({ code: 1 });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(arecord ha terminado con el código 1)',
    });
  });

  it('si a arecord lo para una señal, sin código, lo dice', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.terminate({ code: null });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(arecord ha terminado)',
    });
  });

  it('sin arecord en el sistema, dice que la tarjeta necesita Linux con ALSA', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    const error = Object.assign(new Error('spawn arecord ENOENT'), { code: 'ENOENT' });
    capture.terminate({ code: null, error });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): necesita Linux con ALSA ' +
        '(no se encuentra arecord); en este equipo, usa un fichero de audio',
    });
  });

  it('si lanzarlo falla por otro motivo, lo dice', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.terminate({ code: null, error: new Error('spawn arecord EACCES') });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(spawn arecord EACCES)',
    });
  });

  it('una línea de stderr sin que termine no es un fallo', async () => {
    const arecord = new FakeArecord();
    const pending = openSoundcard(MIXER, arecord.spawn, () => {});
    const capture = arecord.current;

    capture.emitStderr('overrun!!! (at least 1.234 ms long)\n');
    capture.emit(new Uint8Array(2));

    expect((await pending).ok).toBe(true);
  });
});

describe('la fuente', () => {
  it('entrega a 48 kHz, con el umbral de silencio de la configuración y sin posición', async () => {
    const { source } = await opened();

    expect(source.sampleRate).toBe(48_000);
    expect(source.silenceThreshold).toBe(-60);
    expect('positionAt' in source).toBe(false);
  });

  it('convierte los s16le en muestras de -1 a 1', async () => {
    const { capture, source } = await opened();

    capture.emit(s16le([0, 16_384, -16_384, 32_767, -32_768]));

    expect(read(source, 5)).toEqual([0, 0.5, -0.5, 32_767 / 32_768, -1]);
  });

  it('también con bloques de longitud impar, que parten una muestra', async () => {
    const { capture, source } = await opened();
    const bytes = s16le([1000, -2000, 3000]);

    capture.emit(bytes.subarray(0, 1));
    capture.emit(bytes.subarray(1, 4));
    capture.emit(bytes.subarray(4));

    expect(read(source, 3)).toEqual([1000 / 32_768, -2000 / 32_768, 3000 / 32_768]);
  });

  it('descarta 300 ms: el chasquido al abrir la tarjeta no llega al búfer', async () => {
    const loud = Array.from({ length: DISCARDED }, () => 20_000);
    const { capture, source } = await opened(s16le(loud.slice(0, 100)));

    expect(read(source, 4)).toEqual([0, 0, 0, 0]);
    capture.emit(s16le([...loud.slice(100), 8192, 8192]));

    expect(read(source, 4)).toEqual([0, 0, 0.25, 0.25]);
  });

  it('una muestra partida entre bloques en el límite del descarte no se cuela', async () => {
    const loud = s16le(Array.from({ length: DISCARDED }, () => 20_000));
    // El primer bloque acaba a mitad de la última muestra descartada.
    const { capture, source } = await opened(loud.subarray(0, loud.length - 1));

    capture.emit(Uint8Array.from([...loud.subarray(loud.length - 1), ...s16le([8192])]));

    expect(read(source, 2)).toEqual([0, 0.25]);
  });

  it('da las últimas muestras sin mirar el instante, con ceros delante si faltan', async () => {
    const { capture, source } = await opened();

    capture.emit(s16le([8192, 16_384]));
    const out = new Float32Array(3);
    source.read(123.4, out);

    expect(Array.from(out)).toEqual([0, 0.25, 0.5]);
  });

  it('el búfer guarda medio segundo: lo más antiguo se pierde', async () => {
    const { capture, source } = await opened();

    capture.emit(s16le(Array.from({ length: 24_000 }, () => 8192)));
    capture.emit(s16le([16_384]));

    const window = read(source, 24_000);
    expect(window.at(0)).toBe(0.25);
    expect(window.at(-1)).toBe(0.5);
    expect(window.filter((sample) => sample === 0.5)).toHaveLength(1);
  });

  it('con una ventana mayor que el búfer, da todo el búfer con ceros delante', async () => {
    const { capture, source } = await opened();
    capture.emit(s16le(Array.from({ length: 24_000 }, () => 8192)));
    capture.emit(s16le([16_384]));

    const window = read(source, 24_010);

    expect(window.slice(0, 10)).toEqual(Array.from({ length: 10 }, () => 0));
    expect(window.at(10)).toBe(0.25);
    expect(window.at(-1)).toBe(0.5);
  });
});

describe('si se pierde la tarjeta en plena sesión', () => {
  it('da silencio y lo dice una vez en el log, con el nombre, la cadena y el motivo', async () => {
    const { capture, source, logs } = await opened();
    capture.emit(s16le([8192, 8192]));

    capture.emitStderr('arecord: pcm_read:2221: read error: No such device\n');
    capture.terminate({ code: 1 });
    capture.terminate({ code: 1 });
    capture.emit(s16le([8192, 8192]));

    expect(read(source, 4)).toEqual([0, 0, 0, 0]);
    expect(logs).toEqual([
      'Se ha perdido la tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): ' +
        'arecord: pcm_read:2221: read error: No such device. El motor sigue con silencio.',
    ]);
  });

  it('el motivo no es una línea de stderr anterior al último bloque', async () => {
    const { capture, logs } = await opened();
    capture.emitStderr('overrun!!! (at least 1.234 ms long)\n');
    capture.emit(s16le([8192, 8192]));

    capture.terminate({ code: 1 });

    expect(logs).toEqual([
      'Se ha perdido la tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): ' +
        'arecord ha terminado con el código 1. El motor sigue con silencio.',
    ]);
  });

  it('si a arecord lo para una señal, la nombra', async () => {
    const { capture, logs } = await opened();

    capture.terminate({ code: null, signal: 'SIGKILL' });

    expect(logs).toEqual([
      'Se ha perdido la tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): ' +
        'arecord ha terminado por la señal SIGKILL. El motor sigue con silencio.',
    ]);
  });
});

const LOST_LINE =
  'Se ha perdido la tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): ' +
  'arecord: pcm_read:2221: read error: No such device. El motor sigue con silencio.';
const RECOVERED_LINE =
  'Se ha recuperado la tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0).';

/** Desenchufa la tarjeta: `arecord` termina como en la mesa (prueba del 22-oct). */
function unplug(capture: FakeCapture): void {
  capture.emitStderr('arecord: pcm_read:2221: read error: No such device\n');
  capture.terminate({ code: 1 });
}

/** Un intento con la tarjeta aún desenchufada: `arecord` no puede abrirla y termina. */
function failToOpen(capture: FakeCapture): void {
  capture.emitStderr('arecord: main:850: audio open error: No such file or directory\n');
  capture.terminate({ code: 1 });
}

describe('tras perder la tarjeta en plena sesión', () => {
  it('cada segundo lanza arecord otra vez, con la misma cadena', async () => {
    const { arecord, capture, clock } = await opened();

    unplug(capture);
    clock.advance(999);
    expect(arecord.spawned).toHaveLength(1);

    clock.advance(1);
    expect(arecord.spawned).toHaveLength(2);
    failToOpen(arecord.current);
    clock.advance(1000);

    expect(arecord.spawned).toEqual(
      Array.from({ length: 3 }, () => ({ command: 'arecord', args: arecordArgs(MIXER.device) })),
    );
  });

  it('un intento que termina antes del primer bloque no escribe en el log y programa otro', async () => {
    const { arecord, capture, clock, logs } = await opened();
    unplug(capture);
    clock.advance(1000);

    failToOpen(arecord.current);

    expect(logs).toEqual([LOST_LINE]);
    expect(clock.pending).toBe(1);
  });

  it('el primer bloque la recupera: lo dice en el log y vuelve a entregar audio', async () => {
    const { arecord, capture, clock, logs, source } = await opened();
    unplug(capture);
    clock.advance(1000);

    arecord.current.emit(AFTER_DISCARD);

    expect(logs).toEqual([LOST_LINE, RECOVERED_LINE]);
    expect(read(source, 2)).toEqual([0, 0.25]);
    expect(clock.pending).toBe(0);
  });

  it('al recuperarla descarta otra vez 300 ms y no entrega audio de antes del corte', async () => {
    const { arecord, capture, clock, source } = await opened();
    capture.emit(s16le([16_384, 16_384, 16_384]));
    unplug(capture);
    clock.advance(1000);

    arecord.current.emit(s16le(Array.from({ length: DISCARDED - 1 }, () => 20_000)));
    expect(read(source, 3)).toEqual([0, 0, 0]);

    arecord.current.emit(s16le([20_000, 8192]));
    expect(read(source, 3)).toEqual([0, 0, 0.25]);
  });

  it('una muestra partida al perderla no se mezcla con el audio al recuperarla', async () => {
    const { arecord, capture, clock, source } = await opened();
    capture.emit(Uint8Array.of(0xff));
    unplug(capture);
    clock.advance(1000);

    arecord.current.emit(AFTER_DISCARD);

    expect(read(source, 1)).toEqual([0.25]);
  });

  it('sigue intentándolo tras muchos fallos seguidos', async () => {
    const { arecord, capture, clock, logs, source } = await opened();
    unplug(capture);

    for (let attempt = 0; attempt < 600; attempt++) {
      clock.advance(1000);
      failToOpen(arecord.current);
    }
    clock.advance(1000);
    arecord.current.emit(AFTER_DISCARD);

    expect(arecord.spawned).toHaveLength(602);
    expect(logs).toEqual([LOST_LINE, RECOVERED_LINE]);
    expect(read(source, 1)).toEqual([0.25]);
  });

  it('con un cable flojo, cada pérdida y cada recuperación dicen su línea', async () => {
    const { arecord, capture, clock, logs } = await opened();

    unplug(capture);
    clock.advance(1000);
    arecord.current.emit(AFTER_DISCARD);
    unplug(arecord.current);
    clock.advance(1000);
    arecord.current.emit(AFTER_DISCARD);

    expect(logs).toEqual([LOST_LINE, RECOVERED_LINE, LOST_LINE, RECOVERED_LINE]);
  });

  it('un proceso que ya ha terminado no cuenta: ni su audio ni otra pérdida', async () => {
    const { arecord, capture, clock, logs, source } = await opened();
    unplug(capture);
    clock.advance(1000);
    arecord.current.emit(AFTER_DISCARD);

    capture.emit(s16le([16_384]));
    capture.terminate({ code: 1 });

    expect(read(source, 1)).toEqual([0.25]);
    expect(logs).toEqual([LOST_LINE, RECOVERED_LINE]);
  });
});

describe('el estado de la tarjeta', () => {
  it('quien se suscribe recibe el estado actual al momento y cada cambio después', async () => {
    const { arecord, capture, clock, onStatus } = await opened();
    const statuses: string[] = [];

    onStatus((status) => statuses.push(status));
    unplug(capture);
    clock.advance(1000);
    failToOpen(arecord.current);
    clock.advance(1000);
    arecord.current.emit(AFTER_DISCARD);

    expect(statuses).toEqual(['connected', 'lost', 'connected']);
  });

  it('si se suscribe con la tarjeta perdida, recibe que está perdida', async () => {
    const { capture, onStatus } = await opened();
    unplug(capture);
    const statuses: string[] = [];

    onStatus((status) => statuses.push(status));

    expect(statuses).toEqual(['lost']);
  });
});

describe('al parar la fuente', () => {
  it('para arecord, da silencio y no lo cuenta como una pérdida', async () => {
    const { capture, source, logs, stop } = await opened();
    capture.emit(s16le([8192, 8192]));

    stop();
    capture.terminate({ code: null, signal: 'SIGTERM' });

    expect(capture.stopped).toBe(true);
    expect(read(source, 2)).toEqual([0, 0]);
    expect(logs).toEqual([]);
  });

  it('con la tarjeta perdida, cancela el intento pendiente y no lanza más arecord', async () => {
    const { arecord, capture, clock, logs, stop } = await opened();
    unplug(capture);

    stop();
    clock.advance(10_000);

    expect(clock.pending).toBe(0);
    expect(arecord.spawned).toHaveLength(1);
    expect(logs).toEqual([LOST_LINE]);
  });

  it('a mitad de un intento, para ese arecord y no programa otro', async () => {
    const { arecord, capture, clock, logs, onStatus, stop } = await opened();
    unplug(capture);
    clock.advance(1000);
    const statuses: string[] = [];
    onStatus((status) => statuses.push(status));

    stop();
    arecord.current.terminate({ code: null, signal: 'SIGTERM' });
    clock.advance(10_000);

    expect(arecord.current.stopped).toBe(true);
    expect(arecord.spawned).toHaveLength(2);
    expect(logs).toEqual([LOST_LINE]);
    expect(statuses).toEqual(['lost']);
  });
});
