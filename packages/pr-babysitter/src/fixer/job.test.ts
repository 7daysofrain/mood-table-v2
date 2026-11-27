import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { FixJob } from '../core/fix.ts';
import type { Finding } from '../core/triage.ts';

import type { AgentResult, FixAgent, FixRequest } from './agent.ts';
import { codex, fixJob, lint, sonar } from './fixtures.ts';
import { gitWorkspace } from './git.ts';
import { fixOrder, fixTrailer, type JobDeps, runJob } from './job.ts';
import { pushBranch } from './push.ts';

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

const AUTHOR = {
  name: 'mood-table-pr-babysitter[bot]',
  email: '361920848+mood-table-pr-babysitter[bot]@users.noreply.github.com',
};

/** Qué hace el agente falso con cada hallazgo: qué fichero escribe y qué devuelve. */
interface Step {
  write?: Record<string, string>;
  result?: Partial<AgentResult>;
}

function fakeAgent(steps: Step[]) {
  const requests: FixRequest[] = [];
  const heads: string[] = [];
  const agent: FixAgent = {
    async fix(request) {
      requests.push(request);
      heads.push(await git(request.cwd, 'rev-parse', 'HEAD'));
      const step = steps[requests.length - 1] ?? {};
      for (const [file, content] of Object.entries(step.write ?? {})) {
        await writeFile(join(request.cwd, file), content);
      }
      return { outcome: 'done', costUsd: 0.1, ...step.result };
    },
  };
  return { agent, requests, heads };
}

