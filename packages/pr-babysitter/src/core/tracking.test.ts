import { describe, expect, it } from 'vitest';

import type { Check, PullRequestSnapshot } from './pull-request.ts';
import {
  afterChecksWait,
  afterReviewWait,
  checksFinished,
  type FinalState,
  finalState,
  firstFailureChecks,
  type InterventionReason,
  needsReviewRequest,
  needsTriage,
  rerunPassed,
  reviewFinished,
  type TrackedPush,
  unfinishedReruns,
} from './tracking.ts';

const MINUTE = 60_000;
const TIMEOUT = 30 * MINUTE;
/** El margen de las que no van a ejecutarse (`TRACKING_NOT_RUN_MARGIN_SECONDS`). */
const MARGIN = 2 * MINUTE;
const HEAD = 'a1b2c3d';

const passed = (name: string): Check => ({ name, status: 'passed', conclusion: 'success' });
const failed = (name: string): Check => ({ name, status: 'failed', conclusion: 'failure' });
const pending = (name: string): Check => ({ name, status: 'pending', conclusion: null });
const notStarted = (name: string): Check => ({ name, status: 'notStarted', conclusion: null });
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
    expect(checksFinished(snapshot({ checks: [failed('lint'), notStarted('e2e')] }))).toBe(false);
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

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'waiting' });
  });

  it('pasa a avisar cuando han terminado, y la revisión cuenta desde esta foto si pasan todas', () => {
    expect(afterChecksWait(push, snapshot(), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: { ...push, reviewSince: 10 * MINUTE },
      next: 'checksFinished',
    });
  });

  it('si alguna falla, pasa al estado final y la revisión no empieza a contar', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('se agota el tiempo a los 30 min desde la primera foto con ese SHA', () => {
    const now = snapshot({ checks: [pending('e2e')], observedAt: 30 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'timedOut' });
  });

  it('un SHA nuevo reinicia el tiempo desde la foto que lo trae', () => {
    const now = snapshot({ headSha: 'nuevo', checks: [pending('e2e')], observedAt: 40 * MINUTE });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({
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
    expect(needsTriage(intervention({ kind: 'checksFailed', checks: ['e2e'] }), [])).toBe(true);
  });

  it('sí, si necesita intervención porque el revisor tiene hallazgos', () => {
    expect(needsTriage(intervention({ kind: 'reviewFindings', pushes: 'earlier' }), [])).toBe(true);
  });

  it('sí, si además algo no termina a tiempo', () => {
    const state = intervention(
      { kind: 'checksFailed', checks: ['lint'] },
      { kind: 'checksUnfinished', checks: ['e2e'] },
    );

    expect(needsTriage(state, [])).toBe(true);
  });

  it('no, si está lista para integrar', () => {
    expect(needsTriage({ status: 'readyToMerge' }, [])).toBe(false);
  });

  it('no, si solo es porque algo no termina a tiempo', () => {
    const state = intervention(
      { kind: 'checksUnfinished', checks: ['e2e'] },
      { kind: 'reviewUnfinished' },
    );

    expect(needsTriage(state, [])).toBe(false);
  });

  it('sí, si lo que no termina a tiempo es un relanzamiento (change pr-check-rerun, decisión 1)', () => {
    const state = intervention({ kind: 'checksUnfinished', checks: ['e2e'] });

    expect(needsTriage(state, ['e2e'])).toBe(true);
  });
});

describe('lo relanzado, con la foto (change pr-check-rerun, decisiones 1 y 8)', () => {
  const rerun = { sha: 'abc', seenAt: 0, rerunSince: 5 * MINUTE, rerunNames: ['lint', 'e2e'] };
  const now = (checks: Check[]) => snapshot({ checks });

  it('sin terminar: las que el sistema relanzó y siguen pendientes', () => {
    expect(unfinishedReruns(now([passed('lint'), pending('e2e')]), rerun, RERUN)).toEqual(['e2e']);
  });

  it('sin terminar: solo las relanzables, no una que se relanzó con ellas porque fallaba en su run', () => {
    expect(unfinishedReruns(now([pending('lint'), pending('e2e')]), rerun, RERUN)).toEqual(['e2e']);
  });

  it('sin relanzamiento pedido, ninguna, aunque haya pendientes', () => {
    expect(unfinishedReruns(now([pending('e2e')]), { sha: 'abc', seenAt: 0 }, RERUN)).toEqual([]);
  });

  it('pasadas: las que el sistema relanzó y han pasado, no las que siguen fallando', () => {
    expect(rerunPassed(now([failedIn('lint', 2), passed('e2e'), passed('test')]), rerun)).toEqual([
      'e2e',
    ]);
  });

  it('sin relanzar nada, ninguna pasada', () => {
    expect(rerunPassed(now([passed('e2e')]), { sha: 'abc', seenAt: 0 })).toEqual([]);
  });
});

describe('al reanudar la espera de las comprobaciones, el relanzamiento (change pr-check-rerun)', () => {
  // Desde pr-first-failure-triage (decisión 1), el seguimiento no relanza: da `firstFailure`, el hilo
  // tría el fallo y `decidir` relanza.
  it('una relanzable que falla o se agota en su primer intento va al triaje del primer fallo', () => {
    for (const conclusion of ['failure', 'timed_out']) {
      const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1, conclusion)] });

      expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'firstFailure' });
    }
  });

  it('con una determinista y una relanzable en su primer intento, se relanza', () => {
    const now = snapshot({ checks: [failedIn('lint', 1), failedIn('e2e', 1)] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'firstFailure' });
  });

  it('se relanza sin esperar a las demás: con test roja, SonarCloud no llega nunca', () => {
    const now = snapshot({
      checks: [passed('lint'), failedIn('test', 1), pending('SonarCloud Code Analysis')],
    });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'firstFailure' });
  });

  it('con su run aún en marcha, espera a que termine para relanzar', () => {
    const running = failedIn('test', 1, 'failure', false);

    for (const checks of [
      [passed('lint'), running, pending('e2e')],
      // Las exigidas han terminado, pero un job no exigido del run sigue corriendo.
      [passed('lint'), running, passed('e2e')],
    ]) {
      expect(afterChecksWait(push, snapshot({ checks }), TIMEOUT, RERUN, MARGIN)).toEqual({
        push,
        next: 'waiting',
      });
    }
  });

  it('no se relanza una cancelada', () => {
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1, 'cancelled')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('no se relanza una ya relanzada, a mano o por el sistema: su intento es 2 o más', () => {
    for (const attempt of [2, 3]) {
      const now = snapshot({ checks: [passed('lint'), failedIn('test', attempt)] });

      expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
    }
  });

  it('no se relanza si solo falla una que no es relanzable', () => {
    const now = snapshot({ checks: [failedIn('lint', 1), passed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('no se relanza una sin intento, porque su job no se ha podido leer', () => {
    const now = snapshot({ checks: [passed('lint'), failed('e2e')] });

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('con la lista de relanzables vacía, no se relanza nada', () => {
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(push, now, TIMEOUT, [], MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('con el relanzamiento pedido y el intento 1 aún a la vista, sigue esperando sin volver a pedirlo', () => {
    const rerun = { ...push, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push: rerun, next: 'waiting' });
  });

  it('con el relanzamiento pedido, el intento 2 que vuelve a fallar pasa al estado final', () => {
    const rerun = { ...push, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 2)] });

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN, MARGIN)).toEqual({
      push: rerun,
      next: 'checksFailed',
    });
  });

  it('con el relanzamiento rechazado, no se vuelve a pedir', () => {
    const rejected = { ...push, rerunRejected: ['e2e'] };
    const now = snapshot({ checks: [passed('lint'), failedIn('e2e', 1)] });

    expect(afterChecksWait(rejected, now, TIMEOUT, RERUN, MARGIN)).toEqual({
      push: rejected,
      next: 'checksFailed',
    });
  });

  it('sin relanzamiento aceptado, no se vuelve a pedir pasados 30 min desde el push: se agota el tiempo', () => {
    const at = (minute: number) =>
      snapshot({ checks: [passed('lint'), failedIn('e2e', 1)], observedAt: minute * MINUTE });

    expect(afterChecksWait(push, at(29), TIMEOUT, RERUN, MARGIN).next).toBe('firstFailure');
    expect(afterChecksWait(push, at(30), TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'timedOut' });
  });

  it('con el relanzamiento pedido, el tiempo cuenta desde él', () => {
    const rerun = { ...push, rerunSince: 20 * MINUTE };
    const at = (minute: number) =>
      snapshot({ checks: [passed('lint'), pending('e2e')], observedAt: minute * MINUTE });

    expect(afterChecksWait(rerun, at(49), TIMEOUT, RERUN, MARGIN).next).toBe('waiting');
    expect(afterChecksWait(rerun, at(50), TIMEOUT, RERUN, MARGIN).next).toBe('timedOut');
  });

  it('un push nuevo borra el relanzamiento del anterior', () => {
    const previous = { sha: 'push-anterior', seenAt: 0, rerunSince: 5 * MINUTE };
    const now = snapshot({ checks: [pending('e2e')] });

    expect(afterChecksWait(previous, now, TIMEOUT, RERUN, MARGIN)).toEqual({
      push: { sha: HEAD, seenAt: 10 * MINUTE },
      next: 'waiting',
    });
  });
});

describe('las comprobaciones del triaje del primer fallo (change pr-first-failure-triage, decisiones 2 y 4)', () => {
  const now = snapshot({ checks: [failedIn('lint', 1), failedIn('test', 1), failedIn('e2e', 1)] });

  it('nunca da el paso de relanzar: lo decide `decidir`', () => {
    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN).next).not.toBe('rerun');
  });

  it('son las relanzables que fallan en su primer intento, con su run terminado', () => {
    expect(firstFailureChecks(now, push, RERUN)).toEqual(['test', 'e2e']);
  });

  it('sin las que ya ha triado el primer triaje del push: no se vuelven a preguntar', () => {
    const triaged: TrackedPush = {
      ...push,
      firstTriage: [
        { name: 'test', verdict: { class: 'notApplicable', reason: 'probability', probability: 0.12 } },
      ],
    };

    expect(firstFailureChecks(now, triaged, RERUN)).toEqual(['e2e']);
  });

  it('ni una con el run en marcha, una cancelada o una en su segundo intento', () => {
    const checks = [
      failedIn('test', 1, 'failure', false),
      failedIn('e2e', 1, 'cancelled'),
      failedIn('test', 2),
    ];

    expect(firstFailureChecks(snapshot({ checks }), push, RERUN)).toEqual([]);
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

const SONAR = 'SonarCloud Code Analysis';

describe('al reanudar la espera de las comprobaciones, las que no van a ejecutarse (change pr-checks-not-run)', () => {
  /** La #154: `test` falla, `sonar-issues` saltada, `e2e` pasa y SonarCloud sin check run. */
  const quiet = (minute: number, checks: Check[] = [failed('test'), passed('e2e'), notStarted(SONAR)]) =>
    snapshot({ checks, review: null, observedAt: minute * MINUTE });
  const quietFrom = (minute: number): TrackedPush => ({ ...push, quietSince: minute * MINUTE });

  it('la primera foto quieta guarda desde cuándo y sigue esperando', () => {
    expect(afterChecksWait(push, quiet(10), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: quietFrom(10),
      next: 'waiting',
    });
  });

  it('antes de los 2 minutos sigue esperando', () => {
    expect(afterChecksWait(quietFrom(10), quiet(11.9), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: quietFrom(10),
      next: 'waiting',
    });
  });

  it('a los 2 minutos justos, pasa al estado final como si hubieran terminado', () => {
    expect(afterChecksWait(quietFrom(10), quiet(12), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: quietFrom(10),
      next: 'checksFailed',
    });
  });

  it('con una en cola o en curso no está quieta, y si lo estaba, el margen se borra', () => {
    const running = quiet(11, [failed('test'), pending('e2e'), notStarted(SONAR)]);

    expect(afterChecksWait(push, running, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'waiting' });
    expect(afterChecksWait(quietFrom(10), running, TIMEOUT, RERUN, MARGIN)).toEqual({
      push,
      next: 'waiting',
    });
  });

  it('al quedar quieta otra vez, el margen vuelve a empezar', () => {
    const again = afterChecksWait(push, quiet(13), TIMEOUT, RERUN, MARGIN);

    expect(again).toEqual({ push: quietFrom(13), next: 'waiting' });
    expect(afterChecksWait(again.push, quiet(14), TIMEOUT, RERUN, MARGIN).next).toBe('waiting');
    expect(afterChecksWait(again.push, quiet(15), TIMEOUT, RERUN, MARGIN).next).toBe('checksFailed');
  });

  it('una relanzable que falla en su primer intento se relanza primero, sin margen', () => {
    const now = quiet(10, [failedIn('test', 1), passed('e2e'), notStarted(SONAR)]);

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'firstFailure' });
  });

  it('con el relanzamiento pedido y el intento 1 aún a la vista, no hay margen', () => {
    const rerun = { ...push, rerunSince: 8 * MINUTE };
    const now = quiet(10, [failedIn('test', 1), passed('e2e'), notStarted(SONAR)]);

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push: rerun, next: 'waiting' });
  });

  it('si el relanzamiento pasa y queda una sin empezar sin ningún fallo, se espera hasta el plazo', () => {
    const rerun = { ...push, rerunSince: 8 * MINUTE };
    const at = (minute: number) => quiet(minute, [passed('test'), passed('e2e'), notStarted(SONAR)]);

    expect(afterChecksWait(rerun, at(12), TIMEOUT, RERUN, MARGIN)).toEqual({ push: rerun, next: 'waiting' });
    expect(afterChecksWait(rerun, at(37), TIMEOUT, RERUN, MARGIN).next).toBe('waiting');
    expect(afterChecksWait(rerun, at(38), TIMEOUT, RERUN, MARGIN).next).toBe('timedOut');
  });

  it('si el relanzamiento vuelve a fallar, el margen empieza entonces', () => {
    const rerun = { ...push, rerunSince: 8 * MINUTE };
    const now = quiet(12, [failedIn('test', 2), passed('e2e'), notStarted(SONAR)]);

    expect(afterChecksWait(rerun, now, TIMEOUT, RERUN, MARGIN)).toEqual({
      push: { ...rerun, quietSince: 12 * MINUTE },
      next: 'waiting',
    });
  });

  it('una cancelada cuenta como fallada y también lleva al margen', () => {
    const checks = [failedIn('e2e', 1, 'cancelled'), passed('test'), notStarted(SONAR)];

    expect(afterChecksWait(push, quiet(10, checks), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: quietFrom(10),
      next: 'waiting',
    });
    expect(afterChecksWait(quietFrom(10), quiet(12, checks), TIMEOUT, RERUN, MARGIN).next).toBe(
      'checksFailed',
    );
  });

  it('sin ninguna sin empezar, una fallada sin nada pendiente pasa al estado final en la misma foto', () => {
    const now = quiet(10, [failed('test'), passed('e2e'), passed(SONAR)]);

    expect(afterChecksWait(push, now, TIMEOUT, RERUN, MARGIN)).toEqual({ push, next: 'checksFailed' });
  });

  it('un push nuevo no lleva el margen del anterior', () => {
    const previous = { sha: 'push-anterior', seenAt: 0, quietSince: 5 * MINUTE };

    expect(afterChecksWait(previous, quiet(10), TIMEOUT, RERUN, MARGIN)).toEqual({
      push: { sha: HEAD, seenAt: 10 * MINUTE, quietSince: 10 * MINUTE },
      next: 'waiting',
    });
  });
});

describe('el estado final con las que no van a ejecutarse (change pr-checks-not-run)', () => {
  it('con una fallada y nada pendiente, las sin empezar no han llegado a ejecutarse', () => {
    const checks = [failed('test'), passed('e2e'), notStarted(SONAR)];

    expect(finalState(snapshot({ checks, review: null }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['test'] },
        { kind: 'checksNotRun', checks: [SONAR] },
      ],
    });
  });

  it('al vencer el plazo sin fallo, una sin empezar sigue sin terminar', () => {
    const checks = [passed('test'), passed('e2e'), notStarted(SONAR)];

    expect(finalState(snapshot({ checks, review: null }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksUnfinished', checks: [SONAR] }],
    });
  });

  it('al vencer el plazo con una fallada y otra en marcha, las sin empezar siguen sin terminar', () => {
    const checks = [failed('test'), pending('e2e'), notStarted(SONAR)];

    expect(finalState(snapshot({ checks, review: null }), push)).toEqual({
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['test'] },
        { kind: 'checksUnfinished', checks: ['e2e', SONAR] },
      ],
    });
  });
});
