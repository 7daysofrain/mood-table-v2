import type { StripState } from '@moodtable/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { ControlList } from './ControlList.tsx';

const CABINA: StripState = {
  id: 'cabina',
  name: 'Cabina',
  ledCount: 30,
  output: { type: 'virtual' },
  effect: 'breathing',
  values: { color: '#FFA957', period: 4 },
};

function idleQueue() {
  return { send: vi.fn(), busy: () => false, subscribe: () => () => false };
}

describe('la lista de controles', () => {
  it('con la respiración, un selector para el color y un slider para el periodo, con sus valores', () => {
    render(<ControlList strip={CABINA} requests={idleQueue()} />);

    expect(screen.getByRole('group', { name: 'Color' })).toHaveTextContent('#FFA957');
    const period = screen.getByRole('slider', { name: 'Periodo (s)' });
    expect(period).toHaveAttribute('aria-valuetext', '4,0 s');
  });

  it('con la energía, que no tiene parámetros, no pinta nada', () => {
    const { container } = render(
      <ControlList strip={{ ...CABINA, effect: 'energy', values: {} }} requests={idleQueue()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('mover el periodo envía todos los valores de la tira', () => {
    const queue = idleQueue();
    render(<ControlList strip={CABINA} requests={queue} />);

    fireEvent.keyDown(screen.getByRole('slider', { name: 'Periodo (s)' }), { key: 'ArrowRight' });

    expect(queue.send).toHaveBeenCalledWith('cabina', {
      color: '#FFA957',
      period: expect.closeTo(4, 1) as number,
    });
    const [, sent] = queue.send.mock.calls.at(-1) as [string, { period: number }];
    expect(sent.period).toBeGreaterThan(4);
  });
});
