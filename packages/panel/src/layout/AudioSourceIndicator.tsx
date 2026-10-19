import type { SourceMessage } from '@moodtable/shared';

/** De dónde lee el vúmetro el último nivel de la fuente de audio. */
export interface LevelSource {
  readonly level: number | undefined;
}

/**
 * Fuente de audio de la cabecera (specs/audio-source). Sin implementar todavía: sus tests están en
 * rojo.
 */
export function AudioSourceIndicator(props: Readonly<{ source?: SourceMessage; levels: LevelSource }>) {
  void props;
  return null;
}
