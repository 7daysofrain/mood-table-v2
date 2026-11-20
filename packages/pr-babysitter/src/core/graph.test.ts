import { setTimeout as sleep } from 'node:timers/promises';

import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createTrackingGraph, lastSnapshot, threadConfig } from './graph.ts';
import type { Notice } from './notice.ts';
import {
  type CheckReruns,
  type DecisionModel,
  DecisionModelError,
  type Findings,
  GitHubRequestRejectedError,
  type Notifier,
  type ReviewRequests,
  type TriageSummaries,
} from './ports.ts';
import type { Check, PullRequestSnapshot, Review } from './pull-request.ts';
import type {
  CheckFinding,
  Finding,
  ModelAnswer,
  PullRequestContext,
  Question,
} from './triage.ts';
import { type TriagedPush, triageSummary } from './triage-summary.ts';

const MINUTE = 60_000;
const HEAD = 'a1b2c3d';

const PENDING: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  { name: 'e2e', status: 'pending', conclusion: null },
];
const PASSED: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  { name: 'e2e', status: 'passed', conclusion: 'success' },
];
const FAILED: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  { name: 'e2e', status: 'failed', conclusion: 'failure' },
];
/**
 * Falla `build`, una comprobación que no es determinista ni relanzable: la que se pregunta al modelo
 * por la causa (change pr-check-rerun: `test` y `e2e` ya no).
 */
