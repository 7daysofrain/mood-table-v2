/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // En desarrollo, el panel se abre en Vite (recarga en caliente) y Vite reenvía al motor, en su
  // dirección por defecto, el WebSocket del visor (decisión 12) y el fichero de audio. El motor no
  // sabe nada de Vite.
  server: {
    proxy: {
      '/ws': { target: 'ws://127.0.0.1:8080', ws: true },
      '/audio': { target: 'http://127.0.0.1:8080' },
    },
  },
  // Proyecto del panel en el Vitest de la raíz: tests del DOM con jsdom (design.md, decisión 5).
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
  },
});
