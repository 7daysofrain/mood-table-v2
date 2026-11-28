/**
 * Lo que recibe el agente (change pr-fixer, decisión 12): un hallazgo cada vez, con su contexto, y el
 * alcance de la PR. No recibe tokens, ni el diff entero, ni los demás hallazgos. `AGENTS.md` lo carga
 * el SDK con `settingSources: ["project"]`. Va en inglés: solo lo lee el agente.
 */
import type { Finding, PullRequestContext } from '../core/triage.ts';

function place(file: string, line: number | null): string {
  return line === null ? file : `${file}:${line}`;
}

function block(text: string): string {
  return ['```', text, '```'].join('\n');
}

function describeFinding(finding: Finding): string {
  switch (finding.source) {
    case 'check': {
      const lines = [`The required check \`${finding.name}\` fails on the PR's last push.`];
      if (finding.context.state !== 'available') {
        lines.push('There is no log or summary for it: run the check yourself to see why it fails.');
        return lines.join('\n');
      }
      lines.push('', 'What the check reports:', block(finding.context.summary));
      if (finding.context.errors.length > 0) {
        lines.push('', 'Errors:');
        for (const error of finding.context.errors) {
          lines.push(`- ${place(error.file, error.line)} ${error.title ?? ''}: ${error.message}`.replace(' :', ':'));
        }
      }
      return lines.join('\n');
    }
    case 'sonarIssue':
      return [
        `SonarQube reports a new issue at ${place(finding.file, finding.line)}.`,
        `Rule ${finding.rule} (${finding.ruleName}): ${finding.message}`,
        ...(finding.code === null ? [] : ['', 'The code around it:', block(finding.code)]),
      ].join('\n');
    case 'reviewer':
      return [
        `The reviewer (${finding.reviewer}) left a comment at ${place(finding.file, finding.line)}.`,
        `Title: ${finding.title}`,
        '',
        finding.text,
        ...(finding.diffHunk === null ? [] : ['', 'The diff it comments on:', block(finding.diffHunk)]),
        ...(finding.earlierPush?.code
          ? ['', 'It was written on an earlier push. The code there now:', block(finding.earlierPush.code)]
          : []),
      ].join('\n');
  }
}

/** El mensaje para el agente: qué arreglar, dentro de qué alcance y qué no hacer. */
export function fixPrompt(pr: PullRequestContext, finding: Finding): string {
  return [
    'You are fixing one finding on an open pull request of this repository.',
    '',
    '## The pull request (its scope)',
    `Title: ${pr.title}`,
    '',
    pr.description,
    '',
    '## The finding',
    describeFinding(finding),
    '',
    '## How to work',
    '- Fix only this finding, with the smallest change that does it, inside the scope of the pull request.',
    '- Change only what this finding needs. Do not fix anything else you notice, even an obvious bug next',
    '  to it: the other findings are handled apart, and some of them are for the maintainer to decide.',
    '- Follow the conventions in AGENTS.md.',
    '- Check your change with `pnpm lint`, `pnpm typecheck` and `pnpm test`. They must pass.',
    '- Do not commit and do not push: that is done for you if the checks pass.',
    '- If the fix needs a decision only the maintainer can make, or you cannot fix it, leave the files',
    '  unchanged and say why.',
  ].join('\n');
}
