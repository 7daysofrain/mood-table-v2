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
 * El resumen del triaje en la PR (change pr-shadow-triage, decisión 7), uno por push. El texto lo
 * arma el núcleo (`triage-summary.ts`) con una marca del SHA; el adaptador lo publica y la busca.
 *
 * Lanza como `ReviewRequests`: `GitHubRequestRejectedError` si GitHub rechaza el comentario, y
 * cualquier otro error si falla y se puede reintentar.
 */
export interface TriageSummaries {
  /** Si el sistema ya ha publicado, con su token, el resumen de ese push. */
  published(pullRequestNumber: number, sha: string): Promise<boolean>;
  /** Publica el resumen de ese push. */
  publish(pullRequestNumber: number, sha: string, text: string): Promise<void>;
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
 * El modelo de decisión (change pr-check-triage, decisión 3; glosario de PB): responde a una
 * pregunta de sí o no sobre un hallazgo, que va solo en su petición, con la probabilidad del sí. No
 * sabe de umbrales ni de reglas: eso es del triador, los nodos del grafo. Si no responde, lanza
 * `DecisionModelError`.
 */
export interface DecisionModel {
  /**
   * Los tokens de entrada que costaría preguntar por ese hallazgo, estimados antes de llamar y por
   * lo alto: la petición entera, con la PR, el hallazgo y la pregunta con sus criterios (decisión
   * 5). Solo el adaptador sabe cómo es.
   */
  estimate(pr: PullRequestContext, finding: Finding): number;
  /** La probabilidad de que haya que arreglarlo en esta PR, y los tokens de entrada cobrados. */
  ask(pr: PullRequestContext, finding: Finding): Promise<{ probability: number; inputTokens: number }>;
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
 * El modelo de decisión no ha respondido sobre un hallazgo. Lleva los tokens de entrada que ya ha
 * cobrado: una petición que se paga y después falla (la respuesta no trae el hallazgo) suma al gasto
 * de la PR (change pr-check-triage, decisión 5).
 */
export class DecisionModelError extends Error {
  override readonly name = 'DecisionModelError';

  readonly inputTokens: number;

  constructor(message: string, inputTokens: number, options?: ErrorOptions) {
    super(message, options);
    this.inputTokens = inputTokens;
  }
}
