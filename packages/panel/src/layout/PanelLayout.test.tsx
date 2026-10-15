import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { PanelLayout } from './PanelLayout.tsx';

/** Zonas con nombre del glosario (PRD §8), en el orden del wireframe (specs/panel-layout). */
const ZONAS = ['Visor', 'Tiras', 'Efectos', 'Controles'];

describe('PanelLayout', () => {
  it('tiene una cabecera y una región por cada zona, sin ninguna otra', () => {
    render(<PanelLayout status="disconnected" />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('region').map(accessibleName)).toEqual(ZONAS);
  });

  it.each(ZONAS)('encuentra la zona «%s» por su nombre', (nombre) => {
    render(<PanelLayout status="disconnected" />);

    const zona = screen.getByRole('region', { name: nombre });
    expect(within(zona).getByRole('heading', { name: nombre })).toBeInTheDocument();
  });

  it('titula el visor «Visor», no «Tira virtual»', () => {
    render(<PanelLayout status="disconnected" />);

    expect(screen.queryByText('Tira virtual')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visor' })).toBeInTheDocument();
  });

  it('ordena las zonas como el wireframe: cabecera, visor, tiras, efectos, controles', () => {
    render(<PanelLayout status="disconnected" />);

    const enOrden = [screen.getByRole('banner'), ...ZONAS.map((nombre) => screen.getByRole('region', { name: nombre }))];
    for (let i = 1; i < enOrden.length; i++) {
      const anterior = enOrden[i - 1]!;
      const siguiente = enOrden[i]!;
      expect(anterior.compareDocumentPosition(siguiente) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('deja vacías, solo con su título, las zonas que aún no rellena ninguna historia', () => {
    render(<PanelLayout status="disconnected" />);

    for (const nombre of ['Tiras', 'Efectos', 'Controles']) {
      expect(screen.getByRole('region', { name: nombre })).toHaveTextContent(new RegExp(`^${nombre}$`));
    }
  });

  it('pone el contenido del visor en su zona', () => {
    render(<PanelLayout status="disconnected" viewer={<canvas aria-label="Tiras del visor" />} />);

    const visor = screen.getByRole('region', { name: 'Visor' });
    expect(within(visor).getByLabelText('Tiras del visor')).toBeInTheDocument();
  });

  it.each([
    ['connected', 'Conectado'],
    ['disconnected', 'Sin conexión con el motor'],
  ] as const)('con la conexión «%s», la cabecera dice «%s»', (status, texto) => {
    render(<PanelLayout status={status} />);

    expect(within(screen.getByRole('banner')).getByRole('status')).toHaveTextContent(texto);
  });

  it('se abre sin escribir errores en la consola', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PanelLayout status="disconnected" />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

/** Nombre accesible de una región nombrada por `aria-labelledby`. */
function accessibleName(zona: HTMLElement): string {
  const id = zona.getAttribute('aria-labelledby');
  return id ? (document.getElementById(id)?.textContent ?? '') : '';
}
