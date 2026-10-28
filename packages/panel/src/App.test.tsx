import type { SourceMessage, StripState } from '@moodtable/shared';
import { act, fireEvent, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FakeContext } from '../test/fake-audio-context.ts';
import { render } from '../test/render.tsx';
import { App, type PanelConnection, type PanelEffectRequests } from './App.tsx';
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
  /** Las tiras del motor (mensaje `6`), que llegan en su propio aviso. */
  const setStrips = (strips: readonly StripState[] | undefined) => {
    connection.strips = strips;
    notify();
  };
  /** Una posición del fichero que llega del motor en el instante `arrivedAt` (ms). */
  const sendPosition = (position: number, arrivedAt: number) => {
    for (const listener of positionListeners) listener({ seq: 0, position }, arrivedAt);
  };
  return { connection, setStatus, setSource, setSourceLost, setStrips, sendPosition };
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

const BARRA: StripState = {
  id: 'barra',
  name: 'Barra',
  ledCount: 60,
  output: { type: 'virtual' },
  effect: 'energy',
};
const CABINA: StripState = {
  id: 'cabina',
  name: 'Cabina',
  ledCount: 30,
  output: { type: 'virtual' },
  effect: 'breathing',
};

/** El panel conectado al motor, con un fichero como fuente y un envío de cambios falso. */
function panelWithStrips(source: SourceMessage = { kind: 'file', name: 'golpes.wav' }) {
  const fake = fakeConnection();
  const requests = { send: vi.fn() } satisfies PanelEffectRequests;
  render(<App connection={fake.connection} requests={requests} />);
  act(() => {
    fake.setStatus('connected');
    fake.setSource(source);
    fake.setStrips([BARRA, CABINA]);
  });
  /** Se pierde la conexión: como la conexión real, olvida la fuente y las tiras. */
  const disconnect = () => {
    act(() => {
      fake.connection.source = undefined;
      fake.connection.strips = undefined;
      fake.setStatus('disconnected');
    });
  };
  return { ...fake, requests, disconnect };
}

const zone = (name: string) => screen.getByRole('region', { name });
const strip = (name: string) => within(zone('Tiras')).getByRole('radio', { name: new RegExp(name) });
const effect = (name: string) =>
  within(zone('Efectos')).getByRole('button', { name: new RegExp(`^${name}`) });

describe('las zonas Tiras y Efectos', () => {
  it('Tiras lista las tiras del motor y, al abrir, la primera queda seleccionada', () => {
    panelWithStrips();

    expect(within(zone('Tiras')).getAllByRole('radio')).toHaveLength(2);
    expect(strip('Barra')).toBeChecked();
    expect(strip('Barra')).toHaveTextContent('60 LEDs · Virtual');
    expect(strip('Cabina')).not.toBeChecked();
  });

  it('Efectos marca el efecto activo de la tira seleccionada', () => {
    panelWithStrips();

    expect(effect('Energía')).toHaveAttribute('aria-current', 'true');
    expect(effect('Respiración')).not.toHaveAttribute('aria-current');
  });

  it('al seleccionar otra tira, Efectos muestra el activo de esa', () => {
    panelWithStrips();

    fireEvent.click(strip('Cabina'));

    expect(strip('Cabina')).toBeChecked();
    expect(effect('Respiración')).toHaveAttribute('aria-current', 'true');
    expect(effect('Energía')).not.toHaveAttribute('aria-current');
  });

  it('pulsar un efecto lo envía para la tira seleccionada, una sola vez', () => {
    const panel = panelWithStrips();
    fireEvent.click(strip('Cabina'));

    fireEvent.pointerDown(effect('Energía'));
    fireEvent.click(effect('Energía'), { detail: 1 });

    expect(panel.requests.send).toHaveBeenCalledTimes(1);
    expect(panel.requests.send).toHaveBeenCalledWith('cabina', 'energy');
  });

  it('el activo cambia cuando lo dice el motor, no al pulsar', () => {
    const panel = panelWithStrips();

    fireEvent.pointerDown(effect('Respiración'));
    expect(effect('Energía')).toHaveAttribute('aria-current', 'true');

    act(() => {
      panel.setStrips([{ ...BARRA, effect: 'breathing' }, CABINA]);
    });
    expect(effect('Respiración')).toHaveAttribute('aria-current', 'true');
  });

  it('sin fuente de audio, energía está desactivado con su motivo', () => {
    panelWithStrips({ kind: 'none' });

    expect(effect('Energía')).toBeDisabled();
    expect(within(zone('Efectos')).getByText('Necesita una fuente de audio')).toBeVisible();
    expect(effect('Respiración')).toBeEnabled();
  });

  it('sin conexión, las dos zonas solo tienen su título', () => {
    const panel = panelWithStrips();

    panel.disconnect();

    expect(zone('Tiras')).toHaveTextContent(/^Tiras$/);
    expect(zone('Efectos')).toHaveTextContent(/^Efectos$/);
  });

  it('antes de que el motor diga sus tiras, las dos zonas solo tienen su título', () => {
    render(<App connection={fakeConnection().connection} requests={{ send: vi.fn() }} />);

    expect(zone('Tiras')).toHaveTextContent(/^Tiras$/);
    expect(zone('Efectos')).toHaveTextContent(/^Efectos$/);
  });

  it('al volver la conexión, la tira que estaba seleccionada lo sigue estando', () => {
    const panel = panelWithStrips();
    fireEvent.click(strip('Cabina'));
    panel.disconnect();

    act(() => {
      panel.setStatus('connected');
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
      panel.setStrips([BARRA, CABINA]);
    });

    expect(strip('Cabina')).toBeChecked();
  });

  it('la tira seleccionada al abrir, sin pulsarla, sigue seleccionada aunque vuelvan en otro orden', () => {
    const panel = panelWithStrips();
    panel.disconnect();

    act(() => {
      panel.setStatus('connected');
      panel.setStrips([CABINA, BARRA]);
    });

    expect(strip('Barra')).toBeChecked();
    expect(effect('Energía')).toHaveAttribute('aria-current', 'true');
  });

  it('tras reiniciar el motor, marca el efecto que pinta el motor, no el que tenía antes', () => {
    const panel = panelWithStrips();
    act(() => {
      panel.setStrips([{ ...BARRA, effect: 'breathing' }, CABINA]);
    });
    panel.disconnect();

    // El motor arranca otra vez con el efecto del fichero.
    act(() => {
      panel.setStatus('connected');
      panel.setSource({ kind: 'file', name: 'golpes.wav' });
      panel.setStrips([BARRA, CABINA]);
    });

    expect(effect('Energía')).toHaveAttribute('aria-current', 'true');
    expect(effect('Respiración')).not.toHaveAttribute('aria-current');
  });

  it('al volver la conexión sin la tira que estaba seleccionada, queda la primera', () => {
    const panel = panelWithStrips();
    fireEvent.click(strip('Cabina'));
    panel.disconnect();

    act(() => {
      panel.setStatus('connected');
      panel.setStrips([BARRA]);
    });

    expect(strip('Barra')).toBeChecked();
    expect(effect('Energía')).toHaveAttribute('aria-current', 'true');
  });
});
