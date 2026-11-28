/**
 * Un trabajo del *fixer* (change pr-fixer, decisiones 5, 6 y 8): arreglar los hallazgos reales de un
 * push, uno a uno, y subirlos en un solo push.
 *
 * Por cada hallazgo, en orden (comprobaciones, incidencias de SonarQube, hilos del revisor): el agente,
 * luego `lint`, `typecheck` y `test`, y un commit con su *trailer* `Babysitter-Fix`. Si no pasan, o el
 * agente no ha terminado, se deshacen sus cambios y queda sin arreglar con su motivo. Al pasar del tope
 * de gasto, el hallazgo en curso no se sube y los demás no se empiezan; lo ya arreglado sí se sube.
 */
import { type FixJob, type FixStatus, findingLabel } from '../core/fix.ts';
import type { Finding } from '../core/triage.ts';

import type { FixAgent } from './agent.ts';
import type { Gates } from './gates.ts';
import { type Author, commitAll, discardChanges, hasChanges, stagedDiff, type Workspace } from './git.ts';
import { fixPrompt } from './prompt.ts';
import type { PushResult } from './push.ts';

type Unfixed = Extract<FixStatus, { state: 'pushed' }>['unfixed'][number];

export interface JobDeps {
  /** La rama de la PR, que se lee de GitHub. */
  branch(pullRequestNumber: number): Promise<string>;
  workspace: Workspace;
  agent: FixAgent;
  gates: Gates;
  /** Sube el clon a la rama, sin forzar. */
  push(dir: string, branch: string): Promise<PushResult>;
  /** Guarda el coste de una `query()` (decisión 8). */
  recordCost(pullRequestNumber: number, sha: string, usd: number): void;
  /** La identidad de la App: autor y *committer* de cada commit. */
  author: Author;
  /** Los secretos del *fixer*: un arreglo que lleve alguno en su diff no se sube. */
  secrets: string[];
  log?: (message: string) => void;
}

const SOURCE_ORDER: Record<Finding['source'], number> = { check: 0, sonarIssue: 1, reviewer: 2 };

/** Los hallazgos en el orden en que se arreglan: comprobaciones, incidencias y hilos del revisor. */
export function fixOrder(findings: Finding[]): Finding[] {
  return findings.toSorted((a, b) => SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]);
}

/** El valor del *trailer* `Babysitter-Fix` de un commit: qué hallazgo arregla. */
export function fixTrailer(finding: Finding): string {
  const where = (file: string, line: number | null) => (line === null ? file : `${file}:${line}`);
  switch (finding.source) {
    case 'check':
      return `check:${finding.name}`;
    case 'sonarIssue':
      return `sonar:${finding.rule} ${where(finding.file, finding.line)}`;
    case 'reviewer':
      return `thread:${where(finding.file, finding.line)}`;
  }
}

function commitMessage(finding: Finding): string {
  return `fix: arreglar ${findingLabel(finding)}\n\nBabysitter-Fix: ${fixTrailer(finding)}\n`;
}

/** Arregla un hallazgo en el clon: el commit si pasa, o por qué no. */
async function fixOne(
  dir: string,
  job: FixJob,
  finding: Finding,
  budgetUsd: number,
  deps: JobDeps,
): Promise<{ costUsd: number; unfixed?: Unfixed['reason'] }> {
  const { outcome, costUsd } = await deps.agent.fix({ cwd: dir, prompt: fixPrompt(job.pr, finding), budgetUsd });
  deps.recordCost(job.number, job.sha, costUsd);
  deps.log?.(`PR #${job.number} ${fixTrailer(finding)}: ${outcome}, ${costUsd.toFixed(4)} $`);

  const reason = await check(dir, outcome, deps);
  if (reason) {
    await discardChanges(dir);
    return { costUsd, unfixed: reason };
  }
  await commitAll(dir, commitMessage(finding), deps.author);
  return { costUsd };
}

/** Si el cambio del agente se puede subir; si no, por qué. */
async function check(dir: string, outcome: string, deps: JobDeps): Promise<Unfixed['reason'] | undefined> {
  if (outcome === 'budgetSpent') return 'budgetSpent';
  if (outcome !== 'done' || !(await hasChanges(dir))) return 'agentFailed';
  const diff = await stagedDiff(dir);
  if (deps.secrets.some((secret) => diff.includes(secret))) return 'agentFailed';
  const gates = await deps.gates.run(dir);
  return gates.passed ? undefined : 'checksFailed';
}

export async function runJob(job: FixJob, deps: JobDeps): Promise<FixStatus> {
  const branch = await deps.branch(job.number);
  const dir = await deps.workspace.open(branch, job.sha);
  try {
    const unfixed: Unfixed[] = [];
    let spent = 0;
    let commits = 0;
    let budgetSpent = false;
    for (const finding of fixOrder(job.findings)) {
      const left = job.budgetUsd - spent;
      if (budgetSpent || left <= 0) {
        budgetSpent = true;
        unfixed.push({ finding, reason: 'budgetSpent' });
        continue;
      }
      const result = await fixOne(dir, job, finding, left, deps);
      spent += result.costUsd;
      if (result.unfixed) {
        unfixed.push({ finding, reason: result.unfixed });
        budgetSpent = result.unfixed === 'budgetSpent';
      } else {
        commits += 1;
      }
    }

    if (commits === 0) {
      return { state: 'failed', reason: budgetSpent ? 'budgetSpent' : 'nothingFixed', unfixed };
    }
    const pushed = await deps.push(dir, branch);
    return pushed.pushed ? { state: 'pushed', sha: pushed.sha, unfixed } : { state: 'obsolete' };
  } finally {
    await deps.workspace.close(dir);
  }
}
