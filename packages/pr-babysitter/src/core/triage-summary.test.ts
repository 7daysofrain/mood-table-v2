import { describe, expect, it } from 'vitest';

import type { Finding, Verdict } from './triage.ts';
import { summaryMarks, triageSummary } from './triage-summary.ts';

const SHA = 'abc1234def5678abc1234def5678abc1234def56';

const p1: Finding = {
  source: 'reviewer',
  reviewer: 'Codex',
  badge: 'P1',
  severity: 'high',
  file: 'packages/pr-babysitter/src/core/graph.ts',
  line: 204,
  title: 'Prevent pending-notice recovery from requesting a stopped PR review',
  text: 'If Linear rejects…',
  diffHunk: '@@ -190,6 +190,20 @@',
  earlierPush: null,
};

const p2: Finding = {
  ...p1,
  badge: 'P2',
  severity: 'normal',
  file: 'packages/pr-babysitter/src/core/driver.ts',
  line: 88,
  title: 'Skip the request when the push changed',
};

type CheckFinding = Extract<Finding, { source: 'check' }>;

const e2e: CheckFinding = {
  source: 'check',
  name: 'e2e',
  conclusion: 'failure',
  context: {
    state: 'available',
    origin: 'log',
    summary: 'Error: 1 test failed',
    errors: [],
    truncated: false,
  },
};

/** La misma comprobación con otro contexto. */
function e2eWith(context: CheckFinding['context']): Finding {
  return { ...e2e, context };
}

const probability = (cls: 'valid' | 'notApplicable' | 'needsJudgment', p: number): Verdict => ({
  class: cls,
  reason: 'probability',
  probability: p,
});

/** El veredicto de un comentario del revisor por el alcance: su clase, por qué, y P1 y P2. */
const scope = (
  cls: 'valid' | 'notApplicable' | 'needsJudgment',
  reason: 'inScope' | 'outOfScope' | 'unclearScope' | 'contradictoryScope' | 'highSeverity',
  inside: number,
  outside: number,
): Verdict => ({ class: cls, reason, inside, outside });

/** Las filas de la tabla, sin la cabecera. */
function rows(text: string): string[] {
  return text.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Hallazgo'));
}

