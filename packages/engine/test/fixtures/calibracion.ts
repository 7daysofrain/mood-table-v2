/**
 * Genera `config/audio/calibracion.wav`, el WAV para calibrar a ojo una tira física frente al visor
 * (decisión 8 del change scroll-effect): 9 s en bucle, mono, PCM de 16 bits a 44,1 kHz, con un golpe
 * de 30 ms en los segundos 1, 4 y 7, a 400 Hz, 2 kHz y 8 kHz. Con *scroll*, cada golpe es un pulso de
 * un solo color (rojo, verde y azul) que nace en el centro y recorre la tira.
 *
 * Entre golpes no hay silencio digital sino ruido de ±1 LSB: para un fichero, el motor solo cuenta
 * como silencio el digital, y en silencio *scroll* apaga la tira y congela el rastro. Con el ruido,
 * el pulso llega a los extremos y el fondo queda en negro.
 *
 * Es determinista: el ruido sale de un generador con semilla fija, así que dos ejecuciones dan el
 * mismo fichero byte a byte. Se ejecuta con `pnpm --filter @moodtable/engine calibration` y el WAV
 * generado se versiona.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const SAMPLE_RATE = 44_100;
const SECONDS = 9;
const HITS = [
  { second: 1, frequency: 400 },
  { second: 4, frequency: 2000 },
  { second: 7, frequency: 8000 },
];
const HIT_SECONDS = 0.03;
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
  for (let index = 0; index < out.length; index++) out[index] = next() < 0.5 ? -1 : 1;
  const hitLength = Math.round(HIT_SECONDS * SAMPLE_RATE);
  for (const { second, frequency } of HITS) {
    const start = second * SAMPLE_RATE;
    for (let index = 0; index < hitLength; index++) {
      // Ventana de Hann: el golpe sube y baja sin chasquidos, que pintarían otras bandas.
      const envelope = PEAK * Math.sin((Math.PI * index) / hitLength) ** 2;
      const wave = Math.sin((2 * Math.PI * frequency * index) / SAMPLE_RATE);
      out[start + index] = Math.round(envelope * wave * 32_767);
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

const target = fileURLToPath(new URL('../../../../config/audio/calibracion.wav', import.meta.url));
await writeFile(target, wav(samples()));
console.log(`Generado ${target}`);
