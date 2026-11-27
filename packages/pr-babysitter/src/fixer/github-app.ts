/**
 * La identidad del *fixer* en GitHub (change pr-fixer, decisión 2; D128): una GitHub App propia del
 * PR Babysitter, instalada solo en el repo, con *Contents* y *Pull requests* en escritura. Para cada
 * trabajo se pide un token de instalación (dura 1 h), limitado a ese repo. Un *ruleset* sobre `main`
 * le impide integrar o actualizar `main`: el token solo sirve para subir a las ramas de las PR.
 */
import { createSign } from 'node:crypto';

const GITHUB_API = 'https://api.github.com';

/** Lo que identifica a la App: su *client ID* y su clave privada en PEM. */
export interface GitHubApp {
  clientId: string;
  privateKey: string;
}

export interface InstallationToken {
  token: string;
  expiresAt: string;
}

function base64url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

/**
 * El JWT con el que la App se presenta a GitHub: RS256, con la App como emisor. Vale de un minuto
 * antes (por si el reloj de GitHub va por detrás) a nueve después: GitHub admite diez como mucho.
 */
export function appJwt(app: GitHubApp, now: Date): string {
  const seconds = Math.floor(now.getTime() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: seconds - 60, exp: seconds + 9 * 60, iss: app.clientId }));
  const signer = createSign('RSA-SHA256');
  signer.update(`${header}.${payload}`);
  return `${header}.${payload}.${signer.sign(app.privateKey, 'base64url')}`;
}

function headers(bearer: string): Record<string, string> {
  return {
    authorization: `Bearer ${bearer}`,
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28',
  };
}

/**
 * Un token de instalación de la App limitado a `repository` (`owner/name`). Lanza si la App no está
 * instalada en el repo o si GitHub rechaza la petición; el mensaje nunca lleva el JWT.
 */
export async function installationToken(
  fetch: typeof globalThis.fetch,
  app: GitHubApp,
  repository: string,
  now: Date,
): Promise<InstallationToken> {
  const jwt = appJwt(app, now);
  const installation = await fetch(`${GITHUB_API}/repos/${repository}/installation`, {
    headers: headers(jwt),
  });
  if (installation.status === 404) {
    throw new Error(`La App del PR Babysitter no está instalada en ${repository}`);
  }
  if (!installation.ok) {
    throw new Error(`GitHub no da la instalación de la App en ${repository}: ${installation.status}`);
  }
  const { id } = (await installation.json()) as { id: number };

  const name = repository.split('/')[1];
  const response = await fetch(`${GITHUB_API}/app/installations/${id}/access_tokens`, {
    method: 'POST',
    headers: headers(jwt),
    body: JSON.stringify({ repositories: [name] }),
  });
  if (!response.ok) {
    throw new Error(`GitHub no da el token de instalación de la App: ${response.status}`);
  }
  const body = (await response.json()) as { token: string; expires_at: string };
  return { token: body.token, expiresAt: body.expires_at };
}

/** La rama de la PR, leída de GitHub con el token de instalación. El mensaje de error no lleva el token. */
export async function pullRequestBranch(
  fetch: typeof globalThis.fetch,
  token: string,
  repository: string,
  pullRequestNumber: number,
): Promise<string> {
  const response = await fetch(`${GITHUB_API}/repos/${repository}/pulls/${pullRequestNumber}`, {
    headers: headers(token),
  });
  if (!response.ok) {
    throw new Error(`GitHub no da la PR #${pullRequestNumber} de ${repository}: ${response.status}`);
  }
  const body = (await response.json()) as { head: { ref: string } };
  return body.head.ref;
}
