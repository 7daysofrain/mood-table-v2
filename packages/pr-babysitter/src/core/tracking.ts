/**
 * Las reglas del seguimiento de una PR (change pr-tracking, decisiones 6, 7 y 8): funciones puras
 * sobre la foto, sin LangGraph ni reloj. El grafo traduce cada paso a su nodo.
 *
 * Hay dos tiempos de espera, del mismo largo (change pr-review-request, decisión 5): el de las
 * comprobaciones cuenta desde que el sistema **ve** el push (la primera foto con ese SHA), no desde
 * la fecha del commit; el de la revisión, desde que las ve pasar, que es cuando la pide. Un push
 * nuevo los reinicia.
 */
import type { PullRequestSnapshot } from './pull-request.ts';

/**
 * El push que se sigue: su SHA, cuándo lo vio el sistema por primera vez y, si sus comprobaciones
 * han pasado, cuándo lo vio (ms desde epoch). Desde `reviewSince` cuenta la espera de la revisión.
 */
export interface TrackedPush {
  sha: string;
  seenAt: number;
  reviewSince?: number;
}

/** Por qué una PR necesita intervención. */
export type InterventionReason =
  | { kind: 'checksFailed'; checks: string[] }
  | { kind: 'checksUnfinished'; checks: string[] }
  | { kind: 'reviewFindings' }
  | { kind: 'reviewUnfinished' };

/** El estado final de una PR (`specs/pr-tracking`; glosario de PB, *lista para integrar*). */
export type FinalState =
  | { status: 'readyToMerge' }
  | { status: 'needsIntervention'; reasons: InterventionReason[] };

/**
 * Qué toca al reanudar la espera de las comprobaciones: si pasan todas, avisar y esperar al
 * revisor; si alguna falla, el estado final sin esperarlo (change pr-review-request, decisión 4).
 */
export type ChecksStep = 'waiting' | 'checksFinished' | 'checksFailed' | 'timedOut';

/** Qué toca al reanudar la espera del revisor. */
export type ReviewStep = 'waiting' | 'finished' | 'timedOut' | 'newPush';

/** Han terminado cuando ninguna exigida está pendiente, pasen o fallen. */
export function checksFinished(snapshot: PullRequestSnapshot): boolean {
  return snapshot.checks.every((check) => check.status !== 'pending');
}

/** Han pasado cuando ninguna exigida está pendiente ni ha fallado. */
export function checksPassed(snapshot: PullRequestSnapshot): boolean {
  return snapshot.checks.every((check) => check.status === 'passed');
}

/**
 * Si hay que pedir la revisión (change pr-review-request, decisión 3): las comprobaciones han
 * pasado, y ni el revisor ha empezado con el último push, en cualquier estado, ni el sistema la ha
 * pedido ya. Lo primero cubre su revisión automática y la que pide el mantenedor; lo segundo, las
 * peticiones del propio sistema, también tras un reinicio.
 */
export function needsReviewRequest(snapshot: PullRequestSnapshot): boolean {
  const reviewing = snapshot.review?.reviewedSha === snapshot.headSha;
  return checksPassed(snapshot) && !reviewing && !snapshot.reviewRequested;
}

/** Ha terminado si está completada y lo que revisó es el último push (`workflow.md` §4.4). */
export function reviewFinished({ review, headSha }: PullRequestSnapshot): boolean {
  return review !== null && review.completed && review.reviewedSha === headSha;
}

/**
 * El estado final con la última foto y el push que se sigue. Al terminar todo, los motivos son las
 * comprobaciones que fallan y los hallazgos del revisor; con el tiempo agotado, también lo que no
 * ha terminado. Que la revisión no ha terminado solo se dice si se esperaba, es decir, si las
 * comprobaciones pasaron (`reviewSince`); si no, solo cuenta la que ya terminó el último push
 * (change pr-review-request, decisión 4).
 */
export function finalState(snapshot: PullRequestSnapshot, push: TrackedPush): FinalState {
  const named = (status: string) =>
    snapshot.checks.filter((check) => check.status === status).map((check) => check.name);
  const failed = named('failed');
  const unfinished = named('pending');
  const reasons: InterventionReason[] = [];
  if (failed.length > 0) reasons.push({ kind: 'checksFailed', checks: failed });
  if (unfinished.length > 0) reasons.push({ kind: 'checksUnfinished', checks: unfinished });
  if (reviewFinished(snapshot)) {
    if (snapshot.review?.hasFindings) reasons.push({ kind: 'reviewFindings' });
  } else if (push.reviewSince !== undefined) {
    reasons.push({ kind: 'reviewUnfinished' });
  }
  if (reasons.length === 0) return { status: 'readyToMerge' };
  return { status: 'needsIntervention', reasons };
}

/**
 * Si hay que triar antes de avisar del estado final (change pr-shadow-triage, decisión 1): necesita
 * intervención porque falla una comprobación o el revisor tiene hallazgos. Lo que no termina a
 * tiempo no deja hallazgos que triar.
 */
export function needsTriage(state: FinalState): boolean {
  return (
    state.status === 'needsIntervention' &&
    state.reasons.some(({ kind }) => kind === 'checksFailed' || kind === 'reviewFindings')
  );
}

/** El push de la foto: el que se seguía o, si el SHA ha cambiado, uno nuevo desde esta foto. */
export function pushOf(current: TrackedPush, snapshot: PullRequestSnapshot): TrackedPush {
  return current.sha === snapshot.headSha
    ? current
    : { sha: snapshot.headSha, seenAt: snapshot.observedAt };
}

function timedOut(since: number, snapshot: PullRequestSnapshot, timeoutMs: number): boolean {
  return snapshot.observedAt - since >= timeoutMs;
}

/**
 * Al reanudar la espera de las comprobaciones con una foto: un push nuevo reinicia el tiempo y se
 * sigue con la foto que lo trae. Si han pasado todas, la espera de la revisión empieza a contar;
 * si alguna falla, no se espera la revisión.
 */
export function afterChecksWait(
  current: TrackedPush,
  snapshot: PullRequestSnapshot,
  timeoutMs: number,
): { push: TrackedPush; next: ChecksStep } {
  const push = pushOf(current, snapshot);
  if (checksFinished(snapshot)) {
    if (!checksPassed(snapshot)) return { push, next: 'checksFailed' };
    return { push: { ...push, reviewSince: snapshot.observedAt }, next: 'checksFinished' };
  }
  if (timedOut(push.seenAt, snapshot, timeoutMs)) return { push, next: 'timedOut' };
  return { push, next: 'waiting' };
}

/**
 * Al reanudar la espera del revisor con una foto: un push nuevo vuelve a la espera de las
 * comprobaciones, porque las de antes eran de otro push. Se termina con la revisión y las
 * comprobaciones de esta foto acabadas: una comprobación relanzada, o una que el *ruleset* acaba de
 * exigir, se espera como las demás. El tiempo cuenta desde que pasaron las comprobaciones; si no
 * pasaron, desde el push.
 */
export function afterReviewWait(
  current: TrackedPush,
  snapshot: PullRequestSnapshot,
  timeoutMs: number,
): { push: TrackedPush; next: ReviewStep } {
  const push = pushOf(current, snapshot);
  if (push !== current) return { push, next: 'newPush' };
  if (reviewFinished(snapshot) && checksFinished(snapshot)) return { push, next: 'finished' };
  if (timedOut(push.reviewSince ?? push.seenAt, snapshot, timeoutMs)) {
    return { push, next: 'timedOut' };
  }
  return { push, next: 'waiting' };
}
