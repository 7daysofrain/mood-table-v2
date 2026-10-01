/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Proyecto del panel en el Vitest de la raíz: tests del DOM con jsdom (design.md, decisión 5).
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
