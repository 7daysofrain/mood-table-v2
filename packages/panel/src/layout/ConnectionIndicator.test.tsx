import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { render } from '../../test/render.tsx';
import { ConnectionIndicator } from './ConnectionIndicator.tsx';

describe('el indicador de conexión', () => {
  it('conectado, dice «Conectado»', () => {
    render(<ConnectionIndicator status="connected" />);

    expect(screen.getByRole('status')).toHaveTextContent('Conectado');
  });

  it('sin conexión, dice «Sin conexión con el motor»', () => {
    render(<ConnectionIndicator status="disconnected" />);

    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión con el motor');
  });
});
