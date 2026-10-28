/**
 * Entrada de `pnpm openapi`: escribe el OpenAPI de la API en `docs/openapi.yaml`. La lógica está en
 * `openapi.ts`.
 */
import { relative } from 'node:path';
import { writeFile } from 'node:fs/promises';

import { REPO_ROOT } from './adapters/config-file.ts';
import { OPENAPI_FILE, openApiYaml } from './openapi.ts';

await writeFile(OPENAPI_FILE, await openApiYaml());
console.log(`Escrito ${relative(REPO_ROOT, OPENAPI_FILE)}`);
