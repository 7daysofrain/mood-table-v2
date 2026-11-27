/**
 * Datos de prueba del *fixer*: trabajos y hallazgos de los tres orígenes. Solo para los tests.
 */
import type { FixJob } from '../core/fix.ts';
import type { CheckFinding, Finding } from '../core/triage.ts';

type SonarFinding = Extract<Finding, { source: 'sonarIssue' }>;
type ReviewerFinding = Extract<Finding, { source: 'reviewer' }>;

export const lint: CheckFinding = {
  source: 'check',
  name: 'lint',
  conclusion: 'failure',
  context: {
    state: 'available',
    origin: 'annotations',
    summary: '1 error',
    errors: [{ file: 'src/a.ts', line: 3, title: 'no-unused-vars', message: "'x' is unused" }],
    truncated: false,
  },
};

export const sonar: SonarFinding = {
  source: 'sonarIssue',
  rule: 'typescript:S3358',
  ruleName: 'Ternary operators should not be nested',
  severity: 'normal',
  file: 'src/b.ts',
  line: 12,
  message: 'Extract this nested ternary operation into an independent statement.',
  code: '12 >> const x = a ? b : c ? d : e;',
};

export const codex: ReviewerFinding = {
  source: 'reviewer',
  reviewer: 'Codex',
  badge: 'P1',
  severity: 'high',
  file: 'src/c.ts',
  line: 7,
  title: 'Handle the empty list',
  text: 'This throws when the list is empty.',
  diffHunk: '@@ -1,3 +1,7 @@\n+const first = list[0].name;',
  earlierPush: null,
};

export function fixJob(overrides: Partial<FixJob> = {}): FixJob {
  return {
    number: 12,
    sha: 'abc123',
    pr: { title: 'feat(engine): efecto nuevo', description: 'Añade el efecto de barrido.' },
    findings: [lint],
    budgetUsd: 2,
    ...overrides,
  };
}
