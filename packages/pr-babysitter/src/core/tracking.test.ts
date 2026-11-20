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

const passed = (name: string): Check => ({ name, status: 'passed', conclusion: 'success' });
const failed = (name: string): Check => ({ name, status: 'failed', conclusion: 'failure' });
const pending = (name: string): Check => ({ name, status: 'pending', conclusion: null });
/** Una de GitHub Actions que falla en un intento del run 42, terminado salvo que se diga. */
const failedIn = (
  name: string,
  attempt: number,
  conclusion = 'failure',
  runFinished = true,
): Check => ({ name, status: 'failed', conclusion, attempt, runId: 42, runFinished });

/** Las relanzables por defecto (`RERUN_CHECKS`). */
const RERUN = ['test', 'e2e'];

/**
 * Una PR con todas las comprobaciones superadas, revisada en el último push y sin hilos del revisor
 * sin resolver.
 */
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
    review: { reviewedSha: HEAD, completed: true },
    reviewerThreads: { lastPush: 0, earlierPushes: 0 },
    reviewRequested: false,
    observedAt: 10 * MINUTE,
    ...overrides,
  };
}

/** Hilos del revisor sin resolver: `n` del último push y `m` de pushes anteriores. */
const threads = (lastPush: number, earlierPushes = 0) => ({ lastPush, earlierPushes });

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
    const review = { reviewedSha: HEAD, completed: false };
    expect(reviewFinished(snapshot({ review }))).toBe(false);
  });

  it('no ha terminado si revisó un push anterior', () => {
    const review = { reviewedSha: 'push-anterior', completed: true };
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

  it('necesita intervención si el revisor tiene hilos sin resolver del último push', () => {
    expect(finalState(snapshot({ reviewerThreads: threads(2) }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewFindings', pushes: 'last' }],
    });
  });

  it('necesita intervención si solo le quedan hilos sin resolver de un push anterior (la #122)', () => {
    expect(finalState(snapshot({ reviewerThreads: threads(0, 1) }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewFindings', pushes: 'earlier' }],
    });
  });

  it('necesita intervención con hilos sin resolver del último push y de uno anterior', () => {
    expect(finalState(snapshot({ reviewerThreads: threads(1, 2) }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'reviewFindings', pushes: 'both' }],
    });
  });

  it('lista para integrar sin hilos sin resolver, aunque el bloque del revisor dijera hallazgos (la #62)', () => {
    // El bloque de Codex ya no cuenta para los hallazgos: la foto solo trae el commit y si ha
    // terminado, y los hilos resueltos no se cuentan.
    expect(finalState(snapshot({ reviewerThreads: threads(0, 0) }), checked)).toEqual({
      status: 'readyToMerge',
    });
  });

  it('da todos los motivos a la vez', () => {
    const checks = [failed('lint'), failed('e2e')];

    expect(finalState(snapshot({ checks, reviewerThreads: threads(1) }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['lint', 'e2e'] },
        { kind: 'reviewFindings', pushes: 'last' },
      ],
    });
  });

  it('con el tiempo agotado, dice qué comprobación no ha terminado', () => {
    const checks = [passed('lint'), pending('e2e')];
    const review = { reviewedSha: HEAD, completed: false };

    expect(finalState(snapshot({ checks, review }), checked)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }, { kind: 'reviewUnfinished' }],
    });
  });

  it('con el tiempo agotado y las comprobaciones terminadas, dice que la revisión no ha terminado', () => {
    const review = { reviewedSha: 'push-anterior', completed: true };

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

    expect(finalState(snapshot({ checks, reviewerThreads: threads(1) }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['e2e'] },
        { kind: 'reviewFindings', pushes: 'last' },
      ],
    });
  });

  it('con una comprobación fallida, cuenta los hilos sin resolver de un push anterior, sin decir que la revisión no ha terminado', () => {
    const checks = [passed('lint'), failed('e2e')];
    const previous = { reviewedSha: 'push-anterior', completed: true };

    expect(
      finalState(snapshot({ checks, review: previous, reviewerThreads: threads(0, 1) }), push),
    ).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['e2e'] },
        { kind: 'reviewFindings', pushes: 'earlier' },
      ],
    });
  });

  it('con una comprobación fallida, una revisión en marcha o de un push anterior sin hilos no cuenta', () => {
    const checks = [passed('lint'), failed('e2e')];
    const running = { reviewedSha: HEAD, completed: false };
    const previous = { reviewedSha: 'push-anterior', completed: true };
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

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'waiting' });
  });

  it('pasa a avisar cuando han terminado, y la revisión cuenta desde esta foto si pasan todas', () => {
    expect(afterChecksWait(push, snapshot(), TIMEOUT, RERUN)).toEqual({
      push: { ...push, reviewSince: 10 * MINUTE },
      next: 'checksFinished',
    });
  });

  it('si alguna falla, pasa al estado final y la revisión no empieza a contar', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'checksFailed' });
  });

  it('se agota el tiempo a los 30 min desde la primera foto con ese SHA', () => {
    const now = snapshot({ checks: [pending('e2e')], observedAt: 30 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'timedOut' });
  });

  it('un SHA nuevo reinicia el tiempo desde la foto que lo trae', () => {
    const now = snapshot({ headSha: 'nuevo', checks: [pending('e2e')], observedAt: 40 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({
      push: { sha: 'nuevo', seenAt: 40 * MINUTE },
      next: 'waiting',
    });
  });
});

