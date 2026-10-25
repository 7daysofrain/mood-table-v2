/**
 * Con respuestas de Linear en `test/fixtures/linear/`. Grabadas el 25-oct: `not-authenticated.json`
 * (la API con un token no válido, HTTP 401) e `invalid-client.json` (el endpoint del token con un
 * cliente no válido, HTTP 400). Las demás tienen la forma de la documentación de Linear (OAuth 2.0 y
 * attachments), porque grabarlas pide las credenciales de la app; se contrastan en la prueba a mano
 * (tasks.md 1.16).
 */
import { readFile } from 'node:fs/promises';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { githubUnauthorizedNotice, trackingNotice } from '../core/notice.ts';
import type { OpenPullRequest } from '../core/pull-request.ts';
import { createLinearNotifier } from './linear.ts';

const PROFILE_URL = 'https://linear.app/7daysofrain/profiles/joseba';
const INBOX_ISSUE_ID = 'f2b9c3d4-0000-4000-8000-000000000086';
const TASK_ISSUE_ID = '590a1127-f98b-49fc-ba74-2df8751c089e';
const DAY = 24 * 60 * 60 * 1000;

const pullRequest: OpenPullRequest = {
  number: 74,
  title: 'Avisar de cada PR lista para revisar',
  url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
  author: '7daysofrain',
  baseBranch: 'main',
  draft: false,
  headSha: 'a1b2c3d',
};

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`../../test/fixtures/linear/${name}`, import.meta.url), 'utf8');
}

function json(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

interface TokenRequest {
  form: URLSearchParams;
}

interface GraphQLRequest {
  authorization: string | null;
  query: string;
  variables: Record<string, unknown>;
}

/**
 * Linear falso sobre el `fetch` global, que es el que usa `@linear/sdk`. Responde con los fixtures y
 * deja cambiar cada respuesta para un caso.
 */
async function fakeLinear() {
  const fixtures = {
    token: await fixture('oauth-token.json'),
    attachments: await fixture('attachments-for-url.json'),
    noAttachments: await fixture('attachments-for-url-empty.json'),
    comment: await fixture('comment-create.json'),
    notAuthenticated: await fixture('not-authenticated.json'),
    invalidClient: await fixture('invalid-client.json'),
  };
  const linear = {
    fixtures,
    tokenRequests: [] as TokenRequest[],
    graphql: [] as GraphQLRequest[],
    /** El token que dará el endpoint en cada petición, en orden; luego, el último. */
    tokens: ['lin_oauth_primero'],
    tokenResponse: undefined as (() => Response) | undefined,
    attachmentsResponse: () => json(fixtures.attachments),
    /** Respuestas de commentCreate, en orden; luego, la del fixture. */
    commentResponses: [] as (() => Response)[],
  };

  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    if (request.url === 'https://api.linear.app/oauth/token') {
      linear.tokenRequests.push({ form: new URLSearchParams(await request.text()) });
      if (linear.tokenResponse) return linear.tokenResponse();
      const accessToken = linear.tokens.length > 1 ? linear.tokens.shift()! : linear.tokens[0]!;
      return json(fixtures.token.replace('lin_oauth_fixture_primero', accessToken));
    }
    const body = (await request.json()) as { query: string; variables: Record<string, unknown> };
    linear.graphql.push({
      authorization: request.headers.get('authorization'),
      query: body.query,
      variables: body.variables,
    });
    if (body.query.includes('attachmentsForURL')) return linear.attachmentsResponse();
    return (linear.commentResponses.shift() ?? (() => json(fixtures.comment)))();
  });
  return linear;
}

function notifier(clock: () => number = () => 0) {
  return createLinearNotifier({
    clientId: 'client-id',
    clientSecret: 'client-secret',
    maintainerProfileUrl: PROFILE_URL,
    inboxIssueId: INBOX_ISSUE_ID,
    clock,
  });
}

