/**
 * El arreglo en el grafo (change pr-fixer, decisiones 3, 10 y 11): `decidir` elige arreglar, el
 * hilo pide el arreglo al puerto `Fixer` y lo espera como espera a la CI, y avisa de lo que no se
 * arregla. Un `describe` por requisito de `pr-fix` y por cada requisito cambiado de `pr-tracking` y
 * `pr-triage`, con un `Fixer` falso.
 */
import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import type { FixJob, FixStatus } from './fix.ts';
import { createTrackingGraph, PR_ACTION_NODES, threadConfig } from './graph.ts';
import { type Notice, noticeSummary } from './notice.ts';
import type { DecisionModel, Findings, Fixer, Notifier } from './ports.ts';
import type { Check, PullRequestSnapshot } from './pull-request.ts';
import type { CheckFinding, Finding, PullRequestContext } from './triage.ts';

const MINUTE = 60_000;
const HEAD = 'a1b2c3d';
const FIXED = 'f1x3d00';

const CONTEXT: PullRequestContext = { title: 'Pintar la tira', description: 'Fixes MOO-90' };

const passed = (name: string): Check => ({ name, status: 'passed', conclusion: 'success' });
const failed = (name: string, attempt?: number): Check => ({
  name,
  status: 'failed',
  conclusion: 'failure',
  ...(attempt === undefined ? {} : { attempt, runId: 42, runFinished: true }),
});

function snapshot(minute: number, overrides: Partial<PullRequestSnapshot> = {}): PullRequestSnapshot {
  return {
    number: 74,
    title: 'Pintar la tira',
    url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
    author: '7daysofrain',
    baseBranch: 'main',
    draft: false,
    headSha: HEAD,
    labels: [],
    checks: [passed('lint'), { name: 'build', status: 'pending', conclusion: null }],
    review: null,
    reviewerThreads: { lastPush: 0, earlierPushes: 0 },
    reviewRequested: false,
    observedAt: minute * MINUTE,
    ...overrides,
  };
}

const checkFinding = (name: string): CheckFinding => ({
  source: 'check',
  name,
  conclusion: 'failure',
  context: { state: 'available', origin: 'log', summary: `falla ${name}`, errors: [], truncated: false },
});

/** `lint` falla: real por regla. */
const LINT_FAILS = [failed('lint'), passed('build')];
/** `lint` y `build` fallan: `lint` real por regla, `build` exige criterio (p = 0,55). */
const LINT_AND_BUILD_FAIL = [failed('lint'), failed('build')];
/** `e2e` ha vuelto a fallar al relanzarlo: real por regla, pero no la causa la PR. */
const E2E_FAILED_TWICE = [passed('lint'), failed('e2e', 2)];

function findingsFor(found: Finding[]): Findings {
  return {
    read: () => Promise.resolve({ context: CONTEXT, findings: found, sonarIssues: null }),
    readChecks: () => Promise.resolve({ context: CONTEXT, findings: [] }),
  };
}

/** El modelo falso: cualquier causa que se le pregunta, sin tenerlo claro. */
const unsureModel: DecisionModel = {
  estimate: () => 100,
  ask: () => Promise.resolve({ answer: { kind: 'answered', probability: 0.55 }, inputTokens: 100 }),
};

