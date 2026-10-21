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

/** Un `arecord` en memoria: el test decide cuándo entrega bloques y cuándo termina. */
class FakeCapture implements CaptureProcess {
  readonly spawned: { command: string; args: readonly string[] }[] = [];
  private data?: (chunk: Uint8Array) => void;
  private stderr?: (chunk: Uint8Array) => void;
  private exit?: (exit: CaptureExit) => void;

  spawn = (command: string, args: readonly string[]): CaptureProcess => {
    this.spawned.push({ command, args });
    return this;
  };

  onData(listener: (chunk: Uint8Array) => void): void {
    this.data = listener;
  }

  onStderr(listener: (chunk: Uint8Array) => void): void {
    this.stderr = listener;
  }

  onExit(listener: (exit: CaptureExit) => void): void {
    this.exit = listener;
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

/** Las muestras como las entrega `arecord -f S16_LE`: enteros de 16 bits, little-endian. */
function s16le(samples: readonly number[]): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  samples.forEach((sample, index) => view.setInt16(index * 2, sample, true));
  return bytes;
}

/** Abre la tarjeta con el proceso falso y le hace entregar `first` para que arranque. */
async function opened(first: Uint8Array = new Uint8Array(2 * DISCARDED)) {
  const capture = new FakeCapture();
  const logs: string[] = [];
  const pending = openSoundcard(MIXER, capture.spawn, (line) => logs.push(line));
  capture.emit(first);
  const result = await pending;
  if (!result.ok) throw new Error(result.error);
  return { capture, logs, source: result.source };
}

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
    const { capture } = await opened();

    expect(capture.spawned).toEqual([{ command: 'arecord', args: arecordArgs(MIXER.device) }]);
  });
});

describe('el arranque', () => {
  it('se resuelve con el primer bloque, aunque sea silencio', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

    capture.emit(new Uint8Array(4));

    expect((await pending).ok).toBe(true);
  });

  it('si arecord termina antes, falla con nombre, cadena y su última línea de error', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

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
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

    capture.terminate({ code: 1 });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(arecord ha terminado con el código 1)',
    });
  });

  it('si a arecord lo para una señal, sin código, lo dice', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

    capture.terminate({ code: null });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(arecord ha terminado)',
    });
  });

  it('sin arecord en el sistema, dice que la tarjeta necesita Linux con ALSA', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

    const error = Object.assign(new Error('spawn arecord ENOENT'), { code: 'ENOENT' });
    capture.terminate({ code: null, error });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): la tarjeta de sonido ' +
        'necesita Linux con ALSA (no se encuentra arecord); ' +
        'en este equipo, usa un fichero de audio',
    });
  });

  it('si lanzarlo falla por otro motivo, lo dice', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

    capture.terminate({ code: null, error: new Error('spawn arecord EACCES') });

    expect(await pending).toEqual({
      ok: false,
      error:
        'tarjeta de sonido «Mixer de la mesa» (plughw:CARD=Device,DEV=0): no se puede abrir ' +
        '(spawn arecord EACCES)',
    });
  });

  it('una línea de stderr sin que termine no es un fallo', async () => {
    const capture = new FakeCapture();
    const pending = openSoundcard(MIXER, capture.spawn, () => {});

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
});
