/**
 * Esquemas de la API HTTP del motor (decisión 6 del change strip-effect-switch): con ellos valida la
 * ruta, se genera el OpenAPI y el panel tipa lo que envía y recibe. Por HTTP van los mandos; el estado
 * de las tiras lo cuenta el WebSocket del visor (decisión 2).
 */
import Type, { type Static } from 'typebox';

import { EFFECT_CATALOG, type EffectId, EffectIdSchema, type EffectValues } from './effects.ts';

/** Un cuerpo con campos de más es un error de quien llama, no algo que ignorar. */
const CLOSED = { additionalProperties: false } as const;

/** El cuerpo de `PUT /api/strips/{stripId}/effect`: el id del efecto, uno del catálogo. */
export const SetEffectBodySchema = Type.Object({ effect: EffectIdSchema }, CLOSED);

/**
 * Las respuestas `200` de las dos rutas: la tira con su efecto activo y sus valores, con la misma
 * forma que en el mensaje `6`.
 */
export {
  StripStateSchema as SetEffectResponseSchema,
  StripStateSchema as SetValuesResponseSchema,
} from './viewer-protocol.ts';

/** Los valores de cualquier efecto del catálogo: el cuerpo de la ruta de valores. */
export type SetValuesBody = EffectValues<EffectId>;

/**
 * El cuerpo de `PUT /api/strips/{stripId}/values`: todos los valores del efecto activo (decisión 4
 * del change strip-effect-values). Es la unión de los esquemas de parámetros del catálogo, para que el
 * OpenAPI describa cada forma con sus rangos; la validación que decide es la del efecto activo, y la
 * hace el motor. `Unsafe` le da su tipo, que el `map` pierde; el esquema es el mismo.
 */
export const SetValuesBodySchema = Type.Unsafe<SetValuesBody>(
  Type.Union(EFFECT_CATALOG.map((effect) => effect.paramsSchema)),
);

/** La respuesta de cualquier error de la API (`400`, `404`, `409`): una frase que dice qué pasa. */
export const ApiErrorSchema = Type.Object({ message: Type.String({ minLength: 1 }) }, CLOSED);

export type SetEffectBody = Static<typeof SetEffectBodySchema>;

export type ApiError = Static<typeof ApiErrorSchema>;
