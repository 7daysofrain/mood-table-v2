import { describe, expect, it } from 'vitest';

import {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  decodeSourceStatus,
  decodeStrips,
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  encodeSourceStatus,
  encodeStrips,
  type SourceStatus,
  type StripsMessage,
} from './viewer-protocol.ts';

/** Los colores de una tira de `ledCount` LEDs, distintos en cada byte. */
function colorsOf(ledCount: number): Uint8Array {
  return Uint8Array.from({ length: ledCount * 3 }, (_, byte) => byte % 256);
}

describe('el mensaje de un frame', () => {
  it('lleva el tipo, el seq, el índice de la tira y los colores, en ese orden', () => {
    const message = encodeFrame(0x01020304, 2, Uint8Array.of(10, 20, 30));

    expect(Array.from(message)).toEqual([1, 0x01, 0x02, 0x03, 0x04, 2, 10, 20, 30]);
  });

  it('da los bytes del ejemplo de docs/instructions/viewer-protocol.md', () => {
    const message = encodeFrame(260, 0, Uint8Array.of(0xff, 0, 0, 0, 0, 0xff));
    const hex = Array.from(message, (byte) => byte.toString(16).padStart(2, '0')).join(' ');

    expect(hex).toBe('01 00 00 01 04 00 ff 00 00 00 00 ff');
  });

  it('con una tira de 60 LEDs, lleva 180 bytes de color tras la cabecera de 6', () => {
    expect(encodeFrame(7, 0, colorsOf(60))).toHaveLength(6 + 180);
  });

  it('se decodifica igual que se codificó', () => {
    const colors = colorsOf(60);

    expect(decodeFrame(encodeFrame(123_456, 1, colors))).toEqual({
      seq: 123_456,
      stripIndex: 1,
      colors,
    });
  });

  it('el seq vuelve a 0 al pasar de 2³² − 1', () => {
    expect(decodeFrame(encodeFrame(2 ** 32 + 5, 0, colorsOf(1)))?.seq).toBe(5);
  });

  it('no admite un índice de tira que no cabe en un byte', () => {
    expect(() => encodeFrame(0, 256, colorsOf(1))).toThrow(RangeError);
  });

  it('decodifica un mensaje que es una vista sobre un búfer más grande', () => {
    const buffer = new Uint8Array(20);
    buffer.set(encodeFrame(9, 3, Uint8Array.of(1, 2, 3)), 5);

    expect(decodeFrame(buffer.subarray(5, 5 + 9))).toEqual({
      seq: 9,
      stripIndex: 3,
      colors: Uint8Array.of(1, 2, 3),
    });
  });
});

describe('un mensaje que no es un frame', () => {
  it.each([
    ['de otro tipo', Uint8Array.of(2, 0, 0, 0, 1, 0, 10, 20, 30)],
    ['más corto que la cabecera', Uint8Array.of(1, 0, 0)],
    ['sin colores', Uint8Array.of(1, 0, 0, 0, 1, 0)],
    ['con colores que no son de LEDs enteros', Uint8Array.of(1, 0, 0, 0, 1, 0, 10, 20)],
  ])('se rechaza si es %s', (_, message) => {
    expect(decodeFrame(message)).toBeUndefined();
  });
});

