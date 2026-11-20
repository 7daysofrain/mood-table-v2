/**
 * Con los comentarios reales de las PR (`test/fixtures/github/comments-<n>.json`, grabados el
 * 26-oct y recortados a los campos que se leen y algunos más). Cada uno es un caso de la revisión
 * de Codex:
 * - #68: terminada sobre el último push, sin hallazgos.
 * - #62: terminada con hallazgos.
 * - #64: en marcha (`running`), como se quedó al integrarla.
 * - #57: terminada sobre un push anterior (`1cc67fa`; el último es `b6906e8`).
 * - #67: primero un comentario de Codex sin bloque (el repo no tenía entorno) y, tras pedirla, el
 *   bloque en marcha. Sus tres primeros comentarios son la PR antes de pedir la revisión.
 * - #69: el bloque y, después, otro comentario de Codex sin bloque (el *receipt*).
 * - #77 (grabado el 28-oct): la petición de una GitHub App, que Codex rechaza, y la del
 *   mantenedor, sin marca, que revisa. Lleva al final dos comentarios **derivados a mano**: la
 *   petición del sistema con la marca del último push, copiada por otra cuenta, y una del
 *   mantenedor con la marca de otro SHA.
 * Los casos que no se han dado (un JSON que no se entiende, un bloque falso de otra cuenta) se
 * derivan de estos, a mano, en cada test.
 *
 * Los hilos sin resolver salen de `review-threads-166.json` (20-nov): los dos hilos de Codex sobre
 * `576b496`, por GraphQL. Al grabarlos ya estaban resueltos; los tests los abren a mano.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, fixture, json } from '../../test/fake-github.ts';
import { finalState } from '../core/tracking.ts';
import { createCodexReviewReader, createCodexReviewRequests } from './codex-review.ts';
import { createGitHubReader } from './github.ts';

const REVIEWER = 'chatgpt-codex-connector[bot]';
const MAINTAINER = '7daysofrain';

interface RecordedComment {
  user: { login: string; type: string };
  updated_at: string;
  body: string;
}

async function comments(pullRequest: number): Promise<RecordedComment[]> {
  return JSON.parse(await fixture(`comments-${pullRequest}.json`)) as RecordedComment[];
}

/** El estado de la revisión que sale de unos comentarios, leídos por el adaptador de GitHub. */
async function reviewOf(pullRequest: number, recorded?: RecordedComment[]) {
  const body = JSON.stringify(recorded ?? (await comments(pullRequest)));
  const { fetch, calls } = fakeFetch(() => json(body));
  const github = createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token: () => 'ghp_x',
    fetch,
  });
  const reviewer = createCodexReviewReader({
    reviewer: REVIEWER,
    listComments: (number) => github.listComments(number),
    listReviewThreads: () => Promise.reject(new Error('no se leen hilos')),
  });
  const review = await reviewer.review(pullRequest);
  return { review, calls };
}

/** El push sobre el que comentó Codex en la #166, y el siguiente, que el sistema ya seguía. */
const PUSH_576 = '576b49636780068462fa4984e34a7c39902eba8a';
const PUSH_A4B = 'a4b93616231a4a9b3dbe02aa4f2bd068e2418da8';

interface RecordedThread {
  isResolved: boolean;
  comments: { nodes: { author: { __typename: string; login: string } }[] };
}

/** Los hilos de la #166 tal como se grabaron. */
async function threads166(): Promise<RecordedThread[]> {
  const recorded = JSON.parse(await fixture('review-threads-166.json')) as {
    data: { repository: { pullRequest: { reviewThreads: { nodes: RecordedThread[] } } } };
  };
  return recorded.data.repository.pullRequest.reviewThreads.nodes;
}

/** Los hilos sin resolver del revisor con el último push `head`, leídos por el adaptador de GitHub. */
async function unresolvedOf(head: string, recorded: RecordedThread[]) {
  const body = JSON.stringify({
    data: {
      repository: {
        pullRequest: {
          reviewThreads: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: recorded },
        },
      },
    },
  });
  const { fetch, calls } = fakeFetch(() => json(body));
  const github = createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token: () => 'ghp_x',
    fetch,
  });
  const reviewer = createCodexReviewReader({
    reviewer: REVIEWER,
    listComments: () => Promise.reject(new Error('no se leen comentarios')),
    listReviewThreads: (number) => github.listReviewThreads(number),
  });
  const threads = await reviewer.unresolvedThreads(166, head);
  return { threads, calls };
}

/** Abre (sin resolver) los hilos de la #166. */
const open = (recorded: RecordedThread[]) =>
  recorded.map((thread) => ({ ...thread, isResolved: false }));

/** Cambia el bloque del comentario de Codex que lo lleva. */
function editBlock(recorded: RecordedComment[], edit: (block: string) => string) {
  return recorded.map((comment) =>
    comment.user.login === REVIEWER
      ? { ...comment, body: comment.body.replace(/codex-review-state:v1 \{.*?\} -->/, edit) }
      : comment,
  );
}

