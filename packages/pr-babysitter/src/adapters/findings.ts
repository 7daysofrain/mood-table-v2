/**
 * Adaptador de los hallazgos de un push (change pr-shadow-triage, decisión 2): los construye con
 * las lecturas de GitHub, solo para las PR que el sistema tría.
 *
 * - **Del revisor:** sus comentarios de revisión en línea hechos sobre ese push, sin las respuestas
 *   de los hilos. Qué dice cada uno (insignia, severidad, título) lo entiende el adaptador del
 *   revisor (BA3). Un comentario de otra cuenta nunca es un hallazgo (BE6).
 * - **De las comprobaciones que fallan:** cómo acabó cada una y su contexto, que depende de la app
 *   que la ejecuta (`check-context.ts`; change pr-check-triage, decisiones 1 y 2).
 * - **De la comprobación que lista las incidencias nuevas de SonarQube:** cada incidencia que
 *   anota, con el código de alrededor de su línea (`sonar-issues.ts`; change pr-sonar-issue-triage,
 *   decisión 5). La comprobación solo es un hallazgo si no anota ninguna legible.
 */
import type { Findings } from '../core/ports.ts';
import type { Finding, SonarIssueCount } from '../core/triage.ts';
import { type CheckContextGitHub, readCheckContext } from './check-context.ts';
import type { ReviewComment } from './github.ts';
import { readSonarIssues, type SonarIssuesGitHub } from './sonar-issues.ts';

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
  /** El nombre de la comprobación que lista las incidencias nuevas de SonarQube. */
  sonarIssuesCheck: string;
  github: CheckContextGitHub &
    SonarIssuesGitHub & {
      getPullRequest(pullRequestNumber: number): Promise<{ title: string; body: string }>;
      listReviewComments(pullRequestNumber: number): Promise<ReviewComment[]>;
    };
}

export function createFindings({ reviewer, sonarIssuesCheck, github }: FindingsOptions): Findings {
  /**
   * Los hallazgos de una comprobación que falla: ella misma, o cada incidencia que anota si es la de
   * las incidencias de SonarQube, con cuántas trae y cuántas se trían.
   */
  async function fromCheck(
    name: string,
    sha: string,
  ): Promise<{ findings: Finding[]; count: SonarIssueCount }> {
    if (name === sonarIssuesCheck) {
      // Las anotaciones enteras, sin el corte del contexto (`sonar-issues.ts`). Si no anota ninguna
      // incidencia legible, el contexto de la comprobación las vuelve a pedir: es el caso raro.
      const run = await github.checkRun(sha, name);
      const annotations = run?.app === 'github-actions' ? await github.annotations(run.id) : null;
      const read = annotations ? await readSonarIssues(github, sha, annotations) : null;
      if (read) {
        return {
          findings: read.issues.map((issue) => ({ source: 'sonarIssue', ...issue })),
          count: { total: read.total, triaged: read.issues.length },
        };
      }
    }
    const check = await readCheckContext(github, sha, name);
    return { findings: [{ source: 'check', name, ...check }], count: null };
  }

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
      const fromChecks = await Promise.all(failedChecks.map((name) => fromCheck(name, sha)));
      return {
        context: { title: pull.title, description: pull.body },
        findings: [...fromReviewer, ...fromChecks.flatMap(({ findings }) => findings)],
        sonarIssues: fromChecks.find(({ count }) => count !== null)?.count ?? null,
      };
    },
  };
}
