/**
 * Las incidencias de SonarQube de la comprobación `sonar-issues` (change pr-sonar-issue-triage,
 * decisiones 4 y 5), con las anotaciones que dejó en la PR de prueba #165 (`MOO-167`, 20-nov):
 * `test/fixtures/github/annotations-165-sonar-issues.json`, con tres incidencias en el orden en que
 * las da GitHub, su aviso con el total y el `failure` de `.github`. El código de los ficheros no se
 * ha grabado: los tests lo escriben, para que las líneas se cuenten a ojo.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, fixture, json } from '../../test/fake-github.ts';
import type { CheckContext } from '../core/triage.ts';
import { readCheckContext } from './check-context.ts';
import { createGitHubReader } from './github.ts';
import { readSonarIssues } from './sonar-issues.ts';

const SHA = '38fc23365853f5355dc76ab4a15c2a62f7e7d3ea';

/** El contexto de `sonar-issues` en la #165, leído como lo lee el triador. */
async function context165(): Promise<CheckContext> {
  const body = await fixture('annotations-165-sonar-issues.json');
  const { fetch } = fakeFetch(() => json(body));
  const github = createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token: () => 'ghp_x',
    fetch,
  });
  const { context } = await readCheckContext(
    {
      checkRun: () =>
        Promise.resolve({
          id: 136112262311,
          app: 'github-actions',
          conclusion: 'failure',
          output: { title: null, summary: null },
        }),
      annotations: (id) => github.annotations(id),
      jobLog: () => Promise.resolve(null),
    },
    SHA,
    'sonar-issues',
  );
  return context;
}

/** Un fichero de `count` líneas, «línea 1», «línea 2"…, para contar a ojo. */
function lines(count: number): string {
  return Array.from({ length: count }, (_, index) => `línea ${index + 1}`).join('\n') + '\n';
}

/** Un `fileAt` falso con los ficheros dados, que cuenta las peticiones. */
function files(contents: Record<string, string | null>) {
  const calls: string[] = [];
  return {
    calls,
    github: {
      fileAt(sha: string, path: string) {
        calls.push(`${sha}:${path}`);
        return Promise.resolve(contents[path] ?? null);
      },
    },
  };
}

/** Un contexto de `sonar-issues` con las anotaciones dadas y el aviso del total. */
function annotated(
  errors: { file: string; line: number | null; title: string | null; message?: string }[],
  notice = `${errors.length} incidencias nuevas; se anotan ${errors.length}`,
): Extract<CheckContext, { state: 'available' }> {
  return {
    state: 'available',
    origin: 'annotations',
    summary: `Incidencias nuevas de SonarQube\n${notice}`,
    errors: errors.map((error) => ({ message: 'm', ...error })),
    truncated: false,
  };
}

