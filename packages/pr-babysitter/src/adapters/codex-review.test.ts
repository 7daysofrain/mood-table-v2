/**
 * Con los comentarios reales de las PR (`test/fixtures/github/comments-<n>.json`, grabados el
 * 26-oct y recortados a los campos que se leen y algunos más). Cada uno es un caso de la revisión de
 * Codex:
 * - #68: terminada sobre el último push, sin hallazgos.
 * - #62: terminada con hallazgos.
 * - #64: en marcha (`running`), como se quedó al integrarla.
 * - #57: terminada sobre un push anterior (`1cc67fa`; el último es `b6906e8`).
 * - #67: primero un comentario de Codex sin bloque (el repo no tenía entorno) y, tras pedirla, el
 *   bloque en marcha. Sus tres primeros comentarios son la PR antes de pedir la revisión.
 * - #69: el bloque y, después, otro comentario de Codex sin bloque (el *receipt*).
 * Los casos que no se han dado (un JSON que no se entiende, un bloque falso de otra cuenta) se
 * derivan de estos, a mano, en cada test.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, fixture, json } from '../../test/fake-github.ts';
import { createCodexReviewReader } from './codex-review.ts';
import { createGitHubReader } from './github.ts';

const REVIEWER = 'chatgpt-codex-connector[bot]';

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
  });
  const review = await reviewer.review(pullRequest);
  return { review, calls };
}

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
      hasFindings: false,
    });
  });

  it('terminada con hallazgos (#62)', async () => {
    const { review } = await reviewOf(62);

    expect(review).toEqual({
      reviewedSha: '590bd6e6e8faec0017cb6e63dbea43b5a15d5cba',
      completed: true,
      hasFindings: true,
    });
  });

  it('con hallazgos aunque ya estén resueltos: cuenta has_any_findings, no has_unresolved_findings', async () => {
    const resolved = editBlock(await comments(62), (block) =>
      block.replace('"has_unresolved_findings":true', '"has_unresolved_findings":false'),
    );

    const { review } = await reviewOf(62, resolved);

    expect(review).toMatchObject({ completed: true, hasFindings: true });
  });

  it('en marcha (#64)', async () => {
    const { review } = await reviewOf(64);

    expect(review).toEqual({
      reviewedSha: 'b9b25026e7b69a81e7a323b3740b5eb9c1dd0673',
      completed: false,
      hasFindings: false,
    });
  });

  it('terminada sobre un push anterior: da el SHA que revisó (#57)', async () => {
    const { review } = await reviewOf(57);

    expect(review).toEqual({
      reviewedSha: '1cc67fa466e9d22eca3ad9f3e396147afa15e303',
      completed: true,
      hasFindings: false,
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

  it('un bloque terminado sin saber si hay hallazgos no es una revisión', async () => {
    const unknown = editBlock(await comments(68), (block) =>
      block.replace('"has_any_findings":false', '"has_any_findings":null'),
    );

    expect((await reviewOf(68, unknown)).review).toBeNull();
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