/** Un `Fixer` falso: guarda cada trabajo pedido y da el estado que se le ponga. */
function fakeFixer() {
  const recorded = {
    jobs: [] as FixJob[],
    status: { state: 'queued' } as FixStatus,
    spentUsd: 0,
    requestFails: false,
  };
  const fixer: Fixer = {
    request(job) {
      if (recorded.requestFails) return Promise.reject(new Error('el fixer no contesta'));
      recorded.jobs.push(job);
      return Promise.resolve();
    },
    status: () => Promise.resolve(recorded.status),
    spent: () => Promise.resolve(recorded.spentUsd),
  };
  return { fixer, recorded };
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

function setup(found: Finding[], { enabled = true } = {}) {
  const { notifier, notices } = recordingNotifier();
  const { fixer, recorded } = fakeFixer();
  const graph = createTrackingGraph(
    {
      notifier,
      reviewRequests: { requested: () => Promise.resolve(false), request: () => Promise.resolve() },
      findings: findingsFor(found),
      decisionModel: unsureModel,
      summaries: { published: () => Promise.resolve(false), publish: () => Promise.resolve() },
      checkReruns: { rerun: () => Promise.resolve() },
      fixer,
    },
    new MemorySaver(),
    {
      timeoutMs: 30 * MINUTE,
      notRunMarginMs: 2 * MINUTE,
      log: () => undefined,
      rerunChecks: ['test', 'e2e'],
      triage: {
        threshold: 0.8,
        budget: { capUsd: 0.05, inputPricePerMTok: 0.24 },
        ruleChecks: ['lint', 'typecheck'],
        sonarIssuesCheck: 'sonar-issues',
      },
      fix: { enabled, budgetUsd: 2, timeoutMs: 60 * MINUTE },
    },
  );
  const config = threadConfig(74);
  return {
    graph,
    notices,
    recorded,
    start: (first: PullRequestSnapshot) => graph.invoke({ snapshot: first }, config),
    resume: (next: PullRequestSnapshot) => graph.invoke(new Command({ resume: next }), config),
    state: () => graph.getState(config),
  };
}

/** Los avisos después del de seguimiento, en corto. */
function after(notices: Notice[]) {
  return notices.slice(1).map((notice) => (notice.type === 'final' ? notice.state : notice));
}

describe('pr-fix · El sistema arregla los hallazgos reales y los sube a la PR', () => {
  it('un hallazgo real: decide arreglar, pide el trabajo con ese hallazgo y espera sin avisar', async () => {
    const run = setup([checkFinding('lint')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));

    expect(run.recorded.jobs).toEqual([
      {
        number: 74,
        sha: HEAD,
        pr: CONTEXT,
        findings: [checkFinding('lint')],
        budgetUsd: 2,
      },
    ]);
    expect(after(run.notices)).toEqual([]);
    const state = await run.state();
    expect(state.next).toEqual(['esperarArreglo']);
    expect(state.values).toMatchObject({ decision: { action: 'fix', rule: 'fixable' } });
  });

  it('mientras el trabajo está en marcha, sigue esperando sin avisar', async () => {
    const run = setup([checkFinding('lint')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));
    run.recorded.status = { state: 'running' };
    await run.resume(snapshot(6, { checks: LINT_FAILS }));

    expect(after(run.notices)).toEqual([]);
    expect((await run.state()).next).toEqual(['esperarArreglo']);
  });

  it('el arreglo subido: sin aviso, y el push nuevo se sigue como cualquier otro, sin aviso de seguimiento', async () => {
    const run = setup([checkFinding('lint')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));
    run.recorded.status = { state: 'pushed', sha: FIXED, unfixed: [] };
    await run.resume(snapshot(8, { headSha: FIXED }));

    expect(after(run.notices)).toEqual([]);
    const state = await run.state();
    expect(state.next).toEqual(['esperarComprobaciones']);
    expect(state.values).toMatchObject({ push: { sha: FIXED, seenAt: 8 * MINUTE } });
  });

  it('subido pero sin que la foto lo vea todavía: sigue esperando', async () => {
    const run = setup([checkFinding('lint')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));
    run.recorded.status = { state: 'pushed', sha: FIXED, unfixed: [] };
    await run.resume(snapshot(7, { checks: LINT_FAILS }));

    expect((await run.state()).next).toEqual(['esperarArreglo']);
  });

  it('sin hallazgos reales no pide nada y avisa del estado final, como hasta ahora', async () => {
    const run = setup([checkFinding('build')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: [passed('lint'), failed('build')] }));

    expect(run.recorded.jobs).toEqual([]);
    expect(after(run.notices)).toEqual([
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['build'] }] },
    ]);
  });
});

describe('pr-fix · Un arreglo que no pasa lint, typecheck y test no se sube', () => {
  it('uno de dos no pasa: tras subir el otro, avisa del que sigue sin arreglar, con el motivo', async () => {
    const run = setup([checkFinding('lint'), checkFinding('typecheck')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: [failed('lint'), failed('typecheck')] }));
    run.recorded.status = {
      state: 'pushed',
      sha: FIXED,
      unfixed: [{ finding: checkFinding('typecheck'), reason: 'checksFailed' }],
    };
    await run.resume(snapshot(8, { headSha: FIXED }));

    const [notice] = after(run.notices);
    expect(notice).toMatchObject({
      type: 'notFixed',
      items: [{ label: '`typecheck`', reason: 'checksFailed' }],
    });
    expect(noticeSummary(notice as Notice)).toMatch(/`typecheck` \(no pasa lint, typecheck y test\)/);
  });

  it('ninguno pasa: no hay push, y avisa del estado final con el motivo del arreglo', async () => {
    const run = setup([checkFinding('lint')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));
    run.recorded.status = {
      state: 'failed',
      reason: 'nothingFixed',
      unfixed: [{ finding: checkFinding('lint'), reason: 'checksFailed' }],
    };
    await run.resume(snapshot(9, { checks: LINT_FAILS }));

    expect(after(run.notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [
          { kind: 'checksFailed', checks: ['lint'] },
          { kind: 'fixFailed', reason: 'nothingFixed', unfixed: ['`lint` (no pasa lint, typecheck y test)'] },
        ],
      },
    ]);
    expect((await run.state()).next).toEqual([]);
  });
});

