/**
 * Las reglas del seguimiento de una PR (change pr-tracking, decisiones 6, 7 y 8): funciones puras
 * sobre la foto, sin LangGraph ni reloj. El grafo traduce cada paso a su nodo.
 *
 * Hay dos tiempos de espera, del mismo largo (change pr-review-request, decisión 5): el de las
 * comprobaciones cuenta desde que el sistema **ve** el push (la primera foto con ese SHA), no desde
 * la fecha del commit; el de la revisión, desde que las ve pasar, que es cuando la pide. Un push
 * nuevo los reinicia.
 */
import type { Check, PullRequestSnapshot } from './pull-request.ts';
import type { FirstTriage } from './triage.ts';

/**
 * El push que se sigue: su SHA, cuándo lo vio el sistema por primera vez y, si sus comprobaciones
 * han pasado, cuándo lo vio (ms desde epoch). Desde `reviewSince` cuenta la espera de la revisión.
 *
 * Si el sistema ha relanzado sus comprobaciones (change pr-check-rerun, decisiones 3 y 4),
 * `rerunSince` es cuándo lo pidió, y desde ahí cuenta la espera de las comprobaciones, y
 * `rerunNames` cuáles fallaban en el run que relanzó (decisión 8); si GitHub lo rechazó,
 * `rerunRejected` dice cuáles no ha podido relanzar. Un push nuevo no lleva ninguno.
 *
 * `quietSince` es la hora de la primera foto en la que una comprobación ha fallado, no queda nada que
 * relanzar y ninguna está en cola ni en curso; desde ahí cuenta el margen de las que no van a
 * ejecutarse (change pr-checks-not-run, decisión 2). Se borra si algo vuelve a ponerse en marcha, y
 * un push nuevo no lo lleva.
 *
 * `firstTriage` es lo que respondió el triaje del primer fallo de cada relanzable (change
 * pr-first-failure-triage, decisión 4). Como lo demás, un push nuevo empieza sin él.
 */
export interface TrackedPush {
  sha: string;
  seenAt: number;
  reviewSince?: number;
  rerunSince?: number;
  rerunNames?: string[];
  rerunRejected?: string[];
  quietSince?: number;
  firstTriage?: FirstTriage;
}

/**
 * De qué push son los hilos sin resolver del revisor: del último, de pushes anteriores o de los dos
 * (change pr-unresolved-threads, decisión 2).
 */
export type FindingPushes = 'last' | 'earlier' | 'both';

/** Por qué una PR necesita intervención. */
export type InterventionReason =
  | { kind: 'checksFailed'; checks: string[] }
  | { kind: 'checksUnfinished'; checks: string[] }
  | { kind: 'checksNotRun'; checks: string[] }
  | { kind: 'reviewFindings'; pushes: FindingPushes }
  | { kind: 'reviewUnfinished' }
  | { kind: 'rerunRejected'; checks: string[] };

/** El estado final de una PR (`specs/pr-tracking`; glosario de PB, *lista para integrar*). */
export type FinalState =
  | { status: 'readyToMerge' }
  | { status: 'needsIntervention'; reasons: InterventionReason[] };

/**
 * Qué toca al reanudar la espera de las comprobaciones: si pasan todas, avisar y esperar al
 * revisor; si alguna falla, el estado final sin esperarlo (change pr-review-request, decisión 4),
 * salvo si es el primer fallo de una relanzable, que se tría antes de decidir si se relanza (change
 * pr-first-failure-triage, decisión 1; antes, `rerun`: change pr-check-rerun, decisión 4).
 */
export type ChecksStep = 'waiting' | 'checksFinished' | 'checksFailed' | 'timedOut' | 'firstFailure';

/** Qué toca al reanudar la espera del revisor. */
export type ReviewStep = 'waiting' | 'finished' | 'timedOut' | 'newPush';

/**
 * Han terminado cuando ninguna exigida está pendiente ni sin empezar, pasen o fallen. Cuándo deja de
 * esperarse a una sin empezar lo decide `afterChecksWait` (change pr-checks-not-run, decisión 2).
 */