describe('un trabajo del fixer (design.md decisiones 5, 6 y 8)', () => {
  let dir: string;
  let remote: string;
  let workRoot: string;
  let seedSha: string;
  let pushes: number;
  let costs: [number, string, number][];

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'pr-fixer-job-'));
    remote = join(dir, 'remote.git');
    await run('git', ['init', '--bare', '--initial-branch=main', remote]);
    const seed = join(dir, 'seed');
    await run('git', ['clone', remote, seed]);
    seedSha = await commit(seed, 'a.txt', 'uno');
    await git(seed, 'push', 'origin', 'HEAD:refs/heads/pr-branch');
    workRoot = join(dir, 'work');
    await mkdir(workRoot);
    pushes = 0;
    costs = [];
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  function deps(agent: FixAgent, overrides: Partial<JobDeps> = {}): JobDeps {
    return {
      branch: () => Promise.resolve('pr-branch'),
      workspace: gitWorkspace({ cloneUrl: remote, root: workRoot, install: () => Promise.resolve() }),
      agent,
      gates: {
        run: (cwd) =>
          Promise.resolve(existsSync(join(cwd, 'broken.txt')) ? { passed: false, failed: 'test' } : { passed: true }),
      },
      push: (cwd, branch) => {
        pushes += 1;
        return pushBranch(cwd, remote, branch);
      },
      recordCost: (pr, sha, usd) => {
        costs.push([pr, sha, usd]);
      },
      author: AUTHOR,
      secrets: [],
      ...overrides,
    };
  }

  function job(findings: Finding[], overrides: Partial<FixJob> = {}): FixJob {
    return fixJob({ sha: seedSha, findings, ...overrides });
  }

  async function branchCommits(): Promise<string[]> {
    const log = await git(remote, 'log', '--format=%s', `${seedSha}..refs/heads/pr-branch`);
    return log === '' ? [] : log.split('\n').reverse();
  }

  async function branchFiles(): Promise<string[]> {
    return (await git(remote, 'ls-tree', '-r', '--name-only', 'refs/heads/pr-branch')).split('\n');
  }

  it('arregla cada hallazgo con un commit, en orden, y los sube en un solo push', async () => {
    const { agent, requests } = fakeAgent([
      { write: { 'lint.txt': 'x' } },
      { write: { 'sonar.txt': 'x' } },
      { write: { 'codex.txt': 'x' } },
    ]);

    const status = await runJob(job([codex, sonar, lint]), deps(agent));

    const markers = ["'x' is unused", 'typescript:S3358', 'Handle the empty list'];
    expect(requests.map(({ prompt }) => markers.filter((marker) => prompt.includes(marker)))).toEqual(
      markers.map((marker) => [marker]),
    );
    expect(await branchCommits()).toEqual([
      'fix: arreglar `lint`',
      'fix: arreglar la incidencia typescript:S3358 en `src/b.ts:12`',
      'fix: arreglar el comentario de Codex en `src/c.ts:7`',
    ]);
    expect(pushes).toBe(1);
    expect(status).toEqual({ state: 'pushed', sha: await git(remote, 'rev-parse', 'refs/heads/pr-branch'), unfixed: [] });
  });

  it('cada commit va a nombre de la App y cita su hallazgo en un trailer', async () => {
    const { agent } = fakeAgent([{ write: { 'lint.txt': 'x' } }]);

    await runJob(job([lint]), deps(agent));

    expect(await git(remote, 'log', '-1', '--format=%an <%ae>|%cn', 'refs/heads/pr-branch')).toBe(
      `${AUTHOR.name} <${AUTHOR.email}>|${AUTHOR.name}`,
    );
    expect(await git(remote, 'log', '-1', '--format=%(trailers:key=Babysitter-Fix,valueonly)', 'refs/heads/pr-branch')).toBe(
      'check:lint',
    );
  });

  it('el agente trabaja en un clon de la rama en el SHA del trabajo, con el hallazgo y el alcance de la PR', async () => {
    const { agent, requests, heads } = fakeAgent([{ write: { 'lint.txt': 'x' } }]);

    await runJob(job([lint]), deps(agent));

    expect(heads).toEqual([seedSha]);
    expect(requests[0]?.prompt).toContain('feat(engine): efecto nuevo');
    expect(requests[0]?.prompt).toContain("'x' is unused");
  });

  it('si no pasa lint, typecheck y test, se deshacen sus cambios, queda sin arreglar y sigue con el siguiente', async () => {
    const { agent } = fakeAgent([
      { write: { 'roto.txt': 'x', 'broken.txt': 'x' } },
      { write: { 'sonar.txt': 'x' } },
    ]);

    const status = await runJob(job([lint, sonar]), deps(agent));

    expect(await branchCommits()).toEqual(['fix: arreglar la incidencia typescript:S3358 en `src/b.ts:12`']);
    expect(await branchFiles()).not.toContain('roto.txt');
    expect(status).toMatchObject({ state: 'pushed', unfixed: [{ finding: lint, reason: 'checksFailed' }] });
  });

  it('si el agente no cambia nada o no termina, queda sin arreglar; sin ningún commit no hay push', async () => {
    const { agent } = fakeAgent([{}, { write: { 'a medias.txt': 'x' }, result: { outcome: 'failed' } }]);

    const status = await runJob(job([lint, sonar]), deps(agent));

    expect(pushes).toBe(0);
    expect(await branchCommits()).toEqual([]);
    expect(status).toEqual({
      state: 'failed',
      reason: 'nothingFixed',
      unfixed: [
        { finding: lint, reason: 'agentFailed' },
        { finding: sonar, reason: 'agentFailed' },
      ],
    });
  });

  it('guarda el coste de cada query() y le da al agente lo que queda del tope', async () => {
    const { agent, requests } = fakeAgent([
      { write: { 'lint.txt': 'x' }, result: { costUsd: 0.5 } },
      { write: { 'sonar.txt': 'x' }, result: { costUsd: 0.25 } },
    ]);

    await runJob(job([lint, sonar]), deps(agent));

    expect(costs).toEqual([
      [12, seedSha, 0.5],
      [12, seedSha, 0.25],
    ]);
    expect(requests.map((request) => request.budgetUsd)).toEqual([2, 1.5]);
  });

  it('al pasar del tope, el hallazgo en curso no se sube y los demás no se empiezan; lo ya arreglado sí', async () => {
    const { agent, requests } = fakeAgent([
      { write: { 'lint.txt': 'x' }, result: { costUsd: 0.5 } },
      { write: { 'sonar.txt': 'x' }, result: { outcome: 'budgetSpent', costUsd: 1.5 } },
    ]);

    const status = await runJob(job([lint, sonar, codex]), deps(agent));

    expect(requests).toHaveLength(2);
    expect(await branchCommits()).toEqual(['fix: arreglar `lint`']);
    expect(status).toMatchObject({
      state: 'pushed',
      unfixed: [
        { finding: sonar, reason: 'budgetSpent' },
        { finding: codex, reason: 'budgetSpent' },
      ],
    });
  });

  it('sin tope que quede no empieza ningún arreglo, y el trabajo falla con ese motivo', async () => {
    const { agent, requests } = fakeAgent([]);

    const status = await runJob(job([lint], { budgetUsd: 0 }), deps(agent));

    expect(requests).toEqual([]);
    expect(status).toEqual({ state: 'failed', reason: 'budgetSpent', unfixed: [{ finding: lint, reason: 'budgetSpent' }] });
  });

  it('si la rama ha avanzado desde el SHA del trabajo, no sube nada y el trabajo queda obsoleto', async () => {
    const other = join(dir, 'other');
    await run('git', ['clone', '--branch', 'pr-branch', remote, other]);
    const maintainerSha = await commit(other, 'c.txt', 'del mantenedor');
    await git(other, 'push', 'origin', 'HEAD:refs/heads/pr-branch');
    const { agent } = fakeAgent([{ write: { 'lint.txt': 'x' } }]);

    const status = await runJob(job([lint]), deps(agent));

    expect(status).toEqual({ state: 'obsolete' });
    expect(await git(remote, 'rev-parse', 'refs/heads/pr-branch')).toBe(maintainerSha);
  });

  it('un arreglo que lleva un secreto del fixer no se sube', async () => {
    const { agent } = fakeAgent([{ write: { 'lint.txt': 'clave: sk-ant-secreto-123' } }]);

    const status = await runJob(job([lint]), deps(agent, { secrets: ['sk-ant-secreto-123'] }));

    expect(pushes).toBe(0);
    expect(status).toMatchObject({ state: 'failed', unfixed: [{ finding: lint, reason: 'agentFailed' }] });
  });

  it('borra el clon al acabar, también si falla', async () => {
    await runJob(job([lint]), deps(fakeAgent([{ write: { 'lint.txt': 'x' } }]).agent));
    const offline = deps(fakeAgent([{ write: { 'lint.txt': 'y' } }]).agent, {
      push: () => Promise.reject(new Error('sin red')),
    });
    await expect(runJob(job([lint]), offline)).rejects.toThrow('sin red');

    expect(await readdir(workRoot)).toEqual([]);
  });
});

describe('el orden y la cita de los hallazgos (design.md decisión 6)', () => {
  it('primero las comprobaciones, luego las incidencias de SonarQube y luego los hilos del revisor', () => {
    const lint2: Finding = { ...lint, name: 'typecheck' };

    expect(fixOrder([codex, sonar, lint, lint2])).toEqual([lint, lint2, sonar, codex]);
  });

  it('el trailer nombra la comprobación, la regla de la incidencia o el hilo, con dónde', () => {
    expect(fixTrailer(lint)).toBe('check:lint');
    expect(fixTrailer(sonar)).toBe('sonar:typescript:S3358 src/b.ts:12');
    expect(fixTrailer(codex)).toBe('thread:src/c.ts:7');
    expect(fixTrailer({ ...codex, line: null })).toBe('thread:src/c.ts');
  });
});
