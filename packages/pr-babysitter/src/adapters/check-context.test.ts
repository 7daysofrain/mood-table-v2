/**
 * Con respuestas grabadas de GitHub (`test/fixtures/github/`, 14-nov), recortadas a los campos que se
 * leen y algunos más. Los *check runs* se pidieron con `filter=all` y se dejó solo el que falla,
 * porque al relanzar GitHub da el que pasó:
 * - `check-runs-116.json` y `annotations-116-e2e.json`: el `e2e` que falló en la #116 (push
 *   `b4a4734`), con las anotaciones de Playwright: el error del test, el resumen de la ejecución y
 *   las dos de ruido (el `failure` de `.github` y el `notice` sin título).
 * - `check-runs-112.json`, `annotations-112-e2e.json` y `job-logs-112-e2e.txt`: el `e2e` que falló
 *   en la #112 (push `2d09899`). En su log, el primer `##[error]` es la primera línea del bloque de
 *   error de Playwright (`MOO-154`).
 * - `check-runs-117.json`: `SonarCloud Code Analysis` en la #117 (push `709a058`), de otra app.
 */
import { describe, expect, it } from 'vitest';

import { type Call, fakeFetch, fixture, json, text } from '../../test/fake-github.ts';
import { readCheckContext } from './check-context.ts';
import { createGitHubReader } from './github.ts';

const PUSH_112 = '2d098993c3f9625f0a82d79030ed64ef9e5ebd0a';
const PUSH_116 = 'b4a47348bf49447cf62cb29d69299445a30f973f';
const PUSH_117 = '709a0582ace1b0e5c6a67edcb32d1d2db2ac4b6e';
const CHECK_RUNS: Record<string, string> = {
  [PUSH_112]: 'check-runs-112.json',
  [PUSH_116]: 'check-runs-116.json',
  [PUSH_117]: 'check-runs-117.json',
};
/** El *check run* del `e2e` de cada PR, que en GitHub Actions es también su *job*. */
const E2E_112 = 126427896193;
const E2E_116 = 127439969583;

const KIB = 1024;

/** Las dos anotaciones que deja cualquier *job* de Actions que falla, y que no dicen nada. */
const NOISE = [
  {
    path: '.github',
    start_line: 73,
    end_line: 73,
    annotation_level: 'failure',
    title: null,
    message: 'Process completed with exit code 1.',
  },
  {
    path: '.github',
    start_line: 1,
    end_line: 1,
    annotation_level: 'notice',
    title: null,
    message: 'The ubuntu-latest label will migrate to Ubuntu 26.',
  },
];

/** Responde a una petición por su ruta, sin la *query*; `undefined` deja la grabada. */
type Route = (call: Call & { path: string }) => Response | undefined | Promise<Response | undefined>;

/** Un GitHub falso con las respuestas grabadas; `override` responde antes que ellas. */
function github(override: Route = () => undefined) {
  const { fetch, calls } = fakeFetch(async (call) => {
    const path = new URL(call.url).pathname;
    const answer = await override({ ...call, path });
    if (answer) return answer;
    const checkRuns = /\/commits\/([0-9a-f]+)\/check-runs$/.exec(path);
    const recorded = CHECK_RUNS[checkRuns?.[1] ?? ''];
    if (recorded) return json(await fixture(recorded));
    if (path.endsWith(`/check-runs/${E2E_116}/annotations`)) {
      return json(await fixture('annotations-116-e2e.json'));
    }
    if (path.endsWith(`/check-runs/${E2E_112}/annotations`)) {
      return json(await fixture('annotations-112-e2e.json'));
    }
    if (path.endsWith(`/actions/jobs/${E2E_112}/logs`)) {
      return text(await fixture('job-logs-112-e2e.txt'));
    }
    return json('{"message":"Not Found"}', 404);
  });
  const reader = createGitHubReader({
    owner: '7daysofrain',
    repo: 'mood-table-v2',
    baseBranch: 'main',
    token: () => 'ghp_x',
    fetch,
  });
  return { reader, calls };
}

