/**
 * Raíz de composición (README §2.1): el único módulo que conoce a la vez el núcleo y los
 * adaptadores. Leerá la configuración y montará el motor (`MOO-16`).
 */
import { SHARED_PACKAGE_NAME } from '@moodtable/shared';

import { ADAPTERS_NAME } from './adapters/index.ts';
import { CORE_NAME } from './core/index.ts';

export const COMPOSITION = [SHARED_PACKAGE_NAME, CORE_NAME, ADAPTERS_NAME] as const;
