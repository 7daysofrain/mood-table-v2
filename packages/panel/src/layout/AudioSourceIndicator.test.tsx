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

  it('con un nombre largo, lo recorta y deja el completo como título', () => {
    const name = 'una-sesion-de-techno-muy-larga-grabada-en-directo-en-la-mesa-del-dj.wav';
    render(<AudioSourceIndicator source={{ kind: 'file', name }} levels={{ level: 0 }} />);

    expect(screen.getByText(`Fichero: ${name}`)).toHaveAttribute('title', name);
  });

  it('con una tarjeta, dice «Tarjeta de sonido: Mixer de la mesa» y tiene un vúmetro', () => {
    render(
      <AudioSourceIndicator
        source={{ kind: 'soundcard', name: 'Mixer de la mesa' }}
        levels={{ level: 0 }}
      />,
    );

    expect(screen.getByText('Tarjeta de sonido: Mixer de la mesa')).toBeInTheDocument();
    expect(screen.queryByText(/Fichero/)).not.toBeInTheDocument();
    expect(screen.getByRole('meter', METER)).toBeInTheDocument();
  });

  it('con una tarjeta de nombre largo, lo recorta y deja el completo como título', () => {
    const name = 'Mixer de la mesa del salón, salida booth del canal izquierdo';
    render(<AudioSourceIndicator source={{ kind: 'soundcard', name }} levels={{ level: 0 }} />);

    expect(screen.getByText(`Tarjeta de sonido: ${name}`)).toHaveAttribute('title', name);
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
    expect(meter).toHaveAttribute('aria-valuetext', '0 dB');

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

  it('al desmontarse, deja de pintar: no lee más niveles ni pide más frames', () => {
    let reads = 0;
    const levels = {
      get level() {
        reads++;
        return 0.5;
      },
    };
    const request = vi.spyOn(window, 'requestAnimationFrame');
    const { unmount } = render(
      <AudioSourceIndicator source={{ kind: 'file', name: 'golpes.wav' }} levels={levels} />,
    );
    nextAnimationFrame();

    unmount();
    const [readsBefore, requestsBefore] = [reads, request.mock.calls.length];
    nextAnimationFrame();
    nextAnimationFrame();

    expect(reads).toBe(readsBefore);
    expect(request.mock.calls).toHaveLength(requestsBefore);
  });
});
