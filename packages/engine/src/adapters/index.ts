/**
 * Adaptadores del motor: audio, luz, HTTP y persistencia (README §2.1). Pueden importar los
 * puertos del núcleo, nunca al revés. Los adaptadores reales llegan con sus tareas.
 */
import { CORE_NAME } from '../core/index.ts';

export const ADAPTERS_NAME = `adapters → ${CORE_NAME}`;
