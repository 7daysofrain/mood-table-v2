/**
 * Esquemas de la API HTTP del motor (decisión 6 del change strip-effect-switch): con ellos valida la
 * ruta, se genera el OpenAPI y el panel tipa lo que envía y recibe. Por HTTP van los mandos; el estado
 * de las tiras lo cuenta el WebSocket del visor (decisión 2).
 */
import Type, { type Static } from 'typebox';

import { EffectIdSchema } from './effects.ts';

/** Un cuerpo con campos de más es un error de quien llama, no algo que ignorar. */
const CLOSED = { additionalProperties: false } as const;

/** El cuerpo de `PUT /api/strips/{stripId}/effect`: el id del efecto, uno del catálogo. */
export const SetEffectBodySchema = Type.Object({ effect: EffectIdSchema }, CLOSED);

/** La respuesta `200`: la tira con su efecto activo, con la misma forma que en el mensaje `6`. */
export { StripStateSchema as SetEffectResponseSchema } from './viewer-protocol.ts';

/** La respuesta de cualquier error de la API (`400`, `404`, `409`): una frase que dice qué pasa. */
export const ApiErrorSchema = Type.Object({ message: Type.String({ minLength: 1 }) }, CLOSED);

export type SetEffectBody = Static<typeof SetEffectBodySchema>;

export type ApiError = Static<typeof ApiErrorSchema>;
