import { describe, expect, it } from 'vitest';

import type { Check, PullRequestSnapshot } from './pull-request.ts';
import {
  afterChecksWait,
  afterReviewWait,
  checksFinished,
  type FinalState,
  finalState,
  type InterventionReason,
  needsReviewRequest,
  needsTriage,
  reviewFinished,
  type TrackedPush,
} from './tracking.ts';

const MINUTE = 60_000;
const TIMEOUT = 30 * MINUTE;
const HEAD = 'a1b2c3d';

const passed = (name: string): Check => ({ name, status: 'passed' });
const failed = (name: string): Check => ({ name, status: 'failed' });
const pending = (name: string): Check => ({ name, status: 'pending' });

/** Una PR con todas las comprobaciones superadas y revisada sin hallazgos en el último push. */
function snapshot(overrides: Partial<PullRequestSnapshot> = {}): PullRequestSnapshot {
  return {
    number: 74,
    title: 'Seguir cada PR hasta su estado final',
    url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
    author: '7daysofrain',
    baseBranch: 'main',
    draft: false,
    headSha: HEAD,
    labels: [],
    checks: [passed('lint'), passed('e2e')],
    review: { reviewedSha: HEAD, completed: true, hasFindings: false },
    reviewRequested: false,
    observedAt: 10 * MINUTE,
    ...overrides,
  };
}

/** El push que se sigue desde el minuto 0. */
const push: TrackedPush = { sha: HEAD, seenAt: 0 };
/** El mismo push, con sus comprobaciones pasadas en el minuto 5: la revisión se ha pedido. */
const checked: TrackedPush = { ...push, reviewSince: 5 * MINUTE };

describe('las comprobaciones', () => {
  it('han terminado cuando ninguna está pendiente, pasen o fallen', () => {
    expect(checksFinished(snapshot({ checks: [passed('lint'), failed('e2e')] }))).toBe(true);
  });

  it('no han terminado mientras alguna esté pendiente o sin empezar', () => {
    expect(checksFinished(snapshot({ checks: [passed('lint'), pending('e2e')] }))).toBe(false);
  });
});

describe('la revisión', () => {
  it('ha terminado si está completada sobre el último push', () => {
    expect(reviewFinished(snapshot())).toBe(true);
  });

  it('no ha terminado si está en marcha', () => {
    const review = { reviewedSha: HEAD, completed: false, hasFindings: false };
    expect(reviewFinished(snapshot({ review }))).toBe(false);
  });

  it('no ha terminado si revisó un push anterior', () => {
    const review = { reviewedSha: 'push-anterior', completed: true, hasFindings: false };
    expect(reviewFinished(snapshot({ review }))).toBe(false);
  });

  it('no ha terminado si no hay revisión o no se entiende', () => {
    expect(reviewFinished(snapshot({ review: null }))).toBe(false);
  });
});

describe('el estado final, con la revisión pedida', () => {
  it('lista para integrar si todo pasa y el revisor no tiene hallazgos', () => {
    expect(finalState(snapshot(), checked)).toEqual({ status: 'readyToMerge' });
  });

  it('necesita intervención si falla una comprobación, con cuál', () => {
    const checks = [passed('lint'), failed('e2e')];

    expect(finalState(snapshot({ checks }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['e2e'] }],
    });
  });

  it('necesita intervención si el revisor tiene hallazgos', () => {
    const review = { reviewedSha: HEAD, completed: true, hasFindings: true };

    expect(finalState(snapshot({ review }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewFindings' }],
    });
  });

  it('da todos los motivos a la vez', () => {
    const checks = [failed('lint'), failed('e2e')];
    const review = { reviewedSha: HEAD, completed: true, hasFindings: true };

    expect(finalState(snapshot({ checks, review }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['lint', 'e2e'] }, { kind: 'reviewFindings' }],
    });
  });

  it('con el tiempo agotado, dice qué comprobación no ha terminado', () => {
    const checks = [passed('lint'), pending('e2e')];
    const review = { reviewedSha: HEAD, completed: false, hasFindings: false };

    expect(finalState(snapshot({ checks, review }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }, { kind: 'reviewUnfinished' }],
    });
  });

  it('con el tiempo agotado y las comprobaciones terminadas, dice que la revisión no ha terminado', () => {
    const review = { reviewedSha: 'push-anterior', completed: true, hasFindings: false };

    expect(finalState(snapshot({ review }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewUnfinished' }],
    });
  });
});

