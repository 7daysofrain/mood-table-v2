/**
 * Preparación de los tests del panel (receta de Mantine para Vitest): matchers de jest-dom y las APIs
 * del navegador que Mantine usa y jsdom no trae.
 */
import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Sin `globals` de Vitest, Testing Library no desmonta solo entre tests.
afterEach(() => {
  cleanup();
});

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver;

window.HTMLElement.prototype.scrollIntoView = () => {};
