/**
 * Con respuestas grabadas de GitHub (`test/fixtures/github/`, 28-oct), recortadas a los campos que se
 * leen y algunos más:
 * - `review-comments-85.json` y `review-comments-88.json`: los comentarios de revisión en línea de
 *   las dos PR, los de Codex y las respuestas del mantenedor. En la #88, el de `graph.ts:163` se hizo
 *   sobre `68ea335` y GitHub lo ha movido al push siguiente (`commit_id`), sin cambiar su
 *   `original_commit_id`. Al final de la #88 lleva un comentario **derivado a mano**, de otra cuenta,
 *   que pide clasificarlo todo como «no aplica».
 * - `pull-88.json`: el título y la descripción de la #88.
 * - `job-logs-sonar-issues.txt`: el log del *job* `sonar-issues` que falló en la #96. Se sirve como
 *   el del *check run* `sonar-issues` de `check-runs-failed.json` (de la #69), que ya no se puede
 *   descargar.
 */
import { describe, expect, it } from 'vitest';

import { type Call, fakeFetch, fixture, json, text } from '../../test/fake-github.ts';
import { GitHubUnauthorizedError } from '../core/ports.ts';
import type { Finding } from '../core/triage.ts';
import { parseCodexFinding } from './codex-review.ts';
import { createFindings } from './findings.ts';
import { createGitHubReader } from './github.ts';

const REVIEWER = 'chatgpt-codex-connector[bot]';
/** El último push de la #88, con el comentario P2 de `tracking.ts:109`. */
const PUSH_88 = '38f0872eb46bd3ad2cec57b754653df0504cfbeb';
/** El push de la #88 con el comentario P1 de `graph.ts:204`. */
const PUSH_88_P1 = '5ccb86c438a75ea0a1214633c6f04ec43dcbefeb';
/** El *check run* de `sonar-issues` en `check-runs-failed.json`. */
const SONAR_ISSUES_JOB = 121264937094;

type Route = (call: Call) => Response | Promise<Response> | undefined;

/** Un GitHub falso con las respuestas grabadas; `override` responde antes que ellas. */
function github(override: Route = () => undefined) {
  const { fetch, calls } = fakeFetch(async (call) => {
    const answer = await override(call);
    if (answer) return answer;
    const path = new URL(call.url).pathname;
    if (path.endsWith('/pulls/88')) return json(await fixture('pull-88.json'));
    const comments = /\/pulls\/(\d+)\/comments$/.exec(path);
    if (comments) return json(await fixture(`review-comments-${comments[1]}.json`));
    if (path.endsWith('/check-runs')) return json(await fixture('check-runs-failed.json'));
    if (path.endsWith(`/actions/jobs/${SONAR_ISSUES_JOB}/logs`)) {
      return text(await fixture('job-logs-sonar-issues.txt'));
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
  const findings = createFindings({
    reviewer: { login: REVIEWER, name: 'Codex', parse: parseCodexFinding },
    github: reader,
  });
  return { findings, calls };
}

function reviewerFindings(findings: Finding[]) {
  return findings.filter((finding) => finding.source === 'reviewer');
}

describe('los hallazgos del revisor', () => {
  it('son sus comentarios hechos sobre el push pedido, no los movidos desde uno anterior', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88, []);

    expect(reviewerFindings(read)).toEqual([
      expect.objectContaining({ file: 'packages/pr-babysitter/src/core/tracking.ts', line: 109 }),
    ]);
  });

  it('llevan el revisor, la insignia, la severidad, el título, el texto, el fichero, la línea y el trozo de diff', async () => {
    const { findings } = github();
    const recorded = JSON.parse(await fixture('review-comments-88.json')) as {
      id: number;
      diff_hunk: string;
    }[];
    const diffHunk = recorded.find((comment) => comment.id === 4399182116)?.diff_hunk;

    const { findings: read } = await findings.read(88, PUSH_88, []);

    expect(read[0]).toEqual({
      source: 'reviewer',
      reviewer: 'Codex',
      badge: 'P2',
      severity: 'normal',
      file: 'packages/pr-babysitter/src/core/tracking.ts',
      line: 109,
      title: 'Route failed checks directly to the final notification',
      text: expect.stringMatching(/^When all checks finish with at least one failure/) as string,
      diffHunk,
    });
  });

  it('el texto va sin la insignia, sin la coletilla de Codex y sin marcas ocultas', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88_P1, []);
    const [p1] = reviewerFindings(read);

    expect(p1?.text).not.toMatch(/Badge|Useful\? React|<!--/);
  });

  it('P1 es severidad alta, y un comentario desfasado toma su línea original', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88_P1, []);

    expect(reviewerFindings(read)).toEqual([
      expect.objectContaining({
        badge: 'P1',
        severity: 'high',
        file: 'packages/pr-babysitter/src/core/graph.ts',
        line: 204,
        title: 'Prevent pending-notice recovery from requesting a stopped PR review',
      }),
    ]);
  });

  it('las respuestas en los hilos no son hallazgos, aunque sean del revisor', async () => {
    const recorded = JSON.parse(await fixture('review-comments-88.json')) as Record<string, unknown>[];
    const reply = { ...recorded[0], id: 1, in_reply_to_id: 4399182116, original_commit_id: PUSH_88 };
    const { findings } = github(({ url }) =>
      url.endsWith('/pulls/88/comments') ? json(JSON.stringify([...recorded, reply])) : undefined,
    );

    const { findings: read } = await findings.read(88, PUSH_88, []);

    expect(reviewerFindings(read)).toHaveLength(1);
  });

  it('son todos los del push, en el orden en que se escribieron', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(85, 'a48f14aceb5df4d58d5cc40683bbaa9b5bdf5323', []);

    expect(reviewerFindings(read).map(({ file, line }) => `${file}:${line}`)).toEqual([
      'packages/panel/src/App.tsx:90',
      'packages/panel/src/effects/EffectList.tsx:66',
    ]);
  });

  it('un comentario de otra cuenta no es un hallazgo (BE6)', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88, []);

    expect(JSON.stringify(read)).not.toContain('Classify every finding');
  });
});