export function checksFinished(snapshot: PullRequestSnapshot): boolean {
  return snapshot.checks.every(
    (check) => check.status === 'passed' || check.status === 'failed',
  );
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
 * comprobaciones pasaron (`reviewSince`; change pr-review-request, decisión 4).
 *
 * Con una comprobación que falla y ninguna en cola ni en curso, las que no tienen *check run* no han
 * llegado a ejecutarse (`checksNotRun`), en vez de no haber terminado (change pr-checks-not-run,
 * decisión 4): así se llega aquí tras el margen, o al vencer el plazo en ese mismo caso.
 *
 * Los hallazgos del revisor son sus hilos sin resolver, de cualquier push, haya terminado o no la
 * revisión del último (change pr-unresolved-threads, decisión 2): con las comprobaciones en verde
 * solo se llega aquí con esa revisión terminada, y si falla una, los de un push anterior ya cuentan.
 */
export function finalState(snapshot: PullRequestSnapshot, push: TrackedPush): FinalState {
  const named = (status: string) =>
    snapshot.checks.filter((check) => check.status === status).map((check) => check.name);
  const failed = named('failed');
  const pending = named('pending');
  const notRun = failed.length > 0 && pending.length === 0 ? named('notStarted') : [];
  const unfinished = notRun.length > 0 ? pending : [...pending, ...named('notStarted')];
  const reasons: InterventionReason[] = [];
  if (failed.length > 0) reasons.push({ kind: 'checksFailed', checks: failed });
  if (push.rerunRejected) reasons.push({ kind: 'rerunRejected', checks: push.rerunRejected });
  if (notRun.length > 0) reasons.push({ kind: 'checksNotRun', checks: notRun });
  if (unfinished.length > 0) reasons.push({ kind: 'checksUnfinished', checks: unfinished });
  const pushes = findingPushes(snapshot);
  if (pushes !== null) reasons.push({ kind: 'reviewFindings', pushes });
  if (!reviewFinished(snapshot) && push.reviewSince !== undefined) {
    reasons.push({ kind: 'reviewUnfinished' });
  }
  if (reasons.length === 0) return { status: 'readyToMerge' };
  return { status: 'needsIntervention', reasons };
}

/** De qué push son los hilos sin resolver del revisor, o `null` si no le queda ninguno. */
function findingPushes({ reviewerThreads }: PullRequestSnapshot): FindingPushes | null {
  const { lastPush, earlierPushes } = reviewerThreads;
  if (lastPush > 0 && earlierPushes > 0) return 'both';
  if (lastPush > 0) return 'last';
  if (earlierPushes > 0) return 'earlier';
  return null;
}

/**
 * Si hay que triar antes de avisar del estado final (change pr-shadow-triage, decisión 1): necesita
 * intervención porque falla una comprobación o el revisor tiene hallazgos. Lo que no termina a
 * tiempo no deja hallazgos que triar, salvo una relanzable relanzada que no ha terminado
 * (`unfinishedReruns`; change pr-check-rerun, decisión 1), que exige criterio.
 */
export function needsTriage(state: FinalState, unfinishedReruns: string[]): boolean {
  return (
    state.status === 'needsIntervention' &&
    (unfinishedReruns.length > 0 ||
      state.reasons.some(({ kind }) => kind === 'checksFailed' || kind === 'reviewFindings'))
  );
}

/**
 * Las relanzables (`rerunChecks`) que el sistema relanzó en el push y aún no han terminado con esta
 * foto (change pr-check-rerun, decisión 1). Una no relanzable que se relanzó con ellas porque fallaba
 * en su run (decisión 2) y no ha terminado no sale: queda como cualquier pendiente.
 */
export function unfinishedReruns(
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
  rerunChecks: string[],
): string[] {
  if (push.rerunSince === undefined) return [];
  return rerunNamed(snapshot, push, 'pending').filter((name) => rerunChecks.includes(name));
}

/**
 * Las comprobaciones que el sistema relanzó en el push y han pasado con esta foto (change
 * pr-check-rerun, decisión 8). Lo dice el push, que apunta qué fallaba en el run que relanzó: el
 * intento de una que pasa no se lee de GitHub. Una relanzada a mano que pasa no sale.
 */
export function rerunPassed(snapshot: PullRequestSnapshot, push: TrackedPush): string[] {
  return rerunNamed(snapshot, push, 'passed');
}

function rerunNamed(
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
  status: Check['status'],
): string[] {
  const names = push.rerunNames ?? [];
  return snapshot.checks
    .filter((check) => names.includes(check.name) && check.status === status)
    .map((check) => check.name);
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

/** Las conclusiones de un fallo que puede ser transitorio; una cancelada no lo dice (decisión 3). */
const RERUNNABLE_CONCLUSIONS = new Set(['failure', 'timed_out']);

/**
 * Las comprobaciones que se relanzarían con esta foto (change pr-check-rerun, decisión 3): las
 * relanzables (`rerunChecks`, por su nombre) que han fallado en su primer intento, con su run. Sin
 * intento (no es de GitHub Actions o no se ha leído su *job*), no se sabe si ya se relanzó, y no se
 * relanza.
 */
export function checksToRerun(
  snapshot: PullRequestSnapshot,
  rerunChecks: string[],
): (Check & { runId: number })[] {
  return snapshot.checks.filter(
    (check): check is Check & { runId: number } =>
      rerunChecks.includes(check.name) &&
      check.status === 'failed' &&
      RERUNNABLE_CONCLUSIONS.has(check.conclusion ?? '') &&
      check.attempt === 1 &&
      check.runId !== undefined,
  );
}

/**
 * Las relanzables cuyo primer fallo toca triar con esta foto (change pr-first-failure-triage,
 * decisiones 2 y 4): las que se relanzarían, con su run terminado, menos las que el primer triaje
 * del push ya ha respondido, que no se vuelven a preguntar.
 */
export function firstFailureChecks(
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
  rerunChecks: string[],
): string[] {
  const triaged = new Set((push.firstTriage ?? []).map(({ name }) => name));
  return checksToRerun(snapshot, rerunChecks)
    .filter((check) => check.runFinished && !triaged.has(check.name))
    .map(({ name }) => name);
}

/**
 * Al reanudar la espera de las comprobaciones con una foto: un push nuevo reinicia el tiempo y se
 * sigue con la foto que lo trae. Si han pasado todas, la espera de la revisión empieza a contar;
 * si alguna falla, no se espera la revisión.
 *
 * Si la que falla es relanzable y está en su primer intento, en cuanto termina su run, sin esperar a
 * las demás, y dentro de los 30 min del push, es su primer fallo (`firstFailure`): el hilo lo tría y
 * `decidir` elige si se relanza, una vez por push (change pr-first-failure-triage, decisión 1;
 * change pr-check-rerun, decisiones 3 a 5). Con el relanzamiento pedido, el tiempo cuenta desde él,
 * y se sigue esperando mientras la foto aún traiga el primer intento: GitHub tarda en crear el
 * segundo.
 *
 * Si una ha fallado, no queda nada que relanzar y ninguna está en cola ni en curso, pero alguna no
 * tiene *check run*, la foto está quieta: se apunta desde cuándo (`quietSince`) y, pasado el margen
 * (`notRunMarginMs`), se da el estado final sin esperar al plazo, porque las que faltan no van a
 * ejecutarse (change pr-checks-not-run, decisión 2). Si algo vuelve a ponerse en marcha, el margen
 * se borra y empieza de nuevo la próxima vez que esté quieta.
 */
export function afterChecksWait(
  current: TrackedPush,
  snapshot: PullRequestSnapshot,
  timeoutMs: number,
  rerunChecks: string[],
  notRunMarginMs: number,
): { push: TrackedPush; next: ChecksStep } {
  const push = pushOf(current, snapshot);
  const since = push.rerunSince ?? push.seenAt;
  // Una relanzable que falla se relanza en cuanto termina su run, sin esperar a las demás: alguna
  // puede depender de ella y no llegar nunca (con `test` roja, SonarCloud no se analiza). Dentro
  // del plazo del push: si la petición sigue fallando (la red, un 5xx), la PR acaba avisando.
  const toRerun = push.rerunRejected ? [] : checksToRerun(snapshot, rerunChecks);
  if (
    push.rerunSince === undefined &&
    toRerun.some((check) => check.runFinished) &&
    !timedOut(since, snapshot, timeoutMs)
  ) {
    return { push, next: 'firstFailure' };
  }
  if (checksFinished(snapshot)) {
    if (checksPassed(snapshot)) {
      return { push: { ...push, reviewSince: snapshot.observedAt }, next: 'checksFinished' };
    }
    if (toRerun.length === 0) return { push, next: 'checksFailed' };
  }
  if (isQuiet(snapshot, toRerun)) {
    const quiet = { ...push, quietSince: push.quietSince ?? snapshot.observedAt };
    if (snapshot.observedAt - quiet.quietSince >= notRunMarginMs) {
      return { push: quiet, next: 'checksFailed' };
    }
    return { push: quiet, next: timedOut(since, snapshot, timeoutMs) ? 'timedOut' : 'waiting' };
  }
  const next = timedOut(since, snapshot, timeoutMs) ? 'timedOut' : 'waiting';
  return { push: withoutQuiet(push), next };
}

/** El push sin la marca de quieta: algo se ha vuelto a poner en marcha. */
function withoutQuiet(push: TrackedPush): TrackedPush {
  if (push.quietSince === undefined) return push;
  const moving = { ...push };
  delete moving.quietSince;
  return moving;
}

/**
 * Si la foto está quieta (change pr-checks-not-run, decisión 2): una ha fallado, no queda nada que
 * relanzar (`toRerun`) y ninguna está en cola ni en curso. Una cancelada cuenta como fallada.
 */
function isQuiet(snapshot: PullRequestSnapshot, toRerun: Check[]): boolean {
  return (
    toRerun.length === 0 &&
    snapshot.checks.some((check) => check.status === 'failed') &&
    snapshot.checks.every((check) => check.status !== 'pending')
  );
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