describe('el estado final, sin la revisión pedida', () => {
  it('con una comprobación fallida, solo dice qué falla', () => {
    const checks = [passed('lint'), failed('e2e')];

    expect(finalState(snapshot({ checks, review: null }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['e2e'] }],
    });
  });

  it('con una comprobación fallida, dice también si el revisor ya terminó el último push con hallazgos', () => {
    const checks = [passed('lint'), failed('e2e')];
    const review = { reviewedSha: HEAD, completed: true, hasFindings: true };

    expect(finalState(snapshot({ checks, review }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['e2e'] }, { kind: 'reviewFindings' }],
    });
  });

  it('con una comprobación fallida, no cuenta una revisión en marcha o de un push anterior', () => {
    const checks = [passed('lint'), failed('e2e')];
    const running = { reviewedSha: HEAD, completed: false, hasFindings: false };
    const previous = { reviewedSha: 'push-anterior', completed: true, hasFindings: true };
    const failedOnly = {
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['e2e'] }],
    };

    expect(finalState(snapshot({ checks, review: running }), push)).toEqual(failedOnly);
    expect(finalState(snapshot({ checks, review: previous }), push)).toEqual(failedOnly);
  });

  it('con una comprobación sin terminar a tiempo, solo dice cuál', () => {
    const checks = [passed('lint'), pending('e2e')];

    expect(finalState(snapshot({ checks, review: null }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }],
    });
  });
});

describe('al reanudar la espera de las comprobaciones', () => {
  it('sigue esperando si no han terminado y no se ha agotado el tiempo', () => {
    const now = snapshot({ checks: [pending('e2e')], observedAt: 29 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT)).toEqual({ push, next: 'waiting' });
  });

  it('pasa a avisar cuando han terminado, y la revisión cuenta desde esta foto si pasan todas', () => {
    expect(afterChecksWait(push, snapshot(), TIMEOUT)).toEqual({
      push: { ...push, reviewSince: 10 * MINUTE },
      next: 'checksFinished',
    });
  });

  it('si alguna falla, pasa al estado final y la revisión no empieza a contar', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT)).toEqual({ push, next: 'checksFailed' });
  });

  it('se agota el tiempo a los 30 min desde la primera foto con ese SHA', () => {
    const now = snapshot({ checks: [pending('e2e')], observedAt: 30 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT)).toEqual({ push, next: 'timedOut' });
  });

  it('un SHA nuevo reinicia el tiempo desde la foto que lo trae', () => {
    const now = snapshot({ headSha: 'nuevo', checks: [pending('e2e')], observedAt: 40 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT)).toEqual({
      push: { sha: 'nuevo', seenAt: 40 * MINUTE },
      next: 'waiting',
    });
  });
});

describe('si hay que pedir la revisión', () => {
  const running = { reviewedSha: HEAD, completed: false, hasFindings: false };

  it('sí, con todas las comprobaciones pasadas y el revisor sin el último push', () => {
    expect(needsReviewRequest(snapshot({ review: null }))).toBe(true);
  });

  it('sí, si el revisor solo ha revisado un push anterior', () => {
    const review = { reviewedSha: 'push-anterior', completed: true, hasFindings: false };

    expect(needsReviewRequest(snapshot({ review }))).toBe(true);
  });

  it('no, si alguna comprobación falla', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')], review: null });

    expect(needsReviewRequest(now)).toBe(false);
  });

  it('no, mientras alguna comprobación no haya terminado', () => {
    const now = snapshot({ checks: [passed('lint'), pending('e2e')], review: null });

    expect(needsReviewRequest(now)).toBe(false);
  });

  it('no, si el revisor está revisando el último push', () => {
    expect(needsReviewRequest(snapshot({ review: running }))).toBe(false);
  });

  it('no, si el revisor ya ha revisado el último push', () => {
    expect(needsReviewRequest(snapshot())).toBe(false);
  });

  it('no, si el sistema ya la ha pedido para el último push', () => {
    expect(needsReviewRequest(snapshot({ review: null, reviewRequested: true }))).toBe(false);
  });
});

