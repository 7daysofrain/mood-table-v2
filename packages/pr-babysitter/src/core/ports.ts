/**
 * Puertos del núcleo (change pr-tracking, decisiones 2, 3 y 5): lo que el núcleo necesita de fuera
 * sin saber quién se lo da. Los adaptadores de GitHub y Linear los implementan; los tests, con
 * falsos.
 */
import type { Notice } from './notice.ts';
import type { Check, OpenPullRequest, Review } from './pull-request.ts';
import type { Finding, PullRequestContext } from './triage.ts';

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

/**
 * Lectura de la revisión del revisor. Como `GitHubReader`, lanza si no puede leer; una revisión que
 * no hay o no se entiende no es un fallo, es `null` (decisión 7).
 */
export interface ReviewReader {
  review(pullRequestNumber: number): Promise<Review | null>;
}

/**
 * Las peticiones de revisión del sistema (change pr-review-request, decisiones 2 y 3): saber si ya
 * ha pedido la revisión de un push y pedirla. Qué revisor hay detrás y cómo se le pide es del
 * adaptador (BA3).
 *
 * Lanza como `GitHubReader`. Si GitHub rechaza la petición por algo que no se arregla solo (p. ej.
 * el token no tiene permiso), lanza `GitHubRequestRejectedError` (decisión 6).
 */
export interface ReviewRequests {
  /** Si el sistema ya ha pedido la revisión de ese push, con su token. */
  requested(pullRequestNumber: number, sha: string): Promise<boolean>;
  /** Pide al revisor que revise ese push. */
  request(pullRequestNumber: number, sha: string): Promise<void>;
}

/**
 * Los hallazgos de un push (change pr-shadow-triage, decisión 2): los comentarios del revisor hechos
 * sobre ese push y las comprobaciones que fallan, cada uno con su contexto, y el título y la
 * descripción de la PR. Solo los del revisor: un comentario de otra cuenta nunca es un hallazgo
 * (BE6).
 *
 * Lanza como `GitHubReader`. Un contexto que GitHub no da no es un fallo: el hallazgo va sin él.
 */
export interface Findings {
  read(
    pullRequestNumber: number,
    sha: string,
    failedChecks: string[],
  ): Promise<{ context: PullRequestContext; findings: Finding[] }>;
}

/**
 * El modelo de decisión (change pr-shadow-triage, decisión 3): para cada hallazgo, en su orden, la
 * probabilidad de que haya que arreglarlo en esta PR antes de integrarla, y los tokens de entrada
 * que ha cobrado. No sabe de umbrales ni de reglas. Si el modelo no responde, lanza
 * `TriageFailedError`.
 */
export interface Triager {
  triage(
    context: PullRequestContext,
    findings: Finding[],
  ): Promise<{ probabilities: number[]; inputTokens: number }>;
}

/** GitHub rechaza el token (401): hay que avisar, porque no se arregla solo (decisión 3). */
export class GitHubUnauthorizedError extends Error {
  override readonly name = 'GitHubUnauthorizedError';
}

/**
 * GitHub rechaza una escritura con un 4xx que no es el token ni el límite de la API (p. ej. un 403
 * porque el token no tiene permiso): reintentarla no la arregla (change pr-review-request, decisión
 * 6).
 */
export class GitHubRequestRejectedError extends Error {
  override readonly name = 'GitHubRequestRejectedError';
}

/**
 * El modelo de decisión no ha respondido a todo el triaje. Lleva los tokens de entrada que ya ha
 * cobrado: si el triaje va en varias peticiones y falla una posterior, las anteriores se han pagado
 * y suman al gasto de la PR (change pr-shadow-triage, decisión 6).
 */
export class TriageFailedError extends Error {
  override readonly name = 'TriageFailedError';

  constructor(
    message: string,
    readonly inputTokens: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
  }
}
