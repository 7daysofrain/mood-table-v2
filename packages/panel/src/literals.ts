/**
 * Los textos de las zonas Tiras, Efectos y Controles (decisión 9 de los changes strip-effect-switch
 * y strip-effect-values), en castellano y sin librería de i18n. Los nombres salen de `EffectId`, de
 * los valores de cada efecto y del tipo de salida: un efecto, un parámetro o una salida nuevos no
 * compilan hasta tener el suyo. Pasar el panel al inglés (MOO-104) traerá aquí los
 * textos que hoy están en cada componente.
 */
import type { EffectId, EffectValues, StripState } from '@moodtable/shared';

/** El nombre de cada efecto, como lo dice el glosario (PRD §8). */
export const EFFECT_NAMES: Record<EffectId, string> = {
  breathing: 'Respiración',
  energy: 'Energía',
};

/** El nombre de cada parámetro de cada efecto, como lo lee el DJ junto a su control. */
export const PARAM_NAMES: { [E in EffectId]: Record<keyof EffectValues<E>, string> } = {
  breathing: { color: 'Color', period: 'Periodo (s)' },
  energy: {},
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

/** Los nombres accesibles de las partes del selector de color. */
export const CONTROL_LABELS = { saturation: 'Saturación y brillo', hue: 'Tono' } as const;

/** El valor de un slider, con un decimal y coma: «4,0». La unidad va en el nombre del parámetro. */
export function formatValue(value: number): string {
  return value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** «1 LED», «60 LEDs». */
export function ledCountLabel(ledCount: number): string {
  return ledCount === 1 ? '1 LED' : `${ledCount} LEDs`;
}