const BUILD_FAILED: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  { name: 'build', status: 'failed', conclusion: 'failure' },
];
/** El run de CI de las comprobaciones de estos tests. */
const RUN = 42;
/** Una de Actions que falla en un intento del run. */
const failedIn = (name: string, attempt: number, conclusion = 'failure'): Check => ({
  name,
  status: 'failed',
  conclusion,
  attempt,
  runId: RUN,
  runFinished: true,
});
/** `e2e` falla en su primer intento. */
const E2E_FIRST_ATTEMPT: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  failedIn('e2e', 1),
];
/** `e2e` relanzado, en marcha. */
const E2E_RERUNNING: Check[] = PENDING;
/** `e2e` vuelve a fallar al relanzarlo. */
const E2E_FAILED_AGAIN: Check[] = [
  { name: 'lint', status: 'passed', conclusion: 'success' },
  failedIn('e2e', 2),
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

/** Los relanzamientos que pide el grafo, por run, o el error con que falla mientras se le dé. */
function recordingReruns() {
  const recorded = { reruns: [] as number[], failure: undefined as Error | undefined };
  const checkReruns: CheckReruns = {
    rerun(runId) {
      if (recorded.failure) return Promise.reject(recorded.failure);
      recorded.reruns.push(runId);
      return Promise.resolve();
    },
  };
  return { checkReruns, recorded };
}

/** Las comprobaciones relanzables en estos tests: las de por defecto (`RERUN_CHECKS`). */
const RERUN_CHECKS = ['test', 'e2e'];

/** El título y la descripción de la PR, para el triaje. */
const CONTEXT: PullRequestContext = {
  title: 'Avisar de cada PR lista para revisar',
  description: 'Fixes MOO-90',
};

/** Lo que el triaje necesita de fuera; por defecto, un push sin hallazgos. */
interface TriagePorts {
  findings: Findings;
  decisionModel: DecisionModel;
  summaries: TriageSummaries;
}

const noFindings: TriagePorts = {
  findings: { read: () => Promise.resolve({ context: CONTEXT, findings: [], sonarIssues: null }) },
  decisionModel: {
    estimate: () => 0,
    ask: () => Promise.reject(new Error('no hay hallazgos que triar')),
  },
  summaries: {
    published: () => Promise.resolve(false),
    publish: () => Promise.reject(new Error('no hay resumen que publicar')),
  },
};

/** La estimación del modelo falso: 1 token cada 3 bytes de la PR y el hallazgo en JSON. */
function sizeInTokens(context: PullRequestContext, finding: Finding): number {
  return Math.ceil(JSON.stringify({ context, finding }).length / 3);
}

/** Las comprobaciones que decide la regla en estos tests: las de por defecto. */
const RULE_CHECKS = ['lint', 'typecheck', 'SonarCloud Code Analysis'];

/**
 * El grafo con un `Notifier`, sin fallos al pedir la revisión ni al relanzar, con 30 min de tiempo
 * de espera, `test` y `e2e` relanzables, el umbral de 0,80, un tope de 0,05 $ por PR a 0,24 $ el
 * millón de tokens y la regla de las comprobaciones deterministas.
 */
function trackingGraph(
  notifier: Notifier,
  reviewRequests = recordingRequests().reviewRequests,
  { findings, decisionModel, summaries }: TriagePorts = noFindings,
  log: (line: string) => void = () => undefined,
  checkReruns = recordingReruns().checkReruns,
) {
  return createTrackingGraph(
    { notifier, reviewRequests, findings, decisionModel, summaries, checkReruns },
    new MemorySaver(),
    {
      timeoutMs: 30 * MINUTE,
      log,
      rerunChecks: RERUN_CHECKS,
      triage: {
        threshold: 0.8,
        budget: { capUsd: 0.05, inputPricePerMTok: 0.24 },
        ruleChecks: RULE_CHECKS,
        sonarIssuesCheck: 'sonar-issues',
      },
    },
  );
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
  const reruns = recordingReruns();
  const graph = trackingGraph(notifier, reviewRequests, noFindings, undefined, reruns.checkReruns);
  const [first, ...rest] = snapshots;
  await graph.invoke({ snapshot: first! }, threadConfig(74));
  for (const next of rest) {
    await graph.invoke(new Command({ resume: next }), threadConfig(74));
  }
  const state = await graph.getState(threadConfig(74));
  return { notices, requests: recorded.requests, reruns: reruns.recorded.reruns, state };
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
      snapshot(2, { checks: [...PASSED, { name: 'sonar-issues', status: 'pending', conclusion: null }] }),
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
    const graph = trackingGraph(notifier, reviewRequests, noFindings, (line) => log.push(line));
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

/** Un comentario del revisor con su contexto. */
const codexP2: Finding = {
  source: 'reviewer',
  reviewer: 'Codex',
  badge: 'P2',
  severity: 'normal',
  file: 'packages/pr-babysitter/src/core/tracking.ts',
  line: 109,
  title: 'Route failed checks directly to the final notification',
  text: 'When all checks finish with at least one failure…',
  diffHunk: '@@ -100,6 +100,12 @@',
};

/** Una comprobación que falla, con el paso que falla de su log por contexto, si no se dice otro. */
function failingCheck(
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

const buildFailing = failingCheck('build');

/**
 * La respuesta del modelo a la pregunta de la fuente del hallazgo, con `p` del lado del sí: a la de
 * la causa, `p`; a la del alcance, P1 = `p` y P2 = `1 - p`.
 */
function modelAnswer(finding: Finding, p: number): ModelAnswer {
  return finding.source === 'reviewer'
    ? { kind: 'scope', inside: p, outside: Math.round((1 - p) * 100) / 100 }
    : { kind: 'answered', probability: p };
}

/**
 * Un triaje que se puede seguir: los hallazgos que da GitHub con la PR (`CONTEXT`, si no se dice) y
 * cuántas incidencias de SonarQube trae la comprobación que las lista (ninguna, si no se dice), la
 * probabilidad que da el modelo de cada uno (0,93 con 12.000 tokens, si no se dice; `modelAnswer`),
 * cada llamada al modelo, y el orden de lo que pasa, con los avisos.
 */
function recordingTriage(
  found: Finding[],
  answer: (finding: Finding) => Promise<{ probability: number; inputTokens: number }> = () =>
    Promise.resolve({ probability: 0.93, inputTokens: 12_000 }),
  context: PullRequestContext = CONTEXT,
  sonarIssues: { total: number; triaged: number } | null = null,
) {
  const events: string[] = [];
  const reads: { number: number; sha: string; failedChecks: string[] }[] = [];
  const asked: { context: PullRequestContext; finding: Finding; question: Question }[] = [];
  const estimated: { context: PullRequestContext; finding: Finding; question: Question }[] = [];
  const github = { failure: undefined as Error | undefined };
  /** Cuántas llamadas al modelo hay en curso, y el máximo que ha habido a la vez. */
  const concurrency = { inFlight: 0, peak: 0 };
  /** Los resúmenes publicados, los SHA que ya tenían el suyo y el error con que falla publicar. */
  const posted = {
    summaries: [] as { number: number; sha: string; text: string }[],
    existing: [] as string[],
    failure: undefined as Error | undefined,
  };
  const ports: TriagePorts = {
    findings: {
      read(number, sha, failedChecks) {
        if (github.failure) return Promise.reject(github.failure);
        events.push('leer hallazgos');
        reads.push({ number, sha, failedChecks });
        return Promise.resolve({ context, findings: found, sonarIssues });
      },
    },
    decisionModel: {
      estimate(context, finding, question) {
        estimated.push({ context, finding, question });
        return sizeInTokens(context, finding);
      },
      ask(context, finding, question) {
        events.push('preguntar al modelo');
        asked.push({ context, finding, question });
        concurrency.inFlight += 1;
        concurrency.peak = Math.max(concurrency.peak, concurrency.inFlight);
        return answer(finding)
          .then(({ probability, inputTokens }) => ({
            answer: modelAnswer(finding, probability),
            inputTokens,
          }))
          .finally(() => {
            concurrency.inFlight -= 1;
          });
      },
    },
    summaries: {
      published: (_number, sha) => Promise.resolve(posted.existing.includes(sha)),
      publish(number, sha, text) {
        if (posted.failure) return Promise.reject(posted.failure);
        events.push('publicar resumen');
        posted.summaries.push({ number, sha, text });
        return Promise.resolve();
      },
    },
  };
  const notifier: Notifier = {
    notify(notice) {
      events.push(notice.type === 'final' ? 'aviso final' : notice.type);
      return Promise.resolve();
    },
  };
  return { ports, notifier, events, reads, asked, estimated, github, posted, concurrency };
}

/** Sigue el hilo con un triaje que se puede seguir; `spentUsd` es el gasto de la PR al empezar. */
async function followTriage(
  triage: ReturnType<typeof recordingTriage>,
  snapshots: PullRequestSnapshot[],
  spentUsd?: number,
  checkReruns = recordingReruns().checkReruns,
) {
  const graph = trackingGraph(
    triage.notifier,
    recordingRequests().reviewRequests,
    triage.ports,
    undefined,
    checkReruns,
  );
  const [first, ...rest] = snapshots;
  await graph.invoke({ snapshot: first!, spentUsd }, threadConfig(74));
  for (const next of rest) {
    await graph.invoke(new Command({ resume: next }), threadConfig(74));
  }
  return graph.getState(threadConfig(74));
}

/** El push con una comprobación que falla. */
const failing = [snapshot(0), snapshot(5, { checks: BUILD_FAILED })];
/** El push con las comprobaciones pasadas y hallazgos del revisor. */
const withFindings = [
  snapshot(0),
  snapshot(5, { checks: PASSED }),
  snapshot(9, { checks: PASSED, review: reviewed(HEAD, true) }),
];

describe('el sistema tría los hallazgos del último push cuando la PR necesita intervención', () => {
  it('con hallazgos del revisor, los tría antes del aviso final', async () => {
    const triage = recordingTriage([codexP2]);

    const state = await followTriage(triage, withFindings);

    expect(triage.events).toEqual([
      'tracking',
      'checksFinished',
      'leer hallazgos',
      'preguntar al modelo',
      'publicar resumen',
      'aviso final',
    ]);
    expect(triage.reads).toEqual([{ number: 74, sha: HEAD, failedChecks: [] }]);
    expect(state.next).toEqual([]);
  });

  it('con una comprobación que falla, lee los hallazgos con ella y los tría antes del aviso final', async () => {
    const triage = recordingTriage([buildFailing]);

    await followTriage(triage, failing);

    expect(triage.events).toEqual([
      'tracking',
      'leer hallazgos',
      'preguntar al modelo',
      'publicar resumen',
      'aviso final',
    ]);
    expect(triage.reads).toEqual([{ number: 74, sha: HEAD, failedChecks: ['build'] }]);
  });

  it('al modelo llegan la PR y los hallazgos que da GitHub, y nada más', async () => {
    const triage = recordingTriage([codexP2, buildFailing]);

    await followTriage(triage, failing);

    expect(triage.asked).toEqual([
      { context: CONTEXT, finding: codexP2, question: 'scope' },
      { context: CONTEXT, finding: buildFailing, question: 'cause' },
    ]);
  });

  it('lista para integrar, va directa al aviso final', async () => {
    const triage = recordingTriage([codexP2]);

    await followTriage(triage, [
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(9, { checks: PASSED, review: reviewed() }),
    ]);

    expect(triage.events).toEqual(['tracking', 'checksFinished', 'aviso final']);
  });

  it('si solo es porque algo no termina a tiempo, va directa al aviso final', async () => {
    const triage = recordingTriage([codexP2]);

    await followTriage(triage, [snapshot(0), snapshot(29), snapshot(30)]);

    expect(triage.events).toEqual(['tracking', 'aviso final']);
  });
});

describe('cada hallazgo sale real, no aplica o exige criterio según la probabilidad del modelo', () => {
  it('deja en el estado del hilo la clase, la probabilidad y el porqué de cada hallazgo, y el gasto', async () => {
    const triage = recordingTriage([codexP2, buildFailing], (finding) =>
      Promise.resolve({ probability: finding.source === 'reviewer' ? 0.93 : 0.07, inputTokens: 6_000 }),
    );

    const state = await followTriage(triage, failing);

    expect(state.values).toMatchObject({
      triage: {
        sha: HEAD,
        findings: [
          {
            finding: codexP2,
            verdict: { class: 'valid', reason: 'inScope', inside: 0.93, outside: 0.07 },
          },
          {
            finding: buildFailing,
            verdict: { class: 'notApplicable', reason: 'probability', probability: 0.07 },
          },
        ],
        inputTokens: 12_000,
      },
    });
    const values = state.values as { spentUsd: number; triage: { costUsd: number } };
    expect(values.triage.costUsd).toBeCloseTo(0.00288, 10);
    expect(values.spentUsd).toBeCloseTo(0.00288, 10);
  });

  it('el coste se suma al gasto que ya llevaba la PR', async () => {
    const triage = recordingTriage([buildFailing]);

    const state = await followTriage(triage, failing, 0.01);

    expect((state.values as { spentUsd: number }).spentUsd).toBeCloseTo(0.01288, 10);
  });
});

describe('un hallazgo sin contexto exige criterio sin preguntar al modelo', () => {
  it('un comentario del revisor sin su trozo de diff no llega al modelo, y el resto sí', async () => {
    const noDiff: Finding = { ...codexP2, diffHunk: null };
    const triage = recordingTriage([noDiff, buildFailing]);

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([buildFailing]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: noDiff, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: buildFailing, verdict: { class: 'valid' } },
        ],
      },
    });
  });

  it('la comprobación no da contexto: no llega al modelo, y el resto sí', async () => {
    const notProvided = failingCheck('codecov/patch', { state: 'notProvided' });
    const triage = recordingTriage([codexP2, notProvided]);

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([codexP2]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: codexP2, verdict: { class: 'valid' } },
          { finding: notProvided, verdict: { class: 'needsJudgment', reason: 'noContext' } },
        ],
      },
    });
    expect(triage.posted.summaries[0]?.text).toContain('la comprobación no da contexto');
  });

  it('no se puede leer el contexto de una comprobación: no llega al modelo, y el resto sí', async () => {
    const unreadable = failingCheck('build', { state: 'unreadable' });
    const triage = recordingTriage([codexP2, unreadable]);

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([codexP2]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: codexP2, verdict: { class: 'valid' } },
          { finding: unreadable, verdict: { class: 'needsJudgment', reason: 'noContext' } },
        ],
      },
    });
    expect(triage.posted.summaries[0]?.text).toContain('no se ha podido leer su contexto');
  });
});

