import { describe, expect, it } from 'vitest';

import { decide } from './decision.ts';
import type { FirstTriage, Verdict } from './triage.ts';

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