describe('el resumen del triaje (design.md, decisión 7)', () => {
  it('dice que es del PR Babysitter, que no arregla, y de qué push, con su SHA corto', () => {
    const text = triageSummary({ sha: SHA, findings: [] }, 0.8);

    expect(text.split('\n')[0]).toBe(
      '**Triaje del PR Babysitter** (modo sombra: no arregla) · push `abc1234`',
    );
  });

  it('tiene una fila por hallazgo, en su orden, con su identidad, su clase y por qué', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: p1, verdict: scope('valid', 'inScope', 0.93, 0.07) },
          { finding: e2e, verdict: probability('needsJudgment', 0.55) },
          { finding: p2, verdict: scope('notApplicable', 'outOfScope', 0.07, 0.85) },
        ],
      },
      0.8,
    );

    expect(text).toContain('| Hallazgo | Clase | Por qué |\n|---|---|---|');
    expect(rows(text)).toEqual([
      '| P1 de Codex en `graph.ts:204` · Prevent pending-notice recovery from requesting a stopped PR review | real | dentro del alcance: p = 0,93 ≥ 0,80 |',
      '| Comprobación `e2e` | exige criterio | p = 0,55: no llega al umbral de 0,80 · contexto: log |',
      '| P2 de Codex en `driver.ts:88` · Skip the request when the push changed | no aplica | de otra tarea: p = 0,85 ≥ 0,80 · se capturaría |',
    ]);
  });

  it('el porqué de cada regla que exige criterio', () => {
    const reviewerWithoutDiff: Finding = { ...p2, diffHunk: null };
    const notProvided = e2eWith({ state: 'notProvided' });
    const unreadable = e2eWith({ state: 'unreadable' });
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          {
            finding: p1,
            verdict: { class: 'needsJudgment', reason: 'highSeverity', inside: 0.05, outside: 0.9 },
          },
          { finding: notProvided, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: unreadable, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: reviewerWithoutDiff, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: e2e, verdict: { class: 'needsJudgment', reason: 'overBudget' } },
          { finding: p2, verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(1).join(' | '))).toEqual([
      'exige criterio | regla: descartaría un hallazgo de severidad alta |',
      'exige criterio | la comprobación no da contexto |',
      'exige criterio | no se ha podido leer su contexto |',
      'exige criterio | no se ha podido leer el trozo de diff que comenta |',
      'exige criterio | no cabe en el tope de gasto de la PR · contexto: log |',
      'exige criterio | el modelo de decisión no ha respondido |',
    ]);
  });

  it('una comprobación determinista: la decide la regla, sin probabilidad ni origen del contexto', () => {
    const lint: Finding = { ...e2e, name: 'lint' };
    const unreadable: Finding = { ...e2e, name: 'typecheck', context: { state: 'unreadable' } };
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: lint, verdict: { class: 'valid', reason: 'rule' } },
          { finding: unreadable, verdict: { class: 'valid', reason: 'rule' } },
        ],
      },
      0.8,
    );

    expect(rows(text)).toEqual([
      '| Comprobación `lint` | real | regla: comprobación determinista |',
      '| Comprobación `typecheck` | real | regla: comprobación determinista |',
    ]);
  });

  it('el porqué de una comprobación termina con el origen de su contexto, y con si se cortó', () => {
    const available = { state: 'available' as const, summary: '1 failed', errors: [] };
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          {
            finding: e2eWith({ ...available, origin: 'annotations', truncated: false }),
            verdict: probability('valid', 0.93),
          },
          {
            finding: e2eWith({ ...available, origin: 'log', truncated: true }),
            verdict: probability('notApplicable', 0.07),
          },
          {
            finding: e2eWith({ ...available, origin: 'appSummary', truncated: false }),
            verdict: { class: 'needsJudgment', reason: 'modelUnavailable' },
          },
          { finding: p2, verdict: scope('valid', 'inScope', 0.93, 0.07) },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(2).join(' | '))).toEqual([
      'p = 0,93 ≥ 0,80 · contexto: anotaciones |',
      'p = 0,07 ≤ 0,20 · contexto: log, cortado |',
      'el modelo de decisión no ha respondido · contexto: resumen de la app |',
      'dentro del alcance: p = 0,93 ≥ 0,80 |',
    ]);
  });

  it('los cortes son los del umbral configurado', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: e2e, verdict: probability('valid', 0.93) },
          { finding: e2e, verdict: probability('notApplicable', 0.07) },
          { finding: e2e, verdict: probability('needsJudgment', 0.85) },
          { finding: p1, verdict: scope('valid', 'inScope', 0.93, 0.07) },
          { finding: p2, verdict: scope('needsJudgment', 'unclearScope', 0.85, 0.1) },
        ],
      },
      0.9,
    );

    expect(rows(text).map((row) => row.split(' | ').at(-1))).toEqual([
      'p = 0,93 ≥ 0,90 · contexto: log |',
      'p = 0,07 ≤ 0,10 · contexto: log |',
      'p = 0,85: no llega al umbral de 0,90 · contexto: log |',
      'dentro del alcance: p = 0,93 ≥ 0,90 |',
      'dentro p = 0,85, de otra tarea p = 0,10: ninguna llega a 0,90 |',
    ]);
  });

  it('sin insignia o sin línea, nombra lo que hay', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: { ...p2, badge: null }, verdict: probability('valid', 0.9) },
          { finding: { ...p2, line: null }, verdict: probability('valid', 0.9) },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' · ')[0])).toEqual([
      '| Codex en `driver.ts:88`',
      '| P2 de Codex en `driver.ts`',
    ]);
  });

  it('un título con barras o saltos de línea no rompe la tabla', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: { ...p2, title: 'Use a | b\nor c' }, verdict: probability('valid', 0.9) },
        ],
      },
      0.8,
    );

    expect(rows(text)).toEqual([
      '| P2 de Codex en `driver.ts:88` · Use a \\| b or c | real | p = 0,90 ≥ 0,80 |',
    ]);
  });

  it('termina con la marca oculta del push, con el SHA completo, que se lee de vuelta', () => {
    const text = triageSummary({ sha: SHA, findings: [] }, 0.8);

    expect(text.split('\n').at(-1)).toBe(`<!-- pr-babysitter:triage {"sha":"${SHA}"} -->`);
    expect(summaryMarks(text)).toEqual([SHA]);
  });
});