describe('el triaje no pasa del tope de gasto de la PR', () => {
  it('con el gasto cerca del tope, solo llegan al modelo los que caben', async () => {
    const longLog = failingCheck('build', {
      state: 'available',
      origin: 'log',
      summary: 'x'.repeat(3000),
      errors: [],
      truncated: false,
    });
    const triage = recordingTriage([codexP2, longLog]);

    // Quedan 0,0001 $: unos 400 tokens, sitio para el comentario pero no para el log.
    const state = await followTriage(triage, failing, 0.0499);

    // El coste lo estima el modelo, petición a petición, con la PR en cada una.
    expect(triage.estimated).toEqual([
      { context: CONTEXT, finding: codexP2, question: 'scope' },
      { context: CONTEXT, finding: longLog, question: 'cause' },
    ]);
    expect(triage.asked.map(({ finding }) => finding)).toEqual([codexP2]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: codexP2, verdict: { class: 'valid' } },
          { finding: longLog, verdict: { class: 'needsJudgment', reason: 'overBudget' } },
        ],
      },
    });
  });

  it('con el tope gastado, no pregunta al modelo', async () => {
    const triage = recordingTriage([codexP2]);

    const state = await followTriage(triage, failing, 0.05);

    expect(triage.asked).toEqual([]);
    expect(state.values).toMatchObject({
      triage: { findings: [{ verdict: { class: 'needsJudgment', reason: 'overBudget' } }] },
    });
  });
});

describe('cada hallazgo se pregunta al modelo de decisión en una petición propia', () => {
  const browserFailing = failingCheck('vitest-browser');
  const three = [codexP2, browserFailing, buildFailing];
  // Por su nombre: el hallazgo llega a cada rama en su `Send`, copiado.
  const isBrowser = (finding: Finding) => finding.source === 'check' && finding.name === 'vitest-browser';
  /** El estado del reparto: la ronda del último triaje y las respuestas que guarda el hilo. */
  interface FanOutState {
    triageRound: { number: number };
    triageAnswers: { round: number; index: number }[];
  }

  it('con un comentario del revisor y dos comprobaciones, tres llamadas de un hallazgo cada una, a la vez', async () => {
    const triage = recordingTriage(three, async () => {
      await sleep(5);
      return { probability: 0.93, inputTokens: 4_000 };
    });

    const state = await followTriage(triage, failing);

    expect(triage.asked).toEqual([
      { context: CONTEXT, finding: codexP2, question: 'scope' },
      { context: CONTEXT, finding: browserFailing, question: 'cause' },
      { context: CONTEXT, finding: buildFailing, question: 'cause' },
    ]);
    expect(triage.concurrency.peak).toBe(3);
    expect(state.values).toMatchObject({
      triage: {
        findings: three.map((finding) => ({ finding, verdict: { class: 'valid' } })),
        inputTokens: 12_000,
      },
    });
  });

  it('si falla la petición de uno, ese exige criterio, los demás salen con su clase y lo cobrado cuenta', async () => {
    const triage = recordingTriage(three, (finding) =>
      isBrowser(finding)
        ? Promise.reject(new DecisionModelError('La respuesta no trae el hallazgo', 3_000))
        : Promise.resolve({ probability: finding.source === 'reviewer' ? 0.93 : 0.07, inputTokens: 4_000 }),
    );
    const lines: string[] = [];
    const graph = trackingGraph(
      triage.notifier,
      recordingRequests().reviewRequests,
      triage.ports,
      (line) => lines.push(line),
    );
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), threadConfig(74));
    const state = await graph.getState(threadConfig(74));

    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: codexP2, verdict: { class: 'valid', reason: 'inScope' } },
          { finding: browserFailing, verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
          { finding: buildFailing, verdict: { class: 'notApplicable', reason: 'probability' } },
        ],
        inputTokens: 11_000,
      },
    });
    expect(lines).toEqual([expect.stringContaining('La respuesta no trae el hallazgo') as string]);
    expect(triage.events.slice(-2)).toEqual(['publicar resumen', 'aviso final']);
  });

  it('sin nada que preguntar, el triaje termina y publica el resumen igual', async () => {
    const noDiff: Finding = { ...codexP2, diffHunk: null };
    const unreadable = failingCheck('build', { state: 'unreadable' });
    const triage = recordingTriage([noDiff, unreadable]);

    const state = await followTriage(triage, failing);

    expect(triage.events).toEqual(['tracking', 'leer hallazgos', 'publicar resumen', 'aviso final']);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: noDiff, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: unreadable, verdict: { class: 'needsJudgment', reason: 'noContext' } },
        ],
        inputTokens: 0,
      },
    });
    expect(state.next).toEqual([]);
  });

  it('dos pushes seguidos en el mismo hilo: el segundo triaje no lleva respuestas del primero', async () => {
    const found = [codexP2, buildFailing];
    const triage = recordingTriage(found, (finding) =>
      Promise.resolve({ probability: isBrowser(finding) ? 0.07 : 0.93, inputTokens: 4_000 }),
    );
    const graph = trackingGraph(triage.notifier, recordingRequests().reviewRequests, triage.ports);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);
    await graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), config);
    const first = (await graph.getState(config)).values as FanOutState;

    // El push nuevo trae un solo hallazgo, y otro.
    found.splice(0, found.length, browserFailing);
    await graph.invoke({ snapshot: snapshot(10, { headSha: 'nuevo' }) }, config);
    await graph.invoke(
      new Command({ resume: snapshot(15, { headSha: 'nuevo', checks: BUILD_FAILED }) }),
      config,
    );
    const state = await graph.getState(config);
    const second = state.values as FanOutState;

    expect(first.triageRound.number).toBe(1);
    expect(first.triageAnswers.map(({ round, index }) => ({ round, index }))).toEqual([
      { round: 1, index: 0 },
      { round: 1, index: 1 },
    ]);
    expect(second.triageRound.number).toBe(2);
    expect(second.triageAnswers.map(({ round, index }) => ({ round, index }))).toEqual([
      { round: 2, index: 0 },
    ]);
    expect(state.values).toMatchObject({
      triage: {
        sha: 'nuevo',
        findings: [{ finding: browserFailing, verdict: { class: 'notApplicable', probability: 0.07 } }],
        inputTokens: 4_000,
      },
    });
    expect(triage.posted.summaries.at(-1)?.text).not.toContain('tracking.ts');
  });
});

