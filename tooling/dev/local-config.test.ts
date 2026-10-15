import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { DEMO_CONFIG, ensureLocalConfig, LOCAL_CONFIG } from './local-config.ts';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'moodtable-dev-'));
  await mkdir(join(root, 'config'));
  await writeFile(join(root, DEMO_CONFIG), '{ "demo": true }');
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('el config/local.json del simulador', () => {
  it('si no existe, lo crea con el contenido de config/demo.json', async () => {
    expect(await ensureLocalConfig(root)).toBe('created');
    expect(await readFile(join(root, LOCAL_CONFIG), 'utf8')).toBe('{ "demo": true }');
  });

  it('si existe, no lo pisa', async () => {
    await writeFile(join(root, LOCAL_CONFIG), '{ "mio": true }');

    expect(await ensureLocalConfig(root)).toBe('kept');
    expect(await readFile(join(root, LOCAL_CONFIG), 'utf8')).toBe('{ "mio": true }');
  });

  it('si falta config/demo.json, falla', async () => {
    await rm(join(root, DEMO_CONFIG));

    await expect(ensureLocalConfig(root)).rejects.toThrow(/ENOENT/);
  });
});

describe('el config/demo.json del repositorio', () => {
  it('declara una sola tira virtual', async () => {
    const demo = JSON.parse(
      await readFile(new URL('../../config/demo.json', import.meta.url), 'utf8'),
    ) as { strips: { output: { type: string } }[] };

    expect(demo.strips).toHaveLength(1);
    expect(demo.strips[0]?.output.type).toBe('virtual');
  });
});
