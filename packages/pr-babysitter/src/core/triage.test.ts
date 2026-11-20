import { describe, expect, it } from 'vitest';

import {
  classify,
  type Finding,
  findingKeys,
  hasContext,
  latestRound,
  questionFor,
  type RoundAnswer,
  spend,
  type TriageBudget,
  withinBudget,
  withoutModel,
} from './triage.ts';

const THRESHOLD = 0.8;

/** Un comentario del revisor con su contexto, de severidad normal. */
function reviewerFinding(overrides: Partial<Extract<Finding, { source: 'reviewer' }>> = {}): Finding {
  return {
    source: 'reviewer',
    reviewer: 'Codex',
    badge: 'P2',
    severity: 'normal',
    file: 'packages/pr-babysitter/src/core/tracking.ts',
    line: 109,
    title: 'Route failed checks directly to the final state',
    text: 'When a check fails the graph still waits for the reviewer.',
    diffHunk: '@@ -100,6 +100,9 @@ export function finalState(',
    ...overrides,
  };
}

/** Una comprobación que falla, con el paso que falla de su log por contexto, si no se dice otro. */
function checkFinding(
  name: string,
  context: Extract<Finding, { source: 'check' }>['context'] = {
    state: 'available',
    origin: 'log',
    summary: 'Error: 1 test failed',
    errors: [],
    truncated: false,
  },
): Finding {
  return { source: 'check', name, conclusion: 'failure', context };
}

const p1 = reviewerFinding({ badge: 'P1', severity: 'high' });

