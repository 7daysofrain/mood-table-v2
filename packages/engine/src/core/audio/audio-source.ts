/**
 * Puerto de la fuente de audio (README §2.1, decisión 3 del change virtual-strip-audio-file): es
 * *pull*, el ritmo lo marca el motor. En cada pulso, el bucle pide la ventana de audio que acaba en
 * el instante del pulso, y la fuente la escribe. Un fichero la saca de sus muestras en bucle; la
 * tarjeta de sonido (`MOO-15`), de su búfer circular, sin mirar el instante.
 */
export interface AudioSource {
  /** Frecuencia de muestreo de lo que entrega, en Hz. */
  readonly sampleRate: number;
  /**
   * Escribe en `out` las últimas `out.length` muestras (mono, de -1 a 1) que acaban en `time`, los
   * segundos del pulso desde el arranque. No crea objetos.
   */
  read(time: number, out: Float32Array): void;
  /**
   * El punto de la fuente, en segundos desde su principio, en el que acaba la ventana de
   * `read(time, …)`. Solo lo tiene una fuente que recorre un fichero; la tarjeta de sonido, no.
   */
  positionAt?(time: number): number;
  /**
   * Nivel, en dBFS, por debajo del cual una ventana cuenta como silencio. Lo tiene la tarjeta de
   * sonido, que nunca entrega ceros (decisión 7 del change soundcard-audio-source); sin él, solo es
   * silencio el digital, el de un fichero.
   */
  readonly silenceThreshold?: number;
}
