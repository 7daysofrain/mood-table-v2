/**
 * Punto de entrada público de `@moodtable/shared`: lo único que pueden importar `engine` y `panel`.
 * Los esquemas TypeBox comunes (configuración de tiras, parámetros de efectos, comandos, formato de
 * frames) se publican aquí a medida que llegan las tareas que los usan.
 */
export const SHARED_PACKAGE_NAME = '@moodtable/shared';

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
  EnergyParamsSchema,
  type BreathingParams,
  type EffectId,
  type EnergyParams,
} from './effects.ts';

export {
  decodeFrame,
  decodeLevel,
  decodePosition,
  decodeSource,
  decodeSourceStatus,
  encodeFrame,
  encodeLevel,
  encodePosition,
  encodeSource,
  encodeSourceStatus,
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
} from './viewer-protocol.ts';
