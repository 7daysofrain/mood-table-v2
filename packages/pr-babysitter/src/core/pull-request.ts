/**
 * La foto de una PR (change pr-tracking, decisión 9): lo que el driver sabe de ella en una vuelta,
 * leído de GitHub. El grafo no consulta GitHub: recibe la foto al reanudar cada hilo, y con la hora
 * dentro de la foto el tiempo de espera se prueba sin relojes falsos.
 *
 * Se valida con zod, como el estado del grafo (D65, decisión 5).
 */
import * as z from 'zod';

/** Una PR abierta, tal como la da el puerto de lectura de GitHub. */
export const openPullRequestSchema = z.object({
  number: z.number().int().positive(),
  title: z.string(),
  url: z.url(),
  /** Login de GitHub de quien la abrió. */
  author: z.string(),
  /** La rama contra la que se abre. */
  baseBranch: z.string(),
  draft: z.boolean(),
  /** El SHA del último push. */
  headSha: z.string().min(1),
  /** Los nombres de sus etiquetas. */
  labels: z.array(z.string()),
});

export type OpenPullRequest = z.infer<typeof openPullRequestSchema>;

/**
 * Una comprobación que exige la rama base, en el último push (decisión 6): no ha terminado
 * (`pending`, en cola o en curso), no ha empezado (`notStarted`, sin ningún *check run*; change
 * pr-checks-not-run, decisión 1), pasa (correcta, neutra o saltada) o falla.
 *
 * Lleva también cómo acabó en GitHub y, si es de GitHub Actions y falla, su intento, su run y si ese
 * run ha terminado (change pr-check-rerun, decisión 3): con eso decide el seguimiento si se relanza y
 * cuándo.
 */
export const checkSchema = z.object({
  name: z.string(),
  status: z.enum(['pending', 'notStarted', 'passed', 'failed']),
  /** Cómo acabó (`success`, `failure`, `timed_out`, `cancelled`…); `null` si no ha terminado. */
  conclusion: z.string().nullable(),
  /**
   * El intento del *job* (`run_attempt`): 1 la primera vez, 2 o más si se ha relanzado. Solo en una
   * de GitHub Actions que falla y cuyo *job* se ha podido leer.
   */
  attempt: z.number().int().positive().optional(),
  /** El run de GitHub Actions del *job*, el que se relanza. Cuando hay `attempt`. */
  runId: z.number().int().positive().optional(),
  /**
   * Si ese run ha terminado, todos sus *jobs*, exigidos o no: GitHub no relanza los fallidos de un
   * run en marcha. Cuando hay `attempt`; `false` si no se ha podido leer el run.
   */
  runFinished: z.boolean().optional(),
});

export type Check = z.infer<typeof checkSchema>;

/**
 * La última revisión del revisor (decisión 7): el commit que revisó y si ha terminado. `null` en la
 * foto si no hay revisión o no se entiende. Si tiene hallazgos no lo dice la revisión, sino sus
 * hilos sin resolver (change pr-unresolved-threads, decisión 2).
 */
export const reviewSchema = z.object({
  reviewedSha: z.string().min(1),
  completed: z.boolean(),
});

export type Review = z.infer<typeof reviewSchema>;

/**
 * Cuántos hilos sin resolver le quedan al revisor (change pr-unresolved-threads, decisión 2): los
 * de comentarios sobre el último push y los de pushes anteriores. Son sus hallazgos.
 */
export const reviewerThreadsSchema = z.object({
  lastPush: z.number().int().nonnegative(),
  earlierPushes: z.number().int().nonnegative(),
});

export type ReviewerThreads = z.infer<typeof reviewerThreadsSchema>;

/**
 * Lo que recibe un hilo al reanudarse: la PR, sus comprobaciones, la revisión, los hilos sin
 * resolver del revisor, si el sistema ya ha pedido la revisión del último push (change
 * pr-review-request, decisión 2) y cuándo la vio el driver (ms desde epoch).
 */
export const pullRequestSnapshotSchema = openPullRequestSchema.extend({
  checks: z.array(checkSchema),
  review: reviewSchema.nullable(),
  reviewerThreads: reviewerThreadsSchema,
  reviewRequested: z.boolean(),
  observedAt: z.number(),
});

export type PullRequestSnapshot = z.infer<typeof pullRequestSnapshotSchema>;

/** Qué PR se siguen: las del mantenedor contra una rama (`specs/pr-tracking`). */
export interface TrackingPolicy {
  /** Login de GitHub del mantenedor. */
  maintainer: string;
  baseBranch: string;
}

/** Si el sistema sigue la PR: del mantenedor, contra la rama base y lista para revisar. */
export function isTracked(pullRequest: OpenPullRequest, policy: TrackingPolicy): boolean {
  return (
    pullRequest.author === policy.maintainer &&
    pullRequest.baseBranch === policy.baseBranch &&
    !pullRequest.draft
  );
}

/**
 * La etiqueta que detiene el seguimiento de una PR (change pr-stop, decisión 1). La pone o la quita
 * una persona con permiso de escritura; el sistema solo la lee.
 */
export const STOP_LABEL = 'babysitter:stop';

/** Si alguien ha detenido el seguimiento de la PR: tiene la etiqueta `STOP_LABEL`. */
export function isStopped(pullRequest: OpenPullRequest): boolean {
  return pullRequest.labels.includes(STOP_LABEL);
}