/** Las peticiones de commentCreate, con la tarea y el texto del comentario. */
function comments(requests: GraphQLRequest[]) {
  return requests
    .filter((request) => request.query.includes('commentCreate'))
    .map((request) => request.variables.input as { issueId: string; body: string });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('el token de la app de Linear', () => {
  it('se pide con client_credentials y los scopes read y comments:create, y va en cada petición', async () => {
    const linear = await fakeLinear();

    await notifier().notify(trackingNotice(pullRequest));

    expect(linear.tokenRequests).toHaveLength(1);
    const { form } = linear.tokenRequests[0]!;
    expect(Object.fromEntries(form)).toEqual({
      grant_type: 'client_credentials',
      scope: 'read,comments:create',
      client_id: 'client-id',
      client_secret: 'client-secret',
    });
    expect(linear.graphql.map((request) => request.authorization)).toEqual([
      'Bearer lin_oauth_primero',
      'Bearer lin_oauth_primero',
    ]);
  });

  it('se reutiliza mientras no está a punto de caducar', async () => {
    const linear = await fakeLinear();
    let now = 0;
    const linearNotifier = notifier(() => now);

    await linearNotifier.notify(trackingNotice(pullRequest));
    now = 20 * DAY;
    await linearNotifier.notify(trackingNotice(pullRequest));

    expect(linear.tokenRequests).toHaveLength(1);
  });

  it('se renueva antes de que caduque', async () => {
    const linear = await fakeLinear();
    linear.tokens = ['lin_oauth_primero', 'lin_oauth_segundo'];
    let now = 0;
    const linearNotifier = notifier(() => now);

    await linearNotifier.notify(trackingNotice(pullRequest));
    now = 29.5 * DAY;
    await linearNotifier.notify(trackingNotice(pullRequest));

    expect(linear.tokenRequests).toHaveLength(2);
    expect(linear.graphql.at(-1)?.authorization).toBe('Bearer lin_oauth_segundo');
  });

  it('tras un 401 se pide otro y se repite la petición', async () => {
    const linear = await fakeLinear();
    linear.tokens = ['lin_oauth_primero', 'lin_oauth_segundo'];
    linear.commentResponses = [() => json(linear.fixtures.notAuthenticated, 401)];

    await notifier().notify(trackingNotice(pullRequest));

    expect(linear.tokenRequests).toHaveLength(2);
    const published = linear.graphql.filter((request) => request.query.includes('commentCreate'));
    expect(published.map((request) => request.authorization)).toEqual([
      'Bearer lin_oauth_primero',
      'Bearer lin_oauth_segundo',
    ]);
  });
});

describe('el aviso de una PR', () => {
  it('busca la tarea por la URL de la PR y comenta en ella mencionando al mantenedor', async () => {
    const linear = await fakeLinear();

    await notifier().notify(trackingNotice(pullRequest));

    const lookup = linear.graphql.find((request) => request.query.includes('attachmentsForURL'));
    expect(lookup?.variables).toEqual({ url: pullRequest.url });
    expect(comments(linear.graphql)).toEqual([
      {
        issueId: TASK_ISSUE_ID,
        body: [
          `${PROFILE_URL} · #74 · Avisar de cada PR lista para revisar`,
          'La sigo: espero a que terminen sus comprobaciones.',
          'https://github.com/7daysofrain/mood-table-v2/pull/74',
        ].join('\n'),
      },
    ]);
  });

  it('sin tarea enlazada, va al issue buzón', async () => {
    const linear = await fakeLinear();
    linear.attachmentsResponse = () => json(linear.fixtures.noAttachments);

    await notifier().notify(trackingNotice(pullRequest));

    expect(comments(linear.graphql).map((comment) => comment.issueId)).toEqual([INBOX_ISSUE_ID]);
  });
});

describe('el aviso del sistema', () => {
  it('va al issue buzón, sin buscar ninguna tarea, y menciona al mantenedor', async () => {
    const linear = await fakeLinear();

    await notifier().notify(githubUnauthorizedNotice());

    expect(linear.graphql.some((request) => request.query.includes('attachmentsForURL'))).toBe(false);
    expect(comments(linear.graphql)).toEqual([
      {
        issueId: INBOX_ISSUE_ID,
        body: [
          `${PROFILE_URL} · PR Babysitter`,
          'No puedo leer GitHub: rechaza el token. Lo vuelvo a intentar cada vuelta.',
        ].join('\n'),
      },
    ]);
  });
});

describe('si Linear falla, el aviso lanza un error', () => {
  it('si no da el token', async () => {
    const linear = await fakeLinear();
    linear.tokenResponse = () => json(linear.fixtures.invalidClient, 400);

    await expect(notifier().notify(trackingNotice(pullRequest))).rejects.toThrow();
  });

  it('si sigue rechazando el token después de renovarlo', async () => {
    const linear = await fakeLinear();
    linear.commentResponses = [
      () => json(linear.fixtures.notAuthenticated, 401),
      () => json(linear.fixtures.notAuthenticated, 401),
    ];

    await expect(notifier().notify(trackingNotice(pullRequest))).rejects.toThrow();
    expect(linear.tokenRequests).toHaveLength(2);
  });

  it('si no publica el comentario', async () => {
    const linear = await fakeLinear();
    linear.commentResponses = [() => json('{"errors":[{"message":"Internal server error"}]}', 500)];

    await expect(notifier().notify(trackingNotice(pullRequest))).rejects.toThrow();
  });

  it('si no puede buscar la tarea', async () => {
    const linear = await fakeLinear();
    linear.attachmentsResponse = () => json('{"errors":[{"message":"Internal server error"}]}', 500);

    await expect(notifier().notify(trackingNotice(pullRequest))).rejects.toThrow();
    expect(comments(linear.graphql)).toEqual([]);
  });
});
