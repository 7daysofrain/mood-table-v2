/**
 * El adaptador del resumen del triaje (change pr-shadow-triage, decisión 7), sobre el adaptador de
 * GitHub con respuestas falsas: los comentarios que lee son los que da cada test, y lo que escribe
 * es un `POST` que acepta o rechaza.
 */
import { describe, expect, it } from 'vitest';

import { type Call, fakeFetch, json } from '../../test/fake-github.ts';
import { GitHubRequestRejectedError } from '../core/ports.ts';
import { triageSummary } from '../core/triage-summary.ts';
import { createGitHubReader } from './github.ts';
import { createTriageSummaries } from './triage-summary.ts';

const MAINTAINER = '7daysofrain';
const SHA = 'a988f60875fe2643a0c6eb241a44b10bf4eb5c79';
const OTHER_SHA = '38f0872eb46bd3ad2cec57b754653df0504cfbeb';

const comment = (login: string, body: string) => ({
  user: { login, type: 'User' },
  updated_at: '2026-11-02T10:00:00Z',
  body,
});

/** El resumen de un push, tal como lo publica el sistema. */
const summaryOf = (sha: string) => triageSummary({ sha, findings: [] }, 0.8);

/** Los resúmenes sobre unos comentarios, con la respuesta de GitHub al escribir. */
function summariesOn(
  recorded: ReturnType<typeof comment>[],
  onWrite: () => Response = () => json('{"id":1}', 201),
) {
  const { fetch, calls } = fakeFetch((call: Call) =>
    call.method === 'POST' ? onWrite() : json(JSON.stringify(recorded)),
  );
  const github = createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token: () => 'ghp_x',
    fetch,
  });
  const summaries = createTriageSummaries({
    maintainer: MAINTAINER,
    listComments: (number) => github.listComments(number),
    createComment: (number, body) => github.createComment(number, body),
  });
  return { summaries, calls };
}

describe('publicar el resumen', () => {
  it('es un comentario en la PR con el texto del resumen', async () => {
    const { summaries, calls } = summariesOn([]);

    await summaries.publish(99, SHA, summaryOf(SHA));

    const writes = calls.filter((call) => call.method === 'POST');
    expect(writes).toHaveLength(1);
    expect(new URL(writes[0]!.url).pathname).toBe('/repos/7daysofrain/mood-table-v2/issues/99/comments');
    expect((JSON.parse(writes[0]!.body) as { body: string }).body).toBe(summaryOf(SHA));
  });

  it('si GitHub la rechaza con un 403 o un 422, lanza el error de petición rechazada', async () => {
    for (const status of [403, 422]) {
      const { summaries } = summariesOn([], () => json('{"message":"No"}', status));

      await expect(summaries.publish(99, SHA, summaryOf(SHA))).rejects.toBeInstanceOf(
        GitHubRequestRejectedError,
      );
    }
  });

  it('si GitHub falla con un 5xx, lanza un error que no es de petición rechazada', async () => {
    const { summaries } = summariesOn([], () => json('{"message":"Server Error"}', 502));

    const failure = summaries.publish(99, SHA, summaryOf(SHA));

    await expect(failure).rejects.toThrow();
    await expect(failure).rejects.not.toBeInstanceOf(GitHubRequestRejectedError);
  });
});

describe('si el resumen de un push ya está publicado', () => {
  it('sí, con la marca de ese SHA en un comentario del mantenedor', async () => {
    const { summaries } = summariesOn([comment(MAINTAINER, summaryOf(SHA))]);

    await expect(summaries.published(99, SHA)).resolves.toBe(true);
  });

  it('no, si solo está el de otro push', async () => {
    const { summaries } = summariesOn([comment(MAINTAINER, summaryOf(OTHER_SHA))]);

    await expect(summaries.published(99, SHA)).resolves.toBe(false);
  });

  it('no, si la marca la ha copiado otra cuenta (BE6)', async () => {
    const { summaries } = summariesOn([comment('otra-cuenta', summaryOf(SHA))]);

    await expect(summaries.published(99, SHA)).resolves.toBe(false);
  });

  it('no, con la marca de la petición de revisión de ese SHA', async () => {
    const request = `@codex review\n\n<!-- pr-babysitter:review-request {"sha":"${SHA}"} -->`;
    const { summaries } = summariesOn([comment(MAINTAINER, request)]);

    await expect(summaries.published(99, SHA)).resolves.toBe(false);
  });

  it('lee los comentarios de la PR', async () => {
    const { summaries, calls } = summariesOn([]);

    await summaries.published(99, SHA);

    expect(new URL(calls[0]!.url).pathname).toBe('/repos/7daysofrain/mood-table-v2/issues/99/comments');
  });
});
