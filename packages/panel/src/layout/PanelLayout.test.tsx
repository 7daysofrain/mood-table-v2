import { screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { render } from '../../test/render.tsx';
import { PanelLayout } from './PanelLayout.tsx';

/** Zonas con nombre del glosario (PRD §8), en el orden del wireframe (specs/panel-layout). */
const ZONAS = ['Visor', 'Tiras', 'Efectos', 'Controles'];

describe('PanelLayout', () => {
  it('tiene una cabecera y una región por cada zona, sin ninguna otra', () => {
    render(<PanelLayout />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getAllByRole('region').map(accessibleName)).toEqual(ZONAS);
  });

  it.each(ZONAS)('encuentra la zona «%s» por su nombre', (nombre) => {
    render(<PanelLayout />);

    const zona = screen.getByRole('region', { name: nombre });
    expect(within(zona).getByRole('heading', { name: nombre })).toBeInTheDocument();
  });

  it('titula el visor «Visor», no «Tira virtual»', () => {
    render(<PanelLayout />);

    expect(screen.queryByText('Tira virtual')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Visor' })).toBeInTheDocument();
  });

  it('ordena las zonas como el wireframe: cabecera, visor, tiras, efectos, controles', () => {
    render(<PanelLayout />);

    const enOrden = [screen.getByRole('banner'), ...ZONAS.map((nombre) => screen.getByRole('region', { name: nombre }))];
    for (let i = 1; i < enOrden.length; i++) {
      const anterior = enOrden[i - 1]!;
      const siguiente = enOrden[i]!;
      expect(anterior.compareDocumentPosition(siguiente) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('deja cada zona vacía, solo con su título', () => {
    render(<PanelLayout />);

    for (const nombre of ZONAS) {
      expect(screen.getByRole('region', { name: nombre })).toHaveTextContent(new RegExp(`^${nombre}$`));
    }
  });

  it('se abre sin escribir errores en la consola', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<PanelLayout />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

/** Nombre accesible de una región nombrada por `aria-labelledby`. */
function accessibleName(zona: HTMLElement): string {
  const id = zona.getAttribute('aria-labelledby');
  return id ? (document.getElementById(id)?.textContent ?? '') : '';
}
