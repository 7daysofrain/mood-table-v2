// @ts-check
import js from '@eslint/js';
import boundaries from 'eslint-plugin-boundaries';
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

  // Regla de fronteras (specs/module-boundaries, design.md §3). Todo lo que no se permite aquí está
  // prohibido, así que una carpeta nueva sin clasificar falla en lugar de pasar por omisión.
  {
    files: ['packages/**/*.{ts,tsx}'],
    plugins: { boundaries },
    settings: {
      'import/resolver': {
        typescript: {
          project: ['./packages/*/tsconfig.json'],
          noWarnOnMultipleProjects: true,
        },
      },
      'boundaries/elements': [
        { type: 'shared', pattern: 'packages/shared' },
        { type: 'engine-core', pattern: 'packages/engine/src/core' },
        { type: 'engine-adapter', pattern: 'packages/engine/src/adapters' },
        { type: 'engine-main', pattern: 'packages/engine/src' },
        { type: 'panel', pattern: 'packages/panel' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          // Evalúa también los imports externos: es lo que permite rechazar un paquete del repo que
          // no resuelve (el plugin lo clasifica como externo).
          checkAllOrigins: true,
          default: 'disallow',
          policies: [
            // Dependencias de npm y módulos de Node: las gestiona package.json, no esta regla.
            { allow: { to: { module: { origin: ['external', 'core'] } } } },
            { from: { element: { type: 'shared' } }, allow: { to: { element: { type: 'shared' } } } },
            {
              from: { element: { type: 'engine-core' } },
              allow: { to: { element: { type: ['engine-core', 'shared'] } } },
            },
            {
              from: { element: { type: 'engine-adapter' } },
              allow: { to: { element: { type: ['engine-adapter', 'engine-core', 'shared'] } } },
            },
            {
              from: { element: { type: 'engine-main' } },
              allow: {
                to: { element: { type: ['engine-main', 'engine-core', 'engine-adapter', 'shared'] } },
              },
            },
            {
              from: { element: { type: 'panel' } },
              allow: { to: { element: { type: ['panel', 'shared'] } } },
            },
            // Un paquete del repo que no resuelve (no es dependencia declarada, o se entra por una ruta
            // interna que su `exports` no publica) no es "externo": se rechaza.
            {
              disallow: { to: { module: { origin: 'external', source: '@moodtable/**' } } },
              message:
                'Regla de fronteras: "{{dependency.source}}" no es una dependencia permitida. Entre paquetes del repo solo se importa el punto de entrada de una dependencia declarada (specs/module-boundaries).',
            },
          ],
        },
      ],
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