function hexOf(message: Uint8Array): string {
  return Array.from(message, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
}

describe('el mensaje de la fuente de audio', () => {
  it('sin fuente, son dos bytes: el tipo 2 y la clase 0', () => {
    expect(hexOf(encodeSource({ kind: 'none' }))).toBe('02 00');
  });

  it('con un fichero, lleva la clase 1 y su nombre en UTF-8, como en el ejemplo del documento', () => {
    expect(hexOf(encodeSource({ kind: 'file', name: 'golpes.wav' }))).toBe(
      '02 01 67 6f 6c 70 65 73 2e 77 61 76',
    );
  });

  it('con una tarjeta de sonido, lleva la clase 2 y su nombre en UTF-8, como en el documento', () => {
    expect(hexOf(encodeSource({ kind: 'soundcard', name: 'Mixer de la mesa' }))).toBe(
      '02 02 4d 69 78 65 72 20 64 65 20 6c 61 20 6d 65 73 61',
    );
  });

  it.each([
    [{ kind: 'none' as const }],
    [{ kind: 'file' as const, name: 'Canción del año (versión ñ).wav' }],
    [{ kind: 'soundcard' as const, name: 'Mixer de la mesa' }],
  ])('%j se decodifica igual que se codificó', (source) => {
    expect(decodeSource(encodeSource(source))).toEqual(source);
  });

  it.each([
    ['vacío', []],
    ['de otro tipo', [1, 0]],
    ['con una clase que no existe', [2, 7]],
    ['sin fuente pero con nombre', [2, 0, 0x61]],
    ['de un fichero sin nombre', [2, 1]],
    ['con un nombre que no es UTF-8 válido', [2, 1, 0xff, 0xfe]],
    ['de una tarjeta de sonido sin nombre', [2, 2]],
    ['de una tarjeta de sonido con un nombre que no es UTF-8 válido', [2, 2, 0xff, 0xfe]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodeSource(Uint8Array.from(bytes))).toBeUndefined();
  });
});

describe('el mensaje del nivel', () => {
  it('lleva el tipo 3, el seq y el nivel en float32, los dos en big-endian', () => {
    expect(hexOf(encodeLevel(260, 0.5))).toBe('03 00 00 01 04 3f 00 00 00');
  });

  it('se decodifica igual que se codificó', () => {
    expect(decodeLevel(encodeLevel(123_456, 0.25))).toEqual({ seq: 123_456, level: 0.25 });
  });

  it('no admite un nivel fuera de 0 a 1', () => {
    expect(() => encodeLevel(1, 1.5)).toThrow(RangeError);
    expect(() => encodeLevel(1, Number.NaN)).toThrow(RangeError);
  });

  it.each([
    ['corto', [3, 0, 0, 1, 4, 0x3f, 0, 0]],
    ['largo', [3, 0, 0, 1, 4, 0x3f, 0, 0, 0, 0]],
    ['de otro tipo', [1, 0, 0, 1, 4, 0x3f, 0, 0, 0]],
    ['con un nivel por encima de 1 (2,0)', [3, 0, 0, 1, 4, 0x40, 0, 0, 0]],
    ['con un nivel que no es un número', [3, 0, 0, 1, 4, 0x7f, 0xc0, 0, 0]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodeLevel(Uint8Array.from(bytes))).toBeUndefined();
  });
});

describe('los mensajes de fuente y de nivel no son frames', () => {
  it('decodeFrame los rechaza, aunque su longitud cuadre con la de un frame', () => {
    // 9 bytes: la cabecera de un frame y un LED.
    expect(decodeFrame(encodeLevel(1, 0.5))).toBeUndefined();
    expect(decodeFrame(encodeSource({ kind: 'file', name: 'abc.wav' }))).toBeUndefined();
  });
});

describe('el mensaje de la posición del fichero', () => {
  it('lleva el tipo 4, el seq y la posición en float64, los dos en big-endian', () => {
    expect(hexOf(encodePosition(260, 1.5))).toBe('04 00 00 01 04 3f f8 00 00 00 00 00 00');
  });

  it('ocupa 13 bytes', () => {
    expect(encodePosition(1, 93.8)).toHaveLength(13);
  });

  it.each([
    ['al principio del fichero', 7, 0],
    ['en un fichero de una hora, sin perder precisión', 123_456, 3599.987_654_321],
    ['con el seq cerca de 2³²', 2 ** 32 - 1, 2.25],
  ])('%s, se decodifica igual que se codificó', (_name, seq, position) => {
    expect(decodePosition(encodePosition(seq, position))).toEqual({ seq, position });
  });

  it('no admite una posición negativa o que no es un número finito', () => {
    expect(() => encodePosition(1, -0.001)).toThrow(RangeError);
    expect(() => encodePosition(1, Number.NaN)).toThrow(RangeError);
    expect(() => encodePosition(1, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('decodifica un mensaje que es una vista sobre un búfer más grande', () => {
    const buffer = new Uint8Array(30);
    buffer.set(encodePosition(9, 3.5), 4);

    expect(decodePosition(buffer.subarray(4, 4 + 13))).toEqual({ seq: 9, position: 3.5 });
  });

  it.each([
    ['corto', [4, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0]],
    ['largo', [4, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0, 0]],
    ['de otro tipo', [3, 0, 0, 1, 4, 0x3f, 0xf8, 0, 0, 0, 0, 0, 0]],
    ['con una posición negativa (−1,5)', [4, 0, 0, 1, 4, 0xbf, 0xf8, 0, 0, 0, 0, 0, 0]],
    ['con una posición infinita', [4, 0, 0, 1, 4, 0x7f, 0xf0, 0, 0, 0, 0, 0, 0]],
    ['con una posición que no es un número', [4, 0, 0, 1, 4, 0x7f, 0xf8, 0, 0, 0, 0, 0, 0]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodePosition(Uint8Array.from(bytes))).toBeUndefined();
  });

  it('no lo decodifican como frame, nivel ni fuente', () => {
    const message = encodePosition(1, 1.5);

    expect(decodeFrame(message)).toBeUndefined();
    expect(decodeLevel(message)).toBeUndefined();
    expect(decodeSource(message)).toBeUndefined();
  });
});

describe('el mensaje del estado de la fuente', () => {
  it('son dos bytes: el tipo 5 y el estado, 0 si está conectada y 1 si está perdida', () => {
    expect(hexOf(encodeSourceStatus('connected'))).toBe('05 00');
    expect(hexOf(encodeSourceStatus('lost'))).toBe('05 01');
  });

  it('no admite un estado que no es conectada ni perdida', () => {
    expect(() => encodeSourceStatus('unplugged' as SourceStatus)).toThrow(RangeError);
  });

  it.each(['connected', 'lost'] as const)('%s, se decodifica igual que se codificó', (status) => {
    expect(decodeSourceStatus(encodeSourceStatus(status))).toBe(status);
  });

  it.each([
    ['corto', [5]],
    ['largo', [5, 0, 0]],
    ['de otro tipo', [2, 0]],
    ['con un estado que no es 0 ni 1', [5, 2]],
  ])('%s, se rechaza', (_name, bytes) => {
    expect(decodeSourceStatus(Uint8Array.from(bytes))).toBeUndefined();
  });

  it('no lo decodifican como fuente ni frame', () => {
    const message = encodeSourceStatus('lost');

    expect(decodeSource(message)).toBeUndefined();
    expect(decodeFrame(message)).toBeUndefined();
  });
});

describe('el mensaje de las tiras', () => {
  /** El ejemplo de la decisión 6 del change strip-effect-values (y de viewer-protocol.md). */
  const example: StripsMessage = {
    strips: [
      {
        id: 'demo',
        name: 'Tira de prueba',
        ledCount: 60,
        output: { type: 'virtual' },
        effect: 'breathing',
        values: { color: '#FFA957', period: 4 },
      },
    ],
  };

  /** Un mensaje del tipo 6 con `json` tal cual, para probar lo que el esquema rechaza. */
  function stripsMessageOf(json: string): Uint8Array {
    const text = new TextEncoder().encode(json);
    const message = new Uint8Array(1 + text.length);
    message[0] = 6;
    message.set(text, 1);
    return message;
  }

  /** El ejemplo con la primera tira cambiada por `strip`. */
  function withStrip(strip: Record<string, unknown>): string {
    return JSON.stringify({ strips: [strip] });
  }

  const [demo] = example.strips;

  it('es el byte 6 seguido del JSON en UTF-8 del ejemplo', () => {
    const message = encodeStrips(example);

    expect(message[0]).toBe(6);
    expect(new TextDecoder().decode(message.subarray(1))).toBe(
      '{"strips":[{"id":"demo","name":"Tira de prueba","ledCount":60,' +
        '"output":{"type":"virtual"},"effect":"breathing","values":{"color":"#FFA957","period":4}}]}',
    );
  });

  it('se decodifica igual que se codificó', () => {
    expect(decodeStrips(encodeStrips(example))).toEqual(example);
  });

  it('con nombres con acentos, también', () => {
    const message: StripsMessage = {
      strips: [
        { ...demo!, id: 'barra', name: 'Barra de la cabina' },
        { ...demo!, id: 'frontal', name: 'Frontal · señal', ledCount: 144, effect: 'energy', values: {} },
      ],
    };

    expect(decodeStrips(encodeStrips(message))).toEqual(message);
  });

  it('no lo decodifican como fuente ni frame', () => {
    const message = encodeStrips(example);

    expect(decodeSource(message)).toBeUndefined();
    expect(decodeFrame(message)).toBeUndefined();
  });

  it.each([
    ['de otro tipo', Uint8Array.of(2, ...new TextEncoder().encode('{"strips":[]}'))],
    ['vacío', new Uint8Array(0)],
    ['con un JSON roto', stripsMessageOf('{"strips":[')],
    ['con un texto que no es UTF-8 válido', Uint8Array.of(6, 0xff, 0xfe)],
    ['sin la lista de tiras', stripsMessageOf('{}')],
    ['con una tira sin efecto', stripsMessageOf(withStrip({ ...demo, effect: undefined }))],
    ['con un efecto que no está en el catálogo', stripsMessageOf(withStrip({ ...demo, effect: 'strobe' }))],
    ['con un campo que el esquema no declara', stripsMessageOf(withStrip({ ...demo, port: '/dev/ttyACM0' }))],
    ['con un nº de LEDs que no es entero', stripsMessageOf(withStrip({ ...demo, ledCount: 60.5 }))],
    ['con una tira sin valores', stripsMessageOf(withStrip({ ...demo, values: undefined }))],
    ['con los valores de otro efecto', stripsMessageOf(withStrip({ ...demo, effect: 'energy' }))],
    [
      'con un periodo fuera de rango',
      stripsMessageOf(withStrip({ ...demo, values: { color: '#FFA957', period: 25 } })),
    ],
  ])('%s, se rechaza', (_name, message) => {
    expect(decodeStrips(message)).toBeUndefined();
  });
});
