import type { StripState } from '@moodtable/shared';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { StripList } from './StripList.tsx';

const STRIPS: readonly StripState[] = [
  { id: 'barra', name: 'Barra', ledCount: 60, output: { type: 'virtual' }, effect: 'energy', values: {} },
  { id: 'cabina', name: 'Cabina', ledCount: 1, output: { type: 'virtual' }, effect: 'breathing', values: { color: '#FFA957', period: 4 } },
];

describe('la lista de tiras', () => {
  it('lista cada tira, en su orden, con su nombre, su nº de LEDs y su salida', () => {
    render(<StripList strips={STRIPS} selectedId="barra" onSelect={vi.fn()} />);

    const strips = screen.getAllByRole('radio');
    expect(strips).toHaveLength(2);
    expect(strips[0]).toHaveTextContent('Barra');
    expect(strips[0]).toHaveTextContent('60 LEDs · Virtual');
    expect(strips[1]).toHaveTextContent('Cabina');
    expect(strips[1]).toHaveTextContent('1 LED · Virtual');
  });

  it('marca la tira seleccionada, y solo esa', () => {
    render(<StripList strips={STRIPS} selectedId="cabina" onSelect={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /Cabina/ })).toBeChecked();
    expect(screen.getByRole('radio', { name: /Barra/ })).not.toBeChecked();
  });

  it('al pulsar otra tira, pide seleccionarla por su id', () => {
    const onSelect = vi.fn();
    render(<StripList strips={STRIPS} selectedId="barra" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('radio', { name: /Cabina/ }));

    expect(onSelect).toHaveBeenCalledWith('cabina');
  });

  it('las tiras están en un grupo con nombre', () => {
    render(<StripList strips={STRIPS} selectedId="barra" onSelect={vi.fn()} />);

    expect(screen.getByRole('radiogroup', { name: 'Tiras declaradas' })).toBeInTheDocument();
  });
});
