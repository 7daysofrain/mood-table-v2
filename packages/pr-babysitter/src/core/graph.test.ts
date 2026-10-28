import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createTrackingGraph, lastSnapshot, threadConfig } from './graph.ts';
import type { Notice } from './notice.ts';
import { GitHubRequestRejectedError, type Notifier, type ReviewRequests } from './ports.ts';
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
    labels: [],
    checks: PENDING,
    review: null,
    reviewRequested: false,
    observedAt: minute * MINUTE,
    ...overrides,
  } satisfies PullRequestSnapshot;
}

/** Las peticiones de revisión que hace el grafo, o el error con que falla mientras se le dé. */
function recordingRequests() {
  const recorded = {
    requests: [] as { number: number; sha: string }[],
    failure: undefined as Error | undefined,
  };
  const reviewRequests: ReviewRequests = {
    requested: () => Promise.resolve(false),
    request(number, sha) {
      if (recorded.failure) return Promise.reject(recorded.failure);
      recorded.requests.push({ number, sha });
      return Promise.resolve();
    },
  };
  return { reviewRequests, recorded };
}

/** El grafo con un `Notifier`, sin fallos al pedir la revisión y con 30 min de tiempo de espera. */
function trackingGraph(notifier: Notifier, reviewRequests = recordingRequests().reviewRequests) {
  return createTrackingGraph({ notifier, reviewRequests }, new MemorySaver(), {
    timeoutMs: 30 * MINUTE,
    log: () => undefined,
  });
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
  const { reviewRequests, recorded } = recordingRequests();
  const graph = trackingGraph(notifier, reviewRequests);
  const [first, ...rest] = snapshots;
  await graph.invoke({ snapshot: first! }, threadConfig(74));
  for (const next of rest) {
    await graph.invoke(new Command({ resume: next }), threadConfig(74));
  }
  const state = await graph.getState(threadConfig(74));
  return { notices, requests: recorded.requests, state };
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
    const graph = trackingGraph(notifier);

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
  it('la revisión no termina en 30 min desde que pasan las comprobaciones: necesita intervención', async () => {
    const { notices, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(34, { checks: PASSED, review: running() }),
      snapshot(35, { checks: PASSED, review: running() }),
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

describe('una ejecución que empieza sin el aviso de seguimiento (reanudada)', () => {
  it('no avisa y se queda esperando las comprobaciones', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = trackingGraph(notifier);

    await graph.invoke({ snapshot: snapshot(0), silent: true }, threadConfig(74));

    const state = await graph.getState(threadConfig(74));
    expect(notices).toEqual([]);
    expect(state.next).toEqual(['esperarComprobaciones']);
  });

  it('en un hilo terminado, sigue el push de su foto y el tiempo cuenta desde ella', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = trackingGraph(notifier);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);
    await graph.invoke(new Command({ resume: snapshot(29) }), config);
    await graph.invoke(new Command({ resume: snapshot(30) }), config);
    notices.length = 0;

    await graph.invoke({ snapshot: snapshot(60, { headSha: 'nuevo' }), silent: true }, config);
    await graph.invoke(new Command({ resume: snapshot(89, { headSha: 'nuevo' }) }), config);
    expect(notices).toEqual([]);
    await graph.invoke(new Command({ resume: snapshot(90, { headSha: 'nuevo' }) }), config);

    expect(summary(notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }],
      },
    ]);
  });

  it('la ejecución siguiente que empieza con aviso vuelve a avisar', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = trackingGraph(notifier);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0), silent: true }, config);
    await graph.invoke(new Command({ resume: snapshot(30) }), config);

    await graph.invoke({ snapshot: snapshot(40, { headSha: 'nuevo' }) }, config);

    expect(summary(notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }],
      },
      'tracking',
    ]);
  });
});

describe('el sistema pide la revisión cuando pasan las comprobaciones del último push', () => {
  it('avisa de que han terminado, la pide una sola vez para ese push y espera al revisor', async () => {
    const { notices, requests, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(6, { checks: PASSED }),
      snapshot(7, { checks: PASSED, review: running() }),
    );

    expect(summary(notices)).toEqual(['tracking', 'checksFinished']);
    expect(requests).toEqual([{ number: 74, sha: HEAD }]);
    expect(state.next).toEqual(['esperarRevisor']);
  });

  it('no la pide mientras alguna comprobación no ha terminado', async () => {
    const { requests } = await follow(snapshot(0), snapshot(5));

    expect(requests).toEqual([]);
  });

  it('no la pide si alguna comprobación falla', async () => {
    const { requests } = await follow(snapshot(0), snapshot(5, { checks: FAILED }));

    expect(requests).toEqual([]);
  });

  it('tras un push nuevo, la pide para ese push cuando pasan sus comprobaciones', async () => {
    const { requests } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(8, { headSha: 'nuevo' }),
      snapshot(14, { headSha: 'nuevo', checks: PASSED }),
    );

    expect(requests).toEqual([
      { number: 74, sha: HEAD },
      { number: 74, sha: 'nuevo' },
    ]);
  });
});

