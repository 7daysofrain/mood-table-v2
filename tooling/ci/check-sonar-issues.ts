/**
 * Comprobación de incidencias nuevas de SonarQube en una PR contra `main` (specs/quality-gates,
 * design.md decisiones 2 y 3). La lanza el job `sonar-issues` de la CI con Node, sin compilar:
 *
 *   node tooling/ci/check-sonar-issues.ts
 *
 * Espera a que termine el análisis que lanzó el job `test` y falla si la PR tiene incidencias
 * abiertas. Solo E/S: la lógica está en `sonar-issues.ts`, con tests. Fuera de la cobertura.
 */
import { randomUUID } from 'node:crypto';
import { appendFileSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

import {
  type CheckResult,
  type IssuesSearchResponse,
  nextStepForCeTask,
  parseReportTask,
  type ReportTask,
  summarizeIssues,
  toLogLine,
  withoutRunnerCommands,
} from './sonar-issues.ts';

const POLL_INTERVAL_MS = 5_000;
const TIMEOUT_MS = 5 * 60_000;
/** Máximo que devuelve `api/issues/search` por página; si hay más, el informe lo dice. */
const PAGE_SIZE = 100;

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}.`);
  return value;
}

/** Una respuesta que no sea 2xx es un error, nunca «0 incidencias». */
async function getJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    throw new Error(`SonarQube ha respondido ${response.status} ${response.statusText} a ${url}`);
  }
  return (await response.json()) as T;
}

async function waitForAnalysis(ceTaskUrl: string, token: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const { task } = await getJson<{ task: { status: string } }>(ceTaskUrl, token);
    const step = nextStepForCeTask(task.status);
    if (step.kind === 'continue') return;
    if (step.kind === 'fail') throw new Error(step.message);
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `El análisis de SonarQube no ha terminado en ${TIMEOUT_MS / 60_000} minutos. ` +
      'No significa que no haya incidencias: relanza el job.',
  );
}

async function fetchIssues(report: ReportTask, pullRequest: string, token: string) {
  const query = new URLSearchParams({
    componentKeys: report.projectKey,
    pullRequest,
    // Deja fuera las aceptadas y los falsos positivos.
    resolved: 'false',
    ps: String(PAGE_SIZE),
  });
  const url = `${report.serverUrl}/api/issues/search?${query.toString()}`;
  return getJson<IssuesSearchResponse>(url, token);
}

/**
 * Todo por stdout, para que el orden se mantenga; el fallo lo marca el código de salida. El resumen
 * del job es Markdown y el runner no busca comandos en él.
 */
function publish(result: CheckResult): void {
  console.log(withoutRunnerCommands(result.lines, randomUUID()));
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const report = result.lines.map(toLogLine).join('\n');
    appendFileSync(summaryPath, `### Incidencias nuevas de SonarQube\n\n${report}\n`);
  }
}

async function main(): Promise<CheckResult> {
  const token = requiredEnv('SONAR_TOKEN');
  const pullRequest = requiredEnv('PR_NUMBER');
  const report = parseReportTask(readFileSync(requiredEnv('SONAR_REPORT_TASK'), 'utf8'));
  await waitForAnalysis(report.ceTaskUrl, token);
  const issues = await fetchIssues(report, pullRequest, token);
  return summarizeIssues(issues, { ...report, pullRequest });
}

try {
  const result = await main();
  publish(result);
  process.exitCode = result.passed ? 0 : 1;
} catch (error) {
  publish({ passed: false, lines: [error instanceof Error ? error.message : String(error)] });
  process.exitCode = 1;
}
