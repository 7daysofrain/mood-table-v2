/**
 * Adaptador del revisor (change pr-tracking, decisión 7): saca el estado de la revisión de Codex de
 * su bloque `codex-review-state` en los comentarios de la PR. El núcleo solo ve el estado de
 * dominio (`Review`), así que otro revisor (BA3) sería otro adaptador.
 *
 * Solo cuentan los comentarios de la cuenta del revisor: los de otras cuentas no llegan al núcleo
 * (BE6). Un usuario de GitHub no puede tener `[bot]` en su login, así que no se puede suplantar.
 * Codex suele dejar un único comentario con el bloque, que va editando, pero también otros sin él
 * (#67, #69): cuenta el último que lo lleva. Sin bloque, o con uno que no se entiende, no hay
 * revisión, y el núcleo la da por no terminada: el sistema no se rompe ni se inventa un estado.
 */
import * as z from 'zod';

import type { ReviewReader } from '../core/ports.ts';
import type { Review } from '../core/pull-request.ts';
import type { PullRequestComment } from './github.ts';

export interface CodexReviewReaderOptions {
  /** La cuenta de GitHub del revisor. */
  reviewer: string;
  listComments: (pullRequestNumber: number) => Promise<PullRequestComment[]>;
}

const BLOCK = /<!-- codex-review-state:v1 (.*?) -->/s;

/**
 * Lo que se lee del bloque. `has_any_findings` y no `has_unresolved_findings`, que no sigue a los
 * hilos: en la #62 seguía en `true` con los hilos ya resueltos.
 */
const blockSchema = z.object({
  code_review: z.object({
    commit_sha: z.string().min(1),
    status: z.string(),
    has_any_findings: z.boolean().nullable(),
  }),
});

export function createCodexReviewReader({
  reviewer,
  listComments,
}: CodexReviewReaderOptions): ReviewReader {
  return {
    async review(pullRequestNumber) {
      const blocks = (await listComments(pullRequestNumber))
        .filter((comment) => comment.author === reviewer)
        .flatMap((comment) => BLOCK.exec(comment.body)?.[1] ?? []);
      const last = blocks.at(-1);
      return last === undefined ? null : parseBlock(last);
    },
  };
}

function parseBlock(text: string): Review | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = blockSchema.safeParse(json);
  if (!parsed.success) return null;
  const { commit_sha, status, has_any_findings } = parsed.data.code_review;
  const completed = status === 'completed';
  // Terminada sin decir si hay hallazgos: no se sabe qué ha pasado.
  if (completed && has_any_findings === null) return null;
  return { reviewedSha: commit_sha, completed, hasFindings: has_any_findings === true };
}
