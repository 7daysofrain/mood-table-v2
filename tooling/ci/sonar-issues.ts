/**
 * Parte pura de la comprobación de incidencias nuevas de SonarQube (specs/quality-gates, design.md
 * decisión 3). Sin E/S: la E/S (variables de entorno, peticiones y espera) vive en
 * `check-sonar-issues.ts`, que queda fuera de la cobertura.
 */

/** Siguiente paso según el estado de la tarea de análisis de SonarQube (`api/ce/task`). */
export type CeTaskStep = { kind: 'wait' } | { kind: 'continue' } | { kind: 'fail'; message: string };

export interface SonarIssue {
  key: string;
  rule: string;
  /** `<projectKey>:<ruta del fichero>`. */
  component: string;
  /** Ausente en las incidencias de fichero. */
  line?: number;
  message: string;
}

/** Lo que se usa de la respuesta de `api/issues/search`. */
export interface IssuesSearchResponse {
  paging: { total: number };
  issues: SonarIssue[];
}

/** La PR analizada, para construir los enlaces a SonarQube. */
export interface PullRequestRef {
  serverUrl: string;
  projectKey: string;
  pullRequest: string;
}

export interface CheckResult {
  passed: boolean;
  /** Informe para el log y el resumen del job, una línea por elemento. */
  lines: string[];
}

/** Devuelve `ceTaskUrl` del `report-task.txt` que escribe el escáner. */
export function parseCeTaskUrl(reportTask: string): string {
  for (const line of reportTask.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0 && line.slice(0, separator).trim() === 'ceTaskUrl') {
      const url = line.slice(separator + 1).trim();
      if (url) return url;
    }
  }
  throw new Error('El informe del escáner no trae ceTaskUrl: no se sabe qué análisis esperar.');
}

export function nextStepForCeTask(status: string): CeTaskStep {
  switch (status) {
    case 'PENDING':
    case 'IN_PROGRESS':
      return { kind: 'wait' };
    case 'SUCCESS':
      return { kind: 'continue' };
    default:
      return {
        kind: 'fail',
        message: `El análisis de SonarQube no ha terminado bien (estado ${status}): no se pueden consultar las incidencias.`,
      };
  }
}

export function summarizeIssues(response: IssuesSearchResponse, pr: PullRequestRef): CheckResult {
  const total = response.paging.total;
  if (total === 0) {
    return { passed: true, lines: ['0 incidencias nuevas de SonarQube en la PR.'] };
  }

  const lines = [`${total} incidencias nuevas de SonarQube en la PR:`];
  for (const issue of response.issues) {
    lines.push(`- ${issue.rule} · ${location(issue)} · ${issue.message} · ${issueUrl(issue, pr)}`);
  }
  const unlisted = total - response.issues.length;
  if (unlisted > 0) {
    lines.push(`- … y ${unlisted} más: ${issuesUrl(pr)}`);
  }
  lines.push('Corrígelas, o márcalas como aceptadas en SonarQube con el motivo de por qué no aplican.');
  return { passed: false, lines };
}

function location(issue: SonarIssue): string {
  const separator = issue.component.indexOf(':');
  const path = separator === -1 ? issue.component : issue.component.slice(separator + 1);
  return issue.line === undefined ? path : `${path}:${issue.line}`;
}

function issuesUrl(pr: PullRequestRef): string {
  const query = new URLSearchParams({ id: pr.projectKey, pullRequest: pr.pullRequest });
  return `${pr.serverUrl}/project/issues?${query.toString()}`;
}

function issueUrl(issue: SonarIssue, pr: PullRequestRef): string {
  return `${issuesUrl(pr)}&open=${encodeURIComponent(issue.key)}`;
}