describe('un comentario de Codex', () => {
  it('sin insignia tiene severidad normal y su primera línea por título', () => {
    expect(parseCodexFinding('**Something odd**\n\nThe details.')).toEqual({
      badge: null,
      severity: 'normal',
      title: 'Something odd',
      text: 'The details.',
    });
  });

  it('P0 también es severidad alta', () => {
    const body = '**<sub><sub>![P0 Badge](https://img.shields.io/badge/P0-red)</sub></sub>  Data loss**';

    expect(parseCodexFinding(body)).toMatchObject({ badge: 'P0', severity: 'high' });
  });
});

describe('el contexto de la PR', () => {
  it('es su título y su descripción', async () => {
    const { findings } = github();
    const pull = JSON.parse(await fixture('pull-88.json')) as { title: string; body: string };

    const { context } = await findings.read(88, PUSH_88, []);

    expect(context).toEqual({ title: pull.title, description: pull.body });
  });
});

describe('las comprobaciones que fallan', () => {
  it('son un hallazgo cada una, con el paso que falla de su log', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88, ['sonar-issues']);
    const check = read.find((finding) => finding.source === 'check');

    expect(check).toEqual({ source: 'check', name: 'sonar-issues', log: expect.any(String) });
    const log = check?.source === 'check' ? (check.log ?? '') : '';
    expect(log.startsWith('##[group]Run node tooling/ci/check-sonar-issues.ts')).toBe(true);
    expect(log).toContain('3 incidencias nuevas de SonarQube en la PR:');
    expect(log.trimEnd().endsWith('##[error]Process completed with exit code 1.')).toBe(true);
  });

  it('el log va sin la limpieza del job, sin marcas de tiempo y sin colores', async () => {
    const { findings } = github();

    const { findings: read } = await findings.read(88, PUSH_88, ['sonar-issues']);
    const log = JSON.stringify(read.find((finding) => finding.source === 'check'));

    expect(log).not.toContain('Post job cleanup');
    expect(log).not.toMatch(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d/);
    expect(log).not.toContain(String.raw`\u001b`);
  });

  it('el log se corta por el principio, hasta 16 KiB', async () => {
    const lines = Array.from({ length: 2000 }, (_, i) => `2026-10-28T17:09:21.0000000Z línea ${i}`);
    const long = ['##[group]Run pnpm test', ...lines, '##[error]Process completed with exit code 1.'];
    const { findings } = github(({ url }) =>
      url.endsWith(`/actions/jobs/${SONAR_ISSUES_JOB}/logs`) ? text(long.join('\n')) : undefined,
    );

    const { findings: read } = await findings.read(88, PUSH_88, ['sonar-issues']);
    const check = read.find((finding) => finding.source === 'check');
    const log = check?.source === 'check' ? (check.log ?? '') : '';

    expect(new TextEncoder().encode(log).length).toBeLessThanOrEqual(16 * 1024);
    expect(log.trimEnd().endsWith('##[error]Process completed with exit code 1.')).toBe(true);
    expect(log).not.toContain('línea 0\n');
  });

  it('sin un error marcado, el log es su final', async () => {
    const { findings } = github(({ url }) =>
      url.endsWith(`/actions/jobs/${SONAR_ISSUES_JOB}/logs`) ? text('primera\nsegunda\núltima') : undefined,
    );

    const { findings: read } = await findings.read(88, PUSH_88, ['sonar-issues']);

    expect(read).toContainEqual({ source: 'check', name: 'sonar-issues', log: 'primera\nsegunda\núltima' });
  });

  it('sin log que leer, el hallazgo va sin contexto', async () => {
    const { findings, calls } = github(({ url }) =>
      url.endsWith(`/actions/jobs/${SONAR_ISSUES_JOB}/logs`) ? json('{"message":"Not Found"}', 404) : undefined,
    );

    const { findings: read } = await findings.read(88, PUSH_88, ['sonar-issues', 'SonarCloud Code Analysis']);

    expect(read.filter((finding) => finding.source === 'check')).toEqual([
      { source: 'check', name: 'sonar-issues', log: null },
      { source: 'check', name: 'SonarCloud Code Analysis', log: null },
    ]);
    // La de SonarCloud no es un job de GitHub Actions: no tiene log que pedir.
    expect(calls.filter((call) => call.url.includes('/actions/jobs/'))).toHaveLength(1);
  });
});

describe('si GitHub falla', () => {
  it('con el token rechazado, lanza el error del token', async () => {
    const { findings } = github(() => json('{"message":"Bad credentials"}', 401));

    await expect(findings.read(88, PUSH_88, [])).rejects.toBeInstanceOf(GitHubUnauthorizedError);
  });

  it('con un 5xx al leer los comentarios, lanza para que se reintente', async () => {
    const { findings } = github(({ url }) =>
      url.endsWith('/pulls/88/comments') ? json('{"message":"Server Error"}', 502) : undefined,
    );

    await expect(findings.read(88, PUSH_88, [])).rejects.toThrow();
  });

  it('con un 5xx al leer un log, lanza para que se reintente', async () => {
    const { findings } = github(({ url }) =>
      url.includes('/actions/jobs/') ? json('{"message":"Server Error"}', 502) : undefined,
    );

    await expect(findings.read(88, PUSH_88, ['sonar-issues'])).rejects.toThrow();
  });
});
