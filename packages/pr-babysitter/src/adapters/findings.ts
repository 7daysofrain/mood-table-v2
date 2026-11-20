/**
 * Adaptador de los hallazgos de un push (change pr-shadow-triage, decisión 2): los construye con
 * las lecturas de GitHub, solo para las PR que el sistema tría.
 *
 * - **Del revisor:** sus hilos de revisión sin resolver, de cualquier push, por el comentario que
 *   abre cada uno; las respuestas no se miran (change pr-unresolved-threads, decisión 1). Uno de un
 *   push anterior lleva su push y el código del último push alrededor de su línea (decisión 3). Qué
 *   dice cada uno (insignia, severidad, título) lo entiende el adaptador del revisor (BA3). Un hilo
 *   que abre otra cuenta nunca es un hallazgo (BE6).
 * - **De las comprobaciones que fallan:** cómo acabó cada una y su contexto, que depende de la app
 *   que la ejecuta (`check-context.ts`; change pr-check-triage, decisiones 1 y 2).
 * - **De la comprobación que lista las incidencias nuevas de SonarQube:** cada incidencia que
 *   anota, con el código de alrededor de su línea (`sonar-issues.ts`; change pr-sonar-issue-triage,
 *   decisión 5). La comprobación solo es un hallazgo si no anota ninguna legible.
 */
import type { Findings } from '../core/ports.ts';
import type { Finding, SonarIssueCount } from '../core/triage.ts';
import { type CheckContextGitHub, readCheckContext } from './check-context.ts';
import type { ReviewThread } from './github.ts';
import { around, readSonarIssues, type SonarIssuesGitHub } from './sonar-issues.ts';

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
      listReviewThreads(pullRequestNumber: number): Promise<ReviewThread[]>;
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

  /**
   * Un hallazgo de un hilo del revisor. Si es de un push anterior, con el código del último push
   * alrededor de la línea que GitHub le sigue en él o, si ya no la sabe, de la suya.
   */
  async function fromThread(
    { comment }: ReviewThread,
    sha: string,
    fileAt: (path: string) => Promise<string | null>,
  ): Promise<Finding> {
    const earlier = comment.originalSha !== sha;
    const text = earlier ? await fileAt(comment.path) : null;
    return {
      source: 'reviewer',
      reviewer: reviewer.name,
      ...reviewer.parse(comment.body),
      file: comment.path,
      line: comment.originalLine,
      diffHunk: comment.diffHunk,
      earlierPush: earlier
        ? {
            sha: comment.originalSha,
            code: text === null ? null : around(text, comment.line ?? comment.originalLine),
          }
        : null,
    };
  }

  return {
    async read(pullRequestNumber, sha, failedChecks) {
      const [pull, threads] = await Promise.all([
        github.getPullRequest(pullRequestNumber),
        github.listReviewThreads(pullRequestNumber),
      ]);
      // Cada fichero del último push se lee una vez, aunque lo comenten varios hilos.
      const files = new Map<string, Promise<string | null>>();
      const fileAt = (path: string) => {
        let text = files.get(path);
        if (text === undefined) {
          text = github.fileAt(sha, path);
          files.set(path, text);
        }
        return text;
      };
      const fromReviewer = await Promise.all(
        threads
          .filter(({ isResolved, comment }) => !isResolved && comment.author === reviewer.login)
          .map((thread) => fromThread(thread, sha, fileAt)),
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
