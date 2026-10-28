/**
 * Adaptador del revisor (change pr-tracking, decisión 7): saca el estado de la revisión de Codex de
 * su bloque `codex-review-state` en los comentarios de la PR, y se la pide (change
 * pr-review-request, decisiones 1-3). El núcleo solo ve el estado de
 * dominio (`Review`), así que otro revisor (BA3) sería otro adaptador.
 *
 * Solo cuentan los comentarios de la cuenta del revisor: los de otras cuentas no llegan al núcleo
 * (BE6). Un usuario de GitHub no puede tener `[bot]` en su login, así que no se puede suplantar.
 * Codex suele dejar un único comentario con el bloque, que va editando, pero también otros sin él
 * (#67, #69): cuenta el último que lo lleva. Sin bloque, o con uno que no se entiende, no hay
 * revisión, y el núcleo la da por no terminada: el sistema no se rompe ni se inventa un estado.
 */
import * as z from 'zod';

import type { ReviewReader, ReviewRequests } from '../core/ports.ts';
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

export interface CodexReviewRequestsOptions {
  /** La cuenta de GitHub del mantenedor, dueña del token: la única cuyas peticiones cuentan. */
  maintainer: string;
  listComments: (pullRequestNumber: number) => Promise<PullRequestComment[]>;
  createComment: (pullRequestNumber: number, body: string) => Promise<void>;
}

const REQUEST_MARK = /<!-- pr-babysitter:review-request (.*?) -->/gs;

const requestMarkSchema = z.object({ sha: z.string().min(1) });

/**
 * La petición es un comentario `@codex review`, lo único que Codex atiende, escrito con el token
 * del mantenedor: una GitHub App no vale (BA7). Lleva una firma visible, porque en GitHub sale a su
 * nombre (BE4), y una marca oculta con el SHA del push, comprobadas en la #87 (decisión 1).
 *
 * Solo cuentan las marcas de los comentarios del mantenedor: el repo es público, y una copiada por
 * otra cuenta haría que el sistema no la pidiera nunca (BE6). Un `@codex review` sin marca no dice
 * de qué push es, y no cuenta (decisión 3).
 */
export function createCodexReviewRequests({
  maintainer,
  listComments,
  createComment,
}: CodexReviewRequestsOptions): ReviewRequests {
  return {
    async requested(pullRequestNumber, sha) {
      return (await listComments(pullRequestNumber))
        .filter((comment) => comment.author === maintainer)
        .flatMap((comment) => [...comment.body.matchAll(REQUEST_MARK)])
        .some((mark) => parseRequestMark(mark[1] ?? '') === sha);
    },

    async request(pullRequestNumber, sha) {
      await createComment(pullRequestNumber, requestBody(sha));
    },
  };
}

function requestBody(sha: string): string {
  const mark = JSON.stringify({ sha } satisfies z.infer<typeof requestMarkSchema>);
  return [
    '@codex review',
    '',
    `Lo pide el PR Babysitter: las comprobaciones de \`${sha.slice(0, 7)}\` han pasado.`,
    `<!-- pr-babysitter:review-request ${mark} -->`,
  ].join('\n');
}

/** El SHA de una marca, o `null` si no se entiende. */
function parseRequestMark(text: string): string | null {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = requestMarkSchema.safeParse(json);
  return parsed.success ? parsed.data.sha : null;
}

/** La primera línea de un hallazgo de Codex: la insignia y el título, en negrita. */
const FINDING_HEADING = /^\*\*<sub><sub>!\[(P\d) Badge\]\([^)]*\)<\/sub><\/sub>\s*(.*?)\*\*$/;

/**
 * Un hallazgo de Codex, de un comentario de revisión en línea (change pr-shadow-triage, decisión 2):
 * la primera línea lleva en negrita la insignia de severidad y el título; el resto es la
 * explicación, con una coletilla para reaccionar y una marca oculta, que no son del hallazgo. P0 y
 * P1 son severidad alta. Sin insignia, la primera línea es el título y la severidad es normal.
 */
export function parseCodexFinding(body: string): {
  badge: string | null;
  severity: 'high' | 'normal';
  title: string;
  text: string;
} {
  const [first = '', ...rest] = body.split('\n');
  const heading = FINDING_HEADING.exec(first.trim());
  const badge = heading?.[1] ?? null;
  const title = heading?.[2] ?? first.replaceAll('**', '');
  const text = rest
    .join('\n')
    .replaceAll(/<!--.*?-->/gs, '')
    .replace(/^Useful\? React with .*$/m, '');
  return {
    badge,
    severity: badge === 'P0' || badge === 'P1' ? 'high' : 'normal',
    title: title.trim(),
    text: text.trim(),
  };
}
