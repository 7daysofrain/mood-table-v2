/**
 * Escenarios de `specs/module-boundaries`: cada caso lintea un fichero de ejemplo como si estuviera
 * en la carpeta que indica y comprueba si la regla de fronteras lo rechaza. Así un fallo silencioso
 * de la regla (un import que no resuelve y se trata como externo) rompe un test, no pasa sin más.
 */
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Sin información de tipos: los ejemplos no pertenecen a ningún tsconfig y aquí solo importan las
// reglas de fronteras, que no la necesitan.
const eslint = new ESLint({
  cwd: repoRoot,
  overrideConfig: [
    tseslint.configs.disableTypeChecked,
    { languageOptions: { parserOptions: { project: false, projectService: false } } },
  ],
});

const BOUNDARY_RULE = 'boundaries/dependencies';

async function boundaryErrors(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath: `${repoRoot}${filePath}` });
  return (result?.messages ?? []).filter(
    (message) => message.severity === 2 && message.ruleId === BOUNDARY_RULE,
  );
}

describe('el núcleo del motor no depende de los adaptadores', () => {
  it('rechaza que un fichero del núcleo importe un adaptador', async () => {
    const errors = await boundaryErrors(
      'packages/engine/src/core/example.ts',
      "import { ADAPTERS_NAME } from '../adapters/index.ts';\nexport const x = ADAPTERS_NAME;\n",
    );
    expect(errors).toHaveLength(1);
  });

  it('permite que un adaptador importe del núcleo', async () => {
    const errors = await boundaryErrors(
      'packages/engine/src/adapters/example.ts',
      "import { CORE_NAME } from '../core/index.ts';\nexport const x = CORE_NAME;\n",
    );
    expect(errors).toEqual([]);
  });
});

describe('solo la raíz de composición conoce núcleo y adaptadores a la vez', () => {
  it('permite que main.ts importe del núcleo, de los adaptadores y de shared', async () => {
    const errors = await boundaryErrors(
      'packages/engine/src/main.ts',
      [
        "import { SHARED_PACKAGE_NAME } from '@moodtable/shared';",
        "import { ADAPTERS_NAME } from './adapters/index.ts';",
        "import { CORE_NAME } from './core/index.ts';",
        'export const x = [SHARED_PACKAGE_NAME, ADAPTERS_NAME, CORE_NAME];',
        '',
      ].join('\n'),
    );
    expect(errors).toEqual([]);
  });
});

describe('el panel solo importa de shared entre los paquetes del repo', () => {
  it('rechaza que el panel importe el motor por nombre de paquete', async () => {
    const errors = await boundaryErrors(
      'packages/panel/src/example.ts',
      "import { COMPOSITION } from '@moodtable/engine';\nexport const x = COMPOSITION;\n",
    );
    expect(errors).toHaveLength(1);
  });

  it('rechaza que el panel importe el motor por ruta relativa', async () => {
    const errors = await boundaryErrors(
      'packages/panel/src/example.ts',
      "import { CORE_NAME } from '../../engine/src/core/index.ts';\nexport const x = CORE_NAME;\n",
    );
    expect(errors).toHaveLength(1);
  });

  it('permite que el panel importe lo que shared exporta', async () => {
    const errors = await boundaryErrors(
      'packages/panel/src/example.ts',
      "import { SHARED_PACKAGE_NAME } from '@moodtable/shared';\nexport const x = SHARED_PACKAGE_NAME;\n",
    );
    expect(errors).toEqual([]);
  });

  it('rechaza que el panel importe un fichero interno de shared', async () => {
    const errors = await boundaryErrors(
      'packages/panel/src/example.ts',
      "import { SHARED_PACKAGE_NAME } from '@moodtable/shared/src/index.ts';\nexport const x = SHARED_PACKAGE_NAME;\n",
    );
    expect(errors).toHaveLength(1);
  });
});

describe('shared no depende de los otros paquetes', () => {
  it('rechaza que shared importe el motor por nombre de paquete', async () => {
    const errors = await boundaryErrors(
      'packages/shared/src/example.ts',
      "import { COMPOSITION } from '@moodtable/engine';\nexport const x = COMPOSITION;\n",
    );
    expect(errors).toHaveLength(1);
  });

  it('rechaza que shared importe el motor por ruta relativa', async () => {
    const errors = await boundaryErrors(
      'packages/shared/src/example.ts',
      "import { CORE_NAME } from '../../engine/src/core/index.ts';\nexport const x = CORE_NAME;\n",
    );
    expect(errors).toHaveLength(1);
  });
});