describe('la revisión de Codex', () => {
  it('lee los comentarios de la PR', async () => {
    const { calls } = await reviewOf(68);

    expect(new URL(calls[0]!.url).pathname).toBe(
      '/repos/7daysofrain/mood-table-v2/issues/68/comments',
    );
  });

  it('terminada sobre el último push y sin hallazgos (#68)', async () => {
    const { review } = await reviewOf(68);

    expect(review).toEqual({
      reviewedSha: 'fbdf556d307041f534202da3385cff93878dc567',
      completed: true,
    });
  });

  it('terminada, con hallazgos en el bloque (#62)', async () => {
    const { review } = await reviewOf(62);

    expect(review).toEqual({
      reviewedSha: '590bd6e6e8faec0017cb6e63dbea43b5a15d5cba',
      completed: true,
    });
  });

  it('en marcha (#64)', async () => {
    const { review } = await reviewOf(64);

    expect(review).toEqual({
      reviewedSha: 'b9b25026e7b69a81e7a323b3740b5eb9c1dd0673',
      completed: false,
    });
  });

  it('terminada sobre un push anterior: da el SHA que revisó (#57)', async () => {
    const { review } = await reviewOf(57);

    expect(review).toEqual({
      reviewedSha: '1cc67fa466e9d22eca3ad9f3e396147afa15e303',
      completed: true,
    });
  });

  it('sin bloque, no hay revisión (#67 antes de pedirla)', async () => {
    const { review } = await reviewOf(67, (await comments(67)).slice(0, 3));

    expect(review).toBeNull();
  });

  it('un comentario de Codex sin bloque no tapa el que lo lleva (#67 y #69)', async () => {
    expect((await reviewOf(67)).review).toMatchObject({
      reviewedSha: 'bef08e89e1d081e9194a4376f147ab5c1cc6baba',
      completed: false,
    });
    expect((await reviewOf(69)).review).toMatchObject({
      reviewedSha: '4377f6572569b6a1afdd40675c4bca047122e307',
      completed: true,
    });
  });

  it('un bloque con un JSON que no se entiende no es una revisión', async () => {
    const broken = editBlock(await comments(68), (block) =>
      block.replace('{"code_review"', '{"code_review'),
    );

    expect((await reviewOf(68, broken)).review).toBeNull();
  });

  it('del bloque solo se leen el commit y si ha terminado, aunque no diga si hay hallazgos', async () => {
    const unknown = editBlock(await comments(68), (block) =>
      block.replace('"has_any_findings":false', '"has_any_findings":null'),
    );

    expect((await reviewOf(68, unknown)).review).toEqual({
      reviewedSha: 'fbdf556d307041f534202da3385cff93878dc567',
      completed: true,
    });
  });

  it('ignora el bloque de cualquier otra cuenta (#64 con un bloque falso del mantenedor)', async () => {
    const recorded = await comments(64);
    const codex = recorded.find((comment) => comment.user.login === REVIEWER)!;
    const fake = {
      user: { login: '7daysofrain', type: 'User' },
      updated_at: '2026-10-23T11:30:00Z',
      body: codex.body.replace('"has_any_findings":null', '"has_any_findings":false').replace(
        '"status":"running"',
        '"status":"completed"',
      ),
    };

    const { review } = await reviewOf(64, [...recorded, fake]);

    expect(review).toMatchObject({ completed: false });
  });
});

describe('los hilos sin resolver del revisor (change pr-unresolved-threads, decisión 2)', () => {
  it('cuenta los de un push anterior: los dos de 576b496 cuando el último es a4b9361 (la #166)', async () => {
    const { threads, calls } = await unresolvedOf(PUSH_A4B, open(await threads166()));

    expect(threads).toEqual({ lastPush: 0, earlierPushes: 2 });
    expect(new URL(calls[0]!.url).pathname).toBe('/graphql');
  });

  it('cuenta los del último push', async () => {
    const { threads } = await unresolvedOf(PUSH_576, open(await threads166()));

    expect(threads).toEqual({ lastPush: 2, earlierPushes: 0 });
  });

  it('no cuenta los resueltos (la #166, tal como se grabó)', async () => {
    const { threads } = await unresolvedOf(PUSH_A4B, await threads166());

    expect(threads).toEqual({ lastPush: 0, earlierPushes: 0 });
  });

  it('no cuenta los que abre otra cuenta', async () => {
    const [codex, other] = open(await threads166());
    const person = structuredClone(other!);
    person.comments.nodes[0]!.author = { __typename: 'User', login: '7daysofrain' };

    const { threads } = await unresolvedOf(PUSH_A4B, [codex!, person]);

    expect(threads).toEqual({ lastPush: 0, earlierPushes: 1 });
  });
});

