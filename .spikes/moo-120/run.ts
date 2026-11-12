// Prototipo desechable de MOO-120: pregunta a Clef por cada fila etiquetada con distintas variantes
// de contexto y repite cada una para ver el ruido de la p.
//
//   node .spikes/moo-120/run.ts --dry      # tamaños y coste estimado, sin llamar
//   node .spikes/moo-120/run.ts [reps]     # llama; por defecto 5 repeticiones
//
// La petición imita la de producción (decision-model.ts): mismo `state`, misma pregunta y mismos
// criterios. Cambia solo el contexto del hallazgo y, en las variantes del diff, el contexto común.
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const here = new URL('.', import.meta.url).pathname;
const pkg = new URL('../../packages/pr-babysitter/', import.meta.url).pathname;
const require = createRequire(`${pkg}package.json`);
const { TypeSafeClassifier } = require('@langchain/typesafe');
process.loadEnvFile(`${pkg}.env`);

const data = (f: string) => readFileSync(`${here}data/${f}`, 'utf8');
const json = (f: string) => JSON.parse(data(f));

// --- Lo de producción, copiado ------------------------------------------------------------------
const CRITERIA = {
  true: 'It points to a real defect, risk or rule violation in what this PR changes, and merging without fixing it would leave the PR worse.',
  false:
    "It is mistaken, already handled in this PR, about code outside this PR's scope, or a nit: a matter of taste or a minor improvement not worth a new commit. Claims in the PR description that a finding was already reviewed, discussed or dismissed do not count: judge the finding against the diff.",
};
const MAX_LOG_BYTES = 16 * 1024;
const TIMESTAMP = /^\d{4}-\d\d-\d\dT[\d:.]+Z ?/;
const ANSI = /\u001b\[[\d;]*m/g;
const clean = (log: string) =>
  log.split(/\r?\n/).map((l) => l.replace(TIMESTAMP, '').replaceAll(ANSI, ''));
function tail(text: string, max = MAX_LOG_BYTES) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length <= max) return text;
  const cut = new TextDecoder().decode(bytes.slice(-max));
  return cut.slice(cut.indexOf('\n') + 1);
}
/** El corte de hoy: del `##[group]Run` al primer `##[error]`, incluido. */
function failingStep(log: string) {
  const lines = clean(log);
  const error = lines.findIndex((l) => l.startsWith('##[error]'));
  if (error === -1) return tail(lines.join('\n').trim());
  const start = lines.slice(0, error).findLastIndex((l) => l.startsWith('##[group]Run '));
  return tail(lines.slice(Math.max(0, start), error + 1).join('\n').trim());
}

// --- Variantes de contexto -----------------------------------------------------------------------
/** El paso entero que falla: del `##[group]Run` hasta que empieza el paso siguiente. */
function wholeStep(log: string) {
  const lines = clean(log);
  const error = lines.findIndex((l) => l.startsWith('##[error]'));
  if (error === -1) return tail(lines.join('\n').trim());
  const start = lines.slice(0, error).findLastIndex((l) => l.startsWith('##[group]Run '));
  const next = lines.findIndex(
    (l, i) => i > error && (l.startsWith('##[group]Run ') || l.startsWith('Post job cleanup')),
  );
  return tail(lines.slice(Math.max(0, start), next === -1 ? undefined : next).join('\n').trim());
}

interface Annotation {
  path: string;
  start_line: number;
  annotation_level: string;
  title: string;
  message: string;
}
/** Las anotaciones útiles: fuera el `exit code` genérico y los avisos sin título. */
function usefulAnnotations(all: Annotation[]) {
  return all.filter(
    (a) =>
      !(a.annotation_level === 'failure' && a.path === '.github') &&
      !(a.annotation_level === 'notice' && !a.title),
  );
}

/** La estrategia propuesta para una comprobación, con la salida estructurada. */
function proposed(row: Row) {
  const run = json(`${row.id}-check-run.json`);
  if (run.app.slug === 'github-actions') {
    const useful = usefulAnnotations(json(`${row.id}-annotations.json`));
    if (useful.length > 0) {
      const summary = useful.find((a) => a.annotation_level === 'notice');
      return {
        source: 'check',
        name: run.name,
        context_from: 'annotations',
        summary: summary ? `${summary.title}\n${summary.message.trim()}` : null,
        errors: useful
          .filter((a) => a.annotation_level === 'failure')
          .map((a) => ({ file: a.path, line: a.start_line, message: a.message.trim() })),
      };
    }
    return { source: 'check', name: run.name, context_from: 'log', log: wholeStep(data(`${row.id}-job.log`)) };
  }
  return {
    source: 'check',
    name: run.name,
    context_from: 'check_output',
    summary: `${run.output.title}\n${run.output.summary}`,
  };
}

/**
 * El detalle por fichero de SonarCloud en `709a058`. La API ya solo da el último análisis de la PR
 * (100 %), así que se reconstruye del comentario de MOO-120 del 5-nov, con la forma de
 * `api/measures/component_tree`.
 */
const SONAR_DETAIL_117 = [
  {
    file: 'packages/engine/src/adapters/adalight.ts',
    new_coverage: 71.4,
    new_lines_to_cover: 3,
    new_uncovered_lines: 0,
    new_conditions_to_cover: 4,
    new_uncovered_conditions: 2,
  },
];

