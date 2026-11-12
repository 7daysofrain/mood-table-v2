import { describe, expect, it } from 'vitest';

import type { LightOutput } from '../core/frame-loop.ts';
import {
  adalightBuffer,
  AdalightOutput,
  channelSources,
  encodeAdalight,
  openAdalight,
  openAdalightStrips,
  type SerialLink,
} from './adalight.ts';

/**
 * Un puerto serie en memoria: guarda lo que se le escribe y el test decide cuándo ha salido por el
 * cable (`finish`), si falla o si se pierde. Si se le escribe con un envío pendiente, lanza.
 */
class FakeLink implements SerialLink {
  /** Lo que la salida le ha pasado en cada escritura, tal cual: si lo cambia después, se ve aquí. */
  readonly writes: Uint8Array[] = [];
  /** Una copia de cada escritura en el momento de hacerla. */
  readonly copies: Uint8Array[] = [];
  closed = false;
  private onSent: ((error?: Error) => void) | undefined;
  private onLost: ((reason: string) => void) | undefined;

  get pending(): boolean {
    return this.onSent !== undefined;
  }

  write(bytes: Uint8Array, onSent: (error?: Error) => void): void {
    if (this.onSent) throw new Error('Dos envíos pendientes a la vez');
    this.writes.push(bytes);
    this.copies.push(bytes.slice());
    this.onSent = onSent;
  }

  watchLoss(listener: (reason: string) => void): void {
    this.onLost = listener;
  }

  /** El envío pendiente ha salido por el cable, o ha fallado con `error`. */
  finish(error?: Error): void {
    const onSent = this.onSent;
    this.onSent = undefined;
    onSent?.(error);
  }

  lose(reason: string): void {
    this.onLost?.(reason);
  }

  close(): void {
    this.closed = true;
  }
}

/** La tira de la mesa (D46), con el orden de color de su chip, la `WS2812B`. */
const table = {
  name: 'Mesa',
  ledCount: 173,
  port: '/dev/ttyUSB0',
  baudRate: 115200,
  colorOrder: 'GRB' as const,
};

/** El orden RGB, que deja cada canal en su sitio: para medir solo la gamma. */
const AS_IS = [0, 1, 2] as const;

/**
 * Los valores de un canal que la gamma no junta (del 128 al 255), y de qué valor sale cada byte
 * escrito: el pulso se guarda en base 128 con ellos y se lee pasando por la propia codificación.
 */
const DIGIT = 128;
const digitOf = new Map(
  Array.from({ length: DIGIT }, (_, digit) => [
    encodeAdalight(adalightBuffer(1), Uint8Array.of(DIGIT + digit, 0, 0), AS_IS)[6],
    digit,
  ]),
);

/**
 * Un frame de la mesa que lleva `seq` en el azul de los dos primeros LEDs, para saber de qué pulso es
 * lo escrito. El azul, porque el orden GRB no lo mueve.
 */
function frameOf(seq: number, frame: Uint8Array = new Uint8Array(table.ledCount * 3)): Uint8Array {
  frame[2] = DIGIT + (seq % DIGIT);
  frame[5] = DIGIT + Math.floor(seq / DIGIT);
  return frame;
}

/** El pulso que lleva un frame escrito en el puerto (tras los 6 bytes de la cabecera). */
function seqOf(written: Uint8Array): number {
  const low = digitOf.get(written[8] ?? 0);
  const high = digitOf.get(written[11] ?? 0);
  if (low === undefined || high === undefined) throw new Error('El frame escrito no lleva un pulso');
  return low + high * DIGIT;
}

function tick(seq: number): { seq: number; time: number } {
  return { seq, time: seq / 60 };
}

/** La salida, vista como la ve el bucle: un `LightOutput` más. */
function outputWith(link: FakeLink, log: string[] = [], now = () => 0): LightOutput {
  return new AdalightOutput(table, link, { log: (line) => log.push(line), now });
}

