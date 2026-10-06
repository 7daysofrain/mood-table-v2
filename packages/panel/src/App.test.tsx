import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { render } from '../test/render.tsx';
import { App } from './App.tsx';

describe('App', () => {
  it('renderiza el contenedor principal del panel', () => {
    render(<App />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
