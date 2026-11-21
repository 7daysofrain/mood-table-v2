import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { render } from '../../test/render.tsx';
import { DEMO_HOSTNAME, DEMO_NOTICE_SEEN_KEY, DemoNotice, type NoticeStorage } from './DemoNotice.tsx';

const NOTICE = { name: 'Mood Table · demo pública' };

/** Un almacenamiento en memoria, como el `localStorage` de un navegador nuevo. */
function memoryStorage(): NoticeStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
}

describe('el aviso de la demo pública (temporal, MOO-181)', () => {
  it('sale al abrir el panel desde el dominio de la demo', async () => {
    render(<DemoNotice hostname={DEMO_HOSTNAME} storage={memoryStorage()} />);

    expect(await screen.findByRole('dialog', NOTICE)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'README del proyecto' })).toHaveAttribute(
      'href',
      'https://github.com/7daysofrain/mood-table-v2#readme',
    );
  });

  it.each(['localhost', '127.0.0.1', '192.168.0.173'])('no sale desde %s', (hostname) => {
    render(<DemoNotice hostname={hostname} storage={memoryStorage()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('al cerrarlo, el navegador lo recuerda y no vuelve a salir', async () => {
    const storage = memoryStorage();
    const { unmount } = render(<DemoNotice hostname={DEMO_HOSTNAME} storage={storage} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Entendido' }));
    unmount();

    render(<DemoNotice hostname={DEMO_HOSTNAME} storage={storage} />);

    expect(storage.values.get(DEMO_NOTICE_SEEN_KEY)).toBe('1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sin almacenamiento del navegador, sale igual y se puede cerrar', async () => {
    const blocked: NoticeStorage = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('SecurityError');
      },
    };
    render(<DemoNotice hostname={DEMO_HOSTNAME} storage={blocked} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
