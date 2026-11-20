/**
 * Con respuestas grabadas de la API de GitHub (`test/fixtures/github/`), recortadas a los campos
 * que se leen y algunos más:
 * - `open-pulls.json` (25-oct): la lista de PR abiertas contra `main` de ese día.
 * - `open-pulls-stopped.json`: **derivado a mano** del anterior, con etiquetas: `babysitter:stop` en
 *   la #69 y `dependencies` en la #41.
 * - `bad-credentials.json`: la respuesta a un token no válido.
 * - `main-rules.json` (26-oct): las reglas de `main`, con las seis comprobaciones exigidas.
 * - `check-runs-passed.json` (26-oct): los *check runs* del último push de la #69, todos superados.
 * - `check-runs-failed.json` (26-oct): los de un push de la #69 en el que falla `sonar-issues`.
 * - `check-runs-in-progress.json`: **derivado a mano** del anterior, porque un push recién hecho no
 *   se puede grabar a posteriori: `e2e` en marcha, `lint` neutral, `sonar-issues` saltada y sin el
 *   *check run* de `SonarCloud Code Analysis`.
 * - `check-runs-116.json`, `annotations-116-e2e.json`, `check-runs-117.json` y
 *   `job-logs-112-e2e.txt` (14-nov): las comprobaciones que fallan en la #116, la #117 y la #112
 *   (detalle en `check-context.test.ts`).
 * - `job-116-e2e.json` y `run-116.json` (20-nov): el *job* del `e2e` que falla en la #116, en su
 *   primer intento, y su run, ya terminado.
 * - `check-runs-rerun.json` y `job-rerun-test.json` (20-nov): los *check runs* de un push de la
 *   #151 con `filter=all`, relanzado entero (falló `lint`): dos de cada nombre, los del intento 2
 *   primero; y el *job* de `test` en el intento 2.
 * - `annotations-165-sonar-issues.json` (20-nov): las de `sonar-issues` en la PR de prueba #165
 *   (`MOO-167`), con tres incidencias, su aviso y el `failure` de `.github`.
 * El contenido de un fichero no se ha grabado: es el texto tal cual, y el test lo escribe.
 * Las respuestas a un comentario nuevo no se han grabado: los tests de la escritura solo miran el
 * código de estado.
 */
import { describe, expect, it } from 'vitest';

