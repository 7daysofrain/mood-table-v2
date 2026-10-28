/**
 * Los textos de las zonas Tiras y Efectos (decisión 9 del change strip-effect-switch), en castellano
 * y sin librería de i18n. Los nombres salen de `EffectId` y del tipo de salida: un efecto o una
 * salida nuevos no compilan hasta tener el suyo. Pasar el panel al inglés (MOO-104) traerá aquí los
 * textos que hoy están en cada componente.
 */
import type { EffectId, StripState } from '@moodtable/shared';

/** El nombre de cada efecto, como lo dice el glosario (PRD §8). */
export const EFFECT_NAMES: Record<EffectId, string> = {
  breathing: 'Respiración',
  energy: 'Energía',
};

/** Cómo se etiqueta un efecto según use el audio o no (glosario: *efecto*). */
export const EFFECT_KIND = { reactive: 'Reactivo', ambient: 'De ambiente' } as const;

/** Por qué un efecto reactivo no se puede elegir sin fuente de audio (decisión 5). */
export const NEEDS_AUDIO_SOURCE = 'Necesita una fuente de audio';

/** El nombre de cada salida (glosario: *salida*). Adalight llega con H3. */
export const OUTPUT_NAMES: Record<StripState['output']['type'], string> = {
  virtual: 'Virtual',
};

/** El nombre accesible de la lista de tiras: la zona ya tiene su título a la vista. */
export const STRIP_LIST_LABEL = 'Tiras declaradas';

/** El nombre accesible de la lista de efectos. */
export const EFFECT_LIST_LABEL = 'Efectos de la tira seleccionada';

/** «1 LED», «60 LEDs». */
export function ledCountLabel(ledCount: number): string {
  return ledCount === 1 ? '1 LED' : `${ledCount} LEDs`;
}
