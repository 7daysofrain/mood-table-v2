/**
 * Primer paso de `pnpm dev`: deja un `config/local.json` para el motor. La lógica está en
 * `local-config.ts`; aquí solo se resuelve la raíz y se avisa si se ha creado.
 */
import { fileURLToPath } from 'node:url';

import { DEMO_CONFIG, ensureLocalConfig, LOCAL_CONFIG } from './local-config.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));

if ((await ensureLocalConfig(root)) === 'created') {
  console.log(`Creado ${LOCAL_CONFIG} a partir de ${DEMO_CONFIG}`);
}
