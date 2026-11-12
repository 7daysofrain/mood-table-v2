/**
 * Salida Adalight (specs/physical-strip): la tira física por el puerto serie de su controlador. Esta
 * es la parte pura, con tests: la codificación, el descarte, la medida y la pérdida del puerto.
 * Abrir el puerto de verdad es cosa de `adalight.hardware.ts`, que da el enlace (`SerialLink`).
 *
 * Un frame Adalight es una cabecera de 6 bytes, `A` `d` `a`, el nº de LEDs menos uno en dos bytes
 * (el alto primero) y su checksum (los dos en XOR con `0x55`), seguida de 3 bytes por LED, en el
 * orden de la tira y, dentro de cada LED, en el orden de color del chip de la tira (D111): verde,
 * rojo y azul en una `WS2812B`. El controlador pasa los canales tal como le llegan.
 *
 * Cada canal sale corregido con la gamma 2,0 de la v1 (decisión 6 del change scroll-effect): la
 * respuesta del LED, que vive en el núcleo porque el límite de potencia también la usa (D108). El
 * visor recibe los valores sin corregir y en RGB (D100).
 *
 * Nunca hay cola (decisión 2 del change adalight-strip-output): desde que escribe un frame hasta que
 * ha salido por el cable, la salida está ocupada y descarta los que le llegan; al quedar libre,
 * escribe el del pulso en curso. Así el retraso no crece: como mucho, lo que tarda un frame en salir
 * más un pulso (decisión 3).
 *
 *   libre --write--> ocupada --ha salido--> libre
 *                      |  (descarta)
 *                      +--falla--> perdida (descarta siempre; lo dice una vez)
 */
import { chipOf, type ColorOrder, type StripConfig } from '@moodtable/shared';

import type { LightOutput } from '../core/frame-loop.ts';
import { LED_RESPONSE } from '../core/led-response.ts';

/** Los bytes de la cabecera Adalight. */
const HEADER_LENGTH = 6;

/** Cuántos envíos mide antes de decir en el log lo que tarda cada frame (decisión 3). */
const MEASURED_SENDS = 50;

/** Lo mínimo de un puerto serie abierto que necesita la salida. */
export interface SerialLink {
  /** Escribe `bytes` y llama a `onSent` cuando han salido por el cable, o con el error si fallan. */
  write(bytes: Uint8Array, onSent: (error?: Error) => void): void;
  /** Avisa si el puerto falla o se cierra con el motor en marcha (el cable USB se suelta). */
  watchLoss(listener: (reason: string) => void): void;
  /** Cierra el puerto: un puerto abierto mantendría el proceso en marcha. */
  close(): void;
}

/** Abre el puerto serie a unos baudios; rechaza con el motivo del sistema si no puede. */
export type OpenSerialLink = (port: string, baudRate: number) => Promise<SerialLink>;

/** Lo que la salida necesita saber de su tira: para el búfer, para codificar y para el log. */
export interface AdalightStrip {
  name: string;
  ledCount: number;
  port: string;
  baudRate: number;
  /** El orden de color del chip de la tira, ya resuelto (decisión 3 del change strip-color-order). */
  colorOrder: ColorOrder;
}

/**
 * A qué byte de su LED va cada canal del frame (rojo, verde y azul): con `GRB`, el rojo va al
 * segundo, el verde al primero y el azul al tercero, `[1, 0, 2]`.
 */
export type ChannelTargets = readonly [number, number, number];

export interface AdalightOptions {
  log: (line: string) => void;
  /** Milisegundos de un reloj monótono, para medir los envíos. */
  now: () => number;
}

/**
 * La salida Adalight de una tira (`LightOutput`). Su búfer es suyo, con la cabecera ya escrita: como
 * no escribe mientras está ocupada, no cambia mientras sale por el cable.
 */
export class AdalightOutput implements LightOutput {
  private readonly strip: AdalightStrip;
  private readonly link: SerialLink;
  private readonly options: AdalightOptions;
  private readonly buffer: Uint8Array;
  /** El orden de color, traducido una vez para no interpretarlo en cada frame. */
  private readonly targets: ChannelTargets;
  private busy = false;
  private lost = false;
  /** Lo que ha tardado cada envío medido, en ms, y cuándo empezó el primero. */
  private readonly durations: number[] = [];
  private firstStart = 0;

  constructor(strip: AdalightStrip, link: SerialLink, options: AdalightOptions) {
    this.strip = strip;
    this.link = link;
    this.options = options;
    this.buffer = adalightBuffer(strip.ledCount);
    this.targets = channelTargets(strip.colorOrder);
    link.watchLoss((reason) => this.lose(reason));
  }

  write(frame: Uint8Array): void {
    if (this.busy || this.lost) return;
    encodeAdalight(this.buffer, frame, this.targets);
    this.busy = true;
    const start = this.options.now();
    this.link.write(this.buffer, (error) => {
      this.busy = false;
      if (error) this.lose(error.message);
      else this.measure(start, this.options.now());
    });
  }