describe('si hay que pedir la revisión', () => {
  const running = { reviewedSha: HEAD, completed: false };

  it('sí, con todas las comprobaciones pasadas y el revisor sin el último push', () => {
    expect(needsReviewRequest(snapshot({ review: null }))).toBe(true);
  });

  it('sí, si el revisor solo ha revisado un push anterior', () => {
    const review = { reviewedSha: 'push-anterior', completed: true };

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
  const unreviewed = { reviewedSha: HEAD, completed: false };

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
      review: { reviewedSha: HEAD, completed: true },
      observedAt: 12 * MINUTE,
    });
    const newPush = { sha: 'nuevo', seenAt: 12 * MINUTE };

    expect(afterReviewWait(newPush, now, TIMEOUT)).toEqual({ push: newPush, next: 'waiting' });
  });
});

describe('el tiempo de espera de la revisión', () => {
  /** Las comprobaciones tardaron 20 min en pasar: la revisión cuenta desde ahí. */
  const checked: TrackedPush = { sha: HEAD, seenAt: 0, reviewSince: 20 * MINUTE };
  const unreviewed = { reviewedSha: HEAD, completed: false };

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
    expect(needsTriage(intervention({ kind: 'reviewFindings', pushes: 'earlier' }))).toBe(true);
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

describe('al reanudar la espera de las comprobaciones, el relanzamiento (change pr-check-rerun)', () => {
  it('una relanzable que falla o se agota en su primer intento se relanza', () => {
    for (const conclusion of ['failure', 'timed_out']) {
      const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1, conclusion)] });

      expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'rerun' });
    }
  });

  it('con una determinista y una relanzable en su primer intento, se relanza', () => {
    const now = snapshot({ checks: [failedIn('lint', 1), failedIn('e2e', 1)] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'rerun' });
  });

  it('se relanza sin esperar a las demás: con test roja, SonarCloud no llega nunca', () => {
    const now = snapshot({
      checks: [passed('lint'), failedIn('test', 1), pending('SonarCloud Code Analysis')],
    });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'rerun' });
  });

  it('con su run aún en marcha, espera a que termine para relanzar', () => {
    const running = failedIn('test', 1, 'failure', false);

    for (const checks of [
      [passed('lint'), running, pending('e2e')],
      // Las exigidas han terminado, pero un job no exigido del run sigue corriendo.
      [passed('lint'), running, passed('e2e')],
    ]) {
      expect(afterChecksWait(push, snapshot({ checks }), TIMEOUT, RERUN)).toEqual({
        push,
        next: 'waiting',
      });
    }
  });

  it('no se relanza una cancelada', () => {
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1, 'cancelled')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'checksFailed' });
  });

  it('no se relanza una ya relanzada, a mano o por el sistema: su intento es 2 o más', () => {
    for (const attempt of [2, 3]) {
      const now = snapshot({ checks: [passed('lint'), failedIn('test', attempt)] });

      expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'checksFailed' });
    }
  });

  it('no se relanza si solo falla una que no es relanzable', () => {
    const now = snapshot({ checks: [failedIn('lint', 1), passed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'checksFailed' });
  });

  it('no se relanza una sin intento, porque su job no se ha podido leer', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN)).toEqual({ push, next: 'checksFailed' });
  });

  it('con la lista de relanzables vacía, no se relanza nada', () => {
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(push, now, TIMEOUT, [])).toEqual({ push, next: 'checksFailed' });
  });

  it('con el relanzamiento pedido y el intento 1 aún a la vista, sigue esperando sin volver a pedirlo', () => {
    const rerun = { ...push, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN)).toEqual({ push: rerun, next: 'waiting' });
  });

  it('con el relanzamiento pedido, el intento 2 que vuelve a fallar pasa al estado final', () => {
    const rerun = { ...push, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 2)] });

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN)).toEqual({
      push: rerun,
      next: 'checksFailed',
    });
  });

  it('con el relanzamiento rechazado, no se vuelve a pedir', () => {
    const rejected = { ...push, rerunRejected: ['e2e'] };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(rejected, now, TIMEOUT, RERUN)).toEqual({
      push: rejected,
      next: 'checksFailed',
    });
  });

  it('sin relanzamiento aceptado, no se vuelve a pedir pasados 30 min desde el push: se agota el tiempo', () => {
    const at = (minute: number) =>
      snapshot({ checks: [passed('lint'), failedIn('e2e', 1)], observedAt: minute * MINUTE });

    expect(afterChecksWait(push, at(29), TIMEOUT, RERUN).next).toBe('rerun');
    expect(afterChecksWait(push, at(30), TIMEOUT, RERUN)).toEqual({ push, next: 'timedOut' });
  });

  it('con el relanzamiento pedido, el tiempo cuenta desde él', () => {
    const rerun = { ...push, rerunSince: 20 * MINUTE };
    const at = (minute: number) =>
      snapshot({ checks: [passed('lint'), pending('e2e')], observedAt: minute * MINUTE });

    expect(afterChecksWait(rerun, at(49), TIMEOUT, RERUN).next).toBe('waiting');
    expect(afterChecksWait(rerun, at(50), TIMEOUT, RERUN).next).toBe('timedOut');
  });

  it('un push nuevo borra el relanzamiento del anterior', () => {
    const previous = { sha: 'push-anterior', seenAt: 0, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [pending('e2e')] });

    expect(afterChecksWait(previous, now, TIMEOUT, RERUN)).toEqual({
      push: { sha: HEAD, seenAt: 10 * MINUTE },
      next: 'waiting',
    });
  });
});

describe('el estado final con el relanzamiento rechazado', () => {
  it('dice qué falla y que no se ha podido relanzar', () => {
    const checks = [passed('lint'), failedIn('e2e', 1)];

    expect(finalState(snapshot({ checks, review: null }), { ...push, rerunRejected: ['e2e'] })).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['e2e'] },
        { kind: 'rerunRejected', checks: ['e2e'] },
      ],
    });
  });
});