describe('el sistema no pide dos veces la revisión del mismo push', () => {
  it('si el revisor ya está revisando el último push, espera sin pedirla', async () => {
    const { requests, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED, review: running() }),
    );

    expect(requests).toEqual([]);
    expect(state.next).toEqual(['esperarRevisor']);
  });

  it('si el revisor ya ha revisado el último push, no la pide', async () => {
    const { requests } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED, review: reviewed() }),
    );

    expect(requests).toEqual([]);
  });

  it('si el sistema ya la había pedido para el último push, espera sin pedirla', async () => {
    const { requests, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: PASSED, reviewRequested: true }),
    );

    expect(requests).toEqual([]);
    expect(state.next).toEqual(['esperarRevisor']);
  });
});

describe('si GitHub no acepta la petición de revisión', () => {
  it('si la rechaza, lo deja en el log y espera; a los 30 min avisa de que la revisión no ha terminado', async () => {
    const { notifier, notices } = recordingNotifier();
    const { reviewRequests, recorded } = recordingRequests();
    recorded.failure = new GitHubRequestRejectedError('Resource not accessible');
    const log: string[] = [];
    const graph = createTrackingGraph({ notifier, reviewRequests }, new MemorySaver(), {
      timeoutMs: 30 * MINUTE,
      log: (line) => log.push(line),
    });
    const config = threadConfig(74);

    await graph.invoke({ snapshot: snapshot(0) }, config);
    await graph.invoke(new Command({ resume: snapshot(5, { checks: PASSED }) }), config);
    expect((await graph.getState(config)).next).toEqual(['esperarRevisor']);
    expect(log).toEqual([expect.stringContaining('#74')]);
    await graph.invoke(new Command({ resume: snapshot(34, { checks: PASSED }) }), config);
    await graph.invoke(new Command({ resume: snapshot(35, { checks: PASSED }) }), config);

    expect(summary(notices)).toEqual([
      'tracking',
      'checksFinished',
      { status: 'needsIntervention', reasons: [{ kind: 'reviewUnfinished' }] },
    ]);
  });

  it('si falla por la red, el nodo queda pendiente y se reintenta', async () => {
    const { notifier } = recordingNotifier();
    const { reviewRequests, recorded } = recordingRequests();
    recorded.failure = new Error('fetch failed');
    const graph = trackingGraph(notifier, reviewRequests);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);

    await expect(
      graph.invoke(new Command({ resume: snapshot(5, { checks: PASSED }) }), config),
    ).rejects.toThrow('fetch failed');
    expect((await graph.getState(config)).next).toEqual(['pedirRevision']);

    recorded.failure = undefined;
    await graph.invoke(null, config);

    expect(recorded.requests).toEqual([{ number: 74, sha: HEAD }]);
    expect((await graph.getState(config)).next).toEqual(['esperarRevisor']);
  });
});

describe('si falla una comprobación, el sistema avisa del estado final sin esperar a la revisión', () => {
  it('el único aviso es el de estado final, con qué falla, y no pide la revisión', async () => {
    const { notices, requests, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: FAILED }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['e2e'] }] },
    ]);
    expect(requests).toEqual([]);
    expect(state.next).toEqual([]);
  });

  it('si el revisor ya había revisado el último push con hallazgos, lo dice también', async () => {
    const { notices } = await follow(
      snapshot(0),
      snapshot(5, { checks: FAILED, review: reviewed(HEAD, true) }),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      {
        status: 'needsIntervention',
        reasons: [{ kind: 'checksFailed', checks: ['e2e'] }, { kind: 'reviewFindings' }],
      },
    ]);
  });

  it('con una comprobación sin terminar a los 30 min, no dice que la revisión no ha terminado', async () => {
    const { notices } = await follow(snapshot(0), snapshot(29), snapshot(30));

    expect(summary(notices)).toEqual([
      'tracking',
      { status: 'needsIntervention', reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }] },
    ]);
  });

  it('si el aviso se reintenta con la foto de un push anterior, el hilo termina y el push nuevo vuelve a empezar', async () => {
    const notices: Notice[] = [];
    const channel = { failing: false };
    const notifier: Notifier = {
      notify(notice) {
        if (channel.failing) return Promise.reject(new Error('Linear no responde'));
        notices.push(notice);
        return Promise.resolve();
      },
    };
    const graph = trackingGraph(notifier);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);
    channel.failing = true;
    await expect(
      graph.invoke(new Command({ resume: snapshot(5, { checks: FAILED }) }), config),
    ).rejects.toThrow('Linear no responde');

    channel.failing = false;
    await graph.invoke(null, config);
    expect((await graph.getState(config)).next).toEqual([]);
    await graph.invoke({ snapshot: snapshot(8, { headSha: 'nuevo' }) }, config);

    expect(summary(notices)).toEqual([
      'tracking',
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['e2e'] }] },
      'tracking',
    ]);
    expect((await graph.getState(config)).next).toEqual(['esperarComprobaciones']);
  });
});