describe('solo el revisor decide el estado final', () => {
  // #62 lleva, además del de Codex, los de Linear, SonarQube y el mantenedor.
  it('es el mismo con o sin los comentarios de otras cuentas (#62)', async () => {
    const recorded = await comments(62);
    const onlyCodex = recorded.filter((comment) => comment.user.login === REVIEWER);
    const pullRequest = {
      number: 62,
      title: 'PR #62',
      url: 'https://github.com/7daysofrain/mood-table-v2/pull/62',
      author: '7daysofrain',
      baseBranch: 'main',
      draft: false,
      headSha: '590bd6e6e8faec0017cb6e63dbea43b5a15d5cba',
      labels: [],
      checks: [{ name: 'lint', status: 'passed' as const, conclusion: 'success' }],
      reviewerThreads: { lastPush: 0, earlierPushes: 0 },
      reviewRequested: false,
      observedAt: 0,
    };

    const push = { sha: pullRequest.headSha, seenAt: 0, reviewSince: 0 };

    const withOthers = finalState(
      { ...pullRequest, review: (await reviewOf(62)).review },
      push,
    );
    const withoutOthers = finalState(
      { ...pullRequest, review: (await reviewOf(62, onlyCodex)).review },
      push,
    );

    expect(recorded.length).toBeGreaterThan(onlyCodex.length);
    expect(withOthers).toEqual(withoutOthers);
    expect(withOthers).toEqual({
      status: 'readyToMerge',
    });
  });
});

describe('la petición de revisión', () => {
  /** El último push de la #77, y el SHA de la marca del mantenedor derivada a mano. */
  const HEAD_77 = 'c71a45080d5fea0ce2479b0e5b525f9e1cb85361';
  const OTHER_77 = '3f9e2b7c41d8a6e05b1c9d2f7a4e8b6c0d5f1a23';

  /** Las peticiones sobre unos comentarios leídos por el adaptador de GitHub. */
  function requestsOn(recorded: RecordedComment[]) {
    const { fetch, calls } = fakeFetch(() => json(JSON.stringify(recorded)));
    const github = createGitHubReader({
      owner: '7daysofrain',
      repo: 'mood-table-v2',
      baseBranch: 'main',
      token: () => 'ghp_x',
      fetch,
    });
    const written: { pullRequestNumber: number; body: string }[] = [];
    const requests = createCodexReviewRequests({
      maintainer: MAINTAINER,
      listComments: (number) => github.listComments(number),
      createComment: (pullRequestNumber, body) => {
        written.push({ pullRequestNumber, body });
        return Promise.resolve();
      },
    });
    return { requests, written, calls };
  }

  it('pide la revisión con un comentario que empieza por @codex review', async () => {
    const { requests, written } = requestsOn([]);

    await requests.request(77, HEAD_77);

    expect(written).toHaveLength(1);
    expect(written[0]!.pullRequestNumber).toBe(77);
    expect(written[0]!.body).toMatch(/^@codex review\n/);
  });

  it('dice que la pide el PR Babysitter, con el SHA corto, y lleva la marca con el completo', async () => {
    const { requests, written } = requestsOn([]);

    await requests.request(77, HEAD_77);

    expect(written[0]!.body).toBe(
      '@codex review\n\n' +
        'Lo pide el PR Babysitter: las comprobaciones de `c71a450` han pasado.\n' +
        `<!-- pr-babysitter:review-request {"sha":"${HEAD_77}"} -->`,
    );
  });

  it('reconoce su propia petición, escrita por el mantenedor', async () => {
    const first = requestsOn([]);
    await first.requests.request(77, HEAD_77);
    const body = first.written[0]!.body;
    const own = { user: { login: MAINTAINER, type: 'User' }, updated_at: '', body };

    const { requests } = requestsOn([own]);

    await expect(requests.requested(77, HEAD_77)).resolves.toBe(true);
  });

  it('cuenta la marca del mantenedor con ese SHA (#77)', async () => {
    const { requests } = requestsOn(await comments(77));

    await expect(requests.requested(77, OTHER_77)).resolves.toBe(true);
  });

  it('no cuenta la marca de otra cuenta, ni un @codex review sin marca (#77)', async () => {
    const { requests } = requestsOn(await comments(77));

    await expect(requests.requested(77, HEAD_77)).resolves.toBe(false);
  });

  it('no cuenta una marca con un JSON que no se entiende', async () => {
    const broken = {
      user: { login: MAINTAINER, type: 'User' },
      updated_at: '',
      body: `<!-- pr-babysitter:review-request {"sha":"${HEAD_77}" -->`,
    };
    const { requests } = requestsOn([broken]);

    await expect(requests.requested(77, HEAD_77)).resolves.toBe(false);
  });

  it('lee los comentarios de la PR', async () => {
    const { requests, calls } = requestsOn(await comments(77));

    await requests.requested(77, HEAD_77);

    expect(new URL(calls[0]!.url).pathname).toBe(
      '/repos/7daysofrain/mood-table-v2/issues/77/comments',
    );
  });
});