describe('las comprobaciones deterministas salen reales por regla', () => {
  const byRule = { class: 'valid', reason: 'rule' };

  it('`lint` sale real por regla, sin ninguna llamada al modelo, y el resumen lo dice', async () => {
    const lint = failingCheck('lint');
    const triage = recordingTriage([lint]);

    const state = await followTriage(triage, failing);

    expect(triage.asked).toEqual([]);
    expect(triage.estimated).toEqual([]);
    expect(state.values).toMatchObject({
      triage: { findings: [{ finding: lint, verdict: byRule }], inputTokens: 0, costUsd: 0 },
    });
    expect(triage.events).toEqual(['tracking', 'leer hallazgos', 'publicar resumen', 'aviso final']);
    expect(triage.posted.summaries[0]?.text).toContain(
      '| Comprobación `lint` | real | regla: comprobación determinista |',
    );
  });

  it('la regla no necesita contexto: `typecheck` con el log ilegible sale real, y no exige criterio', async () => {
    const typecheck = failingCheck('typecheck', { state: 'unreadable' });
    const triage = recordingTriage([typecheck]);

    const state = await followTriage(triage, failing);

    expect(triage.asked).toEqual([]);
    expect(state.values).toMatchObject({
      triage: { findings: [{ finding: typecheck, verdict: byRule }] },
    });
  });

  it('la regla no gasta del tope: con el tope agotado, SonarCloud sale real y lo demás exige criterio', async () => {
    const sonar = failingCheck('SonarCloud Code Analysis');
    const triage = recordingTriage([sonar, buildFailing]);

    const state = await followTriage(triage, failing, 0.05);

    expect(triage.asked).toEqual([]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: sonar, verdict: byRule },
          { finding: buildFailing, verdict: { class: 'needsJudgment', reason: 'overBudget' } },
        ],
        inputTokens: 0,
      },
    });
    expect((state.values as { spentUsd: number }).spentUsd).toBeCloseTo(0.05, 10);
  });

  it('con una determinista y otra que no lo es, solo la segunda llega al modelo', async () => {
    const lint = failingCheck('lint');
    const triage = recordingTriage([lint, buildFailing]);

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([buildFailing]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: lint, verdict: byRule },
          { finding: buildFailing, verdict: { class: 'valid', reason: 'probability' } },
        ],
      },
    });
  });
});

describe('la pregunta al modelo depende de la fuente del hallazgo', () => {
  it('`build` llega al modelo con la pregunta de la causa, y un comentario del revisor, con la del alcance', async () => {
    const triage = recordingTriage([codexP2, buildFailing]);

    await followTriage(triage, failing);

    expect(triage.asked.map(({ finding, question }) => [finding.source, question])).toEqual([
      ['reviewer', 'scope'],
      ['check', 'cause'],
    ]);
  });

  it('una comprobación que no está en la lista también se pregunta por la causa', async () => {
    const build = failingCheck('build');
    const triage = recordingTriage([build]);

    await followTriage(triage, failing);

    expect(triage.asked).toEqual([{ context: CONTEXT, finding: build, question: 'cause' }]);
  });

  it('el tope se reserva con la estimación de la pregunta que se va a hacer', async () => {
    const triage = recordingTriage([codexP2, buildFailing]);

    await followTriage(triage, failing);

    expect(triage.estimated.map(({ question }) => question)).toEqual(['scope', 'cause']);
  });
});

describe('un hallazgo del revisor se clasifica por el alcance de la PR (change pr-reviewer-scope)', () => {
  it('el comentario llega al modelo con la pregunta del alcance y la comprobación con la de la causa, y el resumen da cada uno con su clase', async () => {
    // El comentario: P1 0,10 y P2 0,90, de otra tarea. La comprobación: 0,93, la causa la PR.
    const triage = recordingTriage([codexP2, buildFailing], (finding) =>
      Promise.resolve({ probability: finding.source === 'reviewer' ? 0.1 : 0.93, inputTokens: 3_000 }),
    );

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding, question }) => [finding, question])).toEqual([
      [codexP2, 'scope'],
      [buildFailing, 'cause'],
    ]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          {
            finding: codexP2,
            verdict: { class: 'notApplicable', reason: 'outOfScope', inside: 0.1, outside: 0.9 },
          },
          { finding: buildFailing, verdict: { class: 'valid', reason: 'probability', probability: 0.93 } },
        ],
        inputTokens: 6_000,
      },
    });
    expect(triage.posted.summaries[0]?.text).toContain(
      '| P2 de Codex en `tracking.ts:109` · Route failed checks directly to the final notification | no aplica | de otra tarea: p = 0,90 ≥ 0,80 · se capturaría |',
    );
    expect(triage.posted.summaries[0]?.text).toContain(
      '| Comprobación `build` | real | p = 0,93 ≥ 0,80 · contexto: log |',
    );
  });

  it('con la descripción de la PR vacía, el comentario exige criterio sin ninguna petición, y la comprobación se tría con el modelo', async () => {
    const triage = recordingTriage([codexP2, buildFailing], undefined, {
      title: CONTEXT.title,
      description: ' \n ',
    });

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([buildFailing]);
    expect(triage.estimated.map(({ finding }) => finding)).toEqual([buildFailing]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: codexP2, verdict: { class: 'needsJudgment', reason: 'noScope' } },
          { finding: buildFailing, verdict: { class: 'valid' } },
        ],
      },
    });
    expect(triage.posted.summaries[0]?.text).toContain(
      '| exige criterio | regla: la PR no dice su alcance |',
    );
  });
});

