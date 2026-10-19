/**
 * Contrato común de los efectos (README §2.2, decisión 1 del change virtual-strip-breathing): el
 * mismo para los de ambiente y los reactivos (patrón *Strategy*). Un efecto no lee el reloj ni
 * guarda nada fuera de su memoria, así que con la misma entrada da siempre el mismo frame.
 */
import type { StripConfig } from '@moodtable/shared';
import type { TSchema } from 'typebox';
import Value from 'typebox/value';

import type { AudioFeatures } from '../audio/analysis.ts';

/** Lo que el bucle le pasa al efecto en cada frame. Es el mismo objeto en todos los frames. */
export interface FrameContext {
  /** Segundos desde que arrancó el bucle: el ambiente se anima con él. */
  time: number;
  /** Segundos desde el frame anterior. */
  dt: number;
  /**
   * Rasgos del audio del pulso, los mismos para todas las tiras. `null` si no hay fuente de audio o
   * si ninguna tira tiene un efecto que use audio (decisión 4 del change virtual-strip-audio-file).
   */
  audio: AudioFeatures | null;
}

export interface Effect<P, M> {
  /** Identificador estable: `"breathing"`, `"spectrum"`… */
  id: string;
  /** Reactivo (`true`) o de ambiente (`false`): el bucle solo analiza el audio si alguno lo usa. */
  usesAudio: boolean;
  /** Tipos, rangos y valores por defecto de los parámetros: el panel genera sus controles con él. */
  paramsSchema: TSchema;
  /** Memoria del efecto entre frames, una por tira. No es el estado del instrumento. */
  createMemory(strip: StripConfig): M;
  /**
   * Escribe el frame en `out` (RGB, 3 bytes por LED). Se llama en cada frame: no debe crear
   * objetos, para no provocar pausas del recolector de basura.
   */
  render(ctx: FrameContext, params: P, memory: M, out: Uint8Array): void;
}

/** Los parámetros de un efecto con los valores por defecto de su esquema. */
export function defaultParams<P>(effect: Effect<P, unknown>): P {
  return Value.Create(effect.paramsSchema) as P;
}