/** Los bytes en hexadecimal, separados por espacios, para leer las cabeceras como en la spec. */
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

describe('la codificación Adalight', () => {
  it('el frame de 173 LEDs de una WS2812B con el primero en rojo puro son 525 bytes con su cabecera', () => {
    const frame = new Uint8Array(173 * 3);
    frame[0] = 0xff;

    const encoded = encodeAdalight(adalightBuffer(173), frame, channelSources('GRB'));

    expect(encoded).toHaveLength(525);
    expect(hex(encoded.subarray(0, 9))).toBe('41 64 61 00 AC F9 00 FF 00');
    expect(encoded.subarray(9).every((byte) => byte === 0)).toBe(true);
  });

  it.each([
    [1, '41 64 61 00 00 55'],
    [300, '41 64 61 01 2B 7F'],
  ])('la cabecera de %d LEDs es %s', (ledCount, header) => {
    expect(hex(adalightBuffer(ledCount).subarray(0, 6))).toBe(header);
  });

  it('copia los LEDs en el orden de la tira', () => {
    // 0 y 255 no cambian con la gamma: aquí solo cuenta el orden.
    const frame = Uint8Array.of(255, 0, 0, 0, 0, 255);

    expect(Array.from(encodeAdalight(adalightBuffer(2), frame, AS_IS).subarray(6))).toEqual([
      255, 0, 0, 0, 0, 255,
    ]);
  });

  it('corrige cada canal con la gamma 2,0 de los LEDs: un color tenue sale más tenue', () => {
    const frame = Uint8Array.of(128, 30, 255);

    expect(Array.from(encodeAdalight(adalightBuffer(1), frame, AS_IS).subarray(6))).toEqual([
      64, 4, 255,
    ]);
  });

  it('con el orden GRB, un color tenue sale más tenue y con el verde primero', () => {
    const frame = Uint8Array.of(128, 30, 255);

    expect(hex(encodeAdalight(adalightBuffer(1), frame, channelSources('GRB')).subarray(6))).toBe(
      '04 40 FF',
    );
  });

  // Un LED a (255, 128, 30), que la gamma deja en (255, 64, 4): tres valores distintos que se ven.
  it.each([
    ['RGB', [255, 64, 4]],
    ['RBG', [255, 4, 64]],
    ['GRB', [64, 255, 4]],
    ['GBR', [64, 4, 255]],
    ['BRG', [4, 255, 64]],
    ['BGR', [4, 64, 255]],
  ] as const)('con el orden %s, escribe los canales de cada LED en ese orden: %j', (order, bytes) => {
    const frame = Uint8Array.of(255, 128, 30, 255, 128, 30);

    expect(Array.from(encodeAdalight(adalightBuffer(2), frame, channelSources(order)).subarray(6))).toEqual(
      [...bytes, ...bytes],
    );
  });

  it.each([
    [0, 0],
    [11, 0],
    [12, 1],
    [255, 255],
  ])('con la gamma, un %d sale como %d', (value, encoded) => {
    expect(encodeAdalight(adalightBuffer(1), Uint8Array.of(value, 0, 0), AS_IS)[6]).toBe(encoded);
  });

  it('escribe en el búfer de la salida, sin crear otro', () => {
    const buffer = adalightBuffer(2);

    expect(encodeAdalight(buffer, new Uint8Array(6), AS_IS)).toBe(buffer);
  });
});