describe('el porqué de cada hallazgo del revisor (change pr-reviewer-scope, decisión 3)', () => {
  /** El porqué de cada fila, con el umbral de 0,80. */
  const why = (findings: { finding: Finding; verdict: Verdict }[]) =>
    rows(triageSummary({ sha: SHA, findings }, 0.8)).map((row) => row.split(' | ').slice(1).join(' | '));

  it('una fila por caso de la tabla: la clase y por qué', () => {
    expect(
      why([
        { finding: p2, verdict: scope('valid', 'inScope', 0.91, 0.11) },
        { finding: p2, verdict: scope('notApplicable', 'outOfScope', 0.1, 0.85) },
        { finding: p2, verdict: scope('needsJudgment', 'unclearScope', 0.58, 0.32) },
        { finding: p2, verdict: scope('needsJudgment', 'contradictoryScope', 0.85, 0.82) },
        { finding: p1, verdict: scope('needsJudgment', 'highSeverity', 0.1, 0.9) },
        { finding: p2, verdict: { class: 'needsJudgment', reason: 'noScope' } },
      ]),
    ).toEqual([
      'real | dentro del alcance: p = 0,91 ≥ 0,80 |',
      'no aplica | de otra tarea: p = 0,85 ≥ 0,80 · se capturaría |',
      'exige criterio | dentro p = 0,58, de otra tarea p = 0,32: ninguna llega a 0,80 |',
      'exige criterio | dentro p = 0,85, de otra tarea p = 0,82: se contradicen |',
      'exige criterio | regla: descartaría un hallazgo de severidad alta |',
      'exige criterio | regla: la PR no dice su alcance |',
    ]);
  });

  it('dice qué se capturaría: el revisor, el fichero y la línea, el título, y por qué', () => {
    const finding: Finding = {
      ...p2,
      file: 'packages/pr-babysitter/src/core/graph.ts',
      line: 88,
      title: 'Conservar el gasto al detener',
    };

    expect(
      rows(
        triageSummary(
          { sha: SHA, findings: [{ finding, verdict: scope('notApplicable', 'outOfScope', 0.1, 0.85) }] },
          0.8,
        ),
      ),
    ).toEqual([
      '| P2 de Codex en `graph.ts:88` · Conservar el gasto al detener | no aplica | de otra tarea: p = 0,85 ≥ 0,80 · se capturaría |',
    ]);
  });

  it('solo dice que se capturaría lo que no aplica por ser de otra tarea', () => {
    const rowsWithCapture = why([
      { finding: p2, verdict: scope('valid', 'inScope', 0.91, 0.11) },
      { finding: p2, verdict: scope('needsJudgment', 'unclearScope', 0.58, 0.32) },
      { finding: p2, verdict: scope('needsJudgment', 'contradictoryScope', 0.85, 0.82) },
      { finding: p1, verdict: scope('needsJudgment', 'highSeverity', 0.1, 0.9) },
    ]).filter((row) => row.includes('se capturaría'));

    expect(rowsWithCapture).toEqual([]);
  });
});

