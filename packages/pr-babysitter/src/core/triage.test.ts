import { describe, expect, it } from 'vitest';

import {
  classify,
  type Finding,
  findingKeys,
  hasContext,
  spend,
  type TriageBudget,
  withinBudget,
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

  it('4 · descartar uno de severidad alta exige criterio, también en el borde de 0,20', () => {
    for (const probability of [0.03, 0.2]) {
      expect(classify(p1, { kind: 'answered', probability }, THRESHOLD)).toEqual({
        class: 'needsJudgment',
        reason: 'highSeverity',
        probability,
      });
    }
  });

  it('5 · con 0,80 o más es real, también si es de severidad alta', () => {
    for (const finding of [reviewerFinding(), p1, checkFinding('e2e')]) {
      for (const probability of [0.8, 0.93]) {
        expect(classify(finding, { kind: 'answered', probability }, THRESHOLD)).toEqual({
          class: 'valid',
          reason: 'probability',
          probability,
        });
      }
    }
  });

  it('6 · con 0,20 o menos no aplica, si no es de severidad alta', () => {
    for (const finding of [reviewerFinding(), checkFinding('e2e')]) {
      for (const probability of [0.2, 0.07]) {
        expect(classify(finding, { kind: 'answered', probability }, THRESHOLD)).toEqual({
          class: 'notApplicable',
          reason: 'probability',
          probability,
        });
      }
    }
  });

  it('7 · entre los dos exige criterio, por la probabilidad', () => {
    for (const probability of [0.21, 0.55, 0.79]) {
      expect(classify(reviewerFinding(), { kind: 'answered', probability }, THRESHOLD)).toEqual({
        class: 'needsJudgment',
        reason: 'probability',
        probability,
      });
    }
  });

  it('el umbral es configurable, y el corte bajo es su complemento', () => {
    const answered = (probability: number) => ({ kind: 'answered', probability }) as const;

    expect(classify(reviewerFinding(), answered(0.7), 0.7).class).toBe('valid');
    expect(classify(reviewerFinding(), answered(0.3), 0.7).class).toBe('notApplicable');
    expect(classify(reviewerFinding(), answered(0.31), 0.7).class).toBe('needsJudgment');
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

describe('el reparto del tope de gasto (design.md, decisión 6)', () => {
  /** 1 $ por millón de tokens: 1 token cuesta 0,000001 $, y el tope son 1.000 tokens. */
  const budget: TriageBudget = { capUsd: 0.001, inputPricePerMTok: 1 };
  const lint = checkFinding('lint');
  const e2e = checkFinding('e2e');
  const test = checkFinding('test');
  const typecheck = checkFinding('typecheck');
  const small = checkFinding('small');
  /** Lo que estimaría el modelo: 100 tokens por la PR, 300 por cada hallazgo y 10 por `small`. */
  const estimates: Finding[][] = [];
  const estimate = (some: Finding[]) => {
    estimates.push(some);
    return 100 + some.reduce((tokens, finding) => tokens + (finding === small ? 10 : 300), 0);
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

  it('cada hallazgo se estima junto con los que ya han entrado, en una sola cuenta', () => {
    estimates.length = 0;

    withinBudget([lint, e2e, test], 0.0004, budget, estimate);

    expect(estimates).toEqual([[lint], [lint, e2e], [lint, test]]);
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
