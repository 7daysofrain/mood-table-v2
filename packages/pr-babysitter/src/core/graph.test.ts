import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createTrackingGraph, lastSnapshot, threadConfig } from './graph.ts';
import type { Notice } from './notice.ts';
import type { Notifier } from './ports.ts';
import type { Check, PullRequestSnapshot, Review } from './pull-request.ts';

const MINUTE = 60_000;
const HEAD = 'a1b2c3d';

const PENDING: Check[] = [
  { name: 'lint', status: 'passed' },
  { name: 'e2e', status: 'pending' },
];
const PASSED: Check[] = [
  { name: 'lint', status: 'passed' },
  { name: 'e2e', status: 'passed' },
];
const FAILED: Check[] = [
  { name: 'lint', status: 'passed' },
  { name: 'e2e', status: 'failed' },
];
const reviewed = (sha = HEAD, hasFindings = false): Review => ({
  reviewedSha: sha,
  completed: true,
  hasFindings,
});
const running = (sha = HEAD): Review => ({ reviewedSha: sha, completed: false, hasFindings: false });

/** La foto de la PR en un minuto; por defecto, con una comprobación pendiente y sin revisión. */
function snapshot(minute: number, overrides: Partial<PullRequestSnapshot> = {}) {
  return {
    number: 74,
    title: 'Avisar de cada PR lista para revisar',
    url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
    author: '7daysofrain',
    baseBranch: 'main',
    draft: false,
    headSha: HEAD,
    checks: PENDING,
    review: null,
    observedAt: minute * MINUTE,
    ...overrides,
  } satisfies PullRequestSnapshot;
}

function recordingNotifier() {
  const notices: Notice[] = [];
  const notifier: Notifier = {
    notify(notice) {
      notices.push(notice);
      return Promise.resolve();
    },
  };
  return { notifier, notices };
}

/** Un hilo que arranca con la primera foto y se reanuda con cada una de las demás, en orden. */
async function follow(...snapshots: PullRequestSnapshot[]) {
  const { notifier, notices } = recordingNotifier();
  const graph = createTrackingGraph(notifier, new MemorySaver(), { timeoutMs: 30 * MINUTE });
  const [first, ...rest] = snapshots;
  await graph.invoke({ snapshot: first! }, threadConfig(74));
  for (const next of rest) {
    await graph.invoke(new Command({ resume: next }), threadConfig(74));
  }
  const state = await graph.getState(threadConfig(74));
  return { notices, state };
}

/** Los avisos en corto: su tipo y, el del estado final, con el estado. */
function summary(notices: Notice[]) {
  return notices.map((notice) => (notice.type === 'final' ? notice.state : notice.type));
}

describe('el hilo de una PR', () => {
  it('al empezar avisa de que sigue la PR y se queda esperando las comprobaciones', async () => {
    const { notices, state } = await follow(snapshot(0));

    expect(notices).toEqual([
      {
        type: 'tracking',
        pullRequest: {
          number: 74,
          title: 'Avisar de cada PR lista para revisar',
          url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
        },
      },
    ]);
    expect(state.next).toEqual(['esperarComprobaciones']);
  });

  it('al reanudarlo con fotos nuevas no repite el aviso y guarda la última foto', async () => {
    const { notices, state } = await follow(snapshot(0), snapshot(1), snapshot(2), snapshot(3));

    expect(notices).toHaveLength(1);
    expect(state.next).toEqual(['esperarComprobaciones']);
    expect(lastSnapshot(state.values)).toEqual(snapshot(3));
  });

  it('cada PR tiene su propio hilo', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = createTrackingGraph(notifier, new MemorySaver(), { timeoutMs: 30 * MINUTE });

    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke({ snapshot: snapshot(0, { number: 75 }) }, threadConfig(75));

    expect(notices.map((notice) => notice.type === 'tracking' && notice.pullRequest.number)).toEqual(
      [74, 75],
    );
  });
});

describe('hasta el estado final', () => {
  it('todo pasa y el revisor no tiene hallazgos: lista para integrar, y el hilo termina', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(6, { checks: PASSED, review: running() }),
      snapshot(9, { checks: PASSED, review: reviewed() }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished', { status: 'readyToMerge' }]);
    expect(state.next).toEqual([]);
  });

  it('si el revisor ya ha terminado cuando terminan las comprobaciones, avisa del estado final con la foto siguiente', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(8, { checks: PASSED, review: reviewed() }),
      snapshot(9, { checks: PASSED, review: reviewed() }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished', { status: 'readyToMerge' }]);
    expect(state.next).toEqual([]);
  });

  it('una comprobación exigida que aún no ha empezado no da el aviso de comprobaciones terminadas', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(2, { checks: [...PASSED, { name: 'sonar-issues', status: 'pending' }] }),
    );

    expect(summary(notices)).toEqual(['tracking']);
  });

  it('falla una comprobación: necesita intervención, con cuál', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(5, { checks: FAILED }),
      snapshot(9, { checks: FAILED, review: reviewed() }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      'checksFinished',
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['e2e'] }] },
    ]);
  });

  it('el revisor tiene hallazgos: necesita intervención', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(9, { checks: PASSED, review: reviewed(HEAD, true) }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      'checksFinished',
      { status: 'needsIntervention', reasons: [{ kind: 'reviewFindings' }] },
    ]);
  });

  it('una comprobación relanzada mientras espera al revisor: el estado final espera a que termine', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(7, { checks: PENDING, review: reviewed() }),
      snapshot(9, { checks: PASSED, review: reviewed() }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished', { status: 'readyToMerge' }]);
  });

  it('el revisor revisa un push anterior: no hay estado final', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(9, { checks: PASSED, review: reviewed('push-anterior') }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished']);
    expect(state.next).toEqual(['esperarRevisor']);
  });
});

describe('el tiempo de espera', () => {
  it('la revisión no termina en 30 min desde que se vio el push: necesita intervención', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(29, { checks: PASSED, review: running() }),
      snapshot(30, { checks: PASSED, review: running() }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      'checksFinished',
      { status: 'needsIntervention', reasons: [{ kind: 'reviewUnfinished' }] },
    ]);
    expect(state.next).toEqual([]);
  });

  it('una comprobación no termina en 30 min: necesita intervención, con cuál', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(29),
      snapshot(30, { review: reviewed() }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      {
        status: 'needsIntervention',
        reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }],
      },
    ]);
  });
});

describe('un push nuevo', () => {
  it('mientras espera las comprobaciones, no avisa y el tiempo cuenta desde ese push', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(20, { headSha: 'nuevo' }),
      snapshot(35, { headSha: 'nuevo' }),
    );

    expect(summary(notices)).toEqual(['tracking']);
    expect(state.next).toEqual(['esperarComprobaciones']);
  });

  it('mientras espera al revisor, no avisa y los avisos siguientes son de ese push', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(8, { headSha: 'nuevo', review: reviewed() }),
      snapshot(9, { headSha: 'nuevo', checks: PENDING, review: reviewed() }),
      snapshot(14, { headSha: 'nuevo', checks: PASSED, review: reviewed() }),
      snapshot(20, { headSha: 'nuevo', checks: PASSED, review: reviewed('nuevo') }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      'checksFinished',
      'checksFinished',
      { status: 'readyToMerge' },
    ]);
    expect(state.next).toEqual([]);
  });

  it('mientras espera al revisor, el tiempo cuenta desde ese push', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(25, { headSha: 'nuevo', checks: PENDING }),
      snapshot(40, { headSha: 'nuevo', checks: PENDING }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished']);
  });
});
