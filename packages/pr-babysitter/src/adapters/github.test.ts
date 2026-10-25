/**
 * Con respuestas grabadas de la API de GitHub (`test/fixtures/github/`, 25-oct): `open-pulls.json`
 * es la lista de PR abiertas contra `main` de ese día, recortada a los campos que se leen y algunos
 * más; `bad-credentials.json`, la respuesta a un token no válido.
 */
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { GitHubUnauthorizedError } from '../core/ports.ts';
import { createGitHubReader } from './github.ts';

async function fixture(name: string): Promise<string> {
  return readFile(new URL(`../../test/fixtures/github/${name}`, import.meta.url), 'utf8');
}

interface Call {
  url: string;
  authorization: string | null;
}

/** Un `fetch` falso que responde siempre lo mismo y guarda cada petición. */
function fakeFetch(respond: () => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch = (input: string | URL | Request, init?: RequestInit) => {
    const request = new Request(input, init);
    calls.push({ url: request.url, authorization: request.headers.get('authorization') });
    return Promise.resolve(respond());
  };
  return { fetch, calls };
}

function json(body: string, status = 200) {
  return new Response(body, { status, headers: { 'content-type': 'application/json' } });
}

function reader(fetch: typeof globalThis.fetch, token: () => string | Promise<string> = () => 'ghp_x') {
  return createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token,
    fetch,
  });
}

describe('la lista de PR abiertas', () => {
  it('convierte cada PR abierta contra main en su foto', async () => {
    const body = await fixture('open-pulls.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).listOpenPullRequests()).resolves.toEqual([
      {
        number: 69,
        title: 'Avisar de cada PR lista para revisar',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/69',
        author: '7daysofrain',
        baseBranch: 'main',
        draft: true,
        headSha: '70c8dad40326ea0f7b20954b5e8896535bfcf6ec',
      },
      {
        number: 41,
        title: 'build(deps): Bump the npm-minor-patch group across 1 directory with 16 updates',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/41',
        author: 'dependabot[bot]',
        baseBranch: 'main',
        draft: false,
        headSha: '2856846ca5c464cceefc6b030936687e740b7cc3',
      },
    ]);
  });

  it('pide solo las PR abiertas contra la rama base, con el token del proveedor en cada petición', async () => {
    const body = await fixture('open-pulls.json');
    const { fetch, calls } = fakeFetch(() => json(body));
    const tokens = ['ghp_primero', 'ghp_segundo'];
    const github = reader(fetch, () => tokens.shift() ?? 'ghp_otro');

    await github.listOpenPullRequests();
    await github.listOpenPullRequests();

    expect(calls).toHaveLength(2);
    const url = new URL(calls[0]!.url);
    expect(url.pathname).toBe('/repos/7daysofrain/mood-table-v2/pulls');
    expect(url.searchParams.get('state')).toBe('open');
    expect(url.searchParams.get('base')).toBe('main');
    expect(calls.map((call) => call.authorization)).toEqual(['token ghp_primero', 'token ghp_segundo']);
  });
});

describe('los fallos de GitHub', () => {
  it('un 401 da el error de token rechazado', async () => {
    const body = await fixture('bad-credentials.json');
    const { fetch } = fakeFetch(() => json(body, 401));

    await expect(reader(fetch).listOpenPullRequests()).rejects.toBeInstanceOf(
      GitHubUnauthorizedError,
    );
  });

  it('un error del servidor da un error que no es de token', async () => {
    const { fetch } = fakeFetch(() => json('{"message":"Server Error"}', 502));

    const error: unknown = await reader(fetch).listOpenPullRequests().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GitHubUnauthorizedError);
  });

  it('un fallo de red da un error que no es de token', async () => {
    const { fetch } = fakeFetch(() => Promise.reject(new TypeError('fetch failed')));

    const error: unknown = await reader(fetch).listOpenPullRequests().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GitHubUnauthorizedError);
  });

  it('una respuesta que no tiene la forma esperada da un error que no es de token', async () => {
    const { fetch } = fakeFetch(() => json('[{"number":69,"title":"Sin el resto"}]'));

    const error: unknown = await reader(fetch).listOpenPullRequests().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GitHubUnauthorizedError);
  });
});