describe('pr-fix · Una comprobación que la PR no causa no se arregla en la PR', () => {
  it('e2e ha fallado dos veces: no se pide arreglo y el aviso final dice que la PR no la causa', async () => {
    const run = setup([{ ...checkFinding('e2e'), attempt: 2 }]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: E2E_FAILED_TWICE }));

    expect(run.recorded.jobs).toEqual([]);
    expect(after(run.notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [
          { kind: 'checksFailed', checks: ['e2e'] },
          { kind: 'notCausedByPr', checks: ['e2e'] },
        ],
      },
    ]);
  });

  it('junto a un real arreglable, se arregla el real y se avisa de la que no causa la PR', async () => {
    const run = setup([checkFinding('lint'), { ...checkFinding('e2e'), attempt: 2 }]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: [failed('lint'), failed('e2e', 2)] }));

    expect(run.recorded.jobs.map((job) => job.findings)).toEqual([[checkFinding('lint')]]);
    run.recorded.status = { state: 'pushed', sha: FIXED, unfixed: [] };
    await run.resume(snapshot(8, { headSha: FIXED }));

    expect(after(run.notices)).toMatchObject([
      { type: 'notFixed', items: [{ label: '`e2e`', reason: 'notCausedByPr' }] },
    ]);
  });
});

describe('pr-fix · Los hallazgos reales se arreglan aunque haya otros que exigen criterio', () => {
  it('pide solo el real y, al subirlo, avisa del que exige criterio', async () => {
    const run = setup([checkFinding('lint'), checkFinding('build')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_AND_BUILD_FAIL }));

    expect(run.recorded.jobs.map((job) => job.findings)).toEqual([[checkFinding('lint')]]);
    run.recorded.status = { state: 'pushed', sha: FIXED, unfixed: [] };
    await run.resume(snapshot(8, { headSha: FIXED }));

    expect(after(run.notices)).toMatchObject([
      { type: 'notFixed', items: [{ label: '`build`', reason: 'needsJudgment' }] },
    ]);
  });
});

describe('pr-fix · El arreglo no pasa del tope de gasto de la PR', () => {
  it('sin tope, no pide el arreglo y el aviso final lo dice', async () => {
    const run = setup([checkFinding('lint')]);
    run.recorded.spentUsd = 2;
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));

    expect(run.recorded.jobs).toEqual([]);
    expect(after(run.notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [{ kind: 'checksFailed', checks: ['lint'] }, { kind: 'fixBudgetSpent' }],
      },
    ]);
  });

  it('el trabajo recibe solo lo que queda del tope', async () => {
    const run = setup([checkFinding('lint')]);
    run.recorded.spentUsd = 0.5;
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));

    expect(run.recorded.jobs[0]?.budgetUsd).toBe(1.5);
  });
});

describe('pr-tracking · el push que se arregla no tiene aviso de estado final', () => {
  it('si el fixer no contesta al pedirlo, avisa del estado final con ese motivo', async () => {
    const run = setup([checkFinding('lint')]);
    run.recorded.requestFails = true;
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));

    expect(after(run.notices)).toEqual([
      {
        status: 'needsIntervention',
        reasons: [
          { kind: 'checksFailed', checks: ['lint'] },
          { kind: 'fixFailed', reason: 'fixerUnavailable', unfixed: [] },
        ],
      },
    ]);
  });

  it('con FIX_ENABLED=false, todo sigue como antes del arreglo', async () => {
    const run = setup([checkFinding('lint')], { enabled: false });
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_FAILS }));

    expect(run.recorded.jobs).toEqual([]);
    expect(after(run.notices)).toEqual([
      { status: 'needsIntervention', reasons: [{ kind: 'checksFailed', checks: ['lint'] }] },
    ]);
  });

  it('un push del mantenedor mientras arregla: se sigue el push nuevo, sin avisar de lo que no se arregló', async () => {
    const run = setup([checkFinding('lint'), checkFinding('build')]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: LINT_AND_BUILD_FAIL }));
    run.recorded.status = { state: 'running' };
    await run.resume(snapshot(7, { headSha: 'm41nt41' }));

    expect(after(run.notices)).toEqual([]);
    const state = await run.state();
    expect(state.next).toEqual(['esperarComprobaciones']);
    expect(state.values).toMatchObject({ push: { sha: 'm41nt41' } });
  });
});

describe('pr-triage · La decisión de arreglar queda registrada', () => {
  it('la decisión y su regla quedan en el estado, también cuando no se arregla', async () => {
    const run = setup([{ ...checkFinding('e2e'), attempt: 2 }]);
    await run.start(snapshot(0));
    await run.resume(snapshot(5, { checks: E2E_FAILED_TWICE }));

    expect((await run.state()).values).toMatchObject({
      decision: { action: 'publish', rule: 'notCausedByPr' },
    });
  });
});

describe('el driver no pide el arreglo de un push viejo ni de una PR detenida', () => {
  it('pedirArreglo es un nodo que actúa sobre la PR', () => {
    expect(PR_ACTION_NODES).toContain('pedirArreglo');
  });
});