describe('un comentario de un push anterior (change pr-unresolved-threads, decisión 5)', () => {
  const earlier: Finding = {
    ...p2,
    file: 'packages/pr-babysitter/src/adapters/findings.ts',
    line: 54,
    title: 'Split SonarQube annotations before applying the context size limit',
    earlierPush: { sha: '576b49636780068462fa4984e34a7c39902eba8a', code: '>>   54 | x' },
  };
  const earlierP1: Finding = { ...earlier, badge: 'P1', severity: 'high' };
  /** El veredicto con las tres probabilidades. */
  const fixedScope = (
    cls: 'valid' | 'notApplicable' | 'needsJudgment',
    reason: 'alreadyFixed' | 'inScope' | 'outOfScope' | 'unclearScope' | 'contradictoryScope' | 'highSeverity',
    fixed: number,
    inside: number,
    outside: number,
  ): Verdict => ({ class: cls, reason, fixed, inside, outside });
  const summary = (findings: { finding: Finding; verdict: Verdict }[]) =>
    rows(triageSummary({ sha: SHA, findings }, 0.8));

  it('la identidad dice que es de un push anterior, con su SHA corto', () => {
    expect(summary([{ finding: earlier, verdict: fixedScope('valid', 'inScope', 0.31, 0.83, 0.21) }])).toEqual([
      '| P2 de Codex en `findings.ts:54` · Split SonarQube annotations before applying the context size limit · de un push anterior (`576b496`) | real | dentro del alcance: p = 0,83 ≥ 0,80 |',
    ]);
  });

  it('la de uno del último push no lo dice', () => {
    const [row] = summary([{ finding: p2, verdict: scope('valid', 'inScope', 0.91, 0.11) }]);

    expect(row).not.toContain('push anterior');
  });

  it('si GitHub ya no da su commit (tras un force push), dice que es de un push anterior, sin SHA', () => {
    const forced: Finding = { ...earlier, earlierPush: { sha: null, code: '>>   54 | x' } };

    const [row] = summary([{ finding: forced, verdict: fixedScope('valid', 'inScope', 0.31, 0.83, 0.21) }]);

    expect(row).toContain('· Split SonarQube annotations before applying the context size limit · de un push anterior |');
  });

  it('una fila por caso de su tabla: la clase y por qué', () => {
    expect(
      summary([
        { finding: earlier, verdict: fixedScope('notApplicable', 'alreadyFixed', 0.91, 0.2, 0.1) },
        { finding: earlierP1, verdict: fixedScope('needsJudgment', 'highSeverity', 0.93, 0.2, 0.1) },
        { finding: earlier, verdict: fixedScope('needsJudgment', 'unclearScope', 0.4, 0.58, 0.32) },
        { finding: earlier, verdict: fixedScope('needsJudgment', 'contradictoryScope', 0.4, 0.85, 0.82) },
        { finding: earlier, verdict: { class: 'needsJudgment', reason: 'noCurrentCode' } },
      ]).map((row) => row.split(' | ').slice(1).join(' | ')),
    ).toEqual([
      'no aplica | ya arreglado en el último push: p = 0,91 ≥ 0,80 |',
      'exige criterio | regla: descartaría un hallazgo de severidad alta |',
      'exige criterio | ya arreglado p = 0,40, dentro p = 0,58, de otra tarea p = 0,32: ninguna llega a 0,80 |',
      'exige criterio | ya arreglado p = 0,40, dentro p = 0,85, de otra tarea p = 0,82: se contradicen |',
      'exige criterio | no se ha podido leer su código en el último push |',
    ]);
  });
});

describe('las incidencias de SonarQube (change pr-sonar-issue-triage, decisión 5)', () => {
  const issue: Finding = {
    source: 'sonarIssue',
    rule: 'typescript:S9382',
    ruleName: 'Promises should not be awaited sequentially in a loop',
    severity: 'normal',
    file: 'tooling/ci/check-sonar-issues.ts',
    line: 58,
    message: 'Unexpected `await` inside a loop.',
    code: '>>   58 | await x;',
  };
  const sonarCheck: Finding = { ...e2e, name: 'sonar-issues' };

  it('una fila por incidencia, con su regla, su fichero y su línea, y el nombre de la regla', () => {
    const text = triageSummary(
      { sha: SHA, findings: [{ finding: issue, verdict: probability('valid', 0.93) }] },
      0.8,
    );

    expect(rows(text)).toEqual([
      '| SonarQube `typescript:S9382` en `check-sonar-issues.ts:58` · Promises should not be awaited sequentially in a loop | real | p = 0,93 ≥ 0,80 |',
    ]);
  });

  it('no aplica dice que se aceptaría en SonarQube; la regla de severidad alta, no', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: issue, verdict: probability('notApplicable', 0.1) },
          {
            finding: { ...issue, severity: 'high' },
            verdict: { class: 'needsJudgment', reason: 'highSeverity', probability: 0.1 },
          },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(1).join(' | '))).toEqual([
      'no aplica | p = 0,10 ≤ 0,20 · se aceptaría en SonarQube |',
      'exige criterio | regla: descartaría un hallazgo de severidad alta |',
    ]);
  });

  it('sin código, o la comprobación sin ninguna incidencia legible, dicen por qué exigen criterio', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: { ...issue, code: null }, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: sonarCheck, verdict: { class: 'needsJudgment', reason: 'noIssues' } },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(1).join(' | '))).toEqual([
      'exige criterio | no se ha podido leer su código |',
      'exige criterio | no anota ninguna incidencia legible |',
    ]);
  });

  it('si la comprobación trae más incidencias de las triadas, lo dice bajo la tabla', () => {
    const findings = [{ finding: issue, verdict: probability('valid', 0.93) }];
    const cut = triageSummary({ sha: SHA, findings, sonarIssues: { total: 12, triaged: 10 } }, 0.8);

    const lines = cut.split('\n');
    const line = 'La comprobación de incidencias nuevas de SonarQube trae 12; se han triado las 10 que anota.';
    expect(lines).toContain(line);
    expect(lines.indexOf(line)).toBeGreaterThan(lines.findLastIndex((row) => row.startsWith('| ')));
    expect(lines.at(-1)).toMatch(/^<!-- pr-babysitter:triage /);
  });

  it('si se han triado todas, o no hay recuento, no dice nada', () => {
    const findings = [{ finding: issue, verdict: probability('valid', 0.93) }];

    for (const sonarIssues of [{ total: 3, triaged: 3 }, null, undefined]) {
      expect(triageSummary({ sha: SHA, findings, sonarIssues }, 0.8)).not.toContain('se han triado');
    }
  });
});

