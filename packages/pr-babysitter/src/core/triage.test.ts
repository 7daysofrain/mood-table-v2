import { describe, expect, it } from 'vitest';

import {
  type CheckFinding,
  classify,
  evidentCase,
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
    earlierPush: null,
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

/** Una incidencia de SonarQube con su código, de severidad normal. */
function sonarIssue(overrides: Partial<Extract<Finding, { source: 'sonarIssue' }>> = {}): Finding {
  return {
    source: 'sonarIssue',
    rule: 'typescript:S9382',
    ruleName: 'Promises should not be awaited sequentially in a loop',
    severity: 'normal',
    file: 'tooling/ci/check-sonar-issues.ts',
    line: 58,
    message: 'Unexpected `await` inside a loop.',
    code: '>>   58 |       await sleep(POLL_INTERVAL_MS, undefined, { signal });',
    ...overrides,
  };
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
  ) =>
    withoutModel(findings, {
      ruleChecks,
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks: [],
      description,
      spentUsd,
      budget,
      estimate,
    });

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
    withoutModel(findings, {
      ruleChecks: ['lint'],
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks: [],
      description,
      spentUsd: 0,
      budget,
      estimate,
    });

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

describe('un comentario de un push anterior (change pr-unresolved-threads, decisiones 3 y 4)', () => {
  const earlier = (overrides: Partial<Extract<Finding, { source: 'reviewer' }>> = {}) =>
    reviewerFinding({
      earlierPush: { sha: '576b49636780068462fa4984e34a7c39902eba8a', code: '>>  109 |   return x;' },
      ...overrides,
    });
  const earlierP1 = earlier({ badge: 'P1', severity: 'high' });
  const noCode = earlier({ earlierPush: { sha: '576b496', code: null } });
  const answer = (fixed: number, inside: number, outside: number) =>
    ({ kind: 'fixedScope', fixed, inside, outside }) as const;

  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const estimated: Finding[] = [];
  const decide = (findings: Finding[], description = 'Arregla el aviso.') =>
    withoutModel(findings, {
      ruleChecks: ['lint'],
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks: [],
      description,
      spentUsd: 0,
      budget,
      estimate: (finding) => {
        estimated.push(finding);
        return 400;
      },
    });

  it('se le pregunta si el último push ya lo arregla, además del alcance', () => {
    expect(questionFor(earlier())).toBe('fixedScope');
  });

  it('a uno del último push solo se le pregunta por el alcance', () => {
    expect(questionFor(reviewerFinding())).toBe('scope');
  });

  it('sin el código del último push, exige criterio sin preguntar ni reservar tope', () => {
    estimated.length = 0;
    const withCode = earlier();

    expect(decide([noCode, withCode])).toEqual([{ kind: 'noCurrentCode' }, undefined]);
    expect(estimated).toEqual([withCode]);
    expect(classify(noCode, { kind: 'noCurrentCode' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'noCurrentCode',
    });
  });

  it('noCurrentCode va después de noScope y de noContext', () => {
    expect(decide([noCode], '')).toEqual([{ kind: 'noScope' }]);
    expect(decide([earlier({ diffHunk: null, earlierPush: { sha: '576b496', code: null } })])).toEqual([
      { kind: 'noContext' },
    ]);
  });

  it('ya arreglado con 0,80 o más: no aplica, con las tres probabilidades', () => {
    expect(classify(earlier(), answer(0.91, 0.85, 0.1), THRESHOLD)).toEqual({
      class: 'notApplicable',
      reason: 'alreadyFixed',
      fixed: 0.91,
      inside: 0.85,
      outside: 0.1,
    });
    expect(classify(earlier(), answer(0.8, 0.85, 0.1), THRESHOLD)).toMatchObject({
      reason: 'alreadyFixed',
    });
  });

  it('un P1 ya arreglado exige criterio por la regla de severidad alta, con las tres probabilidades', () => {
    expect(classify(earlierP1, answer(0.93, 0.2, 0.1), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'highSeverity',
      fixed: 0.93,
      inside: 0.2,
      outside: 0.1,
    });
  });

  it.each([
    ['solo llega P1: real', answer(0.4, 0.91, 0.11), 'valid', 'inScope'],
    ['solo llega P2: no aplica', answer(0.4, 0.12, 0.85), 'notApplicable', 'outOfScope'],
    ['no llega ninguna: exige criterio', answer(0.4, 0.58, 0.32), 'needsJudgment', 'unclearScope'],
    ['llegan las dos: exige criterio', answer(0.4, 0.85, 0.82), 'needsJudgment', 'contradictoryScope'],
  ] as const)('sin llegar ya arreglado, el alcance como siempre · %s', (_, given, klass, reason) => {
    expect(classify(earlier(), given, THRESHOLD)).toEqual({
      class: klass,
      reason,
      fixed: 0.4,
      inside: given.inside,
      outside: given.outside,
    });
  });

  it('sin llegar ya arreglado, un P1 que llega por P2 exige criterio por la regla de severidad alta', () => {
    expect(classify(earlierP1, answer(0.79, 0.1, 0.9), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'highSeverity',
      fixed: 0.79,
      inside: 0.1,
      outside: 0.9,
    });
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

describe('una incidencia de SonarQube (change pr-sonar-issue-triage, decisiones 3 y 5)', () => {
  const answered = (probability: number) => ({ kind: 'answered', probability }) as const;
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const estimated: Finding[] = [];
  const decide = (findings: Finding[], ruleChecks = ['lint']) =>
    withoutModel(findings, {
      ruleChecks,
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks: [],
      description: 'Tría cada incidencia de SonarQube.',
      spentUsd: 0,
      budget,
      estimate: (finding) => {
        estimated.push(finding);
        return 400;
      },
    });

  it('se le pregunta si su regla se cumple en ese código', () => {
    expect(questionFor(sonarIssue())).toBe('rule');
  });

  it('real con 0,80 o más, no aplica con 0,20 o menos y exige criterio entre los dos', () => {
    expect(classify(sonarIssue(), answered(0.85), THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'probability',
      probability: 0.85,
    });
    expect(classify(sonarIssue(), answered(0.1), THRESHOLD)).toEqual({
      class: 'notApplicable',
      reason: 'probability',
      probability: 0.1,
    });
    expect(classify(sonarIssue(), answered(0.5), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'probability',
      probability: 0.5,
    });
  });

  it('una de severidad alta que saldría no aplica exige criterio por esa regla, con la probabilidad', () => {
    expect(classify(sonarIssue({ severity: 'high' }), answered(0.1), THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'highSeverity',
      probability: 0.1,
    });
  });

  it('una de severidad alta que se cumple es real, y en medio exige criterio por la probabilidad', () => {
    const high = sonarIssue({ severity: 'high' });

    expect(classify(high, answered(0.9), THRESHOLD)).toMatchObject({ class: 'valid' });
    expect(classify(high, answered(0.5), THRESHOLD)).toMatchObject({
      class: 'needsJudgment',
      reason: 'probability',
    });
  });

  it('tiene contexto si se ha podido leer su código', () => {
    expect(hasContext(sonarIssue())).toBe(true);
    expect(hasContext(sonarIssue({ code: null }))).toBe(false);
  });

  it('sin código, exige criterio sin preguntar ni reservar tope', () => {
    estimated.length = 0;
    const withCode = sonarIssue();

    expect(decide([sonarIssue({ code: null }), withCode])).toEqual([{ kind: 'noContext' }, undefined]);
    expect(estimated).toEqual([withCode]);
  });

  it('la comprobación de incidencias sin ninguna legible exige criterio, sin preguntar ni reservar tope', () => {
    estimated.length = 0;

    expect(
      decide([checkFinding('sonar-issues'), checkFinding('sonar-issues', { state: 'unreadable' })]),
    ).toEqual([{ kind: 'noIssues' }, { kind: 'noIssues' }]);
    expect(estimated).toEqual([]);
    expect(classify(checkFinding('sonar-issues'), { kind: 'noIssues' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'noIssues',
    });
  });

  it('noIssues va después de la regla', () => {
    expect(decide([checkFinding('sonar-issues')], ['sonar-issues'])).toEqual([{ kind: 'rule' }]);
  });

  it('otra comprobación no es la de incidencias', () => {
    expect(decide([checkFinding('e2e')])).toEqual([undefined]);
  });

  it('su clave la nombra por su regla, su fichero y su línea', () => {
    expect(findingKeys([sonarIssue(), sonarIssue({ line: null })])).toEqual([
      'sonar_typescript_s9382_check_sonar_issues_ts_58',
      'sonar_typescript_s9382_check_sonar_issues_ts',
    ]);
  });
});

describe('una comprobación relanzable, tras el relanzamiento (change pr-check-rerun, decisiones 1, 6 y 7)', () => {
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const estimated: Finding[] = [];
  const decide = (findings: Finding[], spentUsd = 0, rerunChecks = ['test', 'e2e']) =>
    withoutModel(findings, {
      ruleChecks: ['lint'],
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks,
      description: 'Relanza una vez test y e2e.',
      spentUsd,
      budget,
      estimate: (finding) => {
        estimated.push(finding);
        return 400;
      },
    });
  /** Una relanzable que falla, en el intento que se diga, con el error de una aserción. */
  const rerunnable = (
    name: string,
    attempt: number | undefined,
    overrides: Partial<Extract<Finding, { source: 'check' }>> = {},
  ): Finding => ({ ...(checkFinding(name) as CheckFinding), attempt, ...overrides });

  it('una relanzable que ha fallado dos veces sale real por la regla nueva, que lo registra', () => {
    const e2e = rerunnable('e2e', 2);

    expect(decide([e2e])).toEqual([{ kind: 'failedTwice', evidentCase: null }]);
    expect(classify(e2e, { kind: 'failedTwice', evidentCase: null }, THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'failedTwice',
      evidentCase: null,
    });
  });

  it('cuenta el intento de GitHub: también relanzada a mano, y en un intento posterior', () => {
    expect(decide([rerunnable('test', 2), rerunnable('test', 3)])).toEqual([
      { kind: 'failedTwice', evidentCase: null },
      { kind: 'failedTwice', evidentCase: null },
    ]);
  });

  it('va antes que la regla de sin contexto y que el tope, y no reserva nada', () => {
    estimated.length = 0;
    const unreadable = rerunnable('e2e', 2, { context: { state: 'unreadable' } });

    expect(decide([unreadable, rerunnable('test', 2)], 0.001)).toEqual([
      { kind: 'failedTwice', evidentCase: null },
      { kind: 'failedTwice', evidentCase: null },
    ]);
    expect(estimated).toEqual([]);
  });

  it('registra el caso evidente del error del último intento', () => {
    const timedOut = rerunnable('e2e', 2, { conclusion: 'timed_out' });

    expect(decide([timedOut])).toEqual([{ kind: 'failedTwice', evidentCase: 'timeout' }]);
    expect(classify(timedOut, { kind: 'failedTwice', evidentCase: 'timeout' }, THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'failedTwice',
      evidentCase: 'timeout',
    });
  });

  it('sin resultado tras relanzarla exige criterio, con su motivo y sin reservar tope', () => {
    estimated.length = 0;
    const findings = [
      // Sigue en su primer intento: GitHub no dejó relanzarla, o la petición no llegó a tiempo.
      rerunnable('e2e', 1),
      // Sin intento: no se ha podido leer su *job*, así que no se ha relanzado.
      rerunnable('test', undefined),
      rerunnable('e2e', undefined, { conclusion: null, context: { state: 'notProvided' }, unfinished: true }),
      rerunnable('test', 1, { conclusion: 'cancelled' }),
      rerunnable('e2e', 2, { conclusion: 'cancelled' }),
    ];

    expect(decide(findings)).toEqual([
      { kind: 'notRerun' },
      { kind: 'notRerun' },
      { kind: 'rerunUnfinished' },
      { kind: 'cancelled' },
      { kind: 'cancelled' },
    ]);
    expect(estimated).toEqual([]);
    for (const reason of ['notRerun', 'rerunUnfinished', 'cancelled'] as const) {
      expect(classify(findings[0]!, { kind: reason }, THRESHOLD)).toEqual({
        class: 'needsJudgment',
        reason,
      });
    }
  });

  it('ninguna relanzable llega al modelo; las demás comprobaciones siguen con la pregunta de la causa', () => {
    const build = checkFinding('build');

    expect(decide([rerunnable('test', 1), rerunnable('e2e', 2), build])).toEqual([
      { kind: 'notRerun' },
      { kind: 'failedTwice', evidentCase: null },
      undefined,
    ]);
    expect(questionFor(build)).toBe('cause');
  });

  it('con la lista de relanzables vacía, test y e2e van al modelo como antes', () => {
    expect(decide([rerunnable('test', 2), rerunnable('e2e', 1)], 0, [])).toEqual([
      undefined,
      undefined,
    ]);
  });

  it('una determinista sigue saliendo por su regla, aunque también sea relanzable', () => {
    expect(decide([rerunnable('lint', 2)], 0, ['lint'])).toEqual([{ kind: 'rule' }]);
  });

  it('en la ronda final, explícita, las reglas del relanzamiento siguen como antes', () => {
    const findings = [
      rerunnable('e2e', 2),
      rerunnable('test', 1),
      rerunnable('e2e', undefined, { conclusion: null, context: { state: 'notProvided' }, unfinished: true }),
      rerunnable('test', 1, { conclusion: 'cancelled' }),
    ];

    expect(
      withoutModel(findings, {
        ruleChecks: ['lint'],
        sonarIssuesCheck: 'sonar-issues',
        rerunChecks: ['test', 'e2e'],
        description: 'Relanza una vez test y e2e.',
        spentUsd: 0,
        budget,
        estimate: () => 400,
        round: 'final',
      }),
    ).toEqual([
      { kind: 'failedTwice', evidentCase: null },
      { kind: 'notRerun' },
      { kind: 'rerunUnfinished' },
      { kind: 'cancelled' },
    ]);
  });
});

describe('el primer fallo de una relanzable (change pr-first-failure-triage, decisión 3)', () => {
  const estimated: Finding[] = [];
  /** El triaje de la ronda del primer fallo, con 400 tokens por pregunta. */
  const firstFailure = (findings: Finding[], spentUsd = 0, capUsd = 0.001) =>
    withoutModel(findings, {
      ruleChecks: ['lint'],
      sonarIssuesCheck: 'sonar-issues',
      rerunChecks: ['test', 'e2e'],
      description: 'Pregunta por la causa antes de relanzar.',
      spentUsd,
      budget: { capUsd, inputPricePerMTok: 1 },
      estimate: (finding) => {
        estimated.push(finding);
        return 400;
      },
      round: 'firstFailure',
    });
  /** Una relanzable que falla en su primer intento, con el error de una aserción. */
  const atFirst = (name: string, overrides: Partial<CheckFinding> = {}): CheckFinding => ({
    ...(checkFinding(name) as CheckFinding),
    attempt: 1,
    ...overrides,
  });

  it('va al modelo con la pregunta de la causa', () => {
    const e2e = atFirst('e2e');

    expect(firstFailure([e2e])).toEqual([undefined]);
    expect(questionFor(e2e)).toBe('cause');
  });

  it('un caso evidente sale con su caso, sin preguntar ni reservar tope', () => {
    estimated.length = 0;
    const timedOut = atFirst('test', { conclusion: 'timed_out' });

    expect(firstFailure([timedOut])).toEqual([{ kind: 'evident', evidentCase: 'timeout' }]);
    expect(estimated).toEqual([]);
    expect(classify(timedOut, { kind: 'evident', evidentCase: 'timeout' }, THRESHOLD)).toEqual({
      class: 'needsJudgment',
      reason: 'evident',
      evidentCase: 'timeout',
    });
  });

  it('el caso evidente va antes que la regla de sin contexto', () => {
    const timedOut = atFirst('test', { conclusion: 'timed_out', context: { state: 'unreadable' } });

    expect(firstFailure([timedOut])).toEqual([{ kind: 'evident', evidentCase: 'timeout' }]);
  });

  it('sin contexto, noContext, sin reservar tope', () => {
    estimated.length = 0;

    expect(firstFailure([atFirst('e2e', { context: { state: 'unreadable' } })])).toEqual([
      { kind: 'noContext' },
    ]);
    expect(estimated).toEqual([]);
  });

  it('fuera del tope, overBudget; reservan solo las que se preguntan', () => {
    estimated.length = 0;
    const test = atFirst('test');
    const e2e = atFirst('e2e');

    // Quedan 0,0006 $: caben 600 tokens, una pregunta de 400 y no dos.
    expect(firstFailure([test, e2e], 0.0004)).toEqual([undefined, { kind: 'overBudget' }]);
    expect(estimated).toEqual([test, e2e]);
  });

  it('con el tope ya agotado, ninguna llega al modelo', () => {
    expect(firstFailure([atFirst('test')], 0.001)).toEqual([{ kind: 'overBudget' }]);
  });

  it('una respuesta se clasifica por la probabilidad, como cualquier otra', () => {
    const e2e = atFirst('e2e');

    expect(classify(e2e, { kind: 'answered', probability: 0.12 }, THRESHOLD)).toEqual({
      class: 'notApplicable',
      reason: 'probability',
      probability: 0.12,
    });
    expect(classify(e2e, { kind: 'answered', probability: 0.93 }, THRESHOLD)).toEqual({
      class: 'valid',
      reason: 'probability',
      probability: 0.93,
    });
  });
});

describe('el caso evidente del error del último intento (change pr-check-rerun, decisión 6)', () => {
  /** Una comprobación que falla con este texto en su contexto, del origen que se diga. */
  const failing = (
    summary: string,
    origin: 'annotations' | 'log' | 'appSummary' = 'log',
    conclusion = 'failure',
  ) =>
    ({
      source: 'check',
      name: 'e2e',
      conclusion,
      attempt: 2,
      context: { state: 'available', origin, summary, errors: [], truncated: false },
    }) satisfies Finding;
  /** Con el error en una anotación, como lo publican Playwright y Vitest. */
  const annotated = (message: string) =>
    ({
      ...failing('', 'annotations'),
      context: {
        state: 'available',
        origin: 'annotations',
        summary: '',
        errors: [{ file: 'e2e/effects.spec.ts', line: 81, title: null, message }],
        truncated: false,
      },
    }) satisfies Finding;

  it('timeout: la conclusión timed_out, aunque no se pueda leer su contexto', () => {
    expect(evidentCase({ ...failing('', 'log', 'timed_out'), context: { state: 'unreadable' } })).toBe(
      'timeout',
    );
  });

  it.each([
    ['Playwright', 'Test timeout of 30000ms exceeded.'],
    ['Playwright, en una espera', 'Error: page.waitForSelector: Timeout 5000ms exceeded.'],
    ['Vitest', 'Error: Test timed out in 5000ms.'],
  ])('timeout: el mensaje de %s', (_, message) => {
    expect(evidentCase(annotated(message))).toBe('timeout');
  });

  it.each([
    'pnpm install --frozen-lockfile',
    'pnpm --filter @moodtable/e2e exec playwright install --with-deps chromium',
    'actions/checkout@v7',
    'actions/setup-node@v7',
  ])('infraestructura: falla el paso «%s»', (step) => {
    expect(evidentCase(failing(`##[group]Run ${step}\n##[error]Process completed with exit code 1.`))).toBe(
      'infrastructure',
    );
  });

  it.each([
    'Error: read ECONNRESET',
    'Error: connect ETIMEDOUT 140.82.112.4:443',
    'Error: socket hang up',
    'ERR_PNPM_FETCH_502  GET https://registry.npmjs.org/vitest: 502 Bad Gateway',
    'HttpError: 503 Service Unavailable',
  ])('red: %s', (message) => {
    expect(evidentCase(annotated(message))).toBe('network');
  });

  it.each([
    'The runner has received a shutdown signal. This can happen when the runner service is stopped, or a manually started runner is canceled.',
    'The self-hosted runner: moodtable-1 lost communication with the server.',
  ])('runner perdido: %s', (message) => {
    expect(evidentCase(failing(message))).toBe('runnerLost');
  });

  it('sin caso evidente: una aserción (el error real de la PR #112)', () => {
    expect(
      evidentCase(
        annotated(
          '  1) [chromium] › effects.spec.ts:81:1 › el DJ cambia el efecto de la tira desde el panel ──────────\n    Error: expect(received).toBeLessThan(expected)\n\n    Expected: < 100\n    Received:   104.7000000',
        ),
      ),
    ).toBeNull();
  });

  it('sin caso evidente: un paso de tests que falla, aunque lo prepare la infraestructura', () => {
    expect(evidentCase(failing('##[group]Run pnpm test:coverage\n FAIL  src/core/graph.test.ts'))).toBeNull();
  });

  it('sin contexto y sin timed_out, no hay caso evidente', () => {
    expect(evidentCase({ ...failing(''), context: { state: 'notProvided' } })).toBeNull();
  });
});