describe('el triaje no actúa sobre la PR', () => {
  it('si el modelo no responde, los hallazgos exigen criterio y el aviso final es el mismo', async () => {
    const triage = recordingTriage([codexP2, buildFailing], () =>
      Promise.reject(new Error('El modelo no responde')),
    );
    const lines: string[] = [];
    const graph = trackingGraph(
      triage.notifier,
      recordingRequests().reviewRequests,
      triage.ports,
      (line) => lines.push(line),
    );
    const notices: Notice[] = [];
    const notify = triage.notifier.notify.bind(triage.notifier);
    triage.notifier.notify = (notice) => {
      notices.push(notice);
      return notify(notice);
    };
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), threadConfig(74));
    const state = await graph.getState(threadConfig(74));

    expect(summary(notices).at(-1)).toEqual({
      status: 'needsIntervention',
      reasons: [{ kind: 'checksFailed', checks: ['build'] }],
    });
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
          { verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
        ],
      },
    });
    expect(lines).toEqual([
      expect.stringContaining('El modelo no responde') as string,
      expect.stringContaining('El modelo no responde') as string,
    ]);
    expect(state.next).toEqual([]);
  });

  it('si el modelo falla después de cobrar parte del triaje, eso suma al gasto de la PR', async () => {
    const triage = recordingTriage([codexP2, buildFailing], () =>
      Promise.reject(new DecisionModelError('La respuesta no trae el hallazgo', 6_000)),
    );

    const state = await followTriage(triage, failing, 0.01);

    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
          { verdict: { class: 'needsJudgment', reason: 'modelUnavailable' } },
        ],
        inputTokens: 12_000,
      },
    });
    const values = state.values as { spentUsd: number; triage: { costUsd: number } };
    expect(values.triage.costUsd).toBeCloseTo(0.00288, 10);
    expect(values.spentUsd).toBeCloseTo(0.01288, 10);
  });

  it('si GitHub falla al leer los hallazgos, el nodo queda pendiente y se reintenta', async () => {
    const triage = recordingTriage([buildFailing]);
    triage.github.failure = new Error('fetch failed');
    const graph = trackingGraph(triage.notifier, recordingRequests().reviewRequests, triage.ports);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);

    await expect(
      graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), config),
    ).rejects.toThrow('fetch failed');
    expect((await graph.getState(config)).next).toEqual(['triar']);
    expect(triage.events).toEqual(['tracking']);

    triage.github.failure = undefined;
    await graph.invoke(null, config);

    expect(triage.events).toEqual([
      'tracking',
      'leer hallazgos',
      'preguntar al modelo',
      'publicar resumen',
      'aviso final',
    ]);
  });
});

describe('el resumen del triaje es un comentario del sistema por push', () => {
  it('tras triar, publica una vez el resumen del push y sigue al aviso final', async () => {
    const triage = recordingTriage([codexP2, buildFailing]);

    const state = await followTriage(triage, failing);

    expect(triage.events.slice(-3)).toEqual(['preguntar al modelo', 'publicar resumen', 'aviso final']);
    const triaged = (state.values as { triage: TriagedPush }).triage;
    expect(triage.posted.summaries).toEqual([
      { number: 74, sha: HEAD, text: triageSummary(triaged, 0.8) },
    ]);
  });

  it('si ya está el resumen de ese push, no lo repite y sigue al aviso final', async () => {
    const triage = recordingTriage([buildFailing]);
    triage.posted.existing.push(HEAD);

    await followTriage(triage, failing);

    expect(triage.posted.summaries).toEqual([]);
    expect(triage.events.slice(-2)).toEqual(['preguntar al modelo', 'aviso final']);
  });

  it('si GitHub falla por la red, el nodo queda pendiente y se reintenta sin volver a triar', async () => {
    const triage = recordingTriage([buildFailing]);
    triage.posted.failure = new Error('fetch failed');
    const graph = trackingGraph(triage.notifier, recordingRequests().reviewRequests, triage.ports);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);

    await expect(
      graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), config),
    ).rejects.toThrow('fetch failed');
    expect((await graph.getState(config)).next).toEqual(['publicarResumen']);

    triage.posted.failure = undefined;
    await graph.invoke(null, config);

    expect(triage.asked).toHaveLength(1);
    expect(triage.posted.summaries).toHaveLength(1);
    expect(triage.events.slice(-2)).toEqual(['publicar resumen', 'aviso final']);
  });

  it('un push nuevo tiene su propio resumen', async () => {
    const triage = recordingTriage([buildFailing]);
    const graph = trackingGraph(triage.notifier, recordingRequests().reviewRequests, triage.ports);
    const config = threadConfig(74);
    await graph.invoke({ snapshot: snapshot(0) }, config);
    await graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), config);

    await graph.invoke({ snapshot: snapshot(10, { headSha: 'nuevo' }) }, config);
    await graph.invoke(
      new Command({ resume: snapshot(15, { headSha: 'nuevo', checks: BUILD_FAILED }) }),
      config,
    );

    expect(triage.posted.summaries.map(({ sha }) => sha)).toEqual([HEAD, 'nuevo']);
  });

  it('sin hallazgos que triar, no publica nada', async () => {
    const triage = recordingTriage([]);

    await followTriage(triage, failing);

    expect(triage.posted.summaries).toEqual([]);
    expect(triage.events).toEqual(['tracking', 'leer hallazgos', 'aviso final']);
  });
});

describe('si GitHub rechaza el resumen del triaje', () => {
  it('lo deja en el log y el aviso final llega igual', async () => {
    const triage = recordingTriage([buildFailing]);
    triage.posted.failure = new GitHubRequestRejectedError('403 Resource not accessible');
    const lines: string[] = [];
    const graph = trackingGraph(
      triage.notifier,
      recordingRequests().reviewRequests,
      triage.ports,
      (line) => lines.push(line),
    );
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke(new Command({ resume: snapshot(5, { checks: BUILD_FAILED }) }), threadConfig(74));

    expect(triage.events.at(-1)).toBe('aviso final');
    expect(lines).toEqual([expect.stringContaining('403 Resource not accessible') as string]);
    expect((await graph.getState(threadConfig(74))).next).toEqual([]);
  });
});

