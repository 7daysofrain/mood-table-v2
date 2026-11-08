import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { INTENSITY_KEY } from '../engine/request-queue.ts';
import { IntensityZone } from './IntensityZone.tsx';

function idleQueue() {
  return { send: vi.fn(), busy: () => false, subscribe: () => () => false };
}

const fader = () => screen.getByRole('slider', { name: 'Intensidad' });

// specs/intensity; decisiones 6 y 7 del change instrument-intensity.
describe('la zona Intensidad', () => {
  it('muestra un fader vertical con la intensidad del motor en porcentaje: al máximo, «100 %»', () => {
    render(<IntensityZone intensity={1} requests={idleQueue()} />);

    expect(fader()).toHaveAttribute('aria-orientation', 'vertical');
    expect(fader()).toHaveAttribute('aria-valuetext', '100 %');
    expect(screen.getByText('100 %')).toBeInTheDocument();
  });

  it('con la intensidad a 0,4, «40 %»', () => {
    render(<IntensityZone intensity={0.4} requests={idleQueue()} />);

    expect(fader()).toHaveAttribute('aria-valuetext', '40 %');
    expect(screen.getByText('40 %')).toBeInTheDocument();
  });

  it('el porcentaje es entero', () => {
    render(<IntensityZone intensity={0.07} requests={idleQueue()} />);

    expect(screen.getByText('7 %')).toBeInTheDocument();
  });

  it('mover el fader envía la intensidad, y abajo es menos', () => {
    const queue = idleQueue();
    render(<IntensityZone intensity={1} requests={queue} />);

    fireEvent.keyDown(fader(), { key: 'ArrowDown' });

    expect(queue.send).toHaveBeenCalledWith(INTENSITY_KEY, 0.99);
  });
});
