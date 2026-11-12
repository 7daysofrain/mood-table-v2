// Prototipo desechable de MOO-120: ¿tría bien el triador los comentarios de Codex? Muestra pequeña de
// PR integradas, etiquetada con lo que se hizo con cada comentario (data/codex/threads.json). Cada
// hallazgo va solo en su petición, con el código de producción (parseCodexFinding,
// createDecisionModel): la misma pregunta, criterios y forma del hallazgo.
//
//   node .spikes/moo-120/codex.ts [reps]
import { appendFileSync, readFileSync } from 'node:fs';

import { parseCodexFinding } from '../../packages/pr-babysitter/src/adapters/codex-review.ts';
import { createDecisionModel } from '../../packages/pr-babysitter/src/adapters/decision-model.ts';

const here = new URL('.', import.meta.url).pathname;
process.loadEnvFile(new URL('../../packages/pr-babysitter/.env', import.meta.url).pathname);
const json = (f: string) => JSON.parse(readFileSync(`${here}data/codex/${f}`, 'utf8'));

/** PR.hilo y su etiqueta: «real» si se arregló en la PR; «no aplica» si se resolvió sin cambio en ella. */
const SAMPLE: [string, 'real' | 'no aplica', string][] = [
  ['88.2', 'no aplica', 'real, pero del alcance de otra tarea (MOO-91)'],
  ['101.2', 'real', 'se pasó por alto: llegó tras el último repaso (sesión de MOO-108)'],
  ['101.3', 'real', 'se pasó por alto: llegó tras el último repaso (sesión de MOO-108)'],
  ['72.1', 'real', 'arreglado en 1cf8413'],
  ['85.1', 'real', 'arreglado en 16ccb4c (botón del puntero)'],
  ['122.2', 'real', 'arreglado en 3167fea (__proto__)'],
  ['134.0', 'real', 'P1, arreglado en 838ed32'],
  ['140.0', 'real', 'arreglado en ba36b30'],
];

const threads = json('threads.json').data.repository.pullRequests.nodes;
const triager = createDecisionModel({
  baseUrl: process.env.DECISION_MODEL_BASE_URL || 'https://ollama.com',
  model: process.env.DECISION_MODEL || 'clef:27b',
  apiKey: process.env.DECISION_MODEL_API_KEY!,
});
const reps = Number(process.argv[2] ?? 3);
/** `node codex.ts 3 122.2 134.0`: solo esos hilos. */
const only = process.argv.slice(3);

for (const [id, label, why] of SAMPLE) {
  const [pr, index] = id.split('.').map(Number);
  if (only.length > 0 && !only.includes(id)) continue;
  // El índice es el del hilo entre todos los de la PR, como en el listado de threads.json.
  const codex = threads.find((p: { number: number }) => p.number === pr).reviewThreads.nodes[index]
    .comments.nodes[0];
  if (codex.author.login !== 'chatgpt-codex-connector') throw new Error(`#${id} no es de Codex`);
  const finding = {
    source: 'reviewer' as const,
    reviewer: 'Codex',
    ...parseCodexFinding(codex.body),
    file: codex.path,
    line: codex.originalLine,
    diffHunk: codex.diffHunk,
  };
  const { title, body } = json(`pr-${pr}.json`);
  for (let rep = 1; rep <= reps; rep++) {
    const { probabilities, inputTokens } = await triager.triage({ title, description: body }, [finding]);
    const line = { id, label, why, badge: finding.badge, title: finding.title, rep, p: probabilities[0], inputTokens };
    appendFileSync(`${here}out/codex.jsonl`, `${JSON.stringify(line)}\n`);
    console.log(`#${id.padEnd(6)} ${label.padEnd(9)} ${finding.badge} #${rep} p=${probabilities[0]?.toFixed(3)} tok=${inputTokens} · ${finding.title.slice(0, 60)}`);
  }
}
