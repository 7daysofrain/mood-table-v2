/**
 * Catálogo de efectos y esquemas de sus parámetros (README §2.3): viven aquí porque los necesitan el
 * fichero de configuración, para validar el efecto de cada tira, el panel, para generar los
 * controles, y la API, para validar. El render de cada efecto está en el motor, en un registro con
 * los mismos ids.
 */
import Type, { type Static } from 'typebox';

/**
 * Los efectos que existen (decisión 10 del change virtual-strip-audio-file): su id, en inglés como
 * el resto del fichero, y si son reactivos (`true`) o de ambiente (`false`).
 */
export const EFFECT_CATALOG = [
  { id: 'breathing', usesAudio: false },
  { id: 'energy', usesAudio: true },
] as const;

export type EffectId = (typeof EFFECT_CATALOG)[number]['id'];

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

/** Blanco cálido: el de una bombilla incandescente (unos 2700 K). */
const WARM_WHITE = '#FFA957';

/**
 * *Respiración*: color y segundos de una respiración completa (subir y bajar). Valores por
 * defecto: la decisión del DJ sobre PRD Q2 (decisión 5 del change virtual-strip-breathing).
 */
export const BreathingParamsSchema = Type.Object({
  color: Type.String({ pattern: '^#[0-9A-Fa-f]{6}$', default: WARM_WHITE }),
  period: Type.Number({ exclusiveMinimum: 0, default: 4 }),
});

export type BreathingParams = Static<typeof BreathingParamsSchema>;

/**
 * *Energía*: sin parámetros, como la de la v1 (decisión 1 del change virtual-strip-audio-file). La
 * sensibilidad llega con H2.
 */
export const EnergyParamsSchema = Type.Object({});

export type EnergyParams = Static<typeof EnergyParamsSchema>;
