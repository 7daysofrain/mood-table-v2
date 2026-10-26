/**
 * Las reglas del seguimiento de una PR (change pr-tracking, decisiones 6, 7 y 8): funciones puras
 * sobre la foto, sin LangGraph ni reloj. El grafo traduce cada paso a su nodo.
 *
 * El tiempo de espera es uno solo, para comprobaciones y revisión juntas, y cuenta desde que el
 * sistema **ve** el push (la primera foto con ese SHA), no desde la fecha del commit. Un push nuevo
 * lo reinicia.
 */
import type { PullRequestSnapshot } from './pull-request.ts';

/** El push que se sigue: su SHA y cuándo lo vio el sistema por primera vez (ms desde epoch). */
export interface TrackedPush {
  sha: string;
  seenAt: number;
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

/** Qué toca al reanudar la espera de las comprobaciones. */
export type ChecksStep = 'waiting' | 'checksFinished' | 'timedOut';

/** Qué toca al reanudar la espera del revisor. */
export type ReviewStep = 'waiting' | 'finished' | 'timedOut' | 'newPush';

/** Han terminado cuando ninguna exigida está pendiente, pasen o fallen. */
export function checksFinished(snapshot: PullRequestSnapshot): boolean {
  return snapshot.checks.every((check) => check.status !== 'pending');
}

/** Ha terminado si está completada y lo que revisó es el último push (`workflow.md` §4.4). */
export function reviewFinished({ review, headSha }: PullRequestSnapshot): boolean {
  return review !== null && review.completed && review.reviewedSha === headSha;
}

/**
 * El estado final con la última foto. Al terminar todo, los motivos son las comprobaciones que
 * fallan y los hallazgos del revisor; con el tiempo agotado, también lo que no ha terminado.
 */
export function finalState(snapshot: PullRequestSnapshot): FinalState {
  const named = (status: string) =>
    snapshot.checks.filter((check) => check.status === status).map((check) => check.name);
  const failed = named('failed');
  const unfinished = named('pending');
  const reasons: InterventionReason[] = [];
  if (failed.length > 0) reasons.push({ kind: 'checksFailed', checks: failed });
  if (unfinished.length > 0) reasons.push({ kind: 'checksUnfinished', checks: unfinished });
  if (!reviewFinished(snapshot)) reasons.push({ kind: 'reviewUnfinished' });
  else if (snapshot.review?.hasFindings) reasons.push({ kind: 'reviewFindings' });
  if (reasons.length === 0) return { status: 'readyToMerge' };
  return { status: 'needsIntervention', reasons };
}

/** El push de la foto: el que se seguía o, si el SHA ha cambiado, uno nuevo desde esta foto. */
export function pushOf(current: TrackedPush, snapshot: PullRequestSnapshot): TrackedPush {
  return current.sha === snapshot.headSha
    ? current
    : { sha: snapshot.headSha, seenAt: snapshot.observedAt };
}

function timedOut(push: TrackedPush, snapshot: PullRequestSnapshot, timeoutMs: number): boolean {
  return snapshot.observedAt - push.seenAt >= timeoutMs;
}

/**
 * Al reanudar la espera de las comprobaciones con una foto: un push nuevo reinicia el tiempo y se
 * sigue con la foto que lo trae.
 */
export function afterChecksWait(
  current: TrackedPush,
  snapshot: PullRequestSnapshot,
  timeoutMs: number,
): { push: TrackedPush; next: ChecksStep } {
  const push = pushOf(current, snapshot);
  if (checksFinished(snapshot)) return { push, next: 'checksFinished' };
  if (timedOut(push, snapshot, timeoutMs)) return { push, next: 'timedOut' };
  return { push, next: 'waiting' };
}

/**
 * Al reanudar la espera del revisor con una foto: un push nuevo vuelve a la espera de las
 * comprobaciones, porque las de antes eran de otro push. Se termina con la revisión y las
 * comprobaciones de esta foto acabadas: una comprobación relanzada, o una que el *ruleset* acaba de
 * exigir, se espera como las demás.
 */
export function afterReviewWait(
  current: TrackedPush,
  snapshot: PullRequestSnapshot,
  timeoutMs: number,
): { push: TrackedPush; next: ReviewStep } {
  const push = pushOf(current, snapshot);
  if (push !== current) return { push, next: 'newPush' };
  if (reviewFinished(snapshot) && checksFinished(snapshot)) return { push, next: 'finished' };
  if (timedOut(push, snapshot, timeoutMs)) return { push, next: 'timedOut' };
  return { push, next: 'waiting' };
}