import { fakeFetch, fixture, json, text } from '../../test/fake-github.ts';
import { GitHubRequestRejectedError, GitHubUnauthorizedError } from '../core/ports.ts';
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
        labels: [],
      },
      {
        number: 41,
        title: 'build(deps): Bump the npm-minor-patch group across 1 directory with 16 updates',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/41',
        author: 'dependabot[bot]',
        baseBranch: 'main',
        draft: false,
        headSha: '2856846ca5c464cceefc6b030936687e740b7cc3',
        labels: [],
      },
    ]);
  });

  it('da las etiquetas de cada PR por su nombre', async () => {
    const body = await fixture('open-pulls-stopped.json');
    const { fetch } = fakeFetch(() => json(body));

    const pullRequests = await reader(fetch).listOpenPullRequests();

    expect(pullRequests.map(({ number, labels }) => ({ number, labels }))).toEqual([
      { number: 69, labels: ['babysitter:stop'] },
      { number: 41, labels: ['dependencies'] },
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
      REQUIRED_CHECKS.map((name) => ({ name, status: 'passed', conclusion: 'success' })),
    );
    expect(new URL(calls[0]!.url).pathname).toBe(
      `/repos/7daysofrain/mood-table-v2/commits/${sha}/check-runs`,
    );
  });

  it('una con un check run que no es correcto, neutro ni saltado, falla', async () => {
    const body = await fixture('check-runs-failed.json');
    const { fetch } = fakeFetch(({ url }) =>
      url.includes('/actions/jobs/') ? json('{"message":"Not Found"}', 404) : json(body),
    );

    const checks = await reader(fetch).checks(FAILED_PUSH, REQUIRED_CHECKS);

    expect(checks).toContainEqual({ name: 'sonar-issues', status: 'failed', conclusion: 'failure' });
    expect(checks.filter((check) => check.status === 'passed')).toHaveLength(5);
  });

  it('neutra y saltada pasan; en marcha o sin check run, no ha terminado', async () => {
    const body = await fixture('check-runs-in-progress.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checks(FAILED_PUSH, REQUIRED_CHECKS)).resolves.toEqual([
      { name: 'lint', status: 'passed', conclusion: 'neutral' },
      { name: 'test', status: 'passed', conclusion: 'success' },
      { name: 'SonarCloud Code Analysis', status: 'pending', conclusion: null },
      { name: 'typecheck', status: 'passed', conclusion: 'success' },
      { name: 'sonar-issues', status: 'passed', conclusion: 'skipped' },
      { name: 'e2e', status: 'pending', conclusion: null },
    ]);
  });

  it('solo trae las exigidas, aunque el SHA tenga más check runs', async () => {
    const body = await fixture('check-runs-passed.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checks('4377f65', ['lint', 'e2e'])).resolves.toEqual([
      { name: 'lint', status: 'passed', conclusion: 'success' },
      { name: 'e2e', status: 'passed', conclusion: 'success' },
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

describe('el intento de una comprobación', () => {
  const PUSH_116 = 'b4a47348bf49447cf62cb29d69299445a30f973f';
  const PUSH_RERUN = '5f884fad37648758d2d61341ff698253175621e0';

  /** GitHub con los check runs, el job y el run de una de Actions que falla. */
  function actionsFetch(runs: string, job: string, run: string) {
    return fakeFetch(({ url }) => {
      if (url.includes('/actions/jobs/')) return json(job);
      if (url.includes('/actions/runs/')) return json(run);
      return json(runs);
    });
  }

  it('una de Actions que falla da su intento y su run, leídos de su job', async () => {
    const [runs, job, run] = await Promise.all([
      fixture('check-runs-116.json'),
      fixture('job-116-e2e.json'),
      fixture('run-116.json'),
    ]);
    const { fetch, calls } = actionsFetch(runs, job, run);

    await expect(reader(fetch).checks(PUSH_116, ['e2e'])).resolves.toEqual([
      {
        name: 'e2e',
        status: 'failed',
        conclusion: 'failure',
        attempt: 1,
        runId: 42082802927,
        runFinished: true,
      },
    ]);
    expect(calls.map(({ url }) => new URL(url).pathname)).toEqual(
      expect.arrayContaining([
        '/repos/7daysofrain/mood-table-v2/actions/jobs/127439969583',
        '/repos/7daysofrain/mood-table-v2/actions/runs/42082802927',
      ]),
    );
  });

  it('con su run aún en marcha, el run no ha terminado', async () => {
    // Derivado a mano de `run-116.json`: otro job del mismo run sigue corriendo.
    const run = JSON.stringify({ id: 42082802927, status: 'in_progress', conclusion: null });
    const [runs, job] = await Promise.all([
      fixture('check-runs-116.json'),
      fixture('job-116-e2e.json'),
    ]);
    const { fetch } = actionsFetch(runs, job, run);

    await expect(reader(fetch).checks(PUSH_116, ['e2e'])).resolves.toEqual([
      expect.objectContaining({ attempt: 1, runId: 42082802927, runFinished: false }),
    ]);
  });

  it('un run que GitHub no da cuenta como no terminado', async () => {
    const [runs, job] = await Promise.all([
      fixture('check-runs-116.json'),
      fixture('job-116-e2e.json'),
    ]);
    const { fetch } = fakeFetch(({ url }) => {
      if (url.includes('/actions/jobs/')) return json(job);
      if (url.includes('/actions/runs/')) return json('{"message":"Not Found"}', 404);
      return json(runs);
    });

    await expect(reader(fetch).checks(PUSH_116, ['e2e'])).resolves.toEqual([
      expect.objectContaining({ attempt: 1, runFinished: false }),
    ]);
  });

  it('con dos check runs del mismo nombre, cuenta el del intento más reciente', async () => {
    const body = await fixture('check-runs-rerun.json');
    const { fetch, calls } = fakeFetch(() => json(body));

    await expect(reader(fetch).checks(PUSH_RERUN, ['lint', 'test'])).resolves.toEqual([
      { name: 'lint', status: 'passed', conclusion: 'success' },
      { name: 'test', status: 'passed', conclusion: 'success' },
    ]);
    // Una que pasa no necesita su intento: no se lee su job.
    expect(calls).toHaveLength(1);
  });

  it('una que vuelve a fallar en su intento 2 lo dice', async () => {
    // Derivado a mano de `check-runs-rerun.json`: el `test` del intento 2, con `failure`.
    const runs = JSON.stringify({
      total_count: 1,
      check_runs: [
        {
          id: 135781537852,
          name: 'test',
          status: 'completed',
          conclusion: 'failure',
          app: { slug: 'github-actions' },
          output: { title: null, summary: null },
        },
      ],
    });
    const job = await fixture('job-rerun-test.json');
    const run = JSON.stringify({ id: 43634814409, status: 'completed', conclusion: 'failure' });
    const { fetch } = actionsFetch(runs, job, run);

    await expect(reader(fetch).checks(PUSH_RERUN, ['test'])).resolves.toEqual([
      {
        name: 'test',
        status: 'failed',
        conclusion: 'failure',
        attempt: 2,
        runId: 43634814409,
        runFinished: true,
      },
    ]);
  });

  it('una de otra app que falla no tiene intento: no se lee ningún job', async () => {
    const body = await fixture('check-runs-117.json');
    const { fetch, calls } = fakeFetch(() => json(body));
    const push = '709a0582ace1b0e5c6a67edcb32d1d2db2ac4b6e';

    await expect(reader(fetch).checks(push, ['SonarCloud Code Analysis'])).resolves.toEqual([
      { name: 'SonarCloud Code Analysis', status: 'failed', conclusion: 'failure' },
    ]);
    expect(calls).toHaveLength(1);
  });

  it('un job que GitHub no da deja el intento sin dato, y la comprobación sigue fallando', async () => {
    const runs = await fixture('check-runs-116.json');
    const { fetch } = fakeFetch(({ url }) =>
      url.includes('/actions/jobs/') ? json('{"message":"Not Found"}', 404) : json(runs),
    );

    await expect(reader(fetch).checks(PUSH_116, ['e2e'])).resolves.toEqual([
      { name: 'e2e', status: 'failed', conclusion: 'failure' },
    ]);
  });
});

describe('el check run de una comprobación', () => {
  const PUSH_116 = 'b4a47348bf49447cf62cb29d69299445a30f973f';
  const PUSH_117 = '709a0582ace1b0e5c6a67edcb32d1d2db2ac4b6e';

  it('da su id, su app, su conclusión y su salida', async () => {
    const body = await fixture('check-runs-117.json');
    const { fetch, calls } = fakeFetch(() => json(body));

    const run = await reader(fetch).checkRun(PUSH_117, 'SonarCloud Code Analysis');

    expect(run).toEqual({
      id: 127476958031,
      app: 'sonarqubecloud',
      conclusion: 'failure',
      output: {
        title: 'Quality Gate failed',
        summary: expect.stringContaining('71.4% Coverage on New Code') as string,
      },
    });
    expect(new URL(calls[0]!.url).pathname).toBe(
      `/repos/7daysofrain/mood-table-v2/commits/${PUSH_117}/check-runs`,
    );
  });

  it('el de un job de GitHub Actions no trae título ni resumen', async () => {
    const body = await fixture('check-runs-116.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checkRun(PUSH_116, 'e2e')).resolves.toEqual({
      id: 127439969583,
      app: 'github-actions',
      conclusion: 'failure',
      output: { title: null, summary: null },
    });
  });

  it('sin un check run con ese nombre, da null', async () => {
    const body = await fixture('check-runs-116.json');
    const { fetch } = fakeFetch(() => json(body));

    await expect(reader(fetch).checkRun(PUSH_116, 'lint')).resolves.toBeNull();
  });
});

describe('las anotaciones de un check run', () => {
  it('son todas, con su fichero, su línea, su nivel, su título y su mensaje', async () => {
    const body = await fixture('annotations-116-e2e.json');
    const { fetch, calls } = fakeFetch(() => json(body));

    const annotations = await reader(fetch).annotations(127439969583);

    expect(annotations).toHaveLength(4);
    expect(annotations?.[0]).toEqual({
      path: '.github',
      line: 81,
      level: 'failure',
      title: null,
      message: 'Process completed with exit code 1.',
    });
    expect(annotations?.[2]).toMatchObject({
      path: 'e2e/playback.spec.ts',
      line: 189,
      level: 'failure',
      title: expect.stringContaining('playback.spec.ts:177:1') as string,
    });
    expect(new URL(calls[0]!.url).pathname).toBe(
      '/repos/7daysofrain/mood-table-v2/check-runs/127439969583/annotations',
    );
  });

  it('un 404 o un 410 dan null', async () => {
    for (const status of [404, 410]) {
      const { fetch } = fakeFetch(() => json('{"message":"Not Found"}', status));

      await expect(reader(fetch).annotations(1)).resolves.toBeNull();
    }
  });

  it('un 5xx lanza', async () => {
    const { fetch } = fakeFetch(() => json('{"message":"Server Error"}', 502));

    await expect(reader(fetch).annotations(1)).rejects.toThrow();
  });
});

describe('el log de un job', () => {
  it('es el log entero del job con ese id', async () => {
    const body = await fixture('job-logs-112-e2e.txt');
    const { fetch, calls } = fakeFetch(() => text(body));

    // El log grabado empieza por una marca de orden de bytes, que `fetch` quita al leerlo.
    await expect(reader(fetch).jobLog(126427896193)).resolves.toBe(body.replace(/^\uFEFF/, ''));
    expect(new URL(calls[0]!.url).pathname).toBe(
      '/repos/7daysofrain/mood-table-v2/actions/jobs/126427896193/logs',
    );
  });

  it('un 404 o un 410 dan null', async () => {
    for (const status of [404, 410]) {
      const { fetch } = fakeFetch(() => json('{"message":"Gone"}', status));

      await expect(reader(fetch).jobLog(1)).resolves.toBeNull();
    }
  });

  it('un 5xx lanza', async () => {
    const { fetch } = fakeFetch(() => json('{"message":"Server Error"}', 502));

    await expect(reader(fetch).jobLog(1)).rejects.toThrow();
  });

  it('un 401 da el error de token rechazado', async () => {
    const body = await fixture('bad-credentials.json');
    const { fetch } = fakeFetch(() => json(body, 401));

    await expect(reader(fetch).jobLog(1)).rejects.toBeInstanceOf(GitHubUnauthorizedError);
  });
});

describe('el código de un fichero en un commit', () => {
  const SHA = '38fc23365853f5355dc76ab4a15c2a62f7e7d3ea';

  it('es el texto del fichero en ese commit, en crudo', async () => {
    const body = 'export async function enOrden() {\n  await x();\n}\n';
    const { fetch, calls } = fakeFetch(() => text(body));

    await expect(reader(fetch).fileAt(SHA, 'tooling/ci/prueba-await.ts')).resolves.toBe(body);
    const url = new URL(calls[0]!.url);
    expect(decodeURIComponent(url.pathname)).toBe(
      '/repos/7daysofrain/mood-table-v2/contents/tooling/ci/prueba-await.ts',
    );
    expect(url.searchParams.get('ref')).toBe(SHA);
  });

  it('un 404 da null', async () => {
    const { fetch } = fakeFetch(() => json('{"message":"Not Found"}', 404));

    await expect(reader(fetch).fileAt(SHA, 'no-existe.ts')).resolves.toBeNull();
  });

  it('un 5xx lanza', async () => {
    const { fetch } = fakeFetch(() => json('{"message":"Server Error"}', 502));

    await expect(reader(fetch).fileAt(SHA, 'a.ts')).rejects.toThrow();
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

describe('relanzar los jobs fallidos de un run (change pr-check-rerun)', () => {
  /** El error que da `rerunFailedJobs` con una respuesta de GitHub, o `undefined` si la acepta. */
  async function rerunError(response: () => Response) {
    const { fetch } = fakeFetch(response);
    return reader(fetch)
      .rerunFailedJobs(42082802927)
      .then(() => undefined)
      .catch((error: unknown) => error);
  }

  it('lo pide al run, con el token del proveedor', async () => {
    const { fetch, calls } = fakeFetch(() => json('{}', 201));

    await reader(fetch, () => 'ghp_token').rerunFailedJobs(42082802927);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.github.com/repos/7daysofrain/mood-table-v2/actions/runs/42082802927/rerun-failed-jobs',
      authorization: 'token ghp_token',
    });
  });

  it('un 403 sin Actions: write da el error de petición rechazada', async () => {
    const forbidden = '{"message":"Resource not accessible by personal access token"}';

    expect(await rerunError(() => json(forbidden, 403))).toBeInstanceOf(GitHubRequestRejectedError);
  });

  it('un error del servidor da un error que no es de petición rechazada', async () => {
    const error = await rerunError(() => json('{"message":"Server Error"}', 502));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GitHubRequestRejectedError);
  });
});

describe('un comentario nuevo', () => {
  /** El error que da `createComment` con una respuesta de GitHub, o `undefined` si la acepta. */
  async function commentError(response: () => Response) {
    const { fetch } = fakeFetch(response);
    return reader(fetch)
      .createComment(77, 'Hola')
      .then(() => undefined)
      .catch((error: unknown) => error);
  }

  it('se publica en los comentarios de la PR, con el token del proveedor', async () => {
    const { fetch, calls } = fakeFetch(() => json('{"id":1}', 201));

    await reader(fetch, () => 'ghp_token').createComment(77, '@codex review');

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://api.github.com/repos/7daysofrain/mood-table-v2/issues/77/comments',
      authorization: 'token ghp_token',
    });
    expect(JSON.parse(calls[0]!.body)).toEqual({ body: '@codex review' });
  });

  it('un 401 da el error de token rechazado', async () => {
    const body = await fixture('bad-credentials.json');

    expect(await commentError(() => json(body, 401))).toBeInstanceOf(GitHubUnauthorizedError);
  });

  it('un 403 sin permiso o un 422 dan el error de petición rechazada', async () => {
    const forbidden = '{"message":"Resource not accessible by personal access token"}';
    const invalid = '{"message":"Validation Failed"}';

    expect(await commentError(() => json(forbidden, 403))).toBeInstanceOf(
      GitHubRequestRejectedError,
    );
    expect(await commentError(() => json(invalid, 422))).toBeInstanceOf(
      GitHubRequestRejectedError,
    );
  });

  it('el límite de la API no es una petición rechazada: se arregla sola', async () => {
    const limited = (status: number, headers: Record<string, string>) => () =>
      new Response('{"message":"API rate limit exceeded"}', {
        status,
        headers: { 'content-type': 'application/json', ...headers },
      });

    for (const response of [
      limited(403, { 'x-ratelimit-remaining': '0' }),
      limited(403, { 'retry-after': '60' }),
      limited(429, {}),
    ]) {
      const error = await commentError(response);
      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(GitHubRequestRejectedError);
    }
  });

  it('un error del servidor da un error que no es de token ni de petición rechazada', async () => {
    const error = await commentError(() => json('{"message":"Server Error"}', 502));

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(GitHubUnauthorizedError);
    expect(error).not.toBeInstanceOf(GitHubRequestRejectedError);
  });
});
