import { describe, expect, it } from 'vitest';

import { decide } from './decision.ts';
import type { FirstTriage, Verdict } from './triage.ts';

/** El primer triaje de `test` y `e2e` con estos veredictos. */
const firstTriage = (test: Verdict, e2e?: Verdict): FirstTriage => [
  { name: 'test', verdict: test },
  ...(e2e ? [{ name: 'e2e', verdict: e2e }] : []),
];

const probability = (cls: 'valid' | 'notApplicable' | 'needsJudgment', p: number): Verdict => ({
  class: cls,
  reason: 'probability',
  probability: p,
});

describe('qué se hace con el triaje (change pr-first-failure-triage, decisión 1)', () => {
  it.each([
    ['real', probability('valid', 0.93)],
    ['no aplica', probability('notApplicable', 0.12)],
    ['exige criterio', probability('needsJudgment', 0.55)],
    ['caso evidente', { class: 'needsJudgment', reason: 'evident', evidentCase: 'timeout' } satisfies Verdict],
    ['sin respuesta', { class: 'needsJudgment', reason: 'modelUnavailable' } satisfies Verdict],
  ])('en el primer fallo, relanza sea cual sea el veredicto: %s', (_, verdict) => {
    expect(decide('firstFailure', firstTriage(verdict))).toEqual({ action: 'rerun', rule: 'firstFailure' });
  });

  it('en el primer fallo de las dos, también relanza', () => {
    expect(
      decide('firstFailure', firstTriage(probability('valid', 0.93), probability('notApplicable', 0.12))),
    ).toEqual({ action: 'rerun', rule: 'firstFailure' });
  });

  it('en la ronda final, publica el resumen y avisa del estado final', () => {
    expect(decide('final', [])).toEqual({ action: 'publish', rule: 'finalState' });
  });
});
