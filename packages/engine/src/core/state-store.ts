/**
 * Puerto `StateStore` (README §2.1) y el estado del instrumento tal como se guarda (glosario del PRD,
 * *estado del instrumento*): el efecto activo de cada tira y los valores de todos sus efectos. El
 * núcleo solo conoce este puerto, nunca SQLite (design.md, decisión 8 del change
 * instrument-state-restore).
 *
 * Los ids son textos y los valores, `unknown`: lo guardado puede nombrar una tira que el fichero ya
 * no declara o un efecto que el motor ya no tiene, y unos valores de una versión anterior. Se validan
 * al restaurar (decisión 5), no aquí.
 */

/** Lo guardado de una tira. `values` siempre tiene los del efecto activo. */
export interface SavedStrip {
  readonly activeEffect: string;
  /** Los valores de cada efecto de la tira, por id del efecto. */
  readonly values: Readonly<Record<string, unknown>>;
}

/** El estado del instrumento, por id de la tira. Vacío si no hay nada guardado. */
export type InstrumentState = Readonly<Record<string, SavedStrip>>;

/** Síncrono: el motor guarda en su hilo, poco y solo cuando el DJ deja de tocar (decisión 3). */
export interface StateStore {
  /** Lo guardado, o un estado vacío si no hay nada. */
  load(): InstrumentState;
  /**
   * Guarda el estado entero de una vez: sustituye lo de cada tira y cada efecto que lleva, y no borra
   * nada de lo que no lleva (las tiras que el fichero ya no declara y los efectos que el motor ya no
   * tiene se conservan, README §3).
   */
  save(state: InstrumentState): void;
}
