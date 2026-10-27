/**
 * Adaptador de lectura de GitHub (change pr-tracking, decisiones 3, 4 y 6), con octokit. Solo lee:
 * el token es de solo lectura y el sistema no escribe nada en GitHub (D64).
 *
 * Las comprobaciones exigidas salen de las reglas de la rama base, no de los *check runs* que haya:
 * justo después de un push aún no hay ninguno, y con «todos los que haya» una lista vacía daría las
 * comprobaciones por terminadas.
 *
 * El token lo da un proveedor en cada petición, no un valor fijo: hoy es el PAT del `.env`, y con
 * BH3 podrá ser el de una GitHub App sin tocar nada más. Sin reintentos ni esperas por el límite de
 * la API: si una lectura falla, el driver se salta la vuelta y lo intenta en la siguiente.
 */
import { Octokit, RequestError } from 'octokit';
import * as z from 'zod';

import { GitHubUnauthorizedError, type GitHubReader } from '../core/ports.ts';
import type { Check, OpenPullRequest } from '../core/pull-request.ts';

/** Un comentario de una PR: quién lo escribe y qué dice. */
export interface PullRequestComment {
  /** Login de GitHub de la cuenta que lo escribe. */
  author: string;
  body: string;
}

export interface GitHubReaderOptions {
  owner: string;
  repo: string;
  /** Solo se leen las PR contra esta rama. */
  baseBranch: string;
  /** Da el token de cada petición. */
  token: () => string | Promise<string>;
  /** Para los tests; por defecto, el `fetch` de Node. */
  fetch?: typeof globalThis.fetch;
}

/** Lo que se lee de cada PR de `GET /repos/{owner}/{repo}/pulls`. */
const pullSchema = z.object({
  number: z.number(),
  title: z.string(),
  html_url: z.string(),
  user: z.object({ login: z.string() }),
  draft: z.boolean(),
  head: z.object({ sha: z.string() }),
  base: z.object({ ref: z.string() }),
  labels: z.array(z.object({ name: z.string() })),
});

/** Lo que se lee de cada comentario de `GET /repos/{owner}/{repo}/issues/{number}/comments`. */
const commentSchema = z.object({
  user: z.object({ login: z.string() }),
  body: z.string(),
});

/** Lo que se lee de cada regla de `GET /repos/{owner}/{repo}/rules/branches/{branch}`. */
const ruleSchema = z.object({
  type: z.string(),
  parameters: z.unknown().optional(),
});

const requiredStatusChecksSchema = z.object({
  required_status_checks: z.array(z.object({ context: z.string() })),
});

/** Lo que se lee de cada *check run* de `GET /repos/{owner}/{repo}/commits/{ref}/check-runs`. */
const checkRunSchema = z.object({
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
});

/** Las conclusiones que cuentan como superadas (`sonar-issues` se salta: `linear.md` §7). */
const PASSING_CONCLUSIONS = new Set(['success', 'neutral', 'skipped']);

export function createGitHubReader({
  owner,
  repo,
  baseBranch,
  token,
  fetch,
}: GitHubReaderOptions): GitHubReader & {
  /** Los comentarios de una PR, del primero al último. Para el adaptador del revisor. */
  listComments(pullRequestNumber: number): Promise<PullRequestComment[]>;
} {
  const octokit = new Octokit({
    request: fetch ? { fetch } : {},
    retry: { enabled: false },
    throttle: { enabled: false },
  });
  octokit.hook.before('request', async (options) => {
    options.headers.authorization = `token ${await token()}`;
  });

  return {
    async listOpenPullRequests(): Promise<OpenPullRequest[]> {
      const pulls = await read(() =>
        octokit.paginate(octokit.rest.pulls.list, {
          owner,
          repo,
          state: 'open',
          base: baseBranch,
          per_page: 100,
        }),
      );
      return z
        .array(pullSchema)
        .parse(pulls)
        .map((pull) => ({
          number: pull.number,
          title: pull.title,
          url: pull.html_url,
          author: pull.user.login,
          baseBranch: pull.base.ref,
          draft: pull.draft,
          headSha: pull.head.sha,
          labels: pull.labels.map((label) => label.name),
        }));
    },

    async requiredChecks(): Promise<string[]> {
      const rules = await read(() =>
        octokit.paginate(octokit.rest.repos.getBranchRules, {
          owner,
          repo,
          branch: baseBranch,
          per_page: 100,
        }),
      );
      const names = z
        .array(ruleSchema)
        .parse(rules)
        .filter((rule) => rule.type === 'required_status_checks')
        .flatMap((rule) =>
          requiredStatusChecksSchema
            .parse(rule.parameters)
            .required_status_checks.map((check) => check.context),
        );
      // Varios *rulesets* pueden exigir la misma comprobación.
      return [...new Set(names)];
    },

    async checks(sha: string, required: string[]): Promise<Check[]> {
      const runs = await read(() =>
        octokit.paginate(octokit.rest.checks.listForRef, {
          owner,
          repo,
          ref: sha,
          per_page: 100,
        }),
      );
      const checkRuns = z.array(checkRunSchema).parse(runs);
      return required.map((name) => {
        // GitHub da el *check run* más reciente de cada nombre (`filter=latest`).
        const run = checkRuns.find((checkRun) => checkRun.name === name);
        if (run?.status !== 'completed') return { name, status: 'pending' };
        const passed = PASSING_CONCLUSIONS.has(run.conclusion ?? '');
        return { name, status: passed ? 'passed' : 'failed' };
      });
    },

    async listComments(pullRequestNumber: number): Promise<PullRequestComment[]> {
      const comments = await read(() =>
        octokit.paginate(octokit.rest.issues.listComments, {
          owner,
          repo,
          issue_number: pullRequestNumber,
          per_page: 100,
        }),
      );
      return z
        .array(commentSchema)
        .parse(comments)
        .map((comment) => ({ author: comment.user.login, body: comment.body }));
    },
  };
}

/** Hace una lectura y convierte un 401 en el error de token rechazado (decisión 3). */
async function read<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) {
      throw new GitHubUnauthorizedError(error.message, { cause: error });
    }
    throw error;
  }
}
