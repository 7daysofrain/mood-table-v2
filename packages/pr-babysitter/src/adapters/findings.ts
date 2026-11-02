/**
 * Adaptador de los hallazgos de un push (change pr-shadow-triage, decisión 2): los construye con
 * las lecturas de GitHub, solo para las PR que el sistema tría.
 *
 * - **Del revisor:** sus comentarios de revisión en línea hechos sobre ese push, sin las respuestas
 *   de los hilos. Qué dice cada uno (insignia, severidad, título) lo entiende el adaptador del
 *   revisor (BA3). Un comentario de otra cuenta nunca es un hallazgo (BE6).
 * - **De las comprobaciones que fallan:** el paso que falla de su log. GitHub da el log del *job*
 *   entero, que acaba con su limpieza (paso 1.1): el paso va desde el último `##[group]Run` antes
 *   del primer `##[error]` hasta ese error, sin marcas de tiempo ni colores, y se corta por el
 *   principio hasta 16 KiB *(asumido)*. Sin error marcado, se manda el final del log.
 */
import type { Findings } from '../core/ports.ts';
import type { Finding } from '../core/triage.ts';
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
  github: {
    getPullRequest(pullRequestNumber: number): Promise<{ title: string; body: string }>;
    listReviewComments(pullRequestNumber: number): Promise<ReviewComment[]>;
    jobLog(sha: string, checkName: string): Promise<string | null>;
  };
}

/** El tamaño máximo del log de una comprobación que llega al modelo *(asumido)*. */
const MAX_LOG_BYTES = 16 * 1024;

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
        failedChecks.map(async (name): Promise<Finding> => {
          const log = await github.jobLog(sha, name);
          return { source: 'check', name, log: log === null ? null : failingStep(log) };
        }),
      );
      return {
        context: { title: pull.title, description: pull.body },
        findings: [...fromReviewer, ...fromChecks],
      };
    },
  };
}

const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
// eslint-disable-next-line no-control-regex -- los colores del log son secuencias de escape ANSI.
const ANSI_COLOR = /\u001b\[[\d;]*m/g;

/** El paso que falla de un log de GitHub Actions, limpio y cortado. */
function failingStep(log: string): string {
  const lines = log
    .split(/\r?\n/)
    .map((line) => line.replace(TIMESTAMP, '').replaceAll(ANSI_COLOR, ''));
  const error = lines.findIndex((line) => line.startsWith('##[error]'));
  if (error === -1) return tail(lines.join('\n').trim(), MAX_LOG_BYTES);
  const start = lines.slice(0, error).findLastIndex((line) => line.startsWith('##[group]Run '));
  const step = lines.slice(Math.max(0, start), error + 1);
  return tail(step.join('\n').trim(), MAX_LOG_BYTES);
}

/** El final de un texto que cabe en `maxBytes`, desde el principio de una línea. */
function tail(text: string, maxBytes: number): string {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= maxBytes) return text;
  const cut = new TextDecoder().decode(bytes.slice(-maxBytes));
  // La primera línea puede ir cortada, incluso a mitad de un carácter.
  return cut.slice(cut.indexOf('\n') + 1);
}
