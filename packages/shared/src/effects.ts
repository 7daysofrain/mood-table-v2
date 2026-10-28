/**
 * Catálogo de efectos y esquemas de sus parámetros (README §2.3): viven aquí porque los necesitan el
 * fichero de configuración, para validar el efecto de cada tira, el panel, para generar los
 * controles, y la API, para validar. El render de cada efecto está en el motor, en un registro con
 * los mismos ids.
 */
import Type, { type Static } from 'typebox';

/** Blanco cálido: el de una bombilla incandescente (unos 2700 K). */
const WARM_WHITE = '#FFA957';

/**
 * Unos valores con campos que el efecto no declara se rechazan: así unos valores atrasados de otro
 * efecto no caen en el activo (decisión 3 del change strip-effect-values).
 */
const CLOSED = { additionalProperties: false } as const;

/**
 * *Respiración*: color y segundos de una respiración completa (subir y bajar). Valores por
 * defecto: la decisión del DJ sobre PRD Q2 (decisión 5 del change virtual-strip-breathing). El
 * periodo va de 1 a 20 s (decisión 1 del change strip-effect-values). Las extensiones `x-` le dicen
 * al panel qué control pintar, y la validación no las tiene en cuenta (decisión 5).
 */
export const BreathingParamsSchema = Type.Object(
  {
    color: Type.String({ pattern: '^#[0-9A-Fa-f]{6}$', default: WARM_WHITE, 'x-control': 'color' }),
    period: Type.Number({ minimum: 1, maximum: 20, default: 4, 'x-scale': 'log' }),
  },
  CLOSED,
);

export type BreathingParams = Static<typeof BreathingParamsSchema>;

/**
 * *Energía*: sin parámetros, como la de la v1 (decisión 1 del change virtual-strip-audio-file). La
 * sensibilidad llega con H2.
 */
export const EnergyParamsSchema = Type.Object({}, CLOSED);

export type EnergyParams = Static<typeof EnergyParamsSchema>;

/**
 * Los efectos que existen (decisión 10 del change virtual-strip-audio-file): su id, en inglés como
 * el resto del fichero, si son reactivos (`true`) o de ambiente (`false`) y el esquema de sus
 * parámetros, con el que el motor valida y el panel dibuja (decisión 5 del change
 * strip-effect-values).
 */
export const EFFECT_CATALOG = [
  { id: 'breathing', usesAudio: false, paramsSchema: BreathingParamsSchema },
  { id: 'energy', usesAudio: true, paramsSchema: EnergyParamsSchema },
] as const;

export type EffectId = (typeof EFFECT_CATALOG)[number]['id'];

/** Los valores de un efecto, por su id: `EffectValues<'breathing'>` es `BreathingParams`. */
export type EffectValues<E extends EffectId> = Static<
  Extract<(typeof EFFECT_CATALOG)[number], { id: E }>['paramsSchema']
>;

/**
 * El id de un efecto del catálogo, para el fichero, el protocolo del visor y la API. La unión se
 * genera del catálogo, y `Unsafe` le da su tipo, que el `map` pierde; el esquema es el mismo.
 */
export const EffectIdSchema = Type.Unsafe<EffectId>(
  Type.Union(EFFECT_CATALOG.map((effect) => Type.Literal(effect.id))),
);

/**
 * Si el efecto solo funciona con fuente de audio: los reactivos. Es la única regla, y la usan el
 * fichero al arrancar, el motor al cambiar el efecto de una tira y el panel, que desactiva los que no
 * se pueden elegir (decisión 5 del change strip-effect-switch).
 */
export function needsAudioSource(effect: EffectId): boolean {
  return EFFECT_CATALOG.some((each) => each.id === effect && each.usesAudio);
}
