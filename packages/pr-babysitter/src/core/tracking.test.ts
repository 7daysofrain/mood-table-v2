import { describe, expect, it } from 'vitest';

import type { Check, PullRequestSnapshot } from './pull-request.ts';
import {
  afterChecksWait,
  afterReviewWait,
  checksFinished,
  finalState,
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
    checks: [passed('lint'), passed('e2e')],
    review: { reviewedSha: HEAD, completed: true, hasFindings: false },
    observedAt: 10 * MINUTE,
    ...overrides,
  };
}

/** El push que se sigue desde el minuto 0. */
const push: TrackedPush = { sha: HEAD, seenAt: 0 };

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

describe('el estado final', () => {
  it('lista para integrar si todo pasa y el revisor no tiene hallazgos', () => {
    expect(finalState(snapshot())).toEqual({ status: 'readyToMerge' });
  });

  it('necesita intervención si falla una comprobación, con cuál', () => {
    const checks = [passed('lint'), failed('e2e')];

    expect(finalState(snapshot({ checks }))).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['e2e'] }],
    });
  });

  it('necesita intervención si el revisor tiene hallazgos', () => {
    const review = { reviewedSha: HEAD, completed: true, hasFindings: true };

    expect(finalState(snapshot({ review }))).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewFindings' }],
    });
  });

  it('da todos los motivos a la vez', () => {
    const checks = [failed('lint'), failed('e2e')];
    const review = { reviewedSha: HEAD, completed: true, hasFindings: true };

    expect(finalState(snapshot({ checks, review }))).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['lint', 'e2e'] }, { kind: 'reviewFindings' }],
    });
  });

  it('con el tiempo agotado, dice qué comprobación no ha terminado', () => {
    const checks = [passed('lint'), pending('e2e')];
    const review = { reviewedSha: HEAD, completed: false, hasFindings: false };

    expect(finalState(snapshot({ checks, review }))).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }, { kind: 'reviewUnfinished' }],
    });
  });

  it('con el tiempo agotado y las comprobaciones terminadas, dice que la revisión no ha terminado', () => {
    const review = { reviewedSha: 'push-anterior', completed: true, hasFindings: false };

    expect(finalState(snapshot({ review }))).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewUnfinished' }],
    });
  });
});

describe('al reanudar la espera de las comprobaciones', () => {
  it('sigue esperando si no han terminado y no se ha agotado el tiempo', () => {
    const now = snapshot({ checks: [pending('e2e')], observedAt: 29 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT)).toEqual({ push, next: 'waiting' });
  });

  it('pasa a avisar cuando han terminado', () => {
    expect(afterChecksWait(push, snapshot(), TIMEOUT)).toEqual({ push, next: 'checksFinished' });
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

describe('al reanudar la espera del revisor', () => {
  const unreviewed = { reviewedSha: HEAD, completed: false, hasFindings: false };

  it('sigue esperando si no ha terminado y no se ha agotado el tiempo', () => {
    const now = snapshot({ review: unreviewed, observedAt: 29 * MINUTE });

    expect(afterReviewWait(push, now, TIMEOUT)).toEqual({ push, next: 'waiting' });
  });

  it('pasa al estado final cuando ha terminado', () => {
    expect(afterReviewWait(push, snapshot(), TIMEOUT)).toEqual({ push, next: 'finished' });
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
