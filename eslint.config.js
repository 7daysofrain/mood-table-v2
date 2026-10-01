// @ts-check
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/**
 * Lint de todo el repositorio desde la raíz (design.md §3): reglas de typescript-eslint con
 * información de tipos para el código TypeScript y reglas de hooks de React solo en el panel.
 */
export default defineConfig(
  globalIgnores(['**/dist/', 'coverage/']),

  js.configs.recommended,
  tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        // Un tsconfig por contexto: raíz, cada paquete y la config de Vite (que corre en Node).
        project: [
          './tsconfig.json',
          './packages/*/tsconfig.json',
          './tooling/tsconfig.json',
          './packages/panel/tsconfig.vite.json',
        ],
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: globals.node },
  },

  {
    files: ['packages/panel/src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat['recommended-latest']],
    languageOptions: { globals: globals.browser },
  },
);