describe('la salida Adalight', () => {
  it('escribe los canales en el orden de color de su tira', () => {
    const link = new FakeLink();
    const frame = new Uint8Array(table.ledCount * 3);
    frame[0] = 0xff;

    outputWith(link).write(frame, tick(1));

    expect(hex((link.copies[0] ?? new Uint8Array()).subarray(6, 9))).toBe('00 FF 00');
  });

  it('escribe el frame del primer pulso y descarta los siguientes mientras no ha salido', () => {
    const link = new FakeLink();
    const output = outputWith(link);

    output.write(frameOf(10), tick(10));
    output.write(frameOf(11), tick(11));
    output.write(frameOf(12), tick(12));

    expect(link.copies.map(seqOf)).toEqual([10]);
  });

  it('cuando el frame ha salido, escribe el del pulso siguiente', () => {
    const link = new FakeLink();
    const output = outputWith(link);
    output.write(frameOf(10), tick(10));
    output.write(frameOf(11), tick(11));

    link.finish();
    output.write(frameOf(13), tick(13));

    expect(link.copies.map(seqOf)).toEqual([10, 13]);
  });

  it('con un puerto que tarda 3 pulsos por frame, en 1.000 pulsos cada frame es el de su pulso', () => {
    const link = new FakeLink();
    const output = outputWith(link);
    const frame = new Uint8Array(table.ledCount * 3);
    const writtenAt: number[] = [];
    let sentAt = 0;

    for (let seq = 0; seq < 1000; seq++) {
      // El envío tarda lo que 2,7 pulsos: sale antes del tercer pulso desde que se escribió.
      if (link.pending && seq - sentAt >= 3) link.finish();
      const before = link.copies.length;
      output.write(frameOf(seq, frame), tick(seq));
      if (link.copies.length > before) {
        writtenAt.push(seq);
        sentAt = seq;
      }
    }

    // FakeLink lanza si se le escribe con un envío pendiente: no ha pasado nunca.
    expect(link.copies.map(seqOf)).toEqual(writtenAt);
    expect(writtenAt).toHaveLength(334);
    expect(writtenAt.every((seq, index) => seq === index * 3)).toBe(true);
  });

  it('lo escrito no cambia aunque el bucle reutilice su frame en el pulso siguiente', () => {
    const link = new FakeLink();
    const output = outputWith(link);
    const frame = frameOf(10);

    output.write(frame, tick(10));
    frameOf(11, frame);
    output.write(frame, tick(11));

    expect(seqOf(link.writes[0] ?? new Uint8Array())).toBe(10);
  });

  it('tras 50 envíos, dice en el log una sola vez cuánto tarda cada frame y a cuántos fps va', () => {
    const link = new FakeLink();
    const log: string[] = [];
    let clock = 0;
    const output = outputWith(link, log, () => clock);
    let sentAt = 0;

    for (let seq = 0; seq < 600; seq++) {
      // Cada envío sale 46 ms después de escribirse: 2,76 pulsos a 60 fps.
      if (link.pending && (seq - sentAt) * (1000 / 60) >= 46) {
        clock = sentAt * (1000 / 60) + 46;
        link.finish();
      }
      clock = seq * (1000 / 60);
      const before = link.copies.length;
      output.write(frameOf(seq), tick(seq));
      if (link.copies.length > before) sentAt = seq;
    }

    expect(link.copies.length).toBeGreaterThan(100);
    expect(log).toEqual(['Tira «Mesa»: 46 ms por frame, 20 fps (115200 baudios, 173 LEDs)']);
  });

  it.each([
    ['el envío falla', (link: FakeLink) => link.finish(new Error('Input/output error'))],
    ['el puerto se pierde', (link: FakeLink) => link.lose('Input/output error')],
  ])('si %s, lo dice una vez en el log y descarta todos los frames sin lanzar', (_name, loseIt) => {
    const link = new FakeLink();
    const log: string[] = [];
    const output = outputWith(link, log);
    output.write(frameOf(1), tick(1));

    loseIt(link);
    link.finish(new Error('Input/output error'));
    link.lose('Input/output error');
    for (let seq = 2; seq < 10; seq++) output.write(frameOf(seq), tick(seq));

    expect(link.copies.map(seqOf)).toEqual([1]);
    expect(log).toEqual([
      'Tira «Mesa»: se ha perdido el puerto /dev/ttyUSB0 (Input/output error); deja de pintar',
    ]);
  });
});

