/**
 * Lo que `specs/table-service` exige de la unidad de `systemd` de la mesa y se puede ver en el
 * fichero (design.md del change `table-autostart`, decisión 5, y del change `table-install`,
 * decisión 7). Los escenarios completos se prueban a mano en la mesa; esto evita que alguien le
 * añada sin querer un `Restart=` o una espera a la red.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

const unitPath = new URL('../deploy/moodtable.service', import.meta.url);

interface Directive {
  section: string;
  key: string;
  value: string;
}

/** Las directivas de la unidad, en orden, con la sección en la que están. */
function readDirectives(): Directive[] {
  const directives: Directive[] = [];
  let section = '';
  for (const rawLine of readFileSync(unitPath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#') || line.startsWith(';')) continue;
    const header = /^\[(.+)\]$/.exec(line);
    if (header?.[1] !== undefined) {
      section = header[1];
      continue;
    }
    const separator = line.indexOf('=');
    if (separator === -1) continue;
    directives.push({
      section,
      key: line.slice(0, separator).trim(),
      value: line.slice(separator + 1).trim(),
    });
  }
  return directives;
}

function values(section: string, key: string): string[] {
  return readDirectives()
    .filter((directive) => directive.section === section && directive.key === key)
    .map((directive) => directive.value);
}

describe('la unidad de la mesa (deploy/moodtable.service)', () => {
  it('se habilita para arrancar al encender la Pi', () => {
    expect(values('Install', 'WantedBy')).toEqual(['multi-user.target']);
  });

  it('espera a udev antes de lanzar el motor, y arranca igualmente si la espera se agota', () => {
    const preStarts = values('Service', 'ExecStartPre');
    expect(preStarts).toHaveLength(1);
    expect(preStarts[0]).toMatch(/^-\/usr\/bin\/udevadm settle(\s|$)/);
  });

  it('no espera a la red', () => {
    const text = readFileSync(unitPath, 'utf8');
    expect(text).not.toMatch(/network-online\.target/);
    expect(text).not.toMatch(/network\.target/);
  });

  it('no rearranca el motor si termina o falla', () => {
    const restarts = readDirectives().filter((directive) => directive.key === 'Restart');
    expect(restarts).toEqual([{ section: 'Service', key: 'Restart', value: 'no' }]);
  });

  it('lanza el motor con el usuario propio, desde la instalación del script y con el Node del sistema', () => {
    expect(values('Service', 'User')).toEqual(['moodtable']);
    expect(values('Service', 'WorkingDirectory')).toEqual(['/opt/moodtable']);
    expect(values('Service', 'ExecStart')).toEqual([
      '/usr/bin/node packages/engine/src/main.ts',
    ]);
  });
});
