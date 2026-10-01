import { defineConfig } from 'vitest/config';

/**
 * Un único runner para todo el repositorio (README §2.6): cada paquete es un proyecto de Vitest y
 * la cobertura sale en un único `coverage/lcov.info`, el que lee SonarQube.
 */
export default defineConfig({
  test: {
    projects: ['packages/*'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['packages/*/src/**/*.{ts,tsx}'],
      // Mantener igual que `sonar.coverage.exclusions` en sonar-project.properties.
      exclude: [
        // Raíces de composición: montan piezas, sin lógica propia (design.md §5).
        'packages/engine/src/main.ts',
        'packages/panel/src/main.tsx',
        // E/S real de los adaptadores de hardware: se prueba a mano (README §2.6).
        '**/*.hardware.ts',
      ],
    },
  },
});
