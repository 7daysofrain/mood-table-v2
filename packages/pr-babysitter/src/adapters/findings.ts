/**
 * Adaptador de los hallazgos de un push (change pr-shadow-triage, decisión 2): los construye con
 * las lecturas de GitHub, solo para las PR que el sistema tría.
 *
 * - **Del revisor:** sus comentarios de revisión en línea hechos sobre ese push, sin las respuestas
 *   de los hilos. Qué dice cada uno (insignia, severidad, título) lo entiende el adaptador del
 *   revisor (BA3). Un comentario de otra cuenta nunca es un hallazgo (BE6).
 * - **De las comprobaciones que fallan:** cómo acabó cada una y su contexto, que depende de la app
 *   que la ejecuta (`check-context.ts`; change pr-check-triage, decisiones 1 y 2).
 */
import type { Findings } from '../core/ports.ts';
import type { Finding } from '../core/triage.ts';
import { type CheckContextGitHub, readCheckContext } from './check-context.ts';
import type { ReviewComment } from './github.ts';

/** El revisor: su cuenta, su nombre y cómo se lee uno de sus comentarios. */
export interface FindingsReviewer {
  login: string;
  name: string;
  parse(body: string): {
    badge: string | null;
    severity: 'high' | 'normal';
    title: string;
    text: string;
  };
}

export interface FindingsOptions {
  reviewer: FindingsReviewer;
  github: CheckContextGitHub & {
    getPullRequest(pullRequestNumber: number): Promise<{ title: string; body: string }>;
    listReviewComments(pullRequestNumber: number): Promise<ReviewComment[]>;
  };
}

export function createFindings({ reviewer, github }: FindingsOptions): Findings {
  return {
    async read(pullRequestNumber, sha, failedChecks) {
      const [pull, comments] = await Promise.all([
        github.getPullRequest(pullRequestNumber),
        github.listReviewComments(pullRequestNumber),
      ]);
      const fromReviewer = comments
        .filter(
          (comment) =>
            comment.author === reviewer.login &&
            comment.originalSha === sha &&
            comment.inReplyTo === null,
        )
        .map(
          (comment): Finding => ({
            source: 'reviewer',
            reviewer: reviewer.name,
            ...reviewer.parse(comment.body),
            file: comment.path,
            line: comment.originalLine,
            diffHunk: comment.diffHunk,
          }),
        );
      const fromChecks = await Promise.all(
        failedChecks.map(
          async (name): Promise<Finding> => ({
            source: 'check',
            name,
            ...(await readCheckContext(github, sha, name)),
          }),
        ),
      );
      return {
        context: { title: pull.title, description: pull.body },
        findings: [...fromReviewer, ...fromChecks],
      };
    },
  };
}
