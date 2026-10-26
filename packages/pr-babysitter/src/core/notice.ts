/**
 * El aviso de dominio (change pr-tracking, decisión 2): qué tiene que saber el mantenedor, sin nada
 * del canal. El adaptador del canal decide a quién menciona, dónde lo publica y con qué formato;
 * aquí solo se decide qué se dice.
 */
import type { OpenPullRequest } from './pull-request.ts';
import type { FinalState, InterventionReason } from './tracking.ts';

/** La PR de la que habla un aviso: lo justo para identificarla. */
export interface NoticePullRequest {
  number: number;
  title: string;
  url: string;
}

/** El sistema sigue la PR y espera a que terminen sus comprobaciones. */
export interface TrackingNotice {
  type: 'tracking';
  pullRequest: NoticePullRequest;
}

/** Han terminado las comprobaciones del último push: el sistema espera a la revisión. */
export interface ChecksFinishedNotice {
  type: 'checksFinished';
  pullRequest: NoticePullRequest;
}

/** El estado final del último push: el sistema deja de seguir la PR. */
export interface FinalNotice {
  type: 'final';
  pullRequest: NoticePullRequest;
  state: FinalState;
}

/** GitHub rechaza el token: un aviso del sistema, no de una PR (decisión 3). */
export interface GitHubUnauthorizedNotice {
  type: 'githubUnauthorized';
}

export type PullRequestNotice = TrackingNotice | ChecksFinishedNotice | FinalNotice;
export type SystemNotice = GitHubUnauthorizedNotice;
export type Notice = PullRequestNotice | SystemNotice;

function noticePullRequest({ number, title, url }: OpenPullRequest): NoticePullRequest {
  return { number, title, url };
}

export function trackingNotice(pullRequest: OpenPullRequest): TrackingNotice {
  return { type: 'tracking', pullRequest: noticePullRequest(pullRequest) };
}

export function checksFinishedNotice(pullRequest: OpenPullRequest): ChecksFinishedNotice {
  return { type: 'checksFinished', pullRequest: noticePullRequest(pullRequest) };
}

export function finalNotice(pullRequest: OpenPullRequest, state: FinalState): FinalNotice {
  return { type: 'final', pullRequest: noticePullRequest(pullRequest), state };
}

export function githubUnauthorizedNotice(): GitHubUnauthorizedNotice {
  return { type: 'githubUnauthorized' };
}

/** Si el aviso es de una PR. Los demás van al issue buzón (decisión 2). */
export function isPullRequestNotice(notice: Notice): notice is PullRequestNotice {
  return 'pullRequest' in notice;
}

/** Qué dice el aviso, en una frase en español y sin datos de la PR (los pone el canal). */
export function noticeSummary(notice: Notice): string {
  switch (notice.type) {
    case 'tracking':
      return 'La sigo: espero a que terminen sus comprobaciones.';
    case 'checksFinished':
      return 'Han terminado sus comprobaciones: espero a la revisión.';
    case 'final':
      return `${finalSummary(notice.state)} Dejo de seguirla.`;
    case 'githubUnauthorized':
      return 'No puedo leer GitHub: rechaza el token. Lo vuelvo a intentar cada vuelta.';
  }
}

function finalSummary(state: FinalState): string {
  if (state.status === 'readyToMerge') return 'Lista para integrar.';
  return `Necesita intervención: ${state.reasons.map(reasonSummary).join('; ')}.`;
}

function reasonSummary(reason: InterventionReason): string {
  switch (reason.kind) {
    case 'checksFailed':
      return `${reason.checks.length === 1 ? 'falla' : 'fallan'} ${list(reason.checks)}`;
    case 'checksUnfinished':
      return `${reason.checks.length === 1 ? 'no ha' : 'no han'} terminado ${list(reason.checks)}`;
    case 'reviewFindings':
      return 'el revisor tiene hallazgos';
    case 'reviewUnfinished':
      return 'la revisión no ha terminado';
  }
}

/** «a», «a y b», «a, b y c». */
function list(items: string[]): string {
  return items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}
