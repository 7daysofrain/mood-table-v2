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
  CheckReruns,
  DecisionModel,
  Findings,
  Notifier,
  ReviewRequests,
  TriageSummaries,
} from './core/ports.ts';
import type { CheckContext } from './core/triage.ts';

/** El tiempo de espera por defecto del contenedor (`TRACKING_TIMEOUT_MINUTES`). */
const TIMEOUT_MS = 30 * 60_000;
/** El margen por defecto de las que no van a ejecutarse (`TRACKING_NOT_RUN_MARGIN_SECONDS`). */
const NOT_RUN_MARGIN_MS = 120_000;

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
      // Con descripción: sin ella, el comentario del revisor exigiría criterio por regla.
      context: { title: `PR #${pullRequestNumber}`, description: 'La PR de ejemplo de studio.ts.' },
      // Sin incidencias de SonarQube: cada comprobación es un hallazgo.
      sonarIssues: null,
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
          earlierPush: null,
        },
        // Un hilo sin resolver de un push anterior: lleva la pregunta «ya arreglado» (change
        // pr-unresolved-threads, decisión 3).
        {
          source: 'reviewer',
          reviewer: 'Codex',
          badge: 'P2',
          severity: 'normal',
          file: 'src/core/tracking.ts',
          line: 2,
          title: 'Un hallazgo de ejemplo de un push anterior',
          text: 'Escrito por studio.ts.',
          diffHunk: '@@ -2 +2 @@',
          earlierPush: { sha: '0000000000000000000000000000000000000000', code: '>>    2 | ejemplo' },
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
  // El primer fallo de una relanzable (change pr-first-failure-triage, decisión 2): solo esas
  // comprobaciones, con el error de una aserción en su log.
  readChecks(pullRequestNumber, sha, checks) {
    console.log(`Comprobaciones del primer fallo: PR #${pullRequestNumber}, push ${sha}`);
    return Promise.resolve({
      context: { title: `PR #${pullRequestNumber}`, description: 'La PR de ejemplo de studio.ts.' },
      findings: checks.map((name) => ({
        source: 'check' as const,
        name,
        conclusion: 'failure',
        attempt: 1,
        context: CHECK_CONTEXTS[0] ?? { state: 'notProvided' as const },
      })),
    });
  },
};

/**
 * En lugar de preguntar al modelo, tarda un segundo y da una respuesta distinta por fuente, para ver
 * las ramas `preguntarModelo` en paralelo y las tres clases: el comentario del revisor es de otra
 * tarea (P1 0,10 y P2 0,90), así que no aplica y el resumen dice que se capturaría; el de un push
 * anterior ya está arreglado (0,91), así que no aplica; las comprobaciones, por turnos, real (0,90)
 * y exige criterio (0,50). El primer fallo de una relanzable no lo causa la PR (0,12): se relanza y
 * el resumen dice que se capturaría (change pr-first-failure-triage).
 */
const CHECK_PROBABILITIES = [0.9, 0.5];
let checksAsked = 0;

const decisionModel: DecisionModel = {
  estimate: () => 0,
  async ask(_pr, finding, question) {
    await sleep(1000);
    if (question === 'fixedScope') {
      return { answer: { kind: 'fixedScope', fixed: 0.91, inside: 0.5, outside: 0.2 }, inputTokens: 0 };
    }
    if (finding.source === 'reviewer') {
      return { answer: { kind: 'scope', inside: 0.1, outside: 0.9 }, inputTokens: 0 };
    }
    if (finding.source === 'check' && finding.attempt === 1) {
      return { answer: { kind: 'answered', probability: 0.12 }, inputTokens: 0 };
    }
    const probability = CHECK_PROBABILITIES[checksAsked % CHECK_PROBABILITIES.length] ?? 0.5;
    checksAsked += 1;
    return { answer: { kind: 'answered', probability }, inputTokens: 0 };
  },
};

/** En lugar de relanzar en GitHub, escribe en el log qué run se relanzaría (change pr-check-rerun). */
const checkReruns: CheckReruns = {
  rerun(runId) {
    console.log(`Relanzamiento: run ${runId}`);
    return Promise.resolve();
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
  { notifier, reviewRequests, findings, decisionModel, summaries, checkReruns },
  new MemorySaver(),
  {
    timeoutMs: TIMEOUT_MS,
    // La lista por defecto del contenedor (`RERUN_CHECKS`).
    rerunChecks: ['test', 'e2e'],
    notRunMarginMs: NOT_RUN_MARGIN_MS,
    log: (line) => console.error(line),
    triage: {
      threshold: 0.8,
      budget: { capUsd: 0.05, inputPricePerMTok: 0.24 },
      // La lista por defecto del contenedor (`TRIAGE_RULE_CHECKS`).
      ruleChecks: ['lint', 'typecheck', 'SonarCloud Code Analysis'],
      // Ninguna: las comprobaciones de ejemplo se preguntan todas por la causa.
      sonarIssuesCheck: '',
    },
  },
);
