import type { SourceMessage, StripState } from '@moodtable/shared';
import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FakeContext } from '../test/fake-audio-context.ts';
import { render } from '../test/render.tsx';
import { App, type PanelConnection } from './App.tsx';
import { AudioPlayer } from './audio/player.ts';
import type { ConnectionStatus, PositionListener } from './engine/connection.ts';

/** Una conexión falsa: el test decide cuándo cambia de estado. */
function fakeConnection() {
  const listeners = new Set<() => void>();
  const positionListeners = new Set<PositionListener>();
  const connection = {
    status: 'disconnected' as ConnectionStatus,
    frames: new Map<number, Uint8Array>(),
    source: undefined as SourceMessage | undefined,
    level: undefined as number | undefined,
    sourceLost: false as boolean,
    strips: undefined as readonly StripState[] | undefined,
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    subscribePositions: (listener: PositionListener) => {
      positionListeners.add(listener);
      return () => positionListeners.delete(listener);
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
  /** El mensaje de estado de la tarjeta, que llega en su propio aviso. */
  const setSourceLost = (lost: boolean) => {
    connection.sourceLost = lost;
    notify();
  };
  /** Una posición del fichero que llega del motor en el instante `arrivedAt` (ms). */
  const sendPosition = (position: number, arrivedAt: number) => {
    for (const listener of positionListeners) listener({ seq: 0, position }, arrivedAt);
  };
  return { connection, setStatus, setSource, setSourceLost, sendPosition };
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

  it('la cabecera avisa mientras la tarjeta de sonido está perdida, y lo quita al recuperarla', () => {
    const { connection, setStatus, setSource, setSourceLost } = fakeConnection();
    render(<App connection={connection} />);
    act(() => {
      setStatus('connected');
      setSource({ kind: 'soundcard', name: 'Mixer de la mesa' });
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => {
      setSourceLost(true);
    });
    expect(screen.getByRole('alert')).toHaveTextContent('Desconectada');

    act(() => {
      setSourceLost(false);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sin conexión, la cabecera no muestra fuente ni vúmetro', () => {
    render(<App connection={fakeConnection().connection} />);

    const header = screen.getByRole('banner');
    expect(header).not.toHaveTextContent('Fichero');
    expect(header).not.toHaveTextContent('Sin fuente de audio');
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });
});

const LISTEN = { name: 'Oír el fichero de audio' };
const PREPARING = { name: 'Preparando el audio' };
const STOP = { name: 'Dejar de oír el fichero de audio' };

/**
 * El panel conectado, con el reproductor de verdad sobre un `AudioContext` falso y una descarga que
 * el test termina cuando quiere.
 */
function panelWithAudio() {
  const fake = fakeConnection();
  const context = new FakeContext();
  let finishDownload: (data: ArrayBuffer) => void = () => undefined;
  const player = new AudioPlayer(fake.connection, {
    fetchAudio: () =>
      new Promise<ArrayBuffer>((resolve) => {
        finishDownload = resolve;
      }),
    createContext: () => context,
    now: () => 1000,
  });
  render(<App connection={fake.connection} player={player} />);
  act(() => {
    fake.setStatus('connected');
  });
  /** Termina la descarga y llega una posición: el reproductor ya puede sonar. */
  const download = async () => {
    await act(async () => {
      finishDownload(new ArrayBuffer(8));
      await Promise.resolve();
    });
    act(() => {
      fake.sendPosition(1, 1000);
    });
  };
  return { ...fake, player, download };
}

describe('oír el fichero de audio desde la cabecera', () => {
  it('con un fichero como fuente: oír, preparando, dejar de oír y otra vez oír', async () => {
    const panel = panelWithAudio();
    act(() => {
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
    });
    const header = screen.getByRole('banner');

    fireEvent.click(screen.getByRole('button', LISTEN));
    expect(header).toContainElement(screen.getByRole('button', PREPARING));

    await panel.download();
    fireEvent.click(screen.getByRole('button', STOP));

    expect(screen.getByRole('button', LISTEN)).toBeInTheDocument();
  });

  it('sin fuente de audio, no ofrece oír nada', () => {
    const panel = panelWithAudio();
    act(() => {
      panel.setSource({ kind: 'none' });
    });

    expect(screen.queryByRole('button', LISTEN)).not.toBeInTheDocument();
  });

  it('con una tarjeta de sonido como fuente, no ofrece oírla', () => {
    const panel = panelWithAudio();
    act(() => {
      panel.setSource({ kind: 'soundcard', name: 'Mixer de la mesa' });
    });

    expect(screen.getByText('Tarjeta de sonido: Mixer de la mesa')).toBeInTheDocument();
    expect(screen.queryByRole('button', LISTEN)).not.toBeInTheDocument();
  });

  it('sin conexión, no ofrece oír nada', () => {
    render(<App connection={fakeConnection().connection} />);

    expect(screen.queryByRole('button', LISTEN)).not.toBeInTheDocument();
  });

  it('si se pierde la conexión mientras suena, calla, y al volver ofrece oír', async () => {
    const panel = panelWithAudio();
    act(() => {
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
    });
    fireEvent.click(screen.getByRole('button', LISTEN));
    await panel.download();
    expect(panel.player.state).toBe('playing');

    act(() => {
      panel.connection.source = undefined;
      panel.setStatus('disconnected');
    });
    expect(panel.player.state).toBe('silent');
    expect(screen.queryByRole('button', STOP)).not.toBeInTheDocument();

    act(() => {
      panel.setStatus('connected');
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
    });
    expect(screen.getByRole('button', LISTEN)).toBeInTheDocument();
  });

  it('deja leer en window, de solo lectura, el estado, el error de sincronía y los saltos', async () => {
    const panel = panelWithAudio();
    act(() => {
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
    });
    expect(window.moodTableAudio).toEqual({ state: 'silent', error: undefined, jumps: 0 });

    fireEvent.click(screen.getByRole('button', LISTEN));
    await panel.download();

    // Aún no ha comparado lo que suena con el visor: no hay error medido.
    expect(window.moodTableAudio).toEqual({ state: 'playing', error: undefined, jumps: 0 });
    expect(() => {
      Object.assign(window, { moodTableAudio: { state: 'silent' } });
    }).toThrow();
  });
});
