/**
 * El aviso de dominio (change pr-tracking, decisión 2): qué tiene que saber el mantenedor, sin nada
 * del canal. El adaptador del canal decide a quién menciona, dónde lo publica y con qué formato;
 * aquí solo se decide qué se dice. Los avisos de comprobaciones terminadas y de estado final llegan
 * con MOO-84.
 */
import type { OpenPullRequest } from './pull-request.ts';

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

/** GitHub rechaza el token: un aviso del sistema, no de una PR (decisión 3). */
export interface GitHubUnauthorizedNotice {
  type: 'githubUnauthorized';
}

export type PullRequestNotice = TrackingNotice;
export type SystemNotice = GitHubUnauthorizedNotice;
export type Notice = PullRequestNotice | SystemNotice;

export function trackingNotice({ number, title, url }: OpenPullRequest): TrackingNotice {
  return { type: 'tracking', pullRequest: { number, title, url } };
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
    case 'githubUnauthorized':
      return 'No puedo leer GitHub: rechaza el token. Lo vuelvo a intentar cada vuelta.';
  }
}
