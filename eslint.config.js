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
  // Builds, cobertura e informes y trazas que genera Playwright al ejecutar los E2E.
  globalIgnores(['**/dist/', 'coverage/', 'e2e/playwright-report/', 'e2e/test-results/']),

  // Las carpetas con punto son de herramientas, no código del repo: por ejemplo, los worktrees que
  // crean las sesiones de Claude Code en `.claude/worktrees/` son copias enteras del repo. La
  // excepción son los hooks de Claude Code, que sí son código nuestro. Hay que reabrir `.claude/`
  // antes que `.claude/hooks/`: ESLint no reabre un fichero si su carpeta sigue ignorada.
  globalIgnores(['.*/', '!.claude/', '.claude/*', '!.claude/hooks/']),

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
          './e2e/tsconfig.json',
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
        // El PR Babysitter es herramienta de desarrollo, no producto (D63): mismas capas que el motor
        // y ninguna dependencia con los paquetes del producto (change pr-tracking, decisión 5).
        { type: 'pb-core', pattern: 'packages/pr-babysitter/src/core' },
        { type: 'pb-adapter', pattern: 'packages/pr-babysitter/src/adapters' },
        { type: 'pb-main', pattern: 'packages/pr-babysitter/src' },
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
            {
              from: { element: { type: 'pb-core' } },
              allow: { to: { element: { type: 'pb-core' } } },
            },
            {
              from: { element: { type: 'pb-adapter' } },
              allow: { to: { element: { type: ['pb-adapter', 'pb-core'] } } },
            },
            {
              from: { element: { type: 'pb-main' } },
              allow: { to: { element: { type: ['pb-main', 'pb-core', 'pb-adapter'] } } },
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