describe('lo relanzado (change pr-check-rerun, decisiones 1, 6 y 8)', () => {
  const twice = (evidentCase: 'timeout' | 'infrastructure' | 'network' | 'runnerLost' | null): Verdict => ({
    class: 'valid',
    reason: 'failedTwice',
    evidentCase,
  });

  it('una relanzable que ha fallado dos veces: la regla, y el caso evidente si lo hay, sin origen del contexto', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: e2e, verdict: twice(null) },
          { finding: e2e, verdict: twice('timeout') },
          { finding: e2e, verdict: twice('infrastructure') },
          { finding: e2e, verdict: twice('network') },
          { finding: e2e, verdict: twice('runnerLost') },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(1).join(' | '))).toEqual([
      'real | regla: ha fallado dos veces |',
      'real | regla: ha fallado dos veces · caso evidente: timeout |',
      'real | regla: ha fallado dos veces · caso evidente: infraestructura |',
      'real | regla: ha fallado dos veces · caso evidente: red |',
      'real | regla: ha fallado dos veces · caso evidente: runner perdido |',
    ]);
  });

  it('los tres motivos de exige criterio, sin origen del contexto', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [
          { finding: e2e, verdict: { class: 'needsJudgment', reason: 'notRerun' } },
          { finding: e2e, verdict: { class: 'needsJudgment', reason: 'rerunUnfinished' } },
          { finding: e2e, verdict: { class: 'needsJudgment', reason: 'cancelled' } },
        ],
      },
      0.8,
    );

    expect(rows(text).map((row) => row.split(' | ').slice(1).join(' | '))).toEqual([
      'exige criterio | regla: no se ha podido relanzar |',
      'exige criterio | regla: el relanzamiento no ha terminado |',
      'exige criterio | regla: se ha cancelado |',
    ]);
  });

  it('con hallazgos, dice bajo la tabla qué se relanzó y pasó', () => {
    const lint: Finding = { ...e2e, name: 'lint' };
    const text = triageSummary(
      {
        sha: SHA,
        findings: [{ finding: lint, verdict: { class: 'valid', reason: 'rule' } }],
        rerunPassed: ['e2e'],
      },
      0.8,
    );

    expect(rows(text)).toEqual(['| Comprobación `lint` | real | regla: comprobación determinista |']);
    expect(text).toContain('| real | regla: comprobación determinista |\n\nLa comprobación `e2e` se relanzó y pasó.\n');
  });

  it('sin hallazgos, sin tabla: solo lo que se relanzó y pasó, y la marca del push', () => {
    const text = triageSummary({ sha: SHA, findings: [], rerunPassed: ['test', 'e2e'] }, 0.8);

    expect(text).not.toContain('| Hallazgo |');
    expect(text.split('\n')).toEqual([
      '**Triaje del PR Babysitter** (modo sombra: no arregla) · push `abc1234`',
      '',
      'La comprobación `test` se relanzó y pasó.',
      'La comprobación `e2e` se relanzó y pasó.',
      '',
      `<!-- pr-babysitter:triage {"sha":"${SHA}"} -->`,
    ]);
    expect(summaryMarks(text)).toEqual([SHA]);
  });

  it('sin nada relanzado, no dice nada de ello', () => {
    const text = triageSummary(
      { sha: SHA, findings: [{ finding: e2e, verdict: twice(null) }], rerunPassed: [] },
      0.8,
    );

    expect(text).not.toContain('se relanzó');
  });
});

