import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { AudioControl, type ControlPlayer } from './AudioControl.tsx';
import type { PlayerState } from './player.ts';

const LISTEN = { name: 'Oír el fichero de audio' };
const PREPARING = { name: 'Preparando el audio' };
const STOP = { name: 'Dejar de oír el fichero de audio' };

/** Un reproductor falso: el test decide su estado y mira si le piden oír o callar. */
function fakePlayer(initial: PlayerState = 'silent') {
  const listeners = new Set<() => void>();
  const player = {
    state: initial,
    play: vi.fn(),
    stop: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies ControlPlayer;
  const setState = (state: PlayerState) => {
    act(() => {
      player.state = state;
      for (const listener of listeners) listener();
    });
  };
  return { player, setState };
}

describe('el control de oír el fichero de audio', () => {
  it('callado, es un botón «Oír el fichero de audio» que pide oírlo', () => {
    const { player } = fakePlayer();
    render(<AudioControl player={player} />);

    fireEvent.click(screen.getByRole('button', LISTEN));

    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('mientras prepara el audio, dice «Preparando el audio» y pulsarlo no hace nada', () => {
    const { player } = fakePlayer('preparing');
    render(<AudioControl player={player} />);

    const button = screen.getByRole('button', PREPARING);
    fireEvent.click(button);

    expect(button).toBeDisabled();
    expect(player.play).not.toHaveBeenCalled();
    expect(player.stop).not.toHaveBeenCalled();
  });

  it('sonando, es un botón «Dejar de oír el fichero de audio» que lo calla', () => {
    const { player } = fakePlayer('playing');
    render(<AudioControl player={player} />);

    fireEvent.click(screen.getByRole('button', STOP));

    expect(player.stop).toHaveBeenCalledTimes(1);
  });

  it('sigue los cambios de estado del reproductor', () => {
    const { player, setState } = fakePlayer();
    render(<AudioControl player={player} />);

    setState('preparing');
    expect(screen.getByRole('button', PREPARING)).toBeInTheDocument();
    setState('playing');
    expect(screen.getByRole('button', STOP)).toBeInTheDocument();
    setState('silent');
    expect(screen.getByRole('button', LISTEN)).toBeInTheDocument();
  });
});
