/**
 * Punto de entrada público de `@moodtable/shared`: lo único que pueden importar `engine` y `panel`.
 * Los esquemas TypeBox comunes (configuración de tiras, parámetros de efectos, comandos, formato de
 * frames) se publican aquí a medida que llegan las tareas que los usan.
 */
export const SHARED_PACKAGE_NAME = '@moodtable/shared';

export {
  type ApiError,
  ApiErrorSchema,
  type SetEffectBody,
  SetEffectBodySchema,
  SetEffectResponseSchema,
} from './commands.ts';

export {
  AudioSourceConfigSchema,
  ConfigFileSchema,
  parseConfig,
  StripConfigSchema,
  type AudioSourceConfig,
  type Config,
  type ConfigResult,
  type StripConfig,
} from './config.ts';

export {
  BreathingParamsSchema,
  EFFECT_CATALOG,
  EffectIdSchema,
  EnergyParamsSchema,
  type BreathingParams,
  type EffectId,
  type EnergyParams,
  needsAudioSource,
} from './effects.ts';

export {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  decodeSourceStatus,
  decodeStrips,
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  encodeSourceStatus,
  encodeStrips,
  FRAME_HEADER_BYTES,
  FRAME_MESSAGE_TYPE,
  type FrameMessage,
  LEVEL_MESSAGE_TYPE,
  type LevelMessage,
  MAX_STRIPS,
  POSITION_MESSAGE_TYPE,
  type PositionMessage,
  SOURCE_MESSAGE_TYPE,
  type SourceMessage,
  SOURCE_STATUS_MESSAGE_TYPE,
  type SourceStatus,
  type StripState,
  StripStateSchema,
  STRIPS_MESSAGE_TYPE,
  type StripsMessage,
  StripsMessageSchema,
} from './viewer-protocol.ts';
