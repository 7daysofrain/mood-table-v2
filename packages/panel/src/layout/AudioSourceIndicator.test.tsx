import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { AudioSourceIndicator } from './AudioSourceIndicator.tsx';

const METER = { name: 'Nivel de la fuente de audio' };

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Avanza un frame de pantalla: un `requestAnimationFrame`. */
function nextAnimationFrame() {
  act(() => {
    vi.advanceTimersToNextFrame();
  });
}

describe('la fuente de audio de la cabecera', () => {
  it('con un fichero, dice «Fichero: golpes.wav» y tiene un vúmetro', () => {
    render(
      <AudioSourceIndicator source={{ kind: 'file', name: 'golpes.wav' }} levels={{ level: 0 }} />,
    );

    expect(screen.getByText('Fichero: golpes.wav')).toBeInTheDocument();
    expect(screen.getByRole('meter', METER)).toBeInTheDocument();
  });

  it('sin fuente, dice «Sin fuente de audio» y no hay vúmetro', () => {
    render(<AudioSourceIndicator source={{ kind: 'none' }} levels={{ level: undefined }} />);

    expect(screen.getByText('Sin fuente de audio')).toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('sin saber la fuente (sin conexión), no muestra fuente ni vúmetro', () => {
    render(<AudioSourceIndicator levels={{ level: undefined }} />);

    expect(screen.queryByText(/Fichero|Sin fuente de audio/)).not.toBeInTheDocument();
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('el vúmetro pinta el último nivel en cada frame de pantalla: vacío a −60 dB, lleno a 0 dB', () => {
    const levels = { level: 0.001 as number | undefined };
    render(<AudioSourceIndicator source={{ kind: 'file', name: 'golpes.wav' }} levels={levels} />);
    const meter = screen.getByRole('meter', METER);

    nextAnimationFrame();
    expect(meter).toHaveAttribute('aria-valuenow', '-60');

    levels.level = 1;
    nextAnimationFrame();
    expect(meter).toHaveAttribute('aria-valuenow', '0');

    levels.level = undefined;
    nextAnimationFrame();
    expect(meter).toHaveAttribute('aria-valuenow', '-60');
  });

  it('el vúmetro va de −60 a 0 dB', () => {
    render(
      <AudioSourceIndicator source={{ kind: 'file', name: 'golpes.wav' }} levels={{ level: 0 }} />,
    );
    const meter = screen.getByRole('meter', METER);

    expect(meter).toHaveAttribute('aria-valuemin', '-60');
    expect(meter).toHaveAttribute('aria-valuemax', '0');
  });

  it('al desmontarse, deja de pintar', () => {
    const cancel = vi.spyOn(window, 'cancelAnimationFrame');
    const { unmount } = render(
      <AudioSourceIndicator source={{ kind: 'file', name: 'golpes.wav' }} levels={{ level: 0 }} />,
    );

    unmount();

    expect(cancel).toHaveBeenCalled();
  });
});
