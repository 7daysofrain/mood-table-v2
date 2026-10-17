/**
 * Spike de rendimiento (MOO-12, tarea MOO-54). Prototipo DESECHABLE: se borra antes de integrar.
 * Hace el trabajo del motor con análisis de audio sobre audio sintético, sin enviar los frames a
 * ninguna salida, y mide cuánto tarda en calcular cada frame.
 *
 *   node bench.ts <tiras> <fps> <segundos>
 *   node bench.ts 300:spectrum,300:energy 60 180
 *
 * Imprime una línea JSON con la mediana, el p95 y el máximo de los ms por frame.
 */
import FFT from 'fft.js';

import { startTicker } from '../../packages/engine/src/adapters/ticker.ts';

const [stripsArg = '300:spectrum', fpsArg = '60', secondsArg = '10'] = process.argv.slice(2);
const fps = Number(fpsArg);
const seconds = Number(secondsArg);

// --- Audio sintético: 10 s en bucle (bombo a 120 BPM, bajo, tonos medios y charles) -------------
const RATE = 44_100;
const track = new Float32Array(RATE * 10);
for (let i = 0; i < track.length; i++) {
  const t = i / RATE;
  const beat = t % 0.5; // bombo cada medio segundo
  const kick = Math.sin(2 * Math.PI * 55 * beat) * Math.exp(-beat / 0.12);
  const off = (t + 0.25) % 0.5; // charles a contratiempo
  const hat = (Math.random() * 2 - 1) * Math.exp(-off / 0.02) * 0.3;
  const bass = Math.sin(2 * Math.PI * 110 * t) * 0.2 * (1 + Math.sin(2 * Math.PI * 0.5 * t));
  const mids = (Math.sin(2 * Math.PI * 440 * t) + Math.sin(2 * Math.PI * 659 * t)) * 0.05;
  track[i] = (kick * 0.8 + hat + bass + mids) * 0.6;
}

// --- Análisis: una vez por frame, compartido por todas las tiras -------------------------------
const N = 2048;
const BANDS = 32;
const fft = new FFT(N);
const hann = new Float32Array(N).map((_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1)));
const windowed = new Array<number>(N).fill(0); // fft.js trabaja con arrays normales
const spectrum = fft.createComplexArray() as number[];
// Bordes de las bandas en bins, en escala logarítmica de 30 Hz a 16 kHz.
const edges = new Int32Array(BANDS + 1).map((_, b) =>
  Math.max(1, Math.round((30 * Math.pow(16_000 / 30, b / BANDS) * N) / RATE)),
);
const audio = { bands: new Float32Array(BANDS), energy: 0, beat: false };
let energyAvg = 0;
let peak = 1e-6;

function analyse(sample: number): void {
  for (let i = 0; i < N; i++) {
    const s = track[(sample - N + i + track.length) % track.length] ?? 0;
    windowed[i] = s * (hann[i] ?? 0);
  }
  fft.realTransform(spectrum, windowed);
  let energy = 0;
  for (let b = 0; b < BANDS; b++) {
    const from = edges[b] ?? 1;
    const to = Math.max(from + 1, edges[b + 1] ?? from + 1);
    let sum = 0;
    for (let k = from; k < to; k++) {
      const re = spectrum[2 * k] ?? 0;
      const im = spectrum[2 * k + 1] ?? 0;
      sum += Math.sqrt(re * re + im * im);
    }
    const value = Math.log1p(sum / (to - from));
    audio.bands[b] = value;
    energy += value;
  }
  peak = Math.max(peak * 0.999, energy);
  audio.energy = energy / peak; // 0-1, con ganancia automática
  audio.beat = audio.energy > energyAvg * 1.3 && audio.energy > 0.3;
  energyAvg = energyAvg * 0.95 + audio.energy * 0.05;
}

// --- Efectos aproximados (los de la v1) y límite de potencia ------------------------------------
interface Strip {
  effect: 'spectrum' | 'energy';
  leds: number;
  frame: Uint8Array;
  memory: Float32Array; // un valor por LED
  palette: Uint8Array; // color de cada LED
  flash: number;
}

function createStrip(spec: string): Strip {
  const [ledsText = '300', effect = 'spectrum'] = spec.split(':');
  const leds = Number(ledsText);
  if (effect !== 'spectrum' && effect !== 'energy') throw new Error(`Efecto desconocido: ${effect}`);
  const palette = new Uint8Array(leds * 3);
  for (let i = 0; i < leds; i++) {
    const hue = i / leds; // de rojo (graves) a azul (agudos)
    palette[i * 3] = Math.round(255 * Math.max(0, 1 - hue * 2));
    palette[i * 3 + 1] = Math.round(255 * (1 - Math.abs(hue * 2 - 1)));
    palette[i * 3 + 2] = Math.round(255 * Math.max(0, hue * 2 - 1));
  }
  return { effect, leds, frame: new Uint8Array(leds * 3), memory: new Float32Array(leds), palette, flash: 0 };
}

