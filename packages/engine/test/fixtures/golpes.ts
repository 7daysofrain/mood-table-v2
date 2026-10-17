/**
 * Genera `golpes.wav`, el fichero de golpes aislados de los tests (decisión 15 del change
 * virtual-strip-audio-file): 4 s, mono, PCM de 16 bits a 44,1 kHz, con un golpe de 50 ms en los
 * segundos 1, 2 y 3 y silencio digital (muestras a 0) en el resto. Cada golpe es ruido que cae
 * deprisa, como un golpe de percusión.
 *
 * Es determinista: el ruido sale de un generador con semilla fija, así que dos ejecuciones dan el
 * mismo fichero byte a byte. Se ejecuta con `pnpm --filter @moodtable/engine fixtures` y el WAV
 * generado se versiona.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const SECONDS = 4;
const HIT_STARTS = [1, 2, 3];
const HIT_SECONDS = 0.05;
/** Constante de tiempo de la caída: en 50 ms el golpe baja a menos del 1 % (e^-5). */
const DECAY_SECONDS = 0.01;
const PEAK = 0.8;
const SEED = 0x6d6f6f64;

/** Mulberry32: un generador pseudoaleatorio pequeño y con semilla, de 0 a 1. */
function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function samples(): Int16Array {
  const out = new Int16Array(SAMPLE_RATE * SECONDS);
  const next = random(SEED);
  const hitLength = Math.round(HIT_SECONDS * SAMPLE_RATE);
  for (const second of HIT_STARTS) {
    const start = second * SAMPLE_RATE;
    for (let index = 0; index < hitLength; index++) {
      const envelope = PEAK * Math.exp(-index / SAMPLE_RATE / DECAY_SECONDS);
      out[start + index] = Math.round((next() * 2 - 1) * envelope * 32_767);
    }
  }
  return out;
}

/** Un WAV PCM mono de 16 bits: cabecera RIFF de 44 bytes y las muestras en little-endian. */
function wav(data: Int16Array): Uint8Array {
  const bytes = new Uint8Array(44 + data.length * 2);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let index = 0; index < text.length; index++) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  ascii(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // WAVE_FORMAT_PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, 'data');
  view.setUint32(40, data.length * 2, true);
  data.forEach((sample, index) => {
    view.setInt16(44 + index * 2, sample, true);
  });
  return bytes;
}

const target = fileURLToPath(new URL('golpes.wav', import.meta.url));
await writeFile(target, wav(samples()));
console.log(`Generado ${target}`);