/** Un GitHub en el que el `e2e` de la #112 solo deja las anotaciones de ruido; el log, `log`. */
function withoutUsefulAnnotations(log?: () => Response) {
  return github(({ path }) => {
    if (path.endsWith('/annotations')) return json(JSON.stringify(NOISE));
    if (path.includes('/actions/jobs/')) return log?.();
    return undefined;
  });
}

/** Un GitHub con un solo *check run*, de otra app, con esa salida. */
function otherApp(output: { title: string | null; summary: string | null }) {
  return github(async ({ path }) => {
    if (!path.endsWith('/check-runs')) return undefined;
    const recorded = JSON.parse(await fixture('check-runs-117.json')) as {
      check_runs: Record<string, unknown>[];
    };
    const run = { ...recorded.check_runs[0], output };
    return json(JSON.stringify({ total_count: 1, check_runs: [run] }));
  });
}

function bytes(value: string): number {
  return new TextEncoder().encode(value).length;
}

describe('una comprobación de GitHub Actions con anotaciones útiles', () => {
  it('da sus errores, con el fichero, la línea, el título y el mensaje entero', async () => {
    const { reader } = github();

    const { context } = await readCheckContext(reader, PUSH_116, 'e2e');

    expect(context).toMatchObject({ state: 'available', origin: 'annotations', truncated: false });
    const errors = context.state === 'available' ? context.errors : [];
    expect(errors).toEqual([
      {
        file: 'e2e/playback.spec.ts',
        line: 189,
        title:
          '[chromium] › playback.spec.ts:177:1 › oír el fichero de audio mientras la tira virtual reacciona',
        message: expect.stringContaining('Expected: 0\n    Received: 1') as string,
      },
    ]);
  });

  it('el resumen es el de las anotaciones informativas con título', async () => {
    const { reader } = github();

    const { context } = await readCheckContext(reader, PUSH_116, 'e2e');
    const summary = context.state === 'available' ? context.summary : '';

    expect(summary.startsWith('🎭 Playwright Run Summary\n')).toBe(true);
    expect(summary).toContain('1 failed');
    expect(summary).toContain('19 passed');
  });

  it('va sin el `failure` de `.github` y sin el `notice` sin título', async () => {
    const { reader } = github();

    const { context } = await readCheckContext(reader, PUSH_116, 'e2e');

    expect(JSON.stringify(context)).not.toContain('Process completed with exit code 1');
    expect(JSON.stringify(context)).not.toContain('ubuntu-latest');
  });

  it('no pide el log', async () => {
    const { reader, calls } = github();

    await readCheckContext(reader, PUSH_116, 'e2e');

    expect(calls.filter((call) => call.url.includes('/actions/jobs/'))).toEqual([]);
  });
});

