/**
 * Visor del panel (specs/viewer). Sin implementar todavía: sus tests están en rojo.
 */

/** De dónde lee el visor los frames: el último de cada tira, por su índice. */
export interface FrameSource {
  readonly frames: ReadonlyMap<number, Uint8Array>;
}

export function Viewer({ source }: { source: FrameSource }) {
  void source;
  return null;
}