describe('las incidencias de sonar-issues', () => {
  it('saca de cada anotación de error su regla, su nombre, su severidad, su fichero, su línea y su mensaje', async () => {
    const { github } = files({});

    const read = await readSonarIssues(github, SHA, await context165());

    expect(read?.total).toBe(3);
    expect(read?.issues).toMatchObject([
      {
        rule: 'typescript:S6959',
        ruleName: '"Array.reduce()" calls should include an initial value',
        severity: 'normal',
        file: 'tooling/ci/sonar-issues.ts',
        line: 156,
        message: 'Add an initial value to this "reduce()" call.',
      },
      {
        rule: 'typescript:S9382',
        ruleName: 'Promises should not be awaited sequentially in a loop',
        severity: 'normal',
        file: 'tooling/ci/prueba-await.ts',
        line: 4,
        message: 'Unexpected `await` inside a loop.',
      },
      {
        rule: 'typescript:S3358',
        ruleName: 'Ternary operators should not be nested',
        severity: 'normal',
        file: 'packages/shared/src/prueba-ternario.ts',
        line: 3,
        message: 'Extract this nested ternary operation into an independent statement.',
      },
    ]);
  });

  it.each([
    ['BLOCKER', 'high'],
    ['HIGH', 'high'],
    ['MEDIUM', 'normal'],
    ['LOW', 'normal'],
    ['INFO', 'normal'],
  ])('una incidencia %s es de severidad %s', async (severity, expected) => {
    const { github } = files({ 'a.ts': lines(5) });
    const context = annotated([
      { file: 'a.ts', line: 1, title: `typescript:S1 · ${severity} · Regla` },
    ]);

    const read = await readSonarIssues(github, SHA, context);

    expect(read?.issues[0]?.severity).toBe(expected);
  });

  it('el nombre de la regla puede llevar el separador', async () => {
    const { github } = files({ 'a.ts': lines(5) });
    const context = annotated([
      { file: 'a.ts', line: 1, title: 'typescript:S1 · LOW · Uno · dos' },
    ]);

    const read = await readSonarIssues(github, SHA, context);

    expect(read?.issues[0]).toMatchObject({ rule: 'typescript:S1', ruleName: 'Uno · dos' });
  });

  it('el total sale del aviso, aunque se anoten menos', async () => {
    const { github } = files({ 'a.ts': lines(5) });
    const context = annotated(
      [{ file: 'a.ts', line: 1, title: 'typescript:S1 · LOW · Regla' }],
      '12 incidencias nuevas; se anotan 10',
    );

    expect((await readSonarIssues(github, SHA, context))?.total).toBe(12);
  });

  it('sin el aviso, el total son las incidencias leídas', async () => {
    const { github } = files({ 'a.ts': lines(5) });
    const context: CheckContext = {
      ...annotated([{ file: 'a.ts', line: 1, title: 'typescript:S1 · LOW · Regla' }]),
      summary: '',
    };

    expect((await readSonarIssues(github, SHA, context))?.total).toBe(1);
  });

  it('se salta una anotación de error que no es de una incidencia', async () => {
    const { github } = files({ 'a.ts': lines(5) });
    const context = annotated([
      { file: 'a.ts', line: 1, title: null },
      { file: 'a.ts', line: 2, title: 'Otra cosa' },
      { file: 'a.ts', line: 3, title: 'typescript:S1 · LOW · Regla' },
    ]);

    const read = await readSonarIssues(github, SHA, context);

    expect(read?.issues.map(({ line }) => line)).toEqual([3]);
  });

  it.each<[string, CheckContext]>([
    ['el log', { state: 'available', origin: 'log', summary: 'x', errors: [], truncated: false }],
    ['ningún contexto', { state: 'notProvided' }],
    ['un contexto ilegible', { state: 'unreadable' }],
    ['anotaciones sin ninguna incidencia', annotated([{ file: 'a.ts', line: 1, title: null }])],
  ])('sin ninguna incidencia legible (%s) da null', async (_case, context) => {
    const { github, calls } = files({});

    await expect(readSonarIssues(github, SHA, context)).resolves.toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('el código de una incidencia', () => {
  it('va de la línea − 25 a la + 15, numerado y con >> en la suya', async () => {
    const { github } = files({ 'a.ts': lines(200) });
    const context = annotated([{ file: 'a.ts', line: 100, title: 'typescript:S1 · LOW · Regla' }]);

    const code = (await readSonarIssues(github, SHA, context))?.issues[0]?.code ?? '';

    const rows = code.split('\n');
    expect(rows).toHaveLength(41);
    expect(rows[0]).toBe('     75 | línea 75');
    expect(rows[25]).toBe('>>  100 | línea 100');
    expect(rows.at(-1)).toBe('    115 | línea 115');
  });

  it('se queda dentro del fichero cerca del principio y del final', async () => {
    const { github } = files({ 'a.ts': lines(6) });
    const context = annotated([{ file: 'a.ts', line: 4, title: 'typescript:S1 · LOW · Regla' }]);

    const code = (await readSonarIssues(github, SHA, context))?.issues[0]?.code ?? '';

    expect(code.split('\n')).toEqual([
      '      1 | línea 1',
      '      2 | línea 2',
      '      3 | línea 3',
      '>>    4 | línea 4',
      '      5 | línea 5',
      '      6 | línea 6',
    ]);
  });

  it('una incidencia de fichero toma las 40 primeras líneas, sin marca', async () => {
    const { github } = files({ 'a.ts': lines(100) });
    const context = annotated([{ file: 'a.ts', line: null, title: 'typescript:S1 · LOW · Regla' }]);

    const code = (await readSonarIssues(github, SHA, context))?.issues[0]?.code ?? '';

    const rows = code.split('\n');
    expect(rows).toHaveLength(40);
    expect(rows[0]).toBe('      1 | línea 1');
    expect(rows.at(-1)).toBe('     40 | línea 40');
    expect(code).not.toContain('>>');
  });

  it('una línea fuera del fichero da code null', async () => {
    const { github } = files({ 'a.ts': lines(6) });
    const context = annotated([{ file: 'a.ts', line: 7, title: 'typescript:S1 · LOW · Regla' }]);

    expect((await readSonarIssues(github, SHA, context))?.issues[0]?.code).toBeNull();
  });

  it('un fichero que GitHub no da deja code null, y la incidencia sigue', async () => {
    const { github } = files({ 'b.ts': lines(6) });
    const context = annotated([
      { file: 'a.ts', line: 1, title: 'typescript:S1 · LOW · Regla' },
      { file: 'b.ts', line: 1, title: 'typescript:S2 · LOW · Regla' },
    ]);

    const read = await readSonarIssues(github, SHA, context);

    expect(read?.issues[0]?.code).toBeNull();
    expect(read?.issues[1]?.code).toContain('>>    1 | línea 1');
  });

  it('pide cada fichero una vez, en el commit del push', async () => {
    const { github, calls } = files({ 'a.ts': lines(50), 'b.ts': lines(50) });
    const context = annotated([
      { file: 'a.ts', line: 1, title: 'typescript:S1 · LOW · Regla' },
      { file: 'b.ts', line: 2, title: 'typescript:S2 · LOW · Regla' },
      { file: 'a.ts', line: 30, title: 'typescript:S3 · LOW · Regla' },
    ]);

    await readSonarIssues(github, SHA, context);

    expect(calls).toEqual([`${SHA}:a.ts`, `${SHA}:b.ts`]);
  });
});
