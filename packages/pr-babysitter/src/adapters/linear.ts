/**
 * Adaptador del canal de aviso (change pr-tracking, decisiones 1, 2 y 4): publica cada aviso como
 * comentario en Linear, con una app OAuth propia (`actor=app`) que solo puede leer y comentar. Así
 * el comentario no sale a nombre del mantenedor y Linear sí le notifica.
 *
 * El token se pide con `client_credentials` (dura 30 días), se renueva un día antes de que caduque
 * y, si Linear lo rechaza, se pide otro y se repite la petición una vez. El aviso de una PR va a la
 * tarea que tiene la PR como adjunto; sin tarea, y los avisos del sistema, al issue buzón. Si
 * Linear falla, `notify` lanza: el driver reintenta el aviso en la vuelta siguiente.
 */
import { LinearClient, LinearError, LinearErrorType } from '@linear/sdk';
import * as z from 'zod';

import { isPullRequestNotice, type Notice, noticeSummary } from '../core/notice.ts';
import type { Notifier } from '../core/ports.ts';

const TOKEN_URL = 'https://api.linear.app/oauth/token';
const SCOPES = 'read,comments:create';
/** Cuánto antes de que caduque se renueva el token. */
const RENEW_BEFORE_MS = 24 * 60 * 60 * 1000;

export interface LinearNotifierOptions {
  clientId: string;
  clientSecret: string;
  /** La URL del perfil del mantenedor en Linear: por la API, una mención es esa URL. */
  maintainerProfileUrl: string;
  /** El issue buzón, para lo que no tiene tarea (decisión 2). */
  inboxIssueId: string;
  /** Hora en ms desde epoch, para la caducidad del token. */
  clock?: () => number;
  /** Lo que conviene saber sin ser un fallo (una PR con varias tareas). */
  log?: (line: string) => void;
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive(),
});

const PULL_REQUEST_ISSUE_QUERY = `query PullRequestIssue($url: String!) {
  attachmentsForURL(url: $url) {
    nodes {
      issue {
        id
        identifier
      }
    }
  }
}`;

const pullRequestIssueSchema = z.object({
  attachmentsForURL: z.object({
    nodes: z.array(z.object({ issue: z.object({ id: z.string(), identifier: z.string() }) })),
  }),
});

interface Token {
  value: string;
  renewAt: number;
}

export function createLinearNotifier({
  clientId,
  clientSecret,
  maintainerProfileUrl,
  inboxIssueId,
  clock = Date.now,
  log = () => undefined,
}: LinearNotifierOptions): Notifier {
  let token: Token | undefined;

  async function requestToken(): Promise<Token> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        scope: SCOPES,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });
    if (!response.ok) {
      throw new Error(`Linear no da el token (${response.status}): ${await response.text()}`);
    }
    const { access_token, expires_in } = tokenSchema.parse(await response.json());
    return { value: access_token, renewAt: clock() + expires_in * 1000 - RENEW_BEFORE_MS };
  }

  async function client(): Promise<LinearClient> {
    if (!token || clock() >= token.renewAt) token = await requestToken();
    return new LinearClient({ accessToken: token.value });
  }

  /** Ejecuta `run` con un cliente; si Linear rechaza el token, pide otro y lo repite una vez. */
  async function withClient<T>(run: (linear: LinearClient) => Promise<T>): Promise<T> {
    try {
      return await run(await client());
    } catch (error) {
      if (!isAuthenticationError(error)) throw error;
      token = undefined;
      return run(await client());
    }
  }

  async function issueFor(notice: Notice): Promise<string> {
    if (!isPullRequestNotice(notice)) return inboxIssueId;
    const { url } = notice.pullRequest;
    const response = await withClient((linear) =>
      linear.client.rawRequest(PULL_REQUEST_ISSUE_QUERY, { url }),
    );
    const issues = pullRequestIssueSchema
      .parse(response.data)
      .attachmentsForURL.nodes.map((node) => node.issue);
    if (issues.length > 1) {
      const identifiers = issues.map((issue) => issue.identifier).join(', ');
      log(`La PR ${url} está en varias tareas (${identifiers}); se avisa en la primera.`);
    }
    return issues[0]?.id ?? inboxIssueId;
  }

  function body(notice: Notice): string {
    if (!isPullRequestNotice(notice)) {
      return [`${maintainerProfileUrl} · PR Babysitter`, noticeSummary(notice)].join('\n');
    }
    const { number, title, url } = notice.pullRequest;
    return [`${maintainerProfileUrl} · #${number} · ${title}`, noticeSummary(notice), url].join('\n');
  }

  return {
    async notify(notice) {
      const issueId = await issueFor(notice);
      const payload = await withClient((linear) =>
        linear.createComment({ issueId, body: body(notice) }),
      );
      if (!payload.success) throw new Error(`Linear no ha publicado el comentario en ${issueId}`);
    },
  };
}

function isAuthenticationError(error: unknown): boolean {
  return (
    error instanceof LinearError &&
    (error.status === 401 || error.type === LinearErrorType.AuthenticationError)
  );
}
