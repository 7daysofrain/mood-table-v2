/**
 * Adaptador de GitHub (change pr-tracking, decisiones 3, 4 y 6), con octokit. Lee, también los
 * hallazgos que tría el sistema (change pr-shadow-triage, decisión 2), y solo escribe comentarios en
 * una PR, para pedir la revisión (change pr-review-request, decisión 2): el token
 * tiene escritura en *Issues* y *Pull requests*, pero no en *Contents*, así que no puede subir
 * commits ni integrar (D64).
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

import {
  GitHubRequestRejectedError,
  GitHubUnauthorizedError,
  type GitHubReader,
} from '../core/ports.ts';
import type { Check, OpenPullRequest } from '../core/pull-request.ts';

/** Un comentario de una PR: quién lo escribe y qué dice. */
export interface PullRequestComment {
  /** Login de GitHub de la cuenta que lo escribe. */
  author: string;
  body: string;
}

/** Un comentario de revisión en línea, tal como se hizo: en qué push, fichero y línea. */
export interface ReviewComment {
  /** Login de GitHub de la cuenta que lo escribe. */
  author: string;
  body: string;
  /**
   * El push sobre el que se hizo. No el `commit_id`, que GitHub mueve al push siguiente si la línea
   * no cambia (la #88).
   */
  originalSha: string;
  path: string;
  /** La línea en ese push, o `null` si el comentario es del fichero entero. */
  originalLine: number | null;
  diffHunk: string | null;
  /** El comentario al que contesta, si es una respuesta en un hilo. */
  inReplyTo: number | null;
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

/** Lo que se lee de una PR de `GET /repos/{owner}/{repo}/pulls/{number}`, para el triaje. */
const pullTextSchema = z.object({ title: z.string(), body: z.string().nullable() });

/** Lo que se lee de cada comentario de `GET /repos/{owner}/{repo}/pulls/{number}/comments`. */
const reviewCommentSchema = z.object({
  user: z.object({ login: z.string() }),
  body: z.string(),
  original_commit_id: z.string(),
  path: z.string(),
  original_line: z.number().nullable().optional(),
  diff_hunk: z.string().nullable().optional(),
  in_reply_to_id: z.number().nullable().optional(),
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
  id: z.number(),
  name: z.string(),
  status: z.string(),
  conclusion: z.string().nullable(),
  /** La app que la ejecuta: solo las de GitHub Actions son un *job* con log. */
  app: z.object({ slug: z.string() }).nullable().optional(),
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
  /** Publica un comentario en una PR. Para la petición de revisión. */
  createComment(pullRequestNumber: number, body: string): Promise<void>;
  /** El título y la descripción de una PR. Para el triaje. */
  getPullRequest(pullRequestNumber: number): Promise<{ title: string; body: string }>;
  /** Los comentarios de revisión en línea de una PR, del primero al último. Para el triaje. */
  listReviewComments(pullRequestNumber: number): Promise<ReviewComment[]>;
  /**
   * El log entero del *job* de una comprobación en un commit, o `null` si no es un *job* de GitHub
   * Actions o GitHub no lo da. Para el triaje.
   */
  jobLog(sha: string, checkName: string): Promise<string | null>;
} {
  const octokit = new Octokit({
    request: fetch ? { fetch } : {},
    retry: { enabled: false },
    throttle: { enabled: false },
  });
  octokit.hook.before('request', async (options) => {
    options.headers.authorization = `token ${await token()}`;
  });

  async function checkRuns(sha: string) {
    const runs = await read(() =>
      octokit.paginate(octokit.rest.checks.listForRef, {
        owner,
        repo,
        ref: sha,
        per_page: 100,
      }),
    );
    return z.array(checkRunSchema).parse(runs);
  }

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
      const runs = await checkRuns(sha);
      return required.map((name) => {
        // GitHub da el *check run* más reciente de cada nombre (`filter=latest`).
        const run = runs.find((checkRun) => checkRun.name === name);
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

    async createComment(pullRequestNumber: number, body: string): Promise<void> {
      await write(() =>
        octokit.rest.issues.createComment({ owner, repo, issue_number: pullRequestNumber, body }),
      );
    },

    async getPullRequest(pullRequestNumber: number) {
      const { data } = await read(() =>
        octokit.rest.pulls.get({ owner, repo, pull_number: pullRequestNumber }),
      );
      const pull = pullTextSchema.parse(data);
      return { title: pull.title, body: pull.body ?? '' };
    },

    async listReviewComments(pullRequestNumber: number): Promise<ReviewComment[]> {
      const comments = await read(() =>
        octokit.paginate(octokit.rest.pulls.listReviewComments, {
          owner,
          repo,
          pull_number: pullRequestNumber,
          per_page: 100,
        }),
      );
      return z
        .array(reviewCommentSchema)
        .parse(comments)
        .map((comment) => ({
          author: comment.user.login,
          body: comment.body,
          originalSha: comment.original_commit_id,
          path: comment.path,
          originalLine: comment.original_line ?? null,
          diffHunk: comment.diff_hunk ?? null,
          inReplyTo: comment.in_reply_to_id ?? null,
        }));
    },

    async jobLog(sha: string, checkName: string): Promise<string | null> {
      const run = (await checkRuns(sha)).find((checkRun) => checkRun.name === checkName);
      if (run?.app?.slug !== 'github-actions') return null;
      try {
        const { data } = await read(() =>
          octokit.rest.actions.downloadJobLogsForWorkflowRun({ owner, repo, job_id: run.id }),
        );
        return typeof data === 'string' ? data : String(data);
      } catch (error) {
        // Un log que GitHub no da (caducado, borrado o sin permiso) deja el hallazgo sin contexto;
        // la red, un 5xx o el límite de la API se reintentan.
        if (error instanceof RequestError && isRejection(error)) return null;
        throw error;
      }
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

/**
 * Hace una escritura. Como una lectura, un 401 es el token rechazado; otro 4xx que no sea el
 * límite de la API es una petición rechazada, que no se arregla sola (change pr-review-request,
 * decisión 6).
 */
async function write<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await read(request);
  } catch (error) {
    if (error instanceof RequestError && isRejection(error)) {
      throw new GitHubRequestRejectedError(error.message, { cause: error });
    }
    throw error;
  }
}

/** Un 4xx que no es el token ni el límite de la API (GitHub lo da con 429, o con 403 y cabeceras). */
function isRejection({ status, response }: RequestError): boolean {
  if (status < 400 || status >= 500 || status === 401 || status === 429) return false;
  const headers = response?.headers ?? {};
  const limited = headers['x-ratelimit-remaining'] === '0' || headers['retry-after'] !== undefined;
  return !(status === 403 && limited);
}
