import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { EffectList } from './EffectList.tsx';

const ENERGY = { name: /^Energía/ };
const BREATHING = { name: /^Respiración/ };

describe('la lista de efectos', () => {
  it('muestra cada efecto del catálogo, etiquetado como reactivo o de ambiente', () => {
    render(<EffectList active="energy" hasAudioSource onChoose={vi.fn()} />);

    expect(screen.getByRole('button', BREATHING)).toHaveTextContent('RespiraciónDe ambiente');
    expect(screen.getByRole('button', ENERGY)).toHaveTextContent('EnergíaReactivo');
  });

  it('marca el efecto activo, y solo ese', () => {
    render(<EffectList active="energy" hasAudioSource onChoose={vi.fn()} />);

    expect(screen.getByRole('button', ENERGY)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', BREATHING)).not.toHaveAttribute('aria-current');
  });

  it('el efecto se elige al pulsar, sin esperar a soltar, y el clic que sigue no lo repite', () => {
    const onChoose = vi.fn();
    render(<EffectList active="energy" hasAudioSource onChoose={onChoose} />);
    const breathing = screen.getByRole('button', BREATHING);

    fireEvent.pointerDown(breathing);
    expect(onChoose).toHaveBeenCalledWith('breathing');

    fireEvent.click(breathing, { detail: 1 });
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  it('con el teclado, Enter o Espacio lo eligen una sola vez', () => {
    const onChoose = vi.fn();
    render(<EffectList active="energy" hasAudioSource onChoose={onChoose} />);

    // Enter y Espacio sobre un botón llegan como un clic sin puntero (`detail` 0).
    fireEvent.click(screen.getByRole('button', BREATHING), { detail: 0 });

    expect(onChoose).toHaveBeenCalledTimes(1);
    expect(onChoose).toHaveBeenCalledWith('breathing');
  });

  it('pulsar no cambia el activo: lo marca quien dice lo que pinta el motor', () => {
    render(<EffectList active="energy" hasAudioSource onChoose={vi.fn()} />);

    fireEvent.pointerDown(screen.getByRole('button', BREATHING));

    expect(screen.getByRole('button', ENERGY)).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', BREATHING)).not.toHaveAttribute('aria-current');
  });

  it('pulsar no muestra ningún indicador de espera', () => {
    render(<EffectList active="energy" hasAudioSource onChoose={vi.fn()} />);
    const before = document.body.innerHTML;

    fireEvent.pointerDown(screen.getByRole('button', BREATHING));

    expect(document.body.innerHTML).toBe(before);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(document.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('sin fuente de audio, los reactivos están desactivados, con el motivo a la vista', () => {
    const onChoose = vi.fn();
    render(<EffectList active="breathing" hasAudioSource={false} onChoose={onChoose} />);
    const energy = screen.getByRole('button', ENERGY);

    expect(energy).toBeDisabled();
    expect(energy).toHaveAccessibleDescription('Necesita una fuente de audio');
    expect(screen.getByText('Necesita una fuente de audio')).toBeVisible();
    fireEvent.pointerDown(energy);
    expect(onChoose).not.toHaveBeenCalled();

    expect(screen.getByRole('button', BREATHING)).toBeEnabled();
  });

  it('con fuente de audio, no muestra ningún motivo', () => {
    render(<EffectList active="breathing" hasAudioSource onChoose={vi.fn()} />);

    expect(screen.queryByText('Necesita una fuente de audio')).not.toBeInTheDocument();
    expect(screen.getByRole('button', ENERGY)).toBeEnabled();
  });
});
