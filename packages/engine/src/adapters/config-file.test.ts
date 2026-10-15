import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CONFIG_FILE, loadConfig, REPO_ROOT } from './config-file.ts';

const run = promisify(execFile);

const demoStrip = { id: 'demo', name: 'Tira de prueba', output: { type: 'virtual' }, ledCount: 60 };

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'moodtable-config-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

async function writeConfig(content: string): Promise<void> {
  await mkdir(join(root, 'config'));
  await writeFile(join(root, CONFIG_FILE), content);
}

describe('la lectura de config/local.json', () => {
  it('carga un fichero válido y dice de dónde lo ha cargado', async () => {
    await writeConfig(JSON.stringify({ strips: [demoStrip] }));

    const result = await loadConfig(root);

    expect(result).toEqual({
      ok: true,
      path: join(root, 'config', 'local.json'),
      config: { fps: 60, server: { host: '127.0.0.1', port: 8080 }, strips: [demoStrip] },
    });
  });

  it('si no existe, dice que no encuentra el fichero e indica su ruta', async () => {
    const result = await loadConfig(root);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe(
      `${join(root, 'config', 'local.json')}: no se encuentra el fichero de configuración`,
    );
  });

  it('si no se puede leer, lo dice con la ruta', async () => {
    await mkdir(join(root, CONFIG_FILE), { recursive: true });

    const result = await loadConfig(root);

    expect(!result.ok && result.error).toMatch(/local\.json: no se puede leer el fichero/);
  });

  it('si no sirve, nombra el fichero y dice qué falla', async () => {
    await writeConfig(JSON.stringify({ strips: [] }));

    const result = await loadConfig(root);

    expect(!result.ok && result.error).toMatch(
      `${join(root, 'config', 'local.json')}: no declara ninguna tira`,
    );
  });

  it('busca el fichero desde la raíz del repositorio, sea cual sea el directorio de trabajo', async () => {
    // Un proceso de Node arrancado en otro directorio, como el motor arrancado desde otro sitio.
    const module = fileURLToPath(new URL('./config-file.ts', import.meta.url));
    const script = `const m = await import(${JSON.stringify(module)}); console.log(m.REPO_ROOT);`;
    const { stdout } = await run(process.execPath, ['--input-type=module', '-e', script], {
      cwd: root,
    });

    expect(stdout.trim()).toBe(fileURLToPath(new URL('../../../../', import.meta.url)));
    expect(REPO_ROOT).toBe(stdout.trim());
  });
});