describe('una comprobación de GitHub Actions sin anotaciones útiles', () => {
  it('da el paso que falla del log, entero, incluido lo que sigue al primer error (MOO-154)', async () => {
    const { reader } = withoutUsefulAnnotations();

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toMatchObject({ state: 'available', origin: 'log', errors: [], truncated: false });
    const summary = context.state === 'available' ? context.summary : '';
    expect(summary.startsWith('##[group]Run pnpm test:e2e')).toBe(true);
    expect(summary).toContain('##[error]  1) [chromium] › effects.spec.ts:81:1');
    expect(summary).toContain('Expected: < 100\n    Received:   104.70000000000437');
    expect(summary).toContain('18 passed (1.0m)');
    expect(summary.endsWith('##[error]Process completed with exit code 1.')).toBe(true);
  });

  it('va sin los pasos siguientes, sin la limpieza del job, sin marcas de tiempo y sin colores', async () => {
    const { reader } = withoutUsefulAnnotations();

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');
    const summary = JSON.stringify(context);

    expect(summary).not.toContain('actions/upload-artifact');
    expect(summary).not.toContain('pnpm install --frozen-lockfile');
    expect(summary).not.toContain('Post job cleanup');
    expect(summary).not.toMatch(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
    expect(summary).not.toContain(String.raw`\u001b`);
  });

  it('el paso acaba antes de la limpieza del job si no hay otro paso detrás', async () => {
    const log = [
      '##[group]Run pnpm test',
      '##[endgroup]',
      '##[error]Process completed with exit code 1.',
      'Post job cleanup.',
      'limpiando',
    ];
    const { reader } = withoutUsefulAnnotations(() => text(log.join('\n')));

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toMatchObject({ summary: log.slice(0, 3).join('\n') });
  });

  it('sin un error marcado, da el final del log', async () => {
    const { reader } = withoutUsefulAnnotations(() => text('primera\nsegunda\núltima'));

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toEqual({
      state: 'available',
      origin: 'log',
      summary: 'primera\nsegunda\núltima',
      errors: [],
      truncated: false,
    });
  });
});

describe('una comprobación de otra app', () => {
  it('da el título y el resumen que publica', async () => {
    const { reader } = github();

    const { context } = await readCheckContext(reader, PUSH_117, 'SonarCloud Code Analysis');

    expect(context).toMatchObject({ state: 'available', origin: 'appSummary', errors: [], truncated: false });
    const summary = context.state === 'available' ? context.summary : '';
    expect(summary.startsWith('Quality Gate failed\n\nFailed conditions')).toBe(true);
    expect(summary).toContain('71.4% Coverage on New Code');
    expect(summary).toContain('(required ≥ 80%)');
  });

  it('no pide anotaciones ni log', async () => {
    const { reader, calls } = github();

    await readCheckContext(reader, PUSH_117, 'SonarCloud Code Analysis');

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      `/repos/7daysofrain/mood-table-v2/commits/${PUSH_117}/check-runs`,
    ]);
  });

  it('con solo el título, da el título', async () => {
    const { reader } = otherApp({ title: 'Quality Gate failed', summary: null });

    const { context } = await readCheckContext(reader, PUSH_117, 'SonarCloud Code Analysis');

    expect(context).toMatchObject({ origin: 'appSummary', summary: 'Quality Gate failed' });
  });
});

describe('una comprobación que no da contexto', () => {
  it('de otra app, con el título y el resumen vacíos', async () => {
    const { reader } = otherApp({ title: null, summary: '  \n' });

    const { context } = await readCheckContext(reader, PUSH_117, 'SonarCloud Code Analysis');

    expect(context).toEqual({ state: 'notProvided' });
  });

  it('de GitHub Actions, sin anotaciones útiles y con el log vacío', async () => {
    const { reader } = withoutUsefulAnnotations(() => text('\n'));

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toEqual({ state: 'notProvided' });
  });
});

describe('una comprobación cuyo contexto no se puede leer', () => {
  it('con el log caducado (410) o borrado (404)', async () => {
    for (const status of [410, 404]) {
      const { reader } = withoutUsefulAnnotations(() => json('{"message":"Gone"}', status));

      const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

      expect(context).toEqual({ state: 'unreadable' });
    }
  });

  it('sin permiso para leer las anotaciones (403), y no pide el log', async () => {
    const { reader, calls } = github(({ path }) =>
      path.endsWith('/annotations')
        ? json('{"message":"Resource not accessible by personal access token"}', 403)
        : undefined,
    );

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toEqual({ state: 'unreadable' });
    expect(calls.filter((call) => call.url.includes('/actions/jobs/'))).toEqual([]);
  });

  it('sin un check run con ese nombre en el push', async () => {
    const { reader } = github();

    await expect(readCheckContext(reader, PUSH_112, 'lint')).resolves.toEqual({
      conclusion: null,
      context: { state: 'unreadable' },
    });
  });

  it('un 5xx no es un contexto ilegible: lanza para que se reintente', async () => {
    const annotations = github(({ path }) =>
      path.endsWith('/annotations') ? json('{"message":"Server Error"}', 502) : undefined,
    );
    const log = withoutUsefulAnnotations(() => json('{"message":"Server Error"}', 502));

    await expect(readCheckContext(annotations.reader, PUSH_112, 'e2e')).rejects.toThrow();
    await expect(readCheckContext(log.reader, PUSH_112, 'e2e')).rejects.toThrow();
  });
});

