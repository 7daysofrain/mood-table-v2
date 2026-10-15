import { act, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../test/render.tsx';
import { App, type PanelConnection } from './App.tsx';
import type { ConnectionStatus } from './engine/connection.ts';

/** Una conexión falsa: el test decide cuándo cambia de estado. */
function fakeConnection() {
  const listeners = new Set<() => void>();
  const connection = {
    status: 'disconnected' as ConnectionStatus,
    frames: new Map<number, Uint8Array>(),
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies PanelConnection;
  const setStatus = (status: ConnectionStatus) => {
    connection.status = status;
    for (const listener of listeners) listener();
  };
  return { connection, setStatus };
}

describe('App', () => {
  it('renderiza el contenedor principal del panel', () => {
    render(<App connection={fakeConnection().connection} />);

    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('se conecta al motor al abrirse y se desconecta al cerrarse', () => {
    const { connection } = fakeConnection();
    const { unmount } = render(<App connection={connection} />);

    expect(connection.start).toHaveBeenCalled();
    unmount();
    expect(connection.stop).toHaveBeenCalled();
  });

  it('la cabecera sigue el estado de la conexión', () => {
    const { connection, setStatus } = fakeConnection();
    render(<App connection={connection} />);
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión con el motor');

    act(() => {
      setStatus('connected');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Conectado');

    act(() => {
      setStatus('disconnected');
    });
    expect(screen.getByRole('status')).toHaveTextContent('Sin conexión con el motor');
  });

  it('pone el visor en su zona', () => {
    render(<App connection={fakeConnection().connection} />);

    expect(screen.getByRole('img', { name: 'Tiras del visor' })).toBeInTheDocument();
  });
});
