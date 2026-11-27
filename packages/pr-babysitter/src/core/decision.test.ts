import { describe, expect, it } from 'vitest';

import { decide, type FixContext, isFixable } from './decision.ts';
import type { Finding, FirstTriage, Verdict } from './triage.ts';

/** El primer triaje de un push: cada relanzable con su veredicto. */
const triaged = (...entries: [string, Verdict][]): FirstTriage =>
  entries.map(([name, verdict]) => ({ name, verdict }));

const byProbability = (verdictClass: Verdict['class'], probability: number): Verdict =>
  ({ class: verdictClass, reason: 'probability', probability });

const REAL = byProbability('valid', 0.93);
const NOT_APPLICABLE = byProbability('notApplicable', 0.12);
const UNCLEAR = byProbability('needsJudgment', 0.55);

describe('qué se hace con el triaje (change pr-first-failure-triage, decisión 1)', () => {
  it('en el primer fallo, relanza', () => {
    expect(decide('firstFailure', triaged(['e2e', NOT_APPLICABLE]))).toEqual({
      action: 'rerun',
      rule: 'firstFailure',
    });
  });

  it('en la ronda final, publica el resumen y avisa del estado final', () => {
    expect(decide('final', triaged(['e2e', REAL]))).toEqual({ action: 'publish', rule: 'finalState' });
  });
});

describe('no se relanza lo que causa la PR (change pr-first-failure-triage, decisiones 5 y 6)', () => {
  it('si una relanzable sale real, no relanza, con la regla que lo dice', () => {
    expect(decide('firstFailure', triaged(['test', REAL]))).toEqual({
      action: 'skipRerun',
      rule: 'prCausesFailure',
    });
  });

  it('tampoco si la otra no la causa la PR: se relanzan juntas', () => {
    expect(decide('firstFailure', triaged(['test', REAL], ['e2e', NOT_APPLICABLE]))).toEqual({
      action: 'skipRerun',
      rule: 'prCausesFailure',
    });
  });

  it.each<[string, Verdict]>([
    ['no aplica', NOT_APPLICABLE],
    ['exige criterio por la probabilidad', UNCLEAR],
    ['un caso evidente', { class: 'needsJudgment', reason: 'evident', evidentCase: 'timeout' }],
    ['sin contexto', { class: 'needsJudgment', reason: 'noContext' }],
    ['fuera del tope', { class: 'needsJudgment', reason: 'overBudget' }],
    ['sin respuesta del modelo', { class: 'needsJudgment', reason: 'modelUnavailable' }],
  ])('lo que no se sabe se relanza: %s', (_, verdict) => {
    expect(decide('firstFailure', triaged(['e2e', verdict]))).toEqual({
      action: 'rerun',
      rule: 'firstFailure',
    });
  });

  it('sin primer triaje (ninguna relanzable que preguntar), relanza', () => {
    expect(decide('firstFailure', [])).toEqual({ action: 'rerun', rule: 'firstFailure' });
  });
});

const lint: Finding = {
  source: 'check',
  name: 'lint',
  conclusion: 'failure',
  context: { state: 'available', origin: 'annotations', summary: '', errors: [], truncated: false },
};
const e2e: Finding = { ...lint, name: 'e2e', attempt: 2 };
const codex: Finding = {
  source: 'reviewer',
  reviewer: 'Codex',
  badge: 'P2',
  severity: 'normal',
  file: 'packages/engine/src/core/control.ts',
  line: 42,
  title: 'Falta validar el rango',
  text: 'El valor puede salir del rango.',
  diffHunk: null,
  earlierPush: null,
};

const RULE: Verdict = { class: 'valid', reason: 'rule' };
const FAILED_TWICE: Verdict = { class: 'valid', reason: 'failedTwice', evidentCase: null };

/** El triaje final de un push, con el arreglo encendido y tope de sobra salvo que se diga. */
const final = (findings: [Finding, Verdict][], overrides: Partial<FixContext> = {}): FixContext => ({
  findings: findings.map(([finding, verdict]) => ({ finding, verdict })),
  enabled: true,
  budgetLeft: true,
  ...overrides,
});

describe('decide() elige arreglar (change pr-fixer, decisión 11)', () => {
  it('con un hallazgo real arreglable en la ronda final, arregla', () => {
    expect(decide('final', [], final([[lint, RULE]]))).toEqual({ action: 'fix', rule: 'fixable' });
  });

  it('arregla aunque haya otros que exigen criterio o no aplican', () => {
    expect(
      decide('final', [], final([[codex, UNCLEAR], [lint, RULE], [codex, NOT_APPLICABLE]])),
    ).toEqual({ action: 'fix', rule: 'fixable' });
  });

  it('sin hallazgos reales, publica y avisa del estado final, como hasta ahora', () => {
    expect(decide('final', [], final([[codex, UNCLEAR], [codex, NOT_APPLICABLE]]))).toEqual({
      action: 'publish',
      rule: 'finalState',
    });
  });

  it('si los únicos reales son relanzables que han fallado dos veces, no arregla: no las causa la PR', () => {
    expect(decide('final', [], final([[e2e, FAILED_TWICE]]))).toEqual({
      action: 'publish',
      rule: 'notCausedByPr',
    });
  });

  it('una relanzable que ha fallado dos veces no impide arreglar los demás reales', () => {
    expect(decide('final', [], final([[e2e, FAILED_TWICE], [codex, REAL]]))).toEqual({
      action: 'fix',
      rule: 'fixable',
    });
  });

  it('con FIX_ENABLED=false, no arregla', () => {
    expect(decide('final', [], final([[lint, RULE]], { enabled: false }))).toEqual({
      action: 'publish',
      rule: 'fixDisabled',
    });
  });

  it('sin tope de gasto para arreglar, no arregla', () => {
    expect(decide('final', [], final([[lint, RULE]], { budgetLeft: false }))).toEqual({
      action: 'publish',
      rule: 'fixBudgetSpent',
    });
  });

  it('sin el contexto del arreglo, la ronda final publica como hasta ahora', () => {
    expect(decide('final', [])).toEqual({ action: 'publish', rule: 'finalState' });
  });

  it('en el primer fallo nunca arregla', () => {
    expect(decide('firstFailure', [], final([[lint, RULE]]))).toEqual({
      action: 'rerun',
      rule: 'firstFailure',
    });
  });
});

describe('qué hallazgo es arreglable', () => {
  it.each<[string, Finding, Verdict, boolean]>([
    ['una comprobación real por regla', lint, RULE, true],
    ['un comentario real por probabilidad', codex, REAL, true],
    ['una relanzable que ha fallado dos veces', e2e, FAILED_TWICE, false],
    ['uno que exige criterio', codex, UNCLEAR, false],
    ['uno que no aplica', codex, NOT_APPLICABLE, false],
  ])('%s', (_, finding, verdict, expected) => {
    expect(isFixable({ finding, verdict })).toBe(expected);
  });
});
