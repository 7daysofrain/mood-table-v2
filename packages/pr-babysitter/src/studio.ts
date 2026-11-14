/**
 * El grafo del seguimiento para LangGraph Studio (MOO-87): solo para depurarlo en local con
 * `pnpm studio`, sin GitHub, Linear ni modelo de decisión. Cada hilo de Studio hace de una PR, y la foto con la que se
 * reanuda tras cada `interrupt()` se escribe a mano.
 *
 * Importa solo del núcleo y `main.ts` no lo importa: no es una segunda raíz de composición. No lee
 * el `.env`.
 */
import { setTimeout as sleep } from 'node:timers/promises';

import { MemorySaver } from '@langchain/langgraph';

import { createTrackingGraph } from './core/graph.ts';
import type {
  DecisionModel,
  Findings,
  Notifier,
  ReviewRequests,
  TriageSummaries,
} from './core/ports.ts';
import type { CheckContext } from './core/triage.ts';

/** El tiempo de espera por defecto del contenedor (`TRACKING_TIMEOUT_MINUTES`). */
const TIMEOUT_MS = 30 * 60_000;

/** En lugar de publicar en Linear, escribe el aviso en el log del servidor de Studio. */
const notifier: Notifier = {
  notify(notice) {
    console.log(`Aviso: ${JSON.stringify(notice)}`);
    return Promise.resolve();
  },
};

/**
 * En lugar de comentar en GitHub, escribe la petición en el log. Si ya se ha pedido lo dice la foto
 * (`reviewRequested`), así que el grafo no lo pregunta.
 */
const reviewRequests: ReviewRequests = {
  requested: () => Promise.resolve(false),
  request(pullRequestNumber, sha) {
    console.log(`Petición de revisión: PR #${pullRequestNumber}, push ${sha}`);
    return Promise.resolve();
  },
};

/**
 * En lugar de leer GitHub, da un hallazgo de cada fuente: un comentario del revisor y cada
 * comprobación que falla, con su contexto inventado, cada una con un origen distinto.
 */
const CHECK_CONTEXTS: CheckContext[] = [
  {
    state: 'available',
    origin: 'annotations',
    summary: 'Resumen de ejemplo\n  1 failed',
    errors: [{ file: 'e2e/ejemplo.spec.ts', line: 1, title: 'Un test', message: 'Error de ejemplo' }],
    truncated: false,
  },
  {
    state: 'available',
    origin: 'log',
    summary: '##[group]Run pnpm test\n##[error]Error de ejemplo',
    errors: [],
    truncated: true,
  },
  {
    state: 'available',
    origin: 'appSummary',
    summary: 'Quality Gate failed\n\nResumen de ejemplo',
    errors: [],
    truncated: false,
  },
  { state: 'notProvided' },
  { state: 'unreadable' },
];

const findings: Findings = {
  read(pullRequestNumber, sha, failedChecks) {
    console.log(`Hallazgos: PR #${pullRequestNumber}, push ${sha}`);
    return Promise.resolve({
      context: { title: `PR #${pullRequestNumber}`, description: '' },
      findings: [
        {
          source: 'reviewer',
          reviewer: 'Codex',
          badge: 'P2',
          severity: 'normal',
          file: 'src/core/graph.ts',
          line: 1,
          title: 'Un hallazgo de ejemplo',
          text: 'Escrito por studio.ts.',
          diffHunk: '@@ -1 +1 @@',
        },
        ...failedChecks.map((name, i) => ({
          source: 'check' as const,
          name,
          conclusion: 'failure',
          context: CHECK_CONTEXTS[i % CHECK_CONTEXTS.length] ?? { state: 'notProvided' as const },
        })),
      ],
    });
  },
};

/**
 * En lugar de preguntar al modelo, tarda un segundo y da una probabilidad distinta por fuente, para
 * ver las ramas `preguntarModelo` en paralelo y las tres clases: el comentario del revisor sale
 * real (0,90); las comprobaciones, por turnos, no aplica (0,10) y exige criterio (0,50).
 */
const CHECK_PROBABILITIES = [0.1, 0.5];
let checksAsked = 0;

const decisionModel: DecisionModel = {
  estimate: () => 0,
  async ask(_pr, finding) {
    await sleep(1000);
    if (finding.source === 'reviewer') return { probability: 0.9, inputTokens: 0 };
    const probability = CHECK_PROBABILITIES[checksAsked % CHECK_PROBABILITIES.length] ?? 0.5;
    checksAsked += 1;
    return { probability, inputTokens: 0 };
  },
};

/** En lugar de comentar en la PR, escribe el resumen en la consola. */
const summaries: TriageSummaries = {
  published: () => Promise.resolve(false),
  publish(pullRequestNumber, sha, text) {
    console.log(`Resumen del triaje: PR #${pullRequestNumber}, push ${sha}\n${text}`);
    return Promise.resolve();
  },
};

// El servidor de Studio cambia el checkpointer del grafo por el suyo en cada ejecución; este solo
// cumple la firma de `createTrackingGraph`.
export const graph = createTrackingGraph(
  { notifier, reviewRequests, findings, decisionModel, summaries },
  new MemorySaver(),
  {
    timeoutMs: TIMEOUT_MS,
    log: (line) => console.error(line),
    triage: { threshold: 0.8, budget: { capUsd: 0.05, inputPricePerMTok: 0.24 } },
  },
);
