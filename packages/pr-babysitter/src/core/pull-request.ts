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
});

export type OpenPullRequest = z.infer<typeof openPullRequestSchema>;

/**
 * Una comprobación que exige la rama base, en el último push (decisión 6): no ha terminado
 * (`pending`, también si aún no ha empezado), pasa (correcta, neutra o saltada) o falla.
 */
export const checkSchema = z.object({
  name: z.string(),
  status: z.enum(['pending', 'passed', 'failed']),
});

export type Check = z.infer<typeof checkSchema>;

/**
 * La última revisión del revisor (decisión 7): el commit que revisó, si ha terminado y si ha tenido
 * hallazgos. `null` en la foto si no hay revisión o no se entiende.
 */
export const reviewSchema = z.object({
  reviewedSha: z.string().min(1),
  completed: z.boolean(),
  hasFindings: z.boolean(),
});

export type Review = z.infer<typeof reviewSchema>;

/**
 * Lo que recibe un hilo al reanudarse: la PR, sus comprobaciones, la revisión y cuándo la vio el
 * driver (ms desde epoch).
 */
export const pullRequestSnapshotSchema = openPullRequestSchema.extend({
  checks: z.array(checkSchema),
  review: reviewSchema.nullable(),
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
