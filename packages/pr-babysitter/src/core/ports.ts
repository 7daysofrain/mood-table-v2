/**
 * Puertos del núcleo (change pr-tracking, decisiones 2, 3 y 5): lo que el núcleo necesita de fuera
 * sin saber quién se lo da. Los adaptadores de GitHub y Linear los implementan; los tests, con
 * falsos.
 */
import type { Notice } from './notice.ts';
import type { Check, OpenPullRequest } from './pull-request.ts';

/**
 * Publica un aviso para el mantenedor. Solo envía: la respuesta se diseña en BH4. Si el canal no lo
 * acepta, lanza un error en vez de tragárselo, para que el aviso se reintente (decisión 4).
 */
export interface Notifier {
  notify(notice: Notice): Promise<void>;
}

/**
 * Lectura de GitHub. Si GitHub rechaza el token, lanza `GitHubUnauthorizedError`; cualquier otro
 * fallo (red, 5xx, límite de la API) es un error cualquiera, y el driver se salta la vuelta
 * (decisiones 3 y 4).
 */
export interface GitHubReader {
  /** Las PR abiertas contra la rama base. */
  listOpenPullRequests(): Promise<OpenPullRequest[]>;
  /** Los nombres de las comprobaciones que exige ahora la rama base (decisión 6). */
  requiredChecks(): Promise<string[]>;
  /** El estado de cada comprobación exigida en un commit, en el orden de `required`. */
  checks(sha: string, required: string[]): Promise<Check[]>;
}

/** GitHub rechaza el token (401): hay que avisar, porque no se arregla solo (decisión 3). */
export class GitHubUnauthorizedError extends Error {
  override readonly name = 'GitHubUnauthorizedError';
}
