// Prototipo desechable de MOO-120: ¿mover la p agrupar los hallazgos de un push en una petición?
// Usa los adaptadores de producción (createFindings, createDecisionModel) sobre el push b4a4734 de la
// #116, que tuvo dos hallazgos y ningún comentario de Codex. Los logs salen de data/, no de GitHub:
// con `filter=latest`, un job relanzado devolvería el log del intento que pasó.
//
//   node .spikes/moo-120/batch.ts [reps]
import { appendFileSync, readFileSync } from 'node:fs';

import { createDecisionModel } from '../../packages/pr-babysitter/src/adapters/decision-model.ts';
import { createFindings } from '../../packages/pr-babysitter/src/adapters/findings.ts';

const here = new URL('.', import.meta.url).pathname;
process.loadEnvFile(new URL('../../packages/pr-babysitter/.env', import.meta.url).pathname);
const data = (f: string) => readFileSync(`${here}data/${f}`, 'utf8');
const SHA = 'b4a47348bf49447cf62cb29d69299445a30f973f';
const pr = JSON.parse(data('pr-116.json'));
const logs: Record<string, string> = { e2e: data('e2e-116-job.log'), 'sonar-issues': data('sonar-issues-116-job.log') };

const findings = createFindings({
  reviewer: { login: 'nadie', name: 'Codex', parse: () => ({ badge: null, severity: 'normal', title: '', text: '' }) },
  github: {
    getPullRequest: async () => ({ title: pr.title, body: pr.body }),
    listReviewComments: async () => [],
    jobLog: async (_sha, name) => logs[name] ?? null,
  },
});
const triager = createDecisionModel({
  baseUrl: process.env.DECISION_MODEL_BASE_URL || 'https://ollama.com',
  model: process.env.DECISION_MODEL || 'clef:27b',
  apiKey: process.env.DECISION_MODEL_API_KEY!,
});

const CASES: Record<string, string[]> = {
  'juntos (como producción)': ['e2e', 'sonar-issues'],
  'juntos, orden inverso': ['sonar-issues', 'e2e'],
  'e2e solo': ['e2e'],
  'sonar-issues solo': ['sonar-issues'],
};
const reps = Number(process.argv[2] ?? 5);
for (const [name, checks] of Object.entries(CASES)) {
  const { context, findings: found } = await findings.read(116, SHA, checks);
  for (let rep = 1; rep <= reps; rep++) {
    const { probabilities, inputTokens } = await triager.triage(context, found);
    const p = Object.fromEntries(found.map((f, i) => [f.source === 'check' ? f.name : '?', probabilities[i]]));
    appendFileSync(`${here}out/batch.jsonl`, `${JSON.stringify({ case: name, rep, p, inputTokens })}\n`);
    console.log(`${name.padEnd(26)} #${rep} ${JSON.stringify(p)} tok=${inputTokens}`);
  }
}
