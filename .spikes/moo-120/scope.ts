// Prototipo desechable de MOO-120: ¿sabe el triador si arreglar un hallazgo de Codex cae dentro del
// alcance de la tarea de la PR? Un hallazgo por petición, con la PR y, en una variante, la tarea de
// Linear que la PR cierra (`Fixes MOO-n`). p = probabilidad de que esté dentro del alcance.
//
//   node .spikes/moo-120/scope.ts [reps]
import { appendFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { parseCodexFinding } from '../../packages/pr-babysitter/src/adapters/codex-review.ts';

const here = new URL('.', import.meta.url).pathname;
const pkg = new URL('../../packages/pr-babysitter/', import.meta.url).pathname;
const { TypeSafeClassifier } = createRequire(`${pkg}package.json`)('@langchain/typesafe');
process.loadEnvFile(`${pkg}.env`);
const json = (f: string) => JSON.parse(readFileSync(`${here}data/codex/${f}`, 'utf8'));

/** Hilo (PR.índice entre todos los hilos) y si arreglarlo cae dentro de la tarea de la PR. */
const SAMPLE: [string, 'dentro' | 'fuera', string][] = [
  ['88.2', 'fuera', '«Real, pero es el alcance de la otra tarea» (MOO-91)'],
  ['88.0', 'dentro', 'arreglado en b841caa'],
  ['88.1', 'dentro', 'arreglado en f55e8d2'],
  ['101.2', 'dentro', 'se pasó por alto'],
  ['101.3', 'dentro', 'se pasó por alto'],
  ['72.1', 'dentro', 'arreglado en 1cf8413'],
  ['85.1', 'dentro', 'arreglado en 16ccb4c'],
  ['122.2', 'dentro', 'arreglado en 3167fea'],
  ['134.0', 'dentro', 'arreglado en 838ed32'],
  ['140.0', 'dentro', 'arreglado en ba36b30'],
];

const CRITERIA = {
  true: "Fixing it belongs to what this PR's task asks for: it corrects or completes code, tests or docs that the task creates or changes, without work the task leaves to another task and without a design decision outside the task.",
  false:
    "Fixing it needs work this PR's task does not cover: it belongs to another task or story, changes behaviour outside the task's area, or needs a design decision the task does not take. It should be escalated to the maintainer instead of fixed in this PR.",
};

const threads = json('threads.json').data.repository.pullRequests.nodes;
const tasks = json('tasks.json');
const reps = Number(process.argv[2] ?? 2);

for (const withTask of [true, false]) {
  for (const [id, label, why] of SAMPLE) {
    const [pr, index] = id.split('.').map(Number);
    const c = threads.find((p: { number: number }) => p.number === pr).reviewThreads.nodes[index].comments.nodes[0];
    if (c.author.login !== 'chatgpt-codex-connector') throw new Error(`#${id} no es de Codex`);
    const parsed = parseCodexFinding(c.body);
    const { title, body } = json(`pr-${pr}.json`);
    const state: Record<string, unknown> = { pr_author_description: { title, body } };
    if (withTask) state.pr_task = tasks[String(pr)];
    state.finding = {
      source: 'reviewer',
      severity: parsed.severity,
      file: c.path,
      line: c.originalLine,
      title: parsed.title,
      text: parsed.text,
      diff_hunk: c.diffHunk,
    };
    const where = `${c.path.split('/').at(-1)}:${c.originalLine}`;
    const questions = {
      finding: {
        type: 'noul',
        instructions: `Is fixing the ${parsed.badge ?? ''} reviewer comment on ${where}, titled '${parsed.title}', within the scope of this PR's task?`,
        criteria: CRITERIA,
      },
    };
    for (let rep = 1; rep <= reps; rep++) {
      const classifier = new TypeSafeClassifier({
        model: process.env.DECISION_MODEL || 'clef:27b',
        apiKey: process.env.DECISION_MODEL_API_KEY,
        baseUrl: process.env.DECISION_MODEL_BASE_URL || 'https://ollama.com',
        maxRetries: 2,
        questions,
      });
      const result = await classifier.invoke(state);
      const p = result.answers.finding?.noul;
      const variant = withTask ? 'con tarea' : 'sin tarea';
      appendFileSync(`${here}out/scope.jsonl`, `${JSON.stringify({ id, label, why, variant, rep, p, inputTokens: result.usage?.inputTokens })}\n`);
      console.log(`${variant} #${id.padEnd(6)} ${label.padEnd(6)} #${rep} p=${p?.toFixed(3)} tok=${result.usage?.inputTokens} · ${parsed.title.slice(0, 55)}`);
    }
  }
}
