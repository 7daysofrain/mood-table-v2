/**
 * El script de instalación (`deploy/install.sh`, D110) decide si el Node de la Pi vale antes de
 * clonar el repositorio, así que no puede leer `engines.node` del `package.json`: lleva el rango
 * copiado en dos constantes. Esto evita que alguien suba el mínimo en un sitio y no en el otro, y
 * que `pnpm install` (con `engineStrict`) rechace en la mesa un Node que el script dio por bueno.
 */
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8');
}

/** El valor de `readonly NAME='valor'` en el script. */
function scriptConstant(script: string, name: string): string | undefined {
  return new RegExp(`^readonly ${name}='([^']*)'`, 'm').exec(script)?.[1];
}

describe('el Node que exige el script de instalación (deploy/install.sh)', () => {
  it('es el mismo rango que engines.node del package.json raíz', () => {
    const { engines } = JSON.parse(read('../package.json')) as { engines: { node: string } };
    const range = /^>=(\d+)\.(\d+) <(\d+)$/.exec(engines.node);
    expect(range, `engines.node con otra forma: ${engines.node}`).not.toBeNull();
    const [, major, minMinor, nextMajor] = range ?? [];

    const script = read('../deploy/install.sh');
    expect(scriptConstant(script, 'NODE_MAJOR')).toBe(major);
    expect(scriptConstant(script, 'NODE_MIN_MINOR')).toBe(minMinor);
    expect(Number(nextMajor)).toBe(Number(major) + 1);
  });
});