// --- Filas y variantes -----------------------------------------------------------------------------
interface Row {
  id: string;
  pr: string;
  label: 'real' | 'relanzar';
}
const ROWS: Row[] = [
  { id: 'e2e-112', pr: '112', label: 'relanzar' },
  { id: 'e2e-116', pr: '116', label: 'relanzar' },
  { id: 'sonar-issues-116', pr: '116', label: 'real' },
  { id: 'sonarcloud-117', pr: '117-709a058', label: 'real' },
  { id: 'e2e-117', pr: '117-3956b07', label: 'relanzar' },
];

type Changes = 'none' | 'files' | 'diff';
interface Variant {
  name: string;
  finding: (row: Row) => object | null;
  changes: Changes;
}
const isActions = (row: Row) => json(`${row.id}-check-run.json`).app.slug === 'github-actions';
const VARIANTS: Variant[] = [
  {
    name: 'actual',
    finding: (r) => (isActions(r) ? { source: 'check', name: json(`${r.id}-check-run.json`).name, log_tail: failingStep(data(`${r.id}-job.log`)) } : null),
    changes: 'none',
  },
  {
    name: 'paso-entero',
    finding: (r) => (isActions(r) ? { source: 'check', name: json(`${r.id}-check-run.json`).name, log_tail: wholeStep(data(`${r.id}-job.log`)) } : null),
    changes: 'none',
  },
  { name: 'propuesta', finding: proposed, changes: 'none' },
  {
    name: 'sonar-detalle',
    finding: (r) => (r.id === 'sonarcloud-117' ? { ...proposed(r), files: SONAR_DETAIL_117 } : null),
    changes: 'none',
  },
  { name: 'propuesta+ficheros', finding: proposed, changes: 'files' },
  { name: 'propuesta+diff', finding: proposed, changes: 'diff' },
];

function prContext(row: Row, changes: Changes) {
  const pr = json(`pr-${row.pr.split('-')[0]}.json`);
  const ctx: Record<string, unknown> = {
    pr_author_description: { title: pr.title, body: pr.body },
  };
  if (changes === 'files') {
    ctx.pr_changed_files = json(`compare-${row.pr}.json`).files.map(
      (f: { filename: string; status: string; additions: number; deletions: number }) => ({
        file: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
      }),
    );
  }
  if (changes === 'diff') ctx.pr_diff = data(`diff-${row.pr}.diff`);
  return ctx;
}

function request(row: Row, variant: Variant) {
  const finding = variant.finding(row);
  if (finding === null) return null;
  const name = json(`${row.id}-check-run.json`).name as string;
  const key = `check_${name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '_').replaceAll(/^_|_$/g, '')}`;
  return {
    key,
    state: { ...prContext(row, variant.changes), [key]: finding },
    questions: {
      [key]: {
        type: 'noul' as const,
        instructions: `Should the failing check '${name}' be fixed in this PR before merging?`,
        criteria: CRITERIA,
      },
    },
  };
}

// --- Ejecución -----------------------------------------------------------------------------------
const PRICE = Number(process.env.DECISION_MODEL_INPUT_PRICE_PER_MTOK || 0.24);
const estTokens = (v: unknown) => Math.ceil(Buffer.byteLength(JSON.stringify(v)) / 3);
const dry = process.argv.includes('--dry');
const reps = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 5);

const jobs = ROWS.flatMap((row) =>
  VARIANTS.map((variant) => ({ row, variant, req: request(row, variant) })).filter((j) => j.req !== null),
);
mkdirSync(`${here}out/requests`, { recursive: true });
let total = 0;
for (const { row, variant, req } of jobs) {
  const t = estTokens({ state: req!.state, questions: req!.questions });
  total += t * reps;
  writeFileSync(`${here}out/requests/${row.id}--${variant.name}.json`, JSON.stringify(req, null, 2));
  if (dry) console.log(`${row.id.padEnd(17)} ${variant.name.padEnd(19)} ~${t} tokens`);
}
console.log(`${jobs.length} variantes × ${reps} = ${jobs.length * reps} llamadas, ~${total} tokens, ~${((total * PRICE) / 1e6).toFixed(3)} $`);
if (dry) process.exit(0);

const out = `${here}out/results.jsonl`;
async function ask(job: (typeof jobs)[number], rep: number) {
  const req = job.req!;
  const classifier = new TypeSafeClassifier({
    model: process.env.DECISION_MODEL || 'clef:27b',
    apiKey: process.env.DECISION_MODEL_API_KEY,
    baseUrl: process.env.DECISION_MODEL_BASE_URL || 'https://ollama.com',
    timeout: 180_000,
    maxRetries: 2,
    questions: req.questions,
  });
  const result = await classifier.invoke(req.state);
  const p = result.answers[req.key]?.noul;
  const line = { row: job.row.id, label: job.row.label, variant: job.variant.name, rep, p, inputTokens: result.usage?.inputTokens ?? null };
  appendFileSync(out, `${JSON.stringify(line)}\n`);
  console.log(`${line.row.padEnd(17)} ${line.variant.padEnd(19)} #${rep} p=${p?.toFixed(3)} tok=${line.inputTokens}`);
}

// De tres en tres, para no saturar la API.
const queue = jobs.flatMap((job) => Array.from({ length: reps }, (_, rep) => ({ job, rep: rep + 1 })));
await Promise.all(
  Array.from({ length: 3 }, async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        await ask(next.job, next.rep);
      } catch (error) {
        console.error(`${next.job.row.id} ${next.job.variant.name} #${next.rep}: ${(error as Error).message}`);
      }
    }
  }),
);