describe('un contexto de más de 16 KiB', () => {
  it('del log, se corta por el principio y lo dice', async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `2026-10-28T17:09:21.0000000Z línea ${i}`);
    const long = ['##[group]Run pnpm test', ...lines, '##[error]Process completed with exit code 1.'];
    const { reader } = withoutUsefulAnnotations(() => text(long.join('\n')));

    const { context } = await readCheckContext(reader, PUSH_112, 'e2e');

    expect(context).toMatchObject({ state: 'available', origin: 'log', truncated: true });
    const summary = context.state === 'available' ? context.summary : '';
    expect(bytes(summary)).toBeLessThanOrEqual(16 * KIB);
    expect(bytes(summary)).toBeGreaterThan(15 * KIB);
    expect(summary.endsWith('##[error]Process completed with exit code 1.')).toBe(true);
    expect(summary).not.toContain('línea 0\n');
  });

  it('del resumen de una app, se corta por el principio y lo dice', async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `condición ${i}`);
    const { reader } = otherApp({ title: 'Quality Gate failed', summary: lines.join('\n') });

    const { context } = await readCheckContext(reader, PUSH_117, 'SonarCloud Code Analysis');

    expect(context).toMatchObject({ state: 'available', origin: 'appSummary', truncated: true });
    const summary = context.state === 'available' ? context.summary : '';
    expect(bytes(summary)).toBeLessThanOrEqual(16 * KIB);
    expect(summary.endsWith('condición 1999')).toBe(true);
    expect(summary).not.toContain('Quality Gate failed');
  });

  it('de las anotaciones, entran enteras y en orden las que caben, y lo dice', async () => {
    const annotations = Array.from({ length: 30 }, (_, i) => ({
      path: `src/fichero-${i}.ts`,
      start_line: i + 1,
      end_line: i + 1,
      annotation_level: 'failure',
      title: `Error ${i}`,
      message: 'x'.repeat(KIB),
    }));
    const { reader } = github(({ path }) =>
      path.endsWith('/annotations') ? json(JSON.stringify(annotations)) : undefined,
    );

    const { context } = await readCheckContext(reader, PUSH_116, 'e2e');

    expect(context).toMatchObject({ state: 'available', origin: 'annotations', truncated: true });
    const errors = context.state === 'available' ? context.errors : [];
    expect(errors.length).toBeGreaterThan(10);
    expect(errors.length).toBeLessThan(17);
    expect(errors.map((error) => error.title)).toEqual(errors.map((_, i) => `Error ${i}`));
    expect(errors.every((error) => error.message.length === KIB)).toBe(true);
  });

  it('si no cabe ni la primera anotación, se corta su mensaje por el final', async () => {
    const annotation = {
      path: 'src/fichero.ts',
      start_line: 1,
      end_line: 1,
      annotation_level: 'failure',
      title: 'Error',
      message: `principio ${'x'.repeat(20 * KIB)}`,
    };
    const { reader } = github(({ path }) =>
      path.endsWith('/annotations') ? json(JSON.stringify([annotation])) : undefined,
    );

    const { context } = await readCheckContext(reader, PUSH_116, 'e2e');

    expect(context).toMatchObject({ state: 'available', origin: 'annotations', truncated: true });
    const errors = context.state === 'available' ? context.errors : [];
    expect(errors).toHaveLength(1);
    expect(errors[0]?.message.startsWith('principio ')).toBe(true);
    expect(bytes(errors[0]?.message ?? '')).toBeLessThanOrEqual(16 * KIB);
  });
});

describe('la conclusión', () => {
  it('es la del check run', async () => {
    const { reader } = github();

    await expect(readCheckContext(reader, PUSH_116, 'e2e')).resolves.toMatchObject({
      conclusion: 'failure',
    });
  });

  it('una comprobación que se pasa de tiempo la lleva con su contexto', async () => {
    const { reader } = github(async ({ path }) => {
      if (!path.endsWith('/check-runs')) return undefined;
      const recorded = await fixture('check-runs-112.json');
      return json(recorded.replace('"conclusion": "failure"', '"conclusion": "timed_out"'));
    });

    await expect(readCheckContext(reader, PUSH_112, 'e2e')).resolves.toMatchObject({
      conclusion: 'timed_out',
      context: { state: 'available' },
    });
  });
});