describe('el sistema solo escribe en GitHub sus peticiones de revisión y el resumen del triaje', () => {
  it('en una PR seguida hasta su estado final, una petición y un resumen del push', async () => {
    const triage = recordingTriage([codexP2]);
    const { reviewRequests, recorded } = recordingRequests();
    const graph = trackingGraph(triage.notifier, reviewRequests, triage.ports);
    const [first, ...rest] = withFindings;
    await graph.invoke({ snapshot: first! }, threadConfig(74));
    for (const next of rest) {
      await graph.invoke(new Command({ resume: next }), threadConfig(74));
    }

    expect(recorded.requests).toEqual([{ number: 74, sha: HEAD }]);
    expect(triage.posted.summaries.map(({ sha }) => sha)).toEqual([HEAD]);
  });

  it('con un relanzamiento, una petición, un resumen y un relanzamiento del push (change pr-check-rerun)', async () => {
    const triage = recordingTriage([codexP2]);
    const { reviewRequests, recorded } = recordingRequests();
    const reruns = recordingReruns();
    const graph = trackingGraph(
      triage.notifier,
      reviewRequests,
      triage.ports,
      undefined,
      reruns.checkReruns,
    );
    const [first, ...rest] = [
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(6, { checks: E2E_RERUNNING }),
      snapshot(9, { checks: PASSED }),
      snapshot(12, { checks: PASSED, review: reviewed(HEAD, true) }),
    ];
    await graph.invoke({ snapshot: first }, threadConfig(74));
    for (const next of rest) {
      await graph.invoke(new Command({ resume: next }), threadConfig(74));
    }

    expect(reruns.recorded.reruns).toEqual([RUN]);
    expect(recorded.requests).toEqual([{ number: 74, sha: HEAD }]);
    expect(triage.posted.summaries.map(({ sha }) => sha)).toEqual([HEAD]);
  });
});

describe('una comprobación relanzable que falla en su primer intento se relanza una vez (change pr-check-rerun)', () => {
  it('falla un `e2e`: relanza los jobs fallidos de su run, sin avisar ni pedir la revisión', async () => {
    const { notices, requests, reruns, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
    );

    expect(reruns).toEqual([RUN]);
    expect(summary(notices)).toEqual(['tracking']);
    expect(requests).toEqual([]);
    expect(state.next).toEqual(['esperarComprobaciones']);
  });

  it('falla `test` y SonarCloud, que depende de ella, no llega: relanza sin esperarla', async () => {
    const sonar: Check = { name: 'SonarCloud Code Analysis', status: 'pending', conclusion: null };
    const { reruns } = await follow(
      snapshot(0),
      snapshot(5, { checks: [failedIn('test', 1), sonar] }),
    );

    expect(reruns).toEqual([RUN]);
  });

  it('con el run de la que falla aún en marcha, espera a que termine para relanzar', async () => {
    const running: Check = { ...failedIn('e2e', 1), runFinished: false };
    const waiting = await follow(snapshot(0), snapshot(5, { checks: [running] }));
    const finished = await follow(
      snapshot(0),
      snapshot(5, { checks: [running] }),
      snapshot(6, { checks: [failedIn('e2e', 1)] }),
    );

    expect(waiting.reruns).toEqual([]);
    expect(summary(waiting.notices)).toEqual(['tracking']);
    expect(finished.reruns).toEqual([RUN]);
    expect(summary(finished.notices)).toEqual(['tracking']);
  });

  it('el relanzamiento pasa: pide la revisión y la PR llega a lista para integrar', async () => {
    const { notices, requests, reruns } = await follow(
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(6, { checks: E2E_RERUNNING }),
      snapshot(9, { checks: PASSED }),
      snapshot(12, { checks: PASSED, review: reviewed() }),
    );

    expect(reruns).toEqual([RUN]);
    expect(requests).toEqual([{ number: 74, sha: HEAD }]);
    expect(summary(notices)).toEqual(['tracking', 'checksFinished', { status: 'readyToMerge' }]);
  });

  it('vuelve a fallar: necesita intervención, con qué falla, sin otro relanzamiento', async () => {
    const { notices, reruns, state } = await follow(
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(6, { checks: E2E_RERUNNING }),
      snapshot(9, { checks: E2E_FAILED_AGAIN }),
    );

    expect(reruns).toEqual([RUN]);
    expect(summary(notices)).toEqual([
      'tracking',
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['e2e'] }] },
    ]);
    expect(state.next).toEqual([]);
  });

  it('mientras GitHub aún no ha creado el intento 2, no lo vuelve a pedir ni avisa', async () => {
    const { notices, reruns } = await follow(
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(6, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(7, { checks: E2E_RERUNNING }),
    );

    expect(reruns).toEqual([RUN]);
    expect(summary(notices)).toEqual(['tracking']);
  });

  it('un push nuevo durante el relanzamiento: el resultado no cuenta y los avisos son del push nuevo', async () => {
    const { notices, requests, reruns } = await follow(
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(8, { headSha: 'nuevo', checks: PENDING }),
      snapshot(9, { headSha: 'nuevo', checks: PASSED }),
      snapshot(12, { headSha: 'nuevo', checks: PASSED, review: reviewed('nuevo') }),
    );

    expect(reruns).toEqual([RUN]);
    expect(requests).toEqual([{ number: 74, sha: 'nuevo' }]);
    expect(summary(notices)).toEqual(['tracking', 'checksFinished', { status: 'readyToMerge' }]);
  });

  it('GitHub rechaza el relanzamiento: lo deja en el log y avisa de que no ha podido relanzar', async () => {
    const { notifier, notices } = recordingNotifier();
    const reruns = recordingReruns();
    reruns.recorded.failure = new GitHubRequestRejectedError('403 Resource not accessible');
    const lines: string[] = [];
    const graph = trackingGraph(
      notifier,
      recordingRequests().reviewRequests,
      noFindings,
      (line) => lines.push(line),
      reruns.checkReruns,
    );
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke(
      new Command({ resume: snapshot(5, { checks: E2E_FIRST_ATTEMPT }) }),
      threadConfig(74),
    );

    expect(summary(notices)).toEqual([
      'tracking',
      {
        status: 'needsIntervention',
        reasons: [
          { kind: 'checksFailed', checks: ['e2e'] },
          { kind: 'rerunRejected', checks: ['e2e'] },
        ],
      },
    ]);
    expect(lines).toEqual([expect.stringContaining('403 Resource not accessible') as string]);
    expect((await graph.getState(threadConfig(74))).next).toEqual([]);
  });

  it('si falla por la red, el nodo queda pendiente y se vuelve a pedir, sin avisar', async () => {
    const { notifier, notices } = recordingNotifier();
    const reruns = recordingReruns();
    reruns.recorded.failure = new TypeError('fetch failed');
    const graph = trackingGraph(
      notifier,
      recordingRequests().reviewRequests,
      noFindings,
      undefined,
      reruns.checkReruns,
    );
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));

    await expect(
      graph.invoke(
        new Command({ resume: snapshot(5, { checks: E2E_FIRST_ATTEMPT }) }),
        threadConfig(74),
      ),
    ).rejects.toThrow('fetch failed');
    expect((await graph.getState(threadConfig(74))).next).toEqual(['relanzar']);

    reruns.recorded.failure = undefined;
    await graph.invoke(null, threadConfig(74));

    expect(reruns.recorded.reruns).toEqual([RUN]);
    expect(summary(notices)).toEqual(['tracking']);
    expect((await graph.getState(threadConfig(74))).next).toEqual(['esperarComprobaciones']);
  });

  it('no relanza una ya relanzada a mano, una cancelada ni una que no es relanzable', async () => {
    const lint: Check = { name: 'lint', status: 'passed', conclusion: 'success' };
    for (const [checks, name] of [
      [[lint, failedIn('test', 2)], 'test'],
      [[lint, failedIn('e2e', 1, 'cancelled')], 'e2e'],
      [[failedIn('lint', 1), { name: 'e2e', status: 'passed', conclusion: 'success' }], 'lint'],
    ] as const) {
      const { notices, reruns } = await follow(snapshot(0), snapshot(5, { checks: [...checks] }));

      expect(reruns).toEqual([]);
      expect(summary(notices)).toEqual([
        'tracking',
        { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: [name] }] },
      ]);
    }
  });

  it('`lint` y `e2e` fallan en su primer intento: una sola petición, para su run', async () => {
    const { reruns } = await follow(
      snapshot(0),
      snapshot(5, { checks: [failedIn('lint', 1), failedIn('e2e', 1)] }),
    );

    expect(reruns).toEqual([RUN]);
  });
});

