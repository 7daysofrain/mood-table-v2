import { Command, MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createTrackingGraph, threadConfig } from './graph.ts';
import type { Notice } from './notice.ts';
import type { Notifier } from './ports.ts';
import type { PullRequestSnapshot } from './pull-request.ts';

function snapshot(observedAt: number, overrides: Partial<PullRequestSnapshot> = {}) {
  return {
    number: 74,
    title: 'Avisar de cada PR lista para revisar',
    url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
    author: '7daysofrain',
    baseBranch: 'main',
    draft: false,
    headSha: 'a1b2c3d',
    checks: [],
    observedAt,
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

describe('el hilo de una PR', () => {
  it('al empezar avisa de que sigue la PR y se queda esperando las comprobaciones', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = createTrackingGraph(notifier, new MemorySaver());

    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));

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
    const state = await graph.getState(threadConfig(74));
    expect(state.next).toEqual(['esperarComprobaciones']);
  });

  it('al reanudarlo con fotos nuevas no repite el aviso y guarda la última foto', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = createTrackingGraph(notifier, new MemorySaver());
    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));

    for (const observedAt of [60_000, 120_000, 180_000]) {
      await graph.invoke(new Command({ resume: snapshot(observedAt) }), threadConfig(74));
    }

    expect(notices).toHaveLength(1);
    const state = await graph.getState(threadConfig(74));
    expect(state.next).toEqual(['esperarComprobaciones']);
    expect(state.values).toEqual({ snapshot: snapshot(180_000) });
  });

  it('cada PR tiene su propio hilo', async () => {
    const { notifier, notices } = recordingNotifier();
    const graph = createTrackingGraph(notifier, new MemorySaver());

    await graph.invoke({ snapshot: snapshot(0) }, threadConfig(74));
    await graph.invoke({ snapshot: snapshot(0, { number: 75 }) }, threadConfig(75));

    expect(notices.map((notice) => notice.type === 'tracking' && notice.pullRequest.number)).toEqual(
      [74, 75],
    );
  });
});
