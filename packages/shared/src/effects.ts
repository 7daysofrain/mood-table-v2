/**
 * Esquemas de los parámetros de cada efecto (README §2.3): viven aquí porque los necesitan el panel,
 * para generar los controles, y la API, para validar. El render de cada efecto está en el motor.
 */
import Type, { type Static } from 'typebox';

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
