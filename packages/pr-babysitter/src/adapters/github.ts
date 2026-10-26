/**
 * Adaptador de lectura de GitHub (change pr-tracking, decisiones 3 y 4), con octokit. Solo lee: el
 * token es de solo lectura y el sistema no escribe nada en GitHub (D64).
 *
 * El token lo da un proveedor en cada petición, no un valor fijo: hoy es el PAT del `.env`, y con
 * BH3 podrá ser el de una GitHub App sin tocar nada más. Sin reintentos ni esperas por el límite de
 * la API: si una lectura falla, el driver se salta la vuelta y lo intenta en la siguiente.
 */
import { Octokit, RequestError } from 'octokit';
import * as z from 'zod';

import { GitHubUnauthorizedError, type GitHubReader } from '../core/ports.ts';
import type { OpenPullRequest } from '../core/pull-request.ts';

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
});

export function createGitHubReader({
  owner,
  repo,
  baseBranch,
  token,
  fetch,
}: GitHubReaderOptions): GitHubReader {
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
      let pulls: unknown;
      try {
        pulls = await octokit.paginate(octokit.rest.pulls.list, {
          owner,
          repo,
          state: 'open',
          base: baseBranch,
          per_page: 100,
        });
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) {
          throw new GitHubUnauthorizedError(error.message, { cause: error });
        }
        throw error;
      }
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
        }));
    },
  };
}
