// Prototipo desechable de MOO-120: ¿filtra el triador los hallazgos de un revisor más ruidoso? Pasa
// por el triador de producción los hallazgos de dos revisiones a ciegas de Claude (#122 y #134, el
// mismo push que revisó Codex), cada uno solo en su petición. El trozo de diff se saca como lo da
// GitHub: desde la cabecera del *hunk* hasta la línea comentada.
//
//   node .spikes/moo-120/claude.ts [reps]
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

import { createDecisionModel } from '../../packages/pr-babysitter/src/adapters/decision-model.ts';

const here = new URL('.', import.meta.url).pathname;
const root = new URL('../../', import.meta.url).pathname;
process.loadEnvFile(`${root}packages/pr-babysitter/.env`);

const PUSHES: Record<string, { base: string; head: string }> = {
  '122': { base: '24995b63f1e1cc578d556b3161dfb0bd60142e38', head: '960014c2153a208253ec83a96660861e9e6c2bac' },
  '134': { base: '06ff79bf3197b4d4ef76677af43d76c5de038f3c', head: 'd6422eb86f80feb98eaf1446e42374425baf667a' },
};

/** El *hunk* de `file` que contiene la línea nueva `line`, cortado en esa línea, o null. */
function diffHunk(pr: string, file: string, line: number | null): string | null {
  const { base, head } = PUSHES[pr];
  const diff = execFileSync('git', ['diff', base, head, '--', file], { cwd: root, encoding: 'utf8' });
  const lines = diff.split('\n');
  let hunk: string[] | null = null;
  let newLine = 0;
  for (const l of lines) {
    const header = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(l);
    if (header) {
      hunk = [l];
      newLine = Number(header[1]) - 1;
      continue;
    }
    if (!hunk) continue;
    hunk.push(l);
    if (!l.startsWith('-')) newLine += 1;
    if (line !== null && newLine === line && !l.startsWith('-')) return hunk.join('\n');
  }
  return null;
}

const triager = createDecisionModel({
  baseUrl: process.env.DECISION_MODEL_BASE_URL || 'https://ollama.com',
  model: process.env.DECISION_MODEL || 'clef:27b',
  apiKey: process.env.DECISION_MODEL_API_KEY!,
});
const reps = Number(process.argv[2] ?? 2);

for (const pr of Object.keys(PUSHES)) {
  const review = JSON.parse(readFileSync(`${here}data/claude-review/pr-${pr}.json`, 'utf8'));
  const { title, body } = JSON.parse(readFileSync(`${here}data/codex/pr-${pr}.json`, 'utf8'));
  for (const [i, c] of review.entries()) {
    const finding = {
      source: 'reviewer' as const,
      reviewer: 'Claude',
      badge: c.severity,
      severity: c.severity === 'P0' || c.severity === 'P1' ? ('high' as const) : ('normal' as const),
      title: c.title,
      text: c.body,
      file: c.file,
      line: c.line,
      diffHunk: diffHunk(pr, c.file, c.line),
    };
    for (let rep = 1; rep <= reps; rep++) {
      const { probabilities, inputTokens } = await triager.triage({ title, description: body }, [finding]);
      const out = { pr, i, severity: c.severity, title: c.title, hunk: finding.diffHunk !== null, rep, p: probabilities[0], inputTokens };
      appendFileSync(`${here}out/claude.jsonl`, `${JSON.stringify(out)}\n`);
      console.log(`#${pr}.${i} ${c.severity.padEnd(4)} #${rep} p=${probabilities[0]?.toFixed(3)} hunk=${out.hunk} · ${c.title.slice(0, 70)}`);
    }
  }
}
