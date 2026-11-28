/**
 * El clon de cada trabajo y sus commits (change pr-fixer, decisiones 5 y 6). El clon sale de la URL
 * pública, sin token: el agente trabaja en él y no debe encontrar credenciales en su `.git/config`. El
 * token solo va en la URL del push (`push.ts`).
 *
 * git corre sin *hooks* y sin firmar: los commits son del *fixer*, no de quien tenga configurado git en
 * la máquina.
 */
import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);

const NO_USER_CONFIG = ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false'];

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await run('git', [...NO_USER_CONFIG, ...args], {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    maxBuffer: 64 * 1024 * 1024,
  });
  return stdout;
}

export interface Workspace {
  /** Clona la rama, se pone en `sha` e instala; devuelve el directorio del clon. */
  open(branch: string, sha: string): Promise<string>;
  /** Borra el clon. */
  close(dir: string): Promise<void>;
}

export interface GitWorkspaceOptions {
  /** De dónde se clona: la URL pública del repo (un repo *bare* local en los tests). */
  cloneUrl: string;
  /** Dónde se crean los clones. */
  root: string;
  /** Instala las dependencias del clon (`pnpm install`); nada en los tests. */
  install: (dir: string) => Promise<void>;
}

export function gitWorkspace({ cloneUrl, root, install }: GitWorkspaceOptions): Workspace {
  return {
    async open(branch, sha) {
      const dir = await mkdtemp(join(root, 'pr-'));
      try {
        await git(root, 'clone', '--quiet', '--single-branch', '--branch', branch, cloneUrl, dir);
        await git(dir, 'checkout', '--quiet', '--detach', sha);
        await install(dir);
      } catch (error) {
        await rm(dir, { recursive: true, force: true });
        throw error;
      }
      return dir;
    },
    close(dir) {
      return rm(dir, { recursive: true, force: true });
    },
  };
}

/** Si el clon tiene cambios sin commitear, también ficheros nuevos. */
export async function hasChanges(dir: string): Promise<boolean> {
  return (await git(dir, 'status', '--porcelain')).trim() !== '';
}

/** El diff de todo lo que ha cambiado desde el último commit, ficheros nuevos incluidos. */
export async function stagedDiff(dir: string): Promise<string> {
  await git(dir, 'add', '--all');
  return git(dir, 'diff', '--cached');
}

/** Deshace los cambios sin commitear y borra los ficheros nuevos (no los ignorados: `node_modules`). */
export async function discardChanges(dir: string): Promise<void> {
  await git(dir, 'reset', '--quiet', '--hard');
  await git(dir, 'clean', '--quiet', '-fd');
}

export interface Author {
  name: string;
  email: string;
}

/** Hace el commit de todo lo que ha cambiado, a nombre de `author` y como `author`. */
export async function commitAll(dir: string, message: string, author: Author): Promise<void> {
  await git(dir, 'add', '--all');
  await git(dir, '-c', `user.name=${author.name}`, '-c', `user.email=${author.email}`, 'commit', '--quiet', '-m', message);
}
