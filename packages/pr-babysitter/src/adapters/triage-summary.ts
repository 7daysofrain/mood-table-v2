/**
 * Adaptador del resumen del triaje (change pr-shadow-triage, decisión 7): lo publica como un
 * comentario de la PR con el token del mantenedor, como la petición de revisión (D83), y sabe si
 * ya está el de un push por su marca.
 *
 * Solo cuentan las marcas de los comentarios del mantenedor: el repo es público, y una copiada por
 * otra cuenta haría que el sistema no publicara nunca el resumen de ese push (BE6).
 */
import type { TriageSummaries } from '../core/ports.ts';
import { summaryMarks } from '../core/triage-summary.ts';
import type { PullRequestComment } from './github.ts';

export interface TriageSummariesOptions {
  /** La cuenta de GitHub del mantenedor, dueña del token: la única cuyos resúmenes cuentan. */
  maintainer: string;
  listComments: (pullRequestNumber: number) => Promise<PullRequestComment[]>;
  createComment: (pullRequestNumber: number, body: string) => Promise<void>;
}

export function createTriageSummaries({
  maintainer,
  listComments,
  createComment,
}: TriageSummariesOptions): TriageSummaries {
  return {
    async published(pullRequestNumber, sha) {
      return (await listComments(pullRequestNumber))
        .filter((comment) => comment.author === maintainer)
        .some((comment) => summaryMarks(comment.body).includes(sha));
    },

    async publish(pullRequestNumber, _sha, text) {
      await createComment(pullRequestNumber, text);
    },
  };
}