describe('al reanudar la espera del revisor', () => {
  const unreviewed = { reviewedSha: HEAD, completed: false, hasFindings: false };

  it('sigue esperando si no ha terminado y no se ha agotado el tiempo', () => {
    const now = snapshot({ review: unreviewed, observedAt: 29 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({ push, next: 'waiting' });
  });

  it('pasa al estado final cuando ha terminado', () => {
    expect(afterReviewWait(push, snapshot(), TIMEOUT)).toEqual({ push, next: 'finished' });
  });

  it('con la revisión terminada, sigue esperando si una comprobación vuelve a estar pendiente', () => {
    const now = snapshot({ checks: [passed('lint'), pending('e2e')], observedAt: 12 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({ push, next: 'waiting' });
  });

  it('con la revisión terminada y una comprobación pendiente, se agota el tiempo a los 30 min', () => {
    const now = snapshot({ checks: [passed('lint'), pending('e2e')], observedAt: 30 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({ push, next: 'timedOut' });
  });

  it('se agota el tiempo a los 30 min desde la primera foto con ese SHA', () => {
    const now = snapshot({ review: unreviewed, observedAt: 30 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({ push, next: 'timedOut' });
  });

  it('un SHA nuevo vuelve a esperar las comprobaciones, con el tiempo desde ese push', () => {
    const now = snapshot({ headSha: 'nuevo', review: null, observedAt: 12 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({
      push: { sha: 'nuevo', seenAt: 12 * MINUTE },
      next: 'newPush',
    });
  });

  it('una revisión de un push anterior no termina la espera', () => {
    const now = snapshot({
      headSha: 'nuevo',
      review: { reviewedSha: HEAD, completed: true, hasFindings: false },
      observedAt: 12 * MINUTE,
    });
    const newPush = { sha: 'nuevo', seenAt: 12 * MINUTE };

    expect(afterReviewWait(newPush, now, TIMEOUT)).toEqual({ push: newPush, next: 'waiting' });
  });
});

describe('el tiempo de espera de la revisión', () => {
  /** Las comprobaciones tardaron 20 min en pasar: la revisión cuenta desde ahí. */
  const checked: TrackedPush = { sha: HEAD, seenAt: 0, reviewSince: 20 * MINUTE };
  const unreviewed = { reviewedSha: HEAD, completed: false, hasFindings: false };

  it('no se agota a los 30 min del push si la revisión empezó a contar después', () => {
    const now = snapshot({ review: unreviewed, observedAt: 40 * MINUTE });

    expect(afterReviewWait(checked, now, TIMEOUT)).toEqual({ push: checked, next: 'waiting' });
  });

  it('una revisión que termina 20 min después de pasar las comprobaciones llega a tiempo', () => {
    const now = snapshot({ observedAt: 40 * MINUTE });

    expect(afterReviewWait(checked, now, TIMEOUT)).toEqual({ push: checked, next: 'finished' });
  });

  it('se agota a los 30 min desde que pasan las comprobaciones', () => {
    const now = snapshot({ review: unreviewed, observedAt: 50 * MINUTE });

    expect(afterReviewWait(checked, now, TIMEOUT)).toEqual({ push: checked, next: 'timedOut' });
  });
});

describe('si hay que triar (change pr-shadow-triage, decisión 1)', () => {
  const intervention = (...reasons: InterventionReason[]): FinalState => ({
    status: 'needsIntervention',
    reasons,
  });

  it('sí, si necesita intervención porque falla una comprobación', () => {
    expect(needsTriage(intervention({ kind: 'checksFailed', checks: ['e2e'] }))).toBe(true);
  });

  it('sí, si necesita intervención porque el revisor tiene hallazgos', () => {
    expect(needsTriage(intervention({ kind: 'reviewFindings' }))).toBe(true);
  });

  it('sí, si además algo no termina a tiempo', () => {
    const state = intervention(
      { kind: 'checksFailed', checks: ['lint'] },
      { kind: 'checksUnfinished', checks: ['e2e'] },
    );

    expect(needsTriage(state)).toBe(true);
  });

  it('no, si está lista para integrar', () => {
    expect(needsTriage({ status: 'readyToMerge' })).toBe(false);
  });

  it('no, si solo es porque algo no termina a tiempo', () => {
    const state = intervention(
      { kind: 'checksUnfinished', checks: ['e2e'] },
      { kind: 'reviewUnfinished' },
    );

    expect(needsTriage(state)).toBe(false);
  });
});