describe('si el relanzamiento no termina en 30 minutos (change pr-check-rerun)', () => {
  const rerunAt20 = [
    snapshot(0),
    snapshot(20, { checks: E2E_FIRST_ATTEMPT }),
    snapshot(21, { checks: E2E_RERUNNING }),
  ];

  it('a los 30 min desde que se pide, necesita intervención con qué no ha terminado', async () => {
    const before = await follow(...rerunAt20, snapshot(49, { checks: E2E_RERUNNING }));
    const after = await follow(...rerunAt20, snapshot(50, { checks: E2E_RERUNNING }));

    expect(summary(before.notices)).toEqual(['tracking']);
    expect(summary(after.notices)).toEqual([
      'tracking',
      { status: 'needsIntervention', reasons: [{ kind: 'checksUnfinished', checks: ['e2e'] }] },
    ]);
  });

  it('tras comprobaciones de 20 min, un relanzamiento que pasa 15 min después llega a tiempo', async () => {
    const { notices } = await follow(...rerunAt20, snapshot(35, { checks: PASSED }));

    expect(summary(notices)).toEqual(['tracking', 'checksFinished']);
  });
});

/** Una incidencia de SonarQube con su código. */
function sonarIssue(file: string, line: number, code: string | null = `>> ${line} | x`): Finding {
  return {
    source: 'sonarIssue',
    rule: 'typescript:S3358',
    ruleName: 'Ternary operators should not be nested',
    severity: 'normal',
    file,
    line,
    message: 'Extract this nested ternary operation into an independent statement.',
    code,
  };
}

/** Las filas de la tabla del resumen publicado, sin la cabecera. */
function summaryRows(triage: ReturnType<typeof recordingTriage>): string[] {
  const text = triage.posted.summaries[0]?.text ?? '';
  return text.split('\n').filter((line) => line.startsWith('| ') && !line.startsWith('| Hallazgo'));
}

/** `e2e` falla, se relanza y su segundo intento acaba con estas comprobaciones, a los 9 min. */
const rerunThen = (checks: Check[]) => [
  snapshot(0),
  snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
  snapshot(6, { checks: E2E_RERUNNING }),
  snapshot(9, { checks }),
];

describe('una comprobación relanzable que ha fallado dos veces sale real por regla (change pr-check-rerun)', () => {
  it('el relanzamiento vuelve a fallar: real por la regla, que dice que ha fallado dos veces, sin preguntar al modelo', async () => {
    const triage = recordingTriage([failingCheck('e2e')]);

    await followTriage(triage, rerunThen(E2E_FAILED_AGAIN));

    expect(triage.asked).toEqual([]);
    expect(summaryRows(triage)).toEqual(['| Comprobación `e2e` | real | regla: ha fallado dos veces |']);
    expect(triage.events.slice(-2)).toEqual(['publicar resumen', 'aviso final']);
  });

  it('un relanzamiento a mano cuenta: `test` en su segundo intento sale real sin relanzarla', async () => {
    const triage = recordingTriage([failingCheck('test')]);
    const reruns = recordingReruns();

    await followTriage(
      triage,
      [snapshot(0), snapshot(5, { checks: [PASSED[0]!, failedIn('test', 2)] })],
      undefined,
      reruns.checkReruns,
    );

    expect(reruns.recorded.reruns).toEqual([]);
    expect(triage.asked).toEqual([]);
    expect(summaryRows(triage)).toEqual(['| Comprobación `test` | real | regla: ha fallado dos veces |']);
  });

  it('el error del último intento es un timeout: lo dice como caso evidente', async () => {
    const timeout = failingCheck('e2e', {
      state: 'available',
      origin: 'annotations',
      summary: '',
      errors: [
        {
          file: 'e2e/effects.spec.ts',
          line: 81,
          title: null,
          message: 'Test timeout of 30000ms exceeded.',
        },
      ],
      truncated: false,
    });
    const triage = recordingTriage([timeout]);

    await followTriage(triage, rerunThen(E2E_FAILED_AGAIN));

    expect(summaryRows(triage)).toEqual([
      '| Comprobación `e2e` | real | regla: ha fallado dos veces · caso evidente: timeout |',
    ]);
  });

  it('la regla no necesita contexto: con el log ilegible, real y no exige criterio', async () => {
    const triage = recordingTriage([failingCheck('e2e', { state: 'unreadable' })]);

    await followTriage(triage, rerunThen(E2E_FAILED_AGAIN));

    expect(summaryRows(triage)).toEqual(['| Comprobación `e2e` | real | regla: ha fallado dos veces |']);
  });
});

