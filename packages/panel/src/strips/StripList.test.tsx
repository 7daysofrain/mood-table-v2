import type { StripState } from '@moodtable/shared';
import { fireEvent, screen, within } from '@testing-library/react';
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

  it('una tira con salida Adalight dice «Adalight» y, debajo, la ruta entera de su puerto', () => {
    const port = '/dev/serial/by-id/usb-1a86_USB2.0-Ser_-if00-port0';
    const mesa: StripState = {
      id: 'mesa',
      name: 'Mesa',
      ledCount: 173,
      output: { type: 'adalight', port },
      effect: 'energy',
      values: {},
    };
    render(<StripList strips={[mesa]} selectedId="mesa" onSelect={vi.fn()} />);

    const strip = screen.getByRole('radio', { name: /Mesa/ });
    // La línea de los LEDs y la del puerto son dos líneas: la ruta no va pegada a «Adalight».
    expect(within(strip).getByText('173 LEDs · Adalight')).toBeInTheDocument();
    expect(within(strip).getByText(port)).toBeInTheDocument();
  });

  it('una tira virtual no tiene línea de puerto', () => {
    render(<StripList strips={STRIPS} selectedId="barra" onSelect={vi.fn()} />);

    const strip = screen.getByRole('radio', { name: /Barra/ });
    expect(strip).toHaveTextContent(/^Barra60 LEDs · Virtual$/);
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
