/**
 * Con respuestas grabadas de la API de GitHub (`test/fixtures/github/`), recortadas a los campos
 * que se leen y algunos más:
 * - `open-pulls.json` (25-oct): la lista de PR abiertas contra `main` de ese día.
 * - `bad-credentials.json`: la respuesta a un token no válido.
 * - `main-rules.json` (26-oct): las reglas de `main`, con las seis comprobaciones exigidas.
 * - `check-runs-passed.json` (26-oct): los *check runs* del último push de la #69, todos superados.
 * - `check-runs-failed.json` (26-oct): los de un push de la #69 en el que falla `sonar-issues`.
 * - `check-runs-in-progress.json`: **derivado a mano** del anterior, porque un push recién hecho no
 *   se puede grabar a posteriori: `e2e` en marcha, `lint` neutral, `sonar-issues` saltada y sin el
 *   *check run* de `SonarCloud Code Analysis`.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, fixture, json } from '../../test/fake-github.ts';
import { GitHubUnauthorizedError } from '../core/ports.ts';
import { createGitHubReader } from './github.ts';

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

const REQUIRED_CHECKS = [
  'lint',
  'test',
  'SonarCloud Code Analysis',
  'typecheck',
  'sonar-issues',
  'e2e',
];
const FAILED_PUSH = '93210ef00b3ecf9705a747ea8fc468de297a4b95';

describe('las comprobaciones', () => {
  it('las exigidas salen de las reglas de la rama base', async () => {
    const body = await fixture('main-rules.json');
    const { fetch, calls } = fakeFetch(() => json(body));

    await expect(reader(fetch).requiredChecks()).resolves.toEqual(REQUIRED_CHECKS);
    expect(new URL(calls[0]!.url).pathname).toBe(
      '/repos/7daysofrain/mood-table-v2/rules/branches/main',
    );
  });

  it('si todas tienen un check run superado, todas pasan', async () => {
    const body = await fixture('check-runs-passed.json');
    const { fetch, calls } = fakeFetch(() => json(body));
    const sha = '4377f6572569b6a1afdd40675c4bca047122e307';

    await expect(reader(fetch).checks(sha, REQUIRED_CHECKS)).resolves.toEqual(
      REQUIRED_CHECKS.map((name) => ({ name, status: 'passed' })),
    );
    expect(new URL(calls[0]!.url).pathname).toBe(
      `/repos/7daysofrain/mood-table-v2/commits/${sha}/check-runs`,
    );
  });

  it('una con un check run que no es correcto, neutro ni saltado, falla', async () => {
    const body = await fixture('check-runs-failed.json');
    const { fetch } = fakeFetch(() => json(body));

    const checks = await reader(fetch).checks(FAILED_PUSH, REQUIRED_CHECKS);

    expect(checks).toContainEqual({ name: 'sonar-issues', status: 'failed' });
    expect(checks.filter((check) => check.status === 'passed')).toHaveLength(5);
  });

  it('neutra y saltada pasan; en marcha o sin check run, no ha terminado', async () => {
    const body = await fixture('check-runs-in-progress.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checks(FAILED_PUSH, REQUIRED_CHECKS)).resolves.toEqual([
      { name: 'lint', status: 'passed' },
      { name: 'test', status: 'passed' },
      { name: 'SonarCloud Code Analysis', status: 'pending' },
      { name: 'typecheck', status: 'passed' },
      { name: 'sonar-issues', status: 'passed' },
      { name: 'e2e', status: 'pending' },
    ]);
  });

  it('solo trae las exigidas, aunque el SHA tenga más check runs', async () => {
    const body = await fixture('check-runs-passed.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checks('4377f65', ['lint', 'e2e'])).resolves.toEqual([
      { name: 'lint', status: 'passed' },
      { name: 'e2e', status: 'passed' },
    ]);
  });

  it('un 401 al leerlas da el error de token rechazado', async () => {
    const body = await fixture('bad-credentials.json');
    const { fetch } = fakeFetch(() => json(body, 401));
    const github = reader(fetch);

    await expect(github.requiredChecks()).rejects.toBeInstanceOf(GitHubUnauthorizedError);
    await expect(github.checks('4377f65', REQUIRED_CHECKS)).rejects.toBeInstanceOf(
      GitHubUnauthorizedError,
    );
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