describe('una comprobación relanzable sin resultado tras relanzarla exige criterio (change pr-check-rerun)', () => {
  it('GitHub rechaza el relanzamiento: exige criterio porque no se ha podido relanzar', async () => {
    const triage = recordingTriage([failingCheck('e2e')]);
    const reruns = recordingReruns();
    reruns.recorded.failure = new GitHubRequestRejectedError('403 Resource not accessible');

    await followTriage(
      triage,
      [snapshot(0), snapshot(5, { checks: E2E_FIRST_ATTEMPT })],
      undefined,
      reruns.checkReruns,
    );

    expect(triage.asked).toEqual([]);
    expect(summaryRows(triage)).toEqual([
      '| Comprobación `e2e` | exige criterio | regla: no se ha podido relanzar |',
    ]);
  });

  it('el relanzamiento no termina en 30 min: se tría, y exige criterio porque no ha terminado', async () => {
    // GitHub no da ninguna comprobación que falle: la que no ha terminado la añade el sistema.
    const triage = recordingTriage([]);

    await followTriage(triage, [
      snapshot(0),
      snapshot(5, { checks: E2E_FIRST_ATTEMPT }),
      snapshot(6, { checks: E2E_RERUNNING }),
      snapshot(35, { checks: E2E_RERUNNING }),
    ]);

    expect(triage.asked).toEqual([]);
    expect(triage.events).toEqual(['tracking', 'leer hallazgos', 'publicar resumen', 'aviso final']);
    expect(summaryRows(triage)).toEqual([
      '| Comprobación `e2e` | exige criterio | regla: el relanzamiento no ha terminado |',
    ]);
  });

  it('una comprobación que no ha terminado sin haberse relanzado no se tría, como antes', async () => {
    const triage = recordingTriage([]);

    await followTriage(triage, [snapshot(0), snapshot(29), snapshot(30)]);

    expect(triage.events).toEqual(['tracking', 'aviso final']);
  });

  it('la comprobación se ha cancelado: exige criterio con ese motivo, sin preguntar al modelo', async () => {
    const triage = recordingTriage([{ ...(failingCheck('e2e') as CheckFinding), conclusion: 'cancelled' }]);

    await followTriage(triage, [
      snapshot(0),
      snapshot(5, { checks: [PASSED[0]!, failedIn('e2e', 1, 'cancelled')] }),
    ]);

    expect(triage.asked).toEqual([]);
    expect(summaryRows(triage)).toEqual([
      '| Comprobación `e2e` | exige criterio | regla: se ha cancelado |',
    ]);
  });
});

describe('el resumen dice lo que se relanzó y pasó (change pr-check-rerun)', () => {
  /** Tras pasar las comprobaciones, el revisor termina sin hallazgos a los 12 min. */
  const reviewedAfter = (checks: Check[]) => [
    ...rerunThen(checks),
    snapshot(12, { checks, review: reviewed() }),
  ];

  it('relanzada y pasada en una PR lista para integrar: un resumen sin hallazgos que lo dice, y el aviso de siempre', async () => {
    const triage = recordingTriage([]);

    await followTriage(triage, reviewedAfter(PASSED));

    expect(triage.reads).toEqual([]);
    expect(triage.events).toEqual(['tracking', 'checksFinished', 'publicar resumen', 'aviso final']);
    expect(triage.posted.summaries).toEqual([
      {
        number: 74,
        sha: HEAD,
        text: triageSummary({ sha: HEAD, findings: [], rerunPassed: ['e2e'] }, 0.8),
      },
    ]);
  });

  it('relanzada y pasada junto a un `lint` que falla: el resumen lleva las dos cosas', async () => {
    const triage = recordingTriage([failingCheck('lint')]);

    await followTriage(triage, [
      snapshot(0),
      snapshot(5, { checks: [failedIn('lint', 1), failedIn('e2e', 1)] }),
      snapshot(9, { checks: [failedIn('lint', 2), PASSED[1]!] }),
    ]);

    const text = triage.posted.summaries[0]?.text ?? '';
    expect(summaryRows(triage)).toEqual(['| Comprobación `lint` | real | regla: comprobación determinista |']);
    expect(text).toContain('La comprobación `e2e` se relanzó y pasó.');
    expect(text).not.toContain('`lint` se relanzó');
  });

  it('una PR que pasa a la primera no tiene resumen', async () => {
    const triage = recordingTriage([]);

    await followTriage(triage, [
      snapshot(0),
      snapshot(5, { checks: PASSED }),
      snapshot(9, { checks: PASSED, review: reviewed() }),
    ]);

    expect(triage.posted.summaries).toEqual([]);
  });

  it('un solo resumen por push, también en el camino de lista para integrar', async () => {
    const triage = recordingTriage([]);
    triage.posted.existing.push(HEAD);

    await followTriage(triage, reviewedAfter(PASSED));

    expect(triage.posted.summaries).toEqual([]);
    expect(triage.events.at(-1)).toBe('aviso final');
  });
});

describe('cada incidencia nueva de SonarQube se tría como un hallazgo propio', () => {
  it('dos incidencias dan dos peticiones al modelo, cada una con la suya y la pregunta de la regla', async () => {
    const first = sonarIssue('packages/shared/src/a.ts', 3);
    const second = sonarIssue('tooling/ci/b.ts', 4);
    const triage = recordingTriage([first, second]);

    const state = await followTriage(triage, failing);

    expect(triage.asked).toHaveLength(2);
    expect(triage.asked).toEqual(
      expect.arrayContaining([
        { context: CONTEXT, finding: first, question: 'rule' },
        { context: CONTEXT, finding: second, question: 'rule' },
      ]),
    );
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: first, verdict: { class: 'valid' } },
          { finding: second, verdict: { class: 'valid' } },
        ],
      },
    });
  });

  it('una incidencia sin código no llega al modelo y exige criterio, y la otra sí llega', async () => {
    const noCode = sonarIssue('packages/shared/src/a.ts', 999, null);
    const withCode = sonarIssue('tooling/ci/b.ts', 4);
    const triage = recordingTriage([noCode, withCode]);

    const state = await followTriage(triage, failing);

    expect(triage.asked.map(({ finding }) => finding)).toEqual([withCode]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [
          { finding: noCode, verdict: { class: 'needsJudgment', reason: 'noContext' } },
          { finding: withCode, verdict: { class: 'valid' } },
        ],
      },
    });
    expect(triage.posted.summaries[0]?.text).toContain('no se ha podido leer su código');
  });

  it('la comprobación de incidencias sin ninguna legible exige criterio sin preguntar al modelo', async () => {
    const sonarCheck = failingCheck('sonar-issues');
    const triage = recordingTriage([sonarCheck]);

    const state = await followTriage(triage, failing);

    expect(triage.asked).toEqual([]);
    expect(state.values).toMatchObject({
      triage: {
        findings: [{ finding: sonarCheck, verdict: { class: 'needsJudgment', reason: 'noIssues' } }],
      },
    });
  });

  it('si la comprobación trae más incidencias de las triadas, el resumen lo dice', async () => {
    const triage = recordingTriage(
      [sonarIssue('tooling/ci/b.ts', 4)],
      undefined,
      CONTEXT,
      { total: 12, triaged: 10 },
    );

    await followTriage(triage, failing);

    expect(triage.posted.summaries[0]?.text).toContain('trae 12; se han triado las 10 que anota');
  });
});
