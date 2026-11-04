import { describe, expect, it } from 'vitest';

import { adalightBuffer, AdalightOutput, encodeAdalight, type SerialLink } from './adalight.ts';

/**
 * Un puerto serie en memoria: guarda lo que se le escribe y el test decide cuándo ha salido por el
 * cable (`finish`), si falla o si se pierde. Si se le escribe con un envío pendiente, lanza.
 */
class FakeLink implements SerialLink {
  /** Lo que la salida le ha pasado en cada escritura, tal cual: si lo cambia después, se ve aquí. */
  readonly writes: Uint8Array[] = [];
  /** Una copia de cada escritura en el momento de hacerla. */
  readonly copies: Uint8Array[] = [];
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
}

/** La tira de la mesa (D46). */
const table = { name: 'Mesa', ledCount: 173, port: '/dev/ttyUSB0', baudRate: 115200 };

/** Un frame de la mesa que lleva `seq` en el primer LED, para saber de qué pulso es lo escrito. */
function frameOf(seq: number, frame = new Uint8Array(table.ledCount * 3)): Uint8Array {
  frame[0] = seq & 0xff;
  frame[1] = (seq >> 8) & 0xff;
  return frame;
}

/** El pulso que lleva un frame escrito en el puerto (tras los 6 bytes de la cabecera). */
function seqOf(written: Uint8Array): number {
  return (written[6] ?? 0) + ((written[7] ?? 0) << 8);
}

function tick(seq: number): { seq: number; time: number } {
  return { seq, time: seq / 60 };
}

function outputWith(link: FakeLink, log: string[] = [], now = () => 0): AdalightOutput {
  return new AdalightOutput(table, link, { log: (line) => log.push(line), now });
}

/** Los bytes en hexadecimal, separados por espacios, para leer las cabeceras como en la spec. */
function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}

describe('la codificación Adalight', () => {
  it('el frame de 173 LEDs con el primero en rojo puro son 525 bytes con su cabecera', () => {
    const frame = new Uint8Array(173 * 3);
    frame[0] = 0xff;

    const encoded = encodeAdalight(adalightBuffer(173), frame);

    expect(encoded).toHaveLength(525);
    expect(hex(encoded.subarray(0, 9))).toBe('41 64 61 00 AC F9 FF 00 00');
    expect(encoded.subarray(9).every((byte) => byte === 0)).toBe(true);
  });

  it.each([
    [1, '41 64 61 00 00 55'],
    [300, '41 64 61 01 2B 7F'],
  ])('la cabecera de %d LEDs es %s', (ledCount, header) => {
    expect(hex(adalightBuffer(ledCount).subarray(0, 6))).toBe(header);
  });

  it('copia los colores en el orden de la tira, sin reordenarlos', () => {
    const frame = Uint8Array.of(1, 2, 3, 4, 5, 6);

    expect(Array.from(encodeAdalight(adalightBuffer(2), frame).subarray(6))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
  });

  it('escribe en el búfer de la salida, sin crear otro', () => {
    const buffer = adalightBuffer(2);

    expect(encodeAdalight(buffer, new Uint8Array(6))).toBe(buffer);
  });
});

describe('la salida Adalight', () => {
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
