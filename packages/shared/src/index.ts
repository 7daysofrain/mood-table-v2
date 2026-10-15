/**
 * Punto de entrada público de `@moodtable/shared`: lo único que pueden importar `engine` y `panel`.
 * Los esquemas TypeBox comunes (configuración de tiras, parámetros de efectos, comandos, formato de
 * frames) se publican aquí a medida que llegan las tareas que los usan.
 */
export const SHARED_PACKAGE_NAME = '@moodtable/shared';

export {
  ConfigFileSchema,
  parseConfig,
  StripConfigSchema,
  type Config,
  type ConfigResult,
  type StripConfig,
} from './config.ts';

export { BreathingParamsSchema, type BreathingParams } from './effects.ts';
