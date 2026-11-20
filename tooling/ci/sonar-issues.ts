/**
 * Parte pura de la comprobación de incidencias nuevas de SonarQube (specs/quality-gates, design.md
 * decisión 3; las anotaciones, change `pr-sonar-issue-triage`, decisión 1). Sin E/S: la E/S (variables de entorno, peticiones y espera) vive en
 * `check-sonar-issues.ts`, que queda fuera de la cobertura.
 */

/** Siguiente paso según el estado de la tarea de análisis de SonarQube (`api/ce/task`). */
export type CeTaskStep = { kind: 'wait' } | { kind: 'continue' } | { kind: 'fail'; message: string };

export interface SonarIssue {
  key: string;
  rule: string;
  /** La severidad heredada (`BLOCKER`, `CRITICAL`, `MAJOR`, `MINOR`, `INFO`). */
  severity: string;
  /** Los impactos de la incidencia, cada uno con su severidad (`BLOCKER` … `INFO`). */
  impacts?: { softwareQuality: string; severity: string }[];
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
  /** Con `additionalFields=rules`: el nombre de cada regla de la página. */
  rules?: { key: string; name: string }[];
}

/**
 * Las anotaciones de error que guarda el runner de GitHub Actions por paso (`_maxCountPerIssueType`
 * en `actions/runner`); las demás solo salen en el log.
 */
export const MAX_ANNOTATIONS = 10;

/** De más a menos grave. */
const SEVERITIES = ['BLOCKER', 'HIGH', 'MEDIUM', 'LOW', 'INFO'];

/** La severidad heredada, en la escala de los impactos. */
const LEGACY_SEVERITIES: Record<string, string> = {
  BLOCKER: 'BLOCKER',
  CRITICAL: 'HIGH',
  MAJOR: 'MEDIUM',
  MINOR: 'LOW',
  INFO: 'INFO',
};

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

/** Lo que se usa del `report-task.txt` que escribe el escáner al terminar. */
export interface ReportTask {
  ceTaskUrl: string;
  serverUrl: string;
  projectKey: string;
}

const REPORT_TASK_KEYS = ['ceTaskUrl', 'serverUrl', 'projectKey'] as const;

/** Lee el `report-task.txt` del escáner (`clave=valor`, una por línea). */
export function parseReportTask(reportTask: string): ReportTask {
  const values = new Map<string, string>();
  for (const line of reportTask.split(/\r?\n/)) {
    const separator = line.indexOf('=');
    if (separator > 0) {
      values.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
    }
  }
  const ceTaskUrl = values.get('ceTaskUrl');
  const serverUrl = values.get('serverUrl');
  const projectKey = values.get('projectKey');
  if (!ceTaskUrl || !serverUrl || !projectKey) {
    const missing = REPORT_TASK_KEYS.filter((key) => !values.get(key));
    throw new Error(
      `El informe del escáner no trae ${missing.join(', ')}: no se sabe qué análisis esperar.`,
    );
  }
  return { ceTaskUrl, serverUrl, projectKey };
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

/**
 * Las anotaciones de la comprobación, para imprimirlas antes del informe: un `::error` en la línea de
 * cada incidencia, como mucho `MAX_ANNOTATIONS`, en el orden de SonarQube, y un `::notice` con el
 * total. El total va siempre, para que quien las lea sepa si faltan.
 */
export function toAnnotations(response: IssuesSearchResponse): string[] {
  const total = response.paging.total;
  if (total === 0) return [];

  const names = new Map(response.rules?.map((rule) => [rule.key, rule.name]));
  const annotated = response.issues.slice(0, MAX_ANNOTATIONS);
  const errors = annotated.map((issue) => {
    const title = `${issue.rule} · ${issueSeverity(issue)} · ${names.get(issue.rule) ?? issue.rule}`;
    const properties = [`file=${escapeProperty(pathOf(issue))}`];
    if (issue.line !== undefined) properties.push(`line=${issue.line}`);
    properties.push(`title=${escapeProperty(title)}`);
    return `::error ${properties.join(',')}::${escapeData(issue.message)}`;
  });
  const notice =
    `::notice title=${escapeProperty('Incidencias nuevas de SonarQube')}::` +
    escapeData(`${total} incidencias nuevas; se anotan ${annotated.length}`);
  return [...errors, notice];
}

/** La más alta de sus impactos; sin impactos, la heredada traducida. */
export function issueSeverity(issue: SonarIssue): string {
  const impacts = issue.impacts ?? [];
  if (impacts.length === 0) return LEGACY_SEVERITIES[issue.severity] ?? issue.severity;
  return impacts
    .map((impact) => impact.severity)
    .reduce((highest, severity) => (rank(severity) < rank(highest) ? severity : highest));
}

/** Una severidad desconocida va detrás de todas las conocidas. */
function rank(severity: string): number {
  const index = SEVERITIES.indexOf(severity);
  return index === -1 ? SEVERITIES.length : index;
}

/**
 * El escapado que deshace el runner en el texto de un comando: así un dato de SonarQube no puede
 * abrir una línea nueva (y, con ella, otro comando).
 */
function escapeData(text: string): string {
  return text.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
}

/** En una propiedad, además `:` y `,`, que la cerrarían o abrirían otra. */
function escapeProperty(text: string): string {
  return escapeData(text).replaceAll(':', '%3A').replaceAll(',', '%2C');
}

/**
 * Deja una línea segura para el log de GitHub Actions. Los mensajes y las rutas vienen de SonarQube
 * (y las rutas, de la PR): un salto de línea permitiría inyectar líneas, incluidos los comandos `::`
 * del runner. Se sustituye cualquier carácter de control por un espacio.
 */
export function toLogLine(text: string): string {
  return text.replace(/\p{Cc}+/gu, ' ');
}

/**
 * Envuelve el informe para que el runner de GitHub Actions no interprete nada de él como un comando:
 * además de los `::` a principio de línea, reconoce la sintaxis antigua `##[…]` en cualquier punto de
 * la línea. `token` debe ser impredecible, para que el propio informe no pueda reactivarlos.
 */
export function withoutRunnerCommands(lines: string[], token: string): string {
  return [`::stop-commands::${token}`, ...lines.map(toLogLine), `::${token}::`].join('\n');
}

function pathOf(issue: SonarIssue): string {
  const separator = issue.component.indexOf(':');
  return separator === -1 ? issue.component : issue.component.slice(separator + 1);
}

function location(issue: SonarIssue): string {
  const path = pathOf(issue);
  return issue.line === undefined ? path : `${path}:${issue.line}`;
}

function issuesUrl(pr: PullRequestRef): string {
  const query = new URLSearchParams({ id: pr.projectKey, pullRequest: pr.pullRequest });
  return `${pr.serverUrl}/project/issues?${query.toString()}`;
}

function issueUrl(issue: SonarIssue, pr: PullRequestRef): string {
  return `${issuesUrl(pr)}&open=${encodeURIComponent(issue.key)}`;
}
