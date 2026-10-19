import type { SourceMessage } from '@moodtable/shared';
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
    source: undefined as SourceMessage | undefined,
    level: undefined as number | undefined,
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies PanelConnection;
  const notify = () => {
    for (const listener of listeners) listener();
  };
  const setStatus = (status: ConnectionStatus) => {
    connection.status = status;
    notify();
  };
  /** Como la conexión real: la fuente llega en su propio aviso, después de conectarse. */
  const setSource = (source: SourceMessage) => {
    connection.source = source;
    notify();
  };
  return { connection, setStatus, setSource };
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

  it('con conexión y un fichero como fuente, la cabecera lo dice y muestra el vúmetro', () => {
    const { connection, setStatus, setSource } = fakeConnection();
    render(<App connection={connection} />);
    act(() => {
      setStatus('connected');
    });
    expect(screen.getByRole('banner')).not.toHaveTextContent('Fichero');

    act(() => {
      setSource({ kind: 'file', name: 'golpes.wav' });
    });

    const header = screen.getByRole('banner');
    expect(header).toHaveTextContent('Fichero: golpes.wav');
    expect(screen.getByRole('meter', { name: 'Nivel de la fuente de audio' })).toBeInTheDocument();
  });

  it('sin conexión, la cabecera no muestra fuente ni vúmetro', () => {
    render(<App connection={fakeConnection().connection} />);

    const header = screen.getByRole('banner');
    expect(header).not.toHaveTextContent('Fichero');
    expect(header).not.toHaveTextContent('Sin fuente de audio');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});
