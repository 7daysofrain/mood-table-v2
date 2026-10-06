import { defineConfig } from 'vitest/config';

/**
 * Un único runner para todo el repositorio (README §2.6): cada paquete es un proyecto de Vitest y
 * la cobertura sale en un único `coverage/lcov.info`, el que lee SonarQube.
 */
export default defineConfig({
  test: {
    projects: ['packages/*', 'tooling'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.{ts,tsx}', '.claude/hooks/**/*.ts'],
      // Mantener igual que `sonar.coverage.exclusions` en sonar-project.properties.
      exclude: [
        // Raíces de composición: montan piezas, sin lógica propia (design.md §5).
        'packages/engine/src/main.ts',
        'packages/panel/src/main.tsx',
        // Entrada del hook validate-ac: lee stdin y sale con su código; la lógica está en su módulo.
        '.claude/hooks/validate-ac.ts',
        // E/S real de los adaptadores de hardware: se prueba a mano (README §2.6).
        '**/*.hardware.ts',
      ],
    },
  },
});
