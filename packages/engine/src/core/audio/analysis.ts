/**
 * Análisis del audio (README §2.2, decisiones 1, 2, 4 y 11 del change virtual-strip-audio-file).
 * Sin implementar todavía: sus tests están en rojo.
 */

/** Lo que el análisis entrega a los efectos reactivos en `FrameContext.audio`. */
export interface AudioFeatures {
  /** Energía de cada banda mel, de graves a agudos, ya normalizada. */
  readonly bands: Float32Array;
  /** La ventana es silencio digital: un efecto reactivo se apaga. */
  silent: boolean;
}

export interface AudioAnalyzer {
  /** La ventana del pulso (unos 40 ms): la rellena el bucle con la fuente de audio. */
  readonly window: Float32Array;
  /** Tamaño de la FFT: la ventana rellenada con ceros hasta la siguiente potencia de 2. */
  readonly fftSize: number;
  /** Nivel de la ventana: su RMS, de 0 a 1, sin ajustar. */
  level(): number;
  /** Calcula las bandas de la ventana; `dt`, los segundos desde el pulso anterior. */
  update(dt: number): AudioFeatures;
}

export function createAudioAnalyzer(sampleRate: number): AudioAnalyzer {
  throw new Error(`Sin implementar (${sampleRate} Hz)`);
}