describe('la nota del primer triaje (change pr-first-failure-triage, decisión 8)', () => {
  /** El resumen de un push en el que `e2e` se relanzó y pasó, con este primer triaje. */
  const passedWith = (verdict: Verdict) =>
    triageSummary(
      { sha: SHA, findings: [], rerunPassed: ['e2e'], firstTriage: [{ name: 'e2e', verdict }] },
      0.8,
    );
  const passedLine = (text: string) => text.split('\n').find((line) => line.includes('se relanzó'));

  it.each([
    ['no aplica', probability('notApplicable', 0.12), 'primer intento: p = 0,12 ≤ 0,20 · se capturaría'],
    ['exige criterio por la probabilidad', probability('needsJudgment', 0.55), 'primer intento: p = 0,55, no llega al umbral'],
    ['real', probability('valid', 0.93), 'primer intento: p = 0,93 ≥ 0,80'],
    [
      'caso evidente',
      { class: 'needsJudgment', reason: 'evident', evidentCase: 'timeout' } satisfies Verdict,
      'primer intento: caso evidente: timeout',
    ],
    [
      'sin respuesta del modelo',
      { class: 'needsJudgment', reason: 'modelUnavailable' } satisfies Verdict,
      'primer intento: no se ha podido preguntar por la causa: el modelo de decisión no ha respondido',
    ],
    [
      'fuera del tope',
      { class: 'needsJudgment', reason: 'overBudget' } satisfies Verdict,
      'primer intento: no se ha podido preguntar por la causa: no cabe en el tope de gasto de la PR',
    ],
    [
      'sin contexto',
      { class: 'needsJudgment', reason: 'noContext' } satisfies Verdict,
      'primer intento: no se ha podido preguntar por la causa: no se ha podido reunir su contexto',
    ],
  ])('%s: en la línea «se relanzó y pasó»', (_, verdict, note) => {
    expect(passedLine(passedWith(verdict))).toBe(`La comprobación \`e2e\` se relanzó y pasó · ${note}.`);
  });

  it('en el porqué de una fila real por regla, porque ha fallado dos veces', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [{ finding: e2e, verdict: { class: 'valid', reason: 'failedTwice', evidentCase: null } }],
        firstTriage: [{ name: 'e2e', verdict: probability('notApplicable', 0.12) }],
      },
      0.8,
    );

    expect(rows(text)).toEqual([
      '| Comprobación `e2e` | real | regla: ha fallado dos veces · primer intento: p = 0,12 ≤ 0,20 · se capturaría |',
    ]);
  });

  it('en el porqué de una fila que exige criterio porque el relanzamiento no ha terminado', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [{ finding: e2e, verdict: { class: 'needsJudgment', reason: 'rerunUnfinished' } }],
        firstTriage: [{ name: 'e2e', verdict: probability('notApplicable', 0.12) }],
      },
      0.8,
    );

    expect(rows(text)).toEqual([
      '| Comprobación `e2e` | exige criterio | regla: el relanzamiento no ha terminado · primer intento: p = 0,12 ≤ 0,20 · se capturaría |',
    ]);
  });

  it('sin nota en una relanzable que no se relanzó', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [{ finding: e2e, verdict: { class: 'needsJudgment', reason: 'notRerun' } }],
        firstTriage: [{ name: 'e2e', verdict: probability('notApplicable', 0.12) }],
      },
      0.8,
    );

    expect(rows(text)).toEqual(['| Comprobación `e2e` | exige criterio | regla: no se ha podido relanzar |']);
  });

  it('sin primer triaje de esa comprobación, sin nota', () => {
    const text = triageSummary(
      {
        sha: SHA,
        findings: [],
        rerunPassed: ['test', 'e2e'],
        firstTriage: [{ name: 'e2e', verdict: probability('notApplicable', 0.12) }],
      },
      0.8,
    );

    expect(text).toContain('La comprobación `test` se relanzó y pasó.\n');
  });
});

describe('las marcas de un comentario', () => {
  it('no hay ninguna en un comentario cualquiera', () => {
    expect(summaryMarks('Buen trabajo')).toEqual([]);
  });

  it('una marca con un JSON que no se entiende no cuenta', () => {
    expect(summaryMarks('<!-- pr-babysitter:triage {"sha": -->')).toEqual([]);
  });

  it('la marca de la petición de revisión no es la del resumen', () => {
    expect(summaryMarks(`<!-- pr-babysitter:review-request {"sha":"${SHA}"} -->`)).toEqual([]);
  });
});
