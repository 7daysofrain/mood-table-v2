// Prototipo de MOO-76: tría las incidencias de SonarQube de las PR cerradas con la pregunta de la
// regla (D118), con el código del push en que salieron. La etiqueta sale de SonarCloud: arreglada,
// real; aceptada, no aplica. Uso: node .spikes/moo-76/sonar.ts [--dry]
import { appendFileSync, readFileSync } from 'node:fs';

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

// [pr, push, regla, fichero:línea, etiqueta, nota]. Una fila por incidencia, en el primer push en que
// sale con esa línea. Fuera las dos de la #134, que se usaron al escribir D118.
const ROWS: [number, string, string, string, 'real' | 'noAplica', string?][] = [
  [69, '820c79c', 'typescript:S7747', 'packages/pr-babysitter/src/core/driver.ts:54', 'real'],
  [69, '820c79c', 'typescript:S7747', 'packages/pr-babysitter/src/core/driver.ts:110', 'real'],
  [69, '820c79c', 'typescript:S9382', 'packages/pr-babysitter/src/core/driver.ts:111', 'real'],
  [69, '820c79c', 'typescript:S9382', 'packages/pr-babysitter/src/core/driver.ts:116', 'real'],
  [69, '93210ef', 'typescript:S9382', 'packages/pr-babysitter/src/core/driver.ts:142', 'noAplica', 'el mismo bucle que driver.ts:391 de D118'],
  [69, '93210ef', 'typescript:S9382', 'packages/pr-babysitter/src/core/driver.ts:143', 'noAplica', 'el mismo bucle que driver.ts:392 de D118'],
  [83, '', 'typescript:S7763', 'packages/shared/src/commands.ts:18', 'real'],
  [96, '', 'typescript:S2871', 'packages/panel/src/engine/strip-requests.ts:22', 'real'],
  [96, '', 'typescript:S2925', 'e2e/controls.spec.ts:119', 'real'],
  [96, '', 'typescript:S6819', 'packages/panel/src/controls/ControlList.tsx:89', 'real'],
  [101, 'a5c2133', 'typescript:S1994', 'packages/pr-babysitter/src/core/triage.ts:169', 'real'],
  [101, 'a5c2133', 'typescript:S8786', 'packages/pr-babysitter/src/adapters/codex-review.ts:132', 'real'],
  [101, 'a5c2133', 'typescript:S8786', 'packages/pr-babysitter/src/core/triage.ts:149', 'real'],
  [101, 'addd7e1', 'typescript:S9382', 'packages/pr-babysitter/src/adapters/decision-model.ts:83', 'noAplica'],
  [116, '', 'typescript:S2925', 'e2e/effects.spec.ts:183', 'real'],
  [119, '', 'typescript:S5976', 'packages/engine/src/adapters/server.test.ts:642', 'real'],
  [122, '', 'typescript:S7718', 'packages/engine/src/adapters/sqlite-state-store.ts:82', 'real'],
  [124, '', 'typescript:S6759', 'packages/panel/src/layout/Zone.tsx:19', 'real'],
  [148, '', 'typescript:S8786', 'packages/pr-babysitter/src/adapters/check-context.ts:159', 'real'],
  [164, '', 'typescript:S6959', 'tooling/ci/sonar-issues.ts:156', 'real'],
  [166, '', 'typescript:S8786', 'packages/pr-babysitter/src/adapters/sonar-issues.ts:44', 'real'],
  [172, '4104949', 'typescript:S9382', 'packages/pr-babysitter/src/adapters/github.ts:443', 'noAplica'],
];

// El push y el mensaje de cada línea del log de `sonar-issues`.
const log = readFileSync(`${dir}data/sonar-log-lines.tsv`, 'utf8')
  .trim()
  .split('\n')
  .map((l) => l.split('\t'));

const rules = new Map<string, Promise<{ name: string; high: boolean }>>();
function rule(key: string) {
  if (!rules.has(key)) {
    rules.set(
      key,
      fetch(`https://sonarcloud.io/api/rules/show?key=${key}&organization=7daysofrain`)
        .then((r) => r.json())
        .then((j: any) => ({
          name: j.rule.name,
          high: (j.rule.impacts ?? []).some((i: any) => i.severity === 'HIGH' || i.severity === 'BLOCKER'),
        })),
    );
  }
  return rules.get(key)!;
}

for (const [pr, push, key, where, label, note] of ROWS) {
  const line = log.find(
    ([p, sha, text]) => Number(p) === pr && sha.startsWith(push) && text.startsWith(`${key} · ${where} · `),
  );
  if (!line) throw new Error(`Sin línea de log: ${pr} ${key} ${where}`);
  const [, sha, text] = line;
  const message = text.split(' · ')[2];
  const [file, n] = where.split(':');
  const source = await fetch(`https://raw.githubusercontent.com/7daysofrain/mood-table-v2/${sha}/${file}`);
  const code = source.ok ? around(await source.text(), Number(n)) : null;
  const { name, high } = await rule(key);
  const finding: Finding = {
    source: 'sonarIssue',
    rule: key,
    ruleName: name,
    severity: high ? 'high' : 'normal',
    file,
    line: Number(n),
    message,
    code,
  };
  const context = { title: `PR #${pr}`, description: '' };
  const pull = JSON.parse(
    (await import('node:child_process'))
      .execSync(`gh api repos/7daysofrain/mood-table-v2/pulls/${pr} -q '{title,body}'`)
      .toString(),
  );
  context.title = pull.title;
  context.description = pull.body ?? '';
  const row = { pr, sha: sha.slice(0, 7), rule: key, where, label, note, severity: finding.severity };
  if (dry) {
    console.log(pr, key, where, code === null ? 'SIN CÓDIGO' : model.estimate(context, finding, 'rule'));
    continue;
  }
  const { answer, inputTokens } = await model.ask(context, finding, 'rule');
  appendFileSync(`${dir}out/sonar.jsonl`, JSON.stringify({ ...row, answer, inputTokens }) + '\n');
  console.log(pr, key, where, label, JSON.stringify(answer));
}