describe('la clase de un hallazgo (design.md, decisión 4)', () => {
  it('1 · sin contexto exige criterio, sin probabilidad', () => {
    expect(classify(p1, { kind: 'noContext' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'noContext',
    });
  });

  it('2 · fuera del tope de gasto exige criterio', () => {
    expect(classify(p1, { kind: 'overBudget' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'overBudget',
    });
  });

  it('3 · sin respuesta del modelo exige criterio', () => {
    expect(classify(p1, { kind: 'modelUnavailable' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'modelUnavailable',
    });
  });

  it('4 · con 0,80 o más de que la causa la PR es real', () => {
    for (const probability of [0.8, 0.93]) {
      expect(classify(checkFinding('e2e'), { kind: 'answered', probability }, THRESHOLD)).toEqual({
        class: 'valid',
        reason: 'probability',
        probability,
      });
    }
  });

  it('5 · con 0,20 o menos no aplica', () => {
    for (const probability of [0.2, 0.07]) {
      expect(classify(checkFinding('e2e'), { kind: 'answered', probability }, THRESHOLD)).toEqual({
        class: 'notApplicable',
        reason: 'probability',
        probability,
      });
    }
  });

  it('6 · entre los dos exige criterio, por la probabilidad', () => {
    for (const probability of [0.21, 0.55, 0.79]) {
      expect(classify(checkFinding('e2e'), { kind: 'answered', probability }, THRESHOLD)).toEqual({
        class: 'needsJudgment',
        reason: 'probability',
        probability,
      });
    }
  });

  it('el umbral es configurable, y el corte bajo es su complemento', () => {
    const answered = (probability: number) => ({ kind: 'answered', probability }) as const;

    expect(classify(checkFinding('e2e'), answered(0.7), 0.7).class).toBe('valid');
    expect(classify(checkFinding('e2e'), answered(0.3), 0.7).class).toBe('notApplicable');
    expect(classify(checkFinding('e2e'), answered(0.31), 0.7).class).toBe('needsJudgment');
  });
});

describe('la clase de un hallazgo del revisor, por el alcance de la PR (change pr-reviewer-scope, decisión 1)', () => {
  const scope = (inside: number, outside: number) => ({ kind: 'scope', inside, outside }) as const;

  it('P1 llega y P2 no: real, con las dos probabilidades', () => {
    expect(classify(reviewerFinding(), scope(0.91, 0.11), THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'inScope',
      inside: 0.91,
      outside: 0.11,
    });
  });

  it('P2 llega y P1 no: no aplica, porque es trabajo de otra tarea', () => {
    expect(classify(reviewerFinding(), scope(0.12, 0.85), THRESHOLD)).toEqual({
      class: 'notApplicable',
      reason: 'outOfScope',
      inside: 0.12,
      outside: 0.85,
    });
  });

  it('no llega ninguna: exige criterio', () => {
    expect(classify(reviewerFinding(), scope(0.58, 0.32), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'unclearScope',
      inside: 0.58,
      outside: 0.32,
    });
  });

  it('llegan las dos: exige criterio, porque se contradicen', () => {
    expect(classify(reviewerFinding(), scope(0.85, 0.82), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'contradictoryScope',
      inside: 0.85,
      outside: 0.82,
    });
  });

  it('un P1 que llega por P2 exige criterio por la regla de severidad alta, con las dos probabilidades', () => {
    expect(classify(p1, scope(0.1, 0.9), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'highSeverity',
      inside: 0.1,
      outside: 0.9,
    });
  });

  it('un P1 que llega por P1 es real', () => {
    expect(classify(p1, scope(0.93, 0.07), THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'inScope',
      inside: 0.93,
      outside: 0.07,
    });
  });

  it('los extremos de 0,80 cuentan dentro de su caso', () => {
    expect(classify(reviewerFinding(), scope(0.8, 0.79), THRESHOLD).class).toBe('valid');
    expect(classify(reviewerFinding(), scope(0.79, 0.8), THRESHOLD).class).toBe('notApplicable');
    expect(classify(reviewerFinding(), scope(0.8, 0.8), THRESHOLD)).toMatchObject({
      reason: 'contradictoryScope',
    });
    expect(classify(reviewerFinding(), scope(0.79, 0.79), THRESHOLD)).toMatchObject({
      reason: 'unclearScope',
    });
  });

  it('el umbral es configurable', () => {
    expect(classify(reviewerFinding(), scope(0.7, 0.2), 0.7).class).toBe('valid');
    expect(classify(reviewerFinding(), scope(0.2, 0.7), 0.7).class).toBe('notApplicable');
  });
});

describe('si un hallazgo tiene contexto (change pr-check-triage, decisión 1)', () => {
  it('un comentario del revisor, con el trozo de diff que comenta', () => {
    expect(hasContext(reviewerFinding())).toBe(true);
    expect(hasContext(reviewerFinding({ diffHunk: null }))).toBe(false);
  });

  it('una comprobación, con un contexto que dar al modelo', () => {
    expect(hasContext(checkFinding('e2e'))).toBe(true);
    expect(hasContext(checkFinding('e2e', { state: 'notProvided' }))).toBe(false);
    expect(hasContext(checkFinding('e2e', { state: 'unreadable' }))).toBe(false);
  });
});

describe('el reparto del tope de gasto (change pr-check-triage, decisión 5)', () => {
  /** 1 $ por millón de tokens: 1 token cuesta 0,000001 $, y el tope son 1.000 tokens. */
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const lint = checkFinding('lint');
  const e2e = checkFinding('e2e');
  const test = checkFinding('test');
  const typecheck = checkFinding('typecheck');
  const small = checkFinding('small');
  /** Lo que estimaría el modelo de cada petición: 100 tokens por la PR, y 300 por el hallazgo o 10 por `small`. */
  const estimates: Finding[] = [];
  const estimate = (finding: Finding) => {
    estimates.push(finding);
    return 100 + (finding === small ? 10 : 300);
  };

  it('con sitio para todos, se pregunta por todos', () => {
    expect(withinBudget([lint, e2e], 0, budget, estimate)).toEqual({
      asked: [lint, e2e],
      overBudget: [],
    });
  });

  it('entran por orden los que caben en lo que queda del tope, y los demás se quedan fuera', () => {
    expect(withinBudget([lint, e2e, test, typecheck], 0.0005, budget, estimate)).toEqual({
      asked: [lint],
      overBudget: [e2e, test, typecheck],
    });
  });

  it('uno pequeño que cabe entra aunque otro anterior no quepa', () => {
    expect(withinBudget([e2e, small], 0.0008, budget, estimate)).toEqual({
      asked: [small],
      overBudget: [e2e],
    });
  });

  it('cada hallazgo se estima por separado, con su petición entera, y las estimaciones se suman', () => {
    estimates.length = 0;

    // Quedan 600 tokens: entra una petición de 400, y la PR se cuenta otra vez en la siguiente.
    expect(withinBudget([lint, e2e, test], 0.0004, budget, estimate)).toEqual({
      asked: [lint],
      overBudget: [e2e, test],
    });
    expect(estimates).toEqual([lint, e2e, test]);
  });

  it('con el tope ya gastado, no entra ninguno', () => {
    expect(withinBudget([small], 0.001, budget, estimate)).toEqual({
      asked: [],
      overBudget: [small],
    });
  });

  it('el coste real sale de los tokens de entrada cobrados y se suma al gasto de la PR', () => {
    expect(spend(0.01, 12_000, { capUsd: 0.05, inputPricePerMTok: 0.24 })).toBeCloseTo(0.01288, 10);
  });
});

describe('lo que se decide sin el modelo (change pr-check-triage, decisión 6)', () => {
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const RULE_CHECKS = ['lint', 'typecheck', 'SonarCloud Code Analysis'];
  const estimated: Finding[] = [];
  /** 400 tokens por petición: con el tope de 1.000, caben dos. */
  const estimate = (finding: Finding) => {
    estimated.push(finding);
    return 400;
  };
  const decide = (
    findings: Finding[],
    spentUsd = 0,
    ruleChecks = RULE_CHECKS,
    description = 'Pregunta por el alcance de la PR los hallazgos del revisor.',
  ) => withoutModel(findings, { ruleChecks, description, spentUsd, budget, estimate });

  it('una comprobación de la lista sale real por regla, sin probabilidad', () => {
    const lint = checkFinding('lint');

    expect(decide([lint])).toEqual([{ kind: 'rule' }]);
    expect(classify(lint, { kind: 'rule' }, THRESHOLD)).toEqual({ class: 'valid', reason: 'rule' });
  });

  it('la regla va antes que el contexto: sale real aunque no lo tenga', () => {
    expect(
      decide([
        checkFinding('typecheck', { state: 'unreadable' }),
        checkFinding('SonarCloud Code Analysis', { state: 'notProvided' }),
      ]),
    ).toEqual([{ kind: 'rule' }, { kind: 'rule' }]);
  });

  it('la regla va antes que el tope: sale real con el tope agotado, y no reserva nada', () => {
    estimated.length = 0;
    const lint = checkFinding('lint');
    const e2e = checkFinding('e2e');

    expect(decide([lint, e2e], 0.001)).toEqual([{ kind: 'rule' }, { kind: 'overBudget' }]);
    expect(estimated).toEqual([e2e]);
  });

  it('las demás: sin contexto, exige criterio; fuera del tope, también; y el resto va al modelo', () => {
    const noDiff = reviewerFinding({ diffHunk: null });
    const e2e = checkFinding('e2e');
    const test = checkFinding('test');
    const build = checkFinding('build');

    expect(decide([noDiff, e2e, test, build])).toEqual([
      { kind: 'noContext' },
      undefined,
      undefined,
      { kind: 'overBudget' },
    ]);
  });

  it('una comprobación que no está en la lista no la decide la regla', () => {
    expect(decide([checkFinding('lint')], 0, [])).toEqual([undefined]);
    expect(decide([checkFinding('Lint')])).toEqual([undefined]);
  });

  it('un comentario del revisor nunca lo decide la regla, aunque su título sea el de una comprobación', () => {
    expect(decide([reviewerFinding({ title: 'lint' })])).toEqual([undefined]);
  });
});

describe('una PR sin descripción no dice su alcance (change pr-reviewer-scope, decisión 4)', () => {
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const estimated: Finding[] = [];
  /** 400 tokens por petición: con el tope de 1.000, caben dos. */
  const estimate = (finding: Finding) => {
    estimated.push(finding);
    return 400;
  };
  const decide = (findings: Finding[], description: string) =>
    withoutModel(findings, { ruleChecks: ['lint'], description, spentUsd: 0, budget, estimate });

  it('con la descripción vacía o solo con espacios, un comentario del revisor sale noScope, sin reservar tope', () => {
    for (const description of ['', '  \n\t ']) {
      estimated.length = 0;
      const reviewer = reviewerFinding();
      const e2e = checkFinding('e2e');

      expect(decide([reviewer, e2e, checkFinding('lint')], description)).toEqual([
        { kind: 'noScope' },
        undefined,
        { kind: 'rule' },
      ]);
      expect(estimated).toEqual([e2e]);
    }
  });

  it('noScope va antes que noContext', () => {
    expect(decide([reviewerFinding({ diffHunk: null })], '')).toEqual([{ kind: 'noScope' }]);
  });

  it('las comprobaciones no la necesitan: sin contexto, siguen como siempre', () => {
    expect(decide([checkFinding('e2e', { state: 'unreadable' })], '')).toEqual([{ kind: 'noContext' }]);
  });

  it('sin ninguna pregunta, exige criterio con su motivo', () => {
    expect(classify(reviewerFinding(), { kind: 'noScope' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'noScope',
    });
  });

  it('con una descripción escueta, se pregunta al modelo', () => {
    expect(decide([reviewerFinding()], 'Arregla el aviso.')).toEqual([undefined]);
  });
});

describe('la pregunta depende de la fuente del hallazgo (change pr-check-triage, decisión 3)', () => {
  it('por una comprobación, si la causa esta PR', () => {
    expect(questionFor(checkFinding('e2e'))).toBe('cause');
  });

  it('por un comentario del revisor, por el alcance de la PR (change pr-reviewer-scope, decisión 2)', () => {
    expect(questionFor(reviewerFinding())).toBe('scope');
  });
});

describe('las respuestas de un triaje (change pr-check-triage, decisión 4)', () => {
  const answer = (round: number, index: number): RoundAnswer => ({
    round,
    index,
    answer: { kind: 'answered', probability: 0.9 },
    inputTokens: 100,
  });

  it('las de la misma ronda se juntan, en el orden en que llegan', () => {
    expect(latestRound([answer(1, 0)], [answer(1, 2)])).toEqual([answer(1, 0), answer(1, 2)]);
  });

  it('el reductor se queda solo con las de la ronda más alta', () => {
    expect(latestRound([answer(1, 0), answer(1, 1)], [answer(2, 0)])).toEqual([answer(2, 0)]);
  });

  it('una respuesta que llega tarde de una ronda anterior no entra', () => {
    expect(latestRound([answer(2, 0)], [answer(1, 1)])).toEqual([answer(2, 0)]);
  });

  it('sin respuestas, no hay nada', () => {
    expect(latestRound([], [])).toEqual([]);
  });
});

describe('la clave de cada hallazgo (design.md, decisión 2)', () => {
  it('nombra el hallazgo por su identidad', () => {
    const findings = [
      reviewerFinding({ badge: 'P1', file: 'packages/pr-babysitter/src/core/graph.ts', line: 204 }),
      checkFinding('e2e'),
    ];

    expect(findingKeys(findings)).toEqual(['codex_p1_graph_ts_204', 'check_e2e']);
  });

  it('solo lleva letras y números ASCII y guiones bajos', () => {
    const [key] = findingKeys([checkFinding('Incidencias nuevas de SonarQube (ñ)')]);

    expect(key).toMatch(/^[a-z0-9_]+$/);
  });

  it('tiene como mucho 100 caracteres', () => {
    const [key] = findingKeys([checkFinding('x'.repeat(300))]);

    expect(key?.length).toBeLessThanOrEqual(100);
  });

  it('es distinta para dos hallazgos del mismo fichero y línea, también cortada', () => {
    const twice = [reviewerFinding(), reviewerFinding({ title: 'Otro' })];
    const long = [checkFinding('x'.repeat(300)), checkFinding('x'.repeat(301))];

    for (const findings of [twice, long]) {
      const keys = findingKeys(findings);
      expect(new Set(keys).size).toBe(findings.length);
      for (const key of keys) expect(key.length).toBeLessThanOrEqual(100);
    }
  });
});
