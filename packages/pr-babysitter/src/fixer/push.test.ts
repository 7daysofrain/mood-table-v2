import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { authenticatedRemote, pushBranch } from './push.ts';

const run = promisify(execFile);

/** git con una identidad fija y sin la configuración del usuario. */
async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], {
    cwd,
    env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' },
  });
  return stdout.trim();
}

async function commit(cwd: string, file: string, content: string): Promise<string> {
  await writeFile(join(cwd, file), content);
  await git(cwd, 'add', file);
  await git(cwd, 'commit', '-m', `cambia ${file}`);
  return git(cwd, 'rev-parse', 'HEAD');
}

describe('la URL del remoto con el token', () => {
  it('lleva el token de instalación como usuario x-access-token', () => {
    expect(authenticatedRemote('7daysofrain/mood-table-v2', 'ghs_token')).toBe(
      'https://x-access-token:ghs_token@github.com/7daysofrain/mood-table-v2.git',
    );
  });
});

describe('subir a la rama de la PR (design.md decisión 6)', () => {
  let dir: string;
  let remote: string;
  let fixer: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pr-fixer-push-'));
    remote = join(dir, 'remote.git');
    await run('git', ['init', '--bare', '--initial-branch=main', remote]);
    const seed = join(dir, 'seed');
    await run('git', ['clone', remote, seed]);
    await commit(seed, 'a.txt', 'uno');
    await git(seed, 'push', 'origin', 'HEAD:refs/heads/pr-branch');
    fixer = join(dir, 'fixer');
    await run('git', ['clone', '--branch', 'pr-branch', remote, fixer]);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('sube los commits a la rama y devuelve el SHA subido', async () => {
    const sha = await commit(fixer, 'b.txt', 'arreglo');

    const result = await pushBranch(fixer, remote, 'pr-branch');

    expect(result).toEqual({ pushed: true, sha });
    expect(await git(remote, 'rev-parse', 'refs/heads/pr-branch')).toBe(sha);
  });

  it('si la rama ha avanzado, no fuerza: no sube nada y dice que ha cambiado', async () => {
    const other = join(dir, 'other');
    await run('git', ['clone', '--branch', 'pr-branch', remote, other]);
    const maintainerSha = await commit(other, 'c.txt', 'del mantenedor');
    await git(other, 'push', 'origin', 'HEAD:refs/heads/pr-branch');
    await commit(fixer, 'b.txt', 'arreglo');

    const result = await pushBranch(fixer, remote, 'pr-branch');

    expect(result).toEqual({ pushed: false, reason: 'branchMoved' });
    expect(await git(remote, 'rev-parse', 'refs/heads/pr-branch')).toBe(maintainerSha);
  });

  it('cualquier otro fallo lanza, sin el token en el mensaje', async () => {
    await commit(fixer, 'b.txt', 'arreglo');
    // Un remoto con el token en la URL que no contesta: git falla y su mensaje lleva la URL.
    const unreachable = 'https://x-access-token:ghs_secreto@127.0.0.1:1/7daysofrain/mood-table-v2.git';

    const error = await pushBranch(fixer, unreachable, 'pr-branch').catch((thrown: unknown) => thrown as Error);

    expect(error).toBeInstanceOf(Error);
    expect(error.message).not.toContain('ghs_secreto');
  });
});