  /** Cierra el puerto sin contarlo como una pérdida: desde aquí descarta todos los frames. */
  close(): void {
    this.lost = true;
    this.link.close();
  }

  private measure(start: number, end: number): void {
    if (this.durations.length >= MEASURED_SENDS) return;
    if (this.durations.length === 0) this.firstStart = start;
    this.durations.push(end - start);
    if (this.durations.length < MEASURED_SENDS) return;

    // Con 50 envíos, la mediana es la media de los dos centrales: el primero tras abrir el puerto
    // puede ser raro (decisión 9).
    const sorted = [...this.durations].sort((a, b) => a - b);
    const median = sorted.slice(24, 26).reduce((sum, each) => sum + each, 0) / 2;
    const fps = MEASURED_SENDS / ((end - this.firstStart) / 1000);
    const { name, baudRate, ledCount } = this.strip;
    this.options.log(
      `Tira «${name}»: ${Math.round(median)} ms por frame, ${Math.round(fps)} fps ` +
        `(${baudRate} baudios, ${ledCount} LEDs)`,
    );
  }

  /** Desde aquí descarta todos los frames, sin lanzar: el motor y las demás tiras siguen (decisión 5). */
  private lose(reason: string): void {
    if (this.lost) return;
    this.lost = true;
    this.options.log(
      `Tira «${this.strip.name}»: se ha perdido el puerto ${this.strip.port} (${reason}); deja de pintar`,
    );
  }
}

/**
 * Abre el puerto de una tira física y le pone su salida. Si no se abre (no existe, permiso denegado,
 * lo tiene otro programa), el motor no arranca y dice qué tira, qué puerto y por qué (decisión 4):
 * es un estado de paso hasta `MOO-112`.
 */
export async function openAdalight(
  strip: AdalightStrip,
  open: OpenSerialLink,
  options: AdalightOptions,
): Promise<{ ok: true; output: AdalightOutput } | { ok: false; error: string }> {
  try {
    const link = await open(strip.port, strip.baudRate);
    return { ok: true, output: new AdalightOutput(strip, link, options) };
  } catch (error) {
    return {
      ok: false,
      error: `tira «${strip.name}» (${strip.port}): no se puede abrir el puerto serie (${(error as Error).message})`,
    };
  }
}

/**
 * Abre los puertos de todas las tiras físicas, en el orden del fichero, y da la salida de cada una
 * por su id, con el orden de color de su chip. Si uno no se abre, cierra los que ya había abierto y
 * da su mensaje.
 */
export async function openAdalightStrips(
  strips: readonly StripConfig[],
  open: OpenSerialLink,
  options: AdalightOptions,
): Promise<{ ok: true; outputs: Map<string, AdalightOutput> } | { ok: false; error: string }> {
  const outputs = new Map<string, AdalightOutput>();
  for (const { id, name, ledCount, output } of strips) {
    if (output.type !== 'adalight') continue;
    const { port, baudRate, chip } = output;
    const strip = { name, ledCount, port, baudRate, colorOrder: chipOf(chip).colorOrder };
    const opened = await openAdalight(strip, open, options);
    if (!opened.ok) {
      for (const each of outputs.values()) each.close();
      return opened;
    }
    outputs.set(id, opened.output);
  }
  return { ok: true, outputs };
}

/** Un búfer de 6 + 3 × LEDs bytes con la cabecera Adalight ya escrita: uno por salida. */
export function adalightBuffer(ledCount: number): Uint8Array {
  const buffer = new Uint8Array(HEADER_LENGTH + ledCount * 3);
  const high = ((ledCount - 1) >> 8) & 0xff;
  const low = (ledCount - 1) & 0xff;
  buffer.set([0x41, 0x64, 0x61, high, low, high ^ low ^ 0x55]);
  return buffer;
}

/** A qué byte de su LED va cada canal del frame con ese orden de color. */
export function channelTargets(order: ColorOrder): ChannelTargets {
  return [order.indexOf('R'), order.indexOf('G'), order.indexOf('B')];
}

/**
 * Copia los colores de `frame` (RGB, 3 bytes por LED) detrás de la cabecera, cada canal en el byte
 * de su LED que dice `targets` y pasado por la respuesta del LED del núcleo, y devuelve `buffer`. Da
 * igual reordenar antes o después de la gamma: se aplica a cada canal por separado.
 */
export function encodeAdalight(
  buffer: Uint8Array,
  frame: Uint8Array,
  targets: ChannelTargets,
): Uint8Array {
  frame.forEach((value, index) => {
    const channel = (index % 3) as 0 | 1 | 2;
    buffer[HEADER_LENGTH + index - channel + targets[channel]] = LED_RESPONSE[value] ?? 0;
  });
  return buffer;
}