function renderSpectrum(strip: Strip): void {
  const { leds, frame, memory, palette } = strip;
  for (let i = 0; i < leds; i++) {
    const pos = (i * (BANDS - 1)) / (leds - 1);
    const b = Math.floor(pos);
    const a = audio.bands[b] ?? 0;
    const c = audio.bands[Math.min(b + 1, BANDS - 1)] ?? 0;
    const level = Math.min(1, ((a + (c - a) * (pos - b)) * BANDS) / (peak + 1e-6));
    const v = Math.max(level, (memory[i] ?? 0) * 0.85); // sube al momento y cae suave
    memory[i] = v;
    frame[i * 3] = (palette[i * 3] ?? 0) * v;
    frame[i * 3 + 1] = (palette[i * 3 + 1] ?? 0) * v;
    frame[i * 3 + 2] = (palette[i * 3 + 2] ?? 0) * v;
  }
}

function renderEnergy(strip: Strip): void {
  const { leds, frame, memory } = strip;
  strip.flash = audio.beat ? 1 : strip.flash * 0.9;
  const center = (leds - 1) / 2;
  for (let i = 0; i < leds; i++) {
    const distance = Math.abs(i - center) / center; // la energía se abre desde el centro
    const lit = Math.max(0, Math.min(1, audio.energy * 0.7 + strip.flash * 0.3 - distance * (1 - audio.energy)));
    const v = (memory[i] ?? 0) * 0.7 + lit * 0.3;
    memory[i] = v;
    frame[i * 3] = 255 * v;
    frame[i * 3 + 1] = 120 * v;
    frame[i * 3 + 2] = 30 * v * strip.flash;
  }
}

const MA_PER_CHANNEL = 20 / 255; // 20 mA por canal a tope
const POWER_LIMIT_MA = 4000;

function limitPower(frame: Uint8Array): void {
  let sum = 0;
  for (let i = 0; i < frame.length; i++) sum += frame[i] ?? 0;
  const current = sum * MA_PER_CHANNEL;
  if (current <= POWER_LIMIT_MA) return;
  const scale = POWER_LIMIT_MA / current;
  for (let i = 0; i < frame.length; i++) frame[i] = (frame[i] ?? 0) * scale;
}

// --- Medición -----------------------------------------------------------------------------------
const strips = stripsArg.split(',').map(createStrip);
const expected = Math.round(seconds * fps);
const durations = new Float64Array(expected + 1000);
let frames = 0;
let beatFrames = 0; // frames dentro de un golpe (prueba de que el análisis responde)
let checksum = 0; // la salida es nula: así V8 no puede saltarse el trabajo
let startedAt: number | undefined;

startTicker(fps, (now) => {
  startedAt ??= now;
  if (now - startedAt >= seconds * 1000) return finish();
  const t0 = performance.now();

  analyse(Math.floor(((now - startedAt) / 1000) * RATE));
  if (audio.beat) beatFrames++;
  for (const strip of strips) {
    if (strip.effect === 'spectrum') renderSpectrum(strip);
    else renderEnergy(strip);
    limitPower(strip.frame);
    checksum += (strip.frame[0] ?? 0) + (strip.frame[strip.frame.length - 1] ?? 0);
  }

  durations[frames++] = performance.now() - t0;
});

// `startTicker` se reprograma después de llamar a `onTick`, así que pararlo desde dentro no sirve:
// se imprime el resultado y se sale.
function finish(): void {
  const sorted = durations.slice(0, frames).sort();
  const at = (q: number) => sorted[Math.min(frames - 1, Math.ceil(q * frames) - 1)] ?? NaN;
  const round = (ms: number) => Math.round(ms * 1000) / 1000;
  console.log(
    JSON.stringify({
      strips: stripsArg,
      fps,
      seconds,
      expected,
      frames,
      medianMs: round(at(0.5)),
      p95Ms: round(at(0.95)),
      maxMs: round(sorted[frames - 1] ?? NaN),
      over16_6: sorted.filter((ms) => ms > 1000 / 60).length,
      over33_3: sorted.filter((ms) => ms > 1000 / 30).length,
      beatFrames,
      checksum,
      node: process.version,
    }),
  );
  process.exit(0);
}
