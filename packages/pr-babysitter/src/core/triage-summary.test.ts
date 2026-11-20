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
  it('dice que es del PR Babysitter, que no actúa, y de qué push, con su SHA corto', () => {
    const text = triageSummary({ sha: SHA, findings: [] }, 0.8);

    expect(text.split('\n')[0]).toBe(
      '**Triaje del PR Babysitter** (modo sombra: no actúa) · push `abc1234`',
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