describe('cerrar la salida Adalight', () => {
  it('cierra el puerto y descarta desde ahí, sin contarlo como una pérdida', () => {
    const link = new FakeLink();
    const log: string[] = [];
    const output = new AdalightOutput(table, link, { log: (line) => log.push(line), now: () => 0 });

    output.close();
    link.lose('se ha cerrado');
    output.write(frameOf(1));

    expect(link.closed).toBe(true);
    expect(link.copies).toEqual([]);
    expect(log).toEqual([]);
  });
});

describe('abrir el puerto de una tira física', () => {
  const options = { log: () => undefined, now: () => 0 };

  it('si se abre, da la salida de la tira sobre él, a sus baudios', async () => {
    const link = new FakeLink();
    const opened: [string, number][] = [];

    const result = await openAdalight(
      table,
      (port, baudRate) => {
        opened.push([port, baudRate]);
        return Promise.resolve(link);
      },
      options,
    );
    const output: LightOutput | undefined = result.ok ? result.output : undefined;
    output?.write(frameOf(5), tick(5));

    expect(opened).toEqual([['/dev/ttyUSB0', 115200]]);
    expect(link.copies.map(seqOf)).toEqual([5]);
  });

  it('si no se abre, dice qué tira, qué puerto y el motivo del sistema', async () => {
    const result = await openAdalight(
      table,
      () => Promise.reject(new Error('Error: No such file or directory, cannot open /dev/ttyUSB0')),
      options,
    );

    expect(result).toEqual({
      ok: false,
      error:
        'tira «Mesa» (/dev/ttyUSB0): no se puede abrir el puerto serie ' +
        '(Error: No such file or directory, cannot open /dev/ttyUSB0)',
    });
  });
});

describe('abrir los puertos de todas las tiras físicas', () => {
  const options = { log: () => undefined, now: () => 0 };
  const virtual = {
    id: 'demo',
    name: 'Tira de prueba',
    output: { type: 'virtual' as const },
    ledCount: 60,
    effect: 'breathing' as const,
  };
  const physical = (id: string, port: string) => ({
    ...virtual,
    id,
    name: id,
    output: {
      type: 'adalight' as const,
      port,
      baudRate: 115200 as const,
      chip: 'WS2812B' as const,
      power: { supplyAmps: 8 },
    },
  });

  it('da la salida de cada tira física por su id, y ninguna de las virtuales', async () => {
    const result = await openAdalightStrips(
      [virtual, physical('mesa', '/dev/ttyUSB0'), physical('barra', '/dev/ttyUSB1')],
      () => Promise.resolve(new FakeLink()),
      options,
    );

    expect(result.ok && [...result.outputs.keys()]).toEqual(['mesa', 'barra']);
  });

  it('a una tira WS2812B le da una salida que escribe en orden GRB', async () => {
    const link = new FakeLink();
    const frame = new Uint8Array(60 * 3);
    frame[0] = 0xff;

    const result = await openAdalightStrips(
      [physical('mesa', '/dev/ttyUSB0')],
      () => Promise.resolve(link),
      options,
    );
    const output: LightOutput | undefined = result.ok ? result.outputs.get('mesa') : undefined;
    output?.write(frame, tick(1));

    expect(hex((link.copies[0] ?? new Uint8Array()).subarray(6, 9))).toBe('00 FF 00');
  });

  it('si un puerto no se abre, cierra los que ya había abierto y da su mensaje', async () => {
    const first = new FakeLink();

    const result = await openAdalightStrips(
      [physical('mesa', '/dev/ttyUSB0'), physical('barra', '/dev/ttyUSB1')],
      (port) =>
        port === '/dev/ttyUSB0' ? Promise.resolve(first) : Promise.reject(new Error('Resource busy')),
      options,
    );

    expect(first.closed).toBe(true);
    expect(result).toEqual({
      ok: false,
      error: 'tira «barra» (/dev/ttyUSB1): no se puede abrir el puerto serie (Resource busy)',
    });
  });
});
