import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { App } from './App.tsx';

describe('App', () => {
  it('renderiza el contenedor principal del panel', () => {
    expect(renderToStaticMarkup(<App />)).toBe('<main></main>');
  });
});
