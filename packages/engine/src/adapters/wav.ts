/**
 * Decodificador WAV (specs/audio-source, decisión 7 del change virtual-strip-audio-file): bytes de
 * un fichero → muestras mono de -1 a 1 y su frecuencia. Es una función pura, sin disco: la lectura
 * del fichero es cosa del adaptador de la fuente.
 *
 * Solo acepta PCM de 16 bits, mono o estéreo, con cualquier frecuencia: `WAVE_FORMAT_PCM` o
 * `WAVE_FORMAT_EXTENSIBLE` con subformato PCM, que algunos editores escriben para el mismo
 * contenido. El estéreo se mezcla a mono con la media de los dos canales. Los bloques que no son
 * `fmt ` ni `data` (por ejemplo, `LIST`) se saltan.
 */

/** Audio mono, con las muestras de -1 a 1. */
export interface MonoAudio {
  sampleRate: number;
  samples: Float32Array;
}

export type DecodedWav = { ok: true; audio: MonoAudio } | { ok: false; error: string };

const INVALID: DecodedWav = {
  ok: false,
  error: 'formato no válido: se acepta WAV PCM de 16 bits, mono o estéreo',
};

const WAVE_FORMAT_PCM = 1;
const WAVE_FORMAT_EXTENSIBLE = 0xfffe;

/** GUID del subformato PCM de `WAVE_FORMAT_EXTENSIBLE`: `00000001-0000-0010-8000-00aa00389b71`. */
const PCM_SUBFORMAT = [1, 0, 0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71];

/** Lo que importa del bloque `fmt `. */
interface Format {
  channels: number;
  sampleRate: number;
}

export function decodeWav(bytes: Uint8Array): DecodedWav {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || tag(bytes, 0) !== 'RIFF' || tag(bytes, 8) !== 'WAVE') return INVALID;

  let format: Format | undefined;
  let data: Uint8Array | undefined;
  // Cada bloque: id de 4 letras, tamaño (little-endian) y contenido, con un byte de relleno si su
  // tamaño es impar.
  for (let offset = 12; offset + 8 <= bytes.length; ) {
    const id = tag(bytes, offset);
    const size = view.getUint32(offset + 4, true);
    const start = offset + 8;
    if (start + size > bytes.length) return INVALID;
    const body = bytes.subarray(start, start + size);
    if (id === 'fmt ') format = readFormat(body);
    else if (id === 'data') data = body;
    offset = start + size + (size % 2);
  }
  if (!format || !data) return INVALID;

  return { ok: true, audio: toMono(data, format) };
}

function tag(bytes: Uint8Array, offset: number): string {
  return String.fromCodePoint(...bytes.subarray(offset, offset + 4));
}

/** El formato si es uno de los que se aceptan; si no, `undefined`. */
function readFormat(body: Uint8Array): Format | undefined {
  if (body.length < 16) return undefined;
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength);
  const formatTag = view.getUint16(0, true);
  const channels = view.getUint16(2, true);
  const sampleRate = view.getUint32(4, true);
  const bits = view.getUint16(14, true);

  const pcm =
    formatTag === WAVE_FORMAT_PCM ||
    (formatTag === WAVE_FORMAT_EXTENSIBLE &&
      body.length >= 40 &&
      PCM_SUBFORMAT.every((byte, index) => body[24 + index] === byte));
  if (!pcm || bits !== 16 || (channels !== 1 && channels !== 2) || sampleRate === 0) {
    return undefined;
  }
  return { channels, sampleRate };
}

/** Muestras de 16 bits intercaladas por canal → mono de -1 a 1. */
function toMono(data: Uint8Array, { channels, sampleRate }: Format): MonoAudio {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const samples = new Float32Array(Math.floor(data.length / (2 * channels)));
  for (let frame = 0; frame < samples.length; frame++) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel++) {
      sum += view.getInt16((frame * channels + channel) * 2, true);
    }
    samples[frame] = sum / channels / 32_768;
  }
  return { sampleRate, samples };
}
