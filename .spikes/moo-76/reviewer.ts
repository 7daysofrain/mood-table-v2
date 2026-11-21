// Prototipo de MOO-76: tría los hilos de Codex de las PR cerradas con el código de producción.
// Por hilo, tres peticiones: alcance (P1/P2) como comentario del último push; «ya arreglado» con el
// código del commit que comentó (etiqueta: no); y con el código del último commit de la PR, si se
// arregló con un commit (etiqueta: sí). Uso: node .spikes/moo-76/reviewer.ts [--dry]
import { execSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';

import { parseCodexFinding } from '../../packages/pr-babysitter/src/adapters/codex-review.ts';
import { createDecisionModel } from '../../packages/pr-babysitter/src/adapters/decision-model.ts';
import { around } from '../../packages/pr-babysitter/src/adapters/sonar-issues.ts';
import type { Finding } from '../../packages/pr-babysitter/src/core/triage.ts';

const dir = new URL('.', import.meta.url).pathname;
const dry = process.argv.includes('--dry');
const env = Object.fromEntries(
  readFileSync(
    '/Users/7daysofrain/Proyectos/ai-roadmap/02-lidr-ai4devs/AI4Devs-finalproject/packages/pr-babysitter/.env',
    'utf8',
  )
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);
const model = createDecisionModel({
  baseUrl: env.DECISION_MODEL_BASE_URL ?? 'https://ollama.com',
  model: env.DECISION_MODEL ?? 'clef:27b',
  apiKey: env.DECISION_MODEL_API_KEY,
});

// Los 10 hilos que se usaron al escribir las preguntas de alcance (MOO-120, D116).
const SEEN = new Set(['88.0', '88.1', '88.2', '72.1', '85.1', '122.2', '101.2', '101.3', '134.0', '140.0']);
const FIXED_REPLY = /(arreglado|corregido|hecho) en [0-9a-f]{7}|\(([0-9a-f]{7})\)/i;

const files = new Map<string, Promise<string | null>>();
function fileAt(sha: string, path: string) {
  const key = `${sha}:${path}`;
  if (!files.has(key)) {
    files.set(
      key,
      fetch(`https://raw.githubusercontent.com/7daysofrain/mood-table-v2/${sha}/${path}`).then((r) =>
        r.ok ? r.text() : null,
      ),
    );
  }
  return files.get(key)!;
}

const prs = readFileSync(`${dir}data/prs.jsonl`, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const out = `${dir}out/reviewer.jsonl`;
execSync(`mkdir -p ${dir}out`);

for (const pr of prs.filter((p) => p.state === 'MERGED')) {
  const threads = pr.reviewThreads.nodes.filter(
    (t: any) => t.comments.nodes[0]?.author?.login === 'chatgpt-codex-connector',
  );
  if (threads.length === 0) continue;
  const head = execSync(`gh api repos/7daysofrain/mood-table-v2/pulls/${pr.number} -q .head.sha`)
    .toString()
    .trim();
  const context = { title: pr.title, description: pr.body ?? '' };
  for (const [index, thread] of threads.entries()) {
    const id = `${pr.number}.${index}`;
    if (SEEN.has(id)) continue;
    const [first, ...replies] = thread.comments.nodes;
    const reply = replies.map((c: any) => c.body).join('\n');
    const base: Finding = {
      source: 'reviewer',
      reviewer: 'Codex',
      ...parseCodexFinding(first.body),
      file: thread.path,
      line: thread.originalLine,
      diffHunk: first.diffHunk,
      earlierPush: null,
    };
    const originalSha = first.originalCommit.oid;
    const before = around((await fileAt(originalSha, thread.path)) ?? '', thread.originalLine);
    const afterText = await fileAt(head, thread.path);
    const after = afterText === null ? null : around(afterText, thread.line ?? thread.originalLine);
    const fixedByCommit = FIXED_REPLY.test(reply);
    const runs: [string, Finding, 'scope' | 'fixedScope', string][] = [
      ['scope', base, 'scope', 'inside'],
      ['notFixed', { ...base, earlierPush: { sha: originalSha, code: before } }, 'fixedScope', 'notFixed'],
    ];
    if (fixedByCommit && after !== null) {
      runs.push(['fixed', { ...base, earlierPush: { sha: head, code: after } }, 'fixedScope', 'fixed']);
    }
    for (const [variant, finding, question, label] of runs) {
      const row = { id, variant, label, badge: base.badge, title: base.title, reply: reply.slice(0, 120) };
      if (dry) {
        console.log(id, variant, model.estimate(context, finding, question));
        continue;
      }
      try {
        const { answer, inputTokens } = await model.ask(context, finding, question);
        appendFileSync(out, JSON.stringify({ ...row, answer, inputTokens }) + '\n');
        console.log(id, variant, JSON.stringify(answer));
      } catch (error) {
        appendFileSync(out, JSON.stringify({ ...row, error: String(error) }) + '\n');
        console.log(id, variant, 'ERROR', String(error).slice(0, 120));
      }
    }
  }
}
