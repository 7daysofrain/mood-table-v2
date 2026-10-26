/**
 * La foto de una PR (change pr-tracking, decisión 9): lo que el driver sabe de ella en una vuelta,
 * leído de GitHub. El grafo no consulta GitHub: recibe la foto al reanudar cada hilo, y con la hora
 * dentro de la foto el tiempo de espera se prueba sin relojes falsos.
 *
 * Se valida con zod, como el estado del grafo (D65, decisión 5). Las comprobaciones y el estado del
 * revisor llegan con MOO-84.
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

/** Lo que recibe un hilo al reanudarse: la PR y cuándo la vio el driver (ms desde epoch). */
export const pullRequestSnapshotSchema = openPullRequestSchema.extend({
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
