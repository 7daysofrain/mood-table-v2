/**
 * El grafo del seguimiento para LangGraph Studio (MOO-87): solo para depurarlo en local con
 * `pnpm studio`, sin GitHub, Linear ni modelo de decisión. Cada hilo de Studio hace de una PR, y la foto con la que se
 * reanuda tras cada `interrupt()` se escribe a mano.
 *
 * Importa solo del núcleo y `main.ts` no lo importa: no es una segunda raíz de composición. No lee
 * el `.env`.
 */
import { MemorySaver } from '@langchain/langgraph';

import { createTrackingGraph } from './core/graph.ts';
import type { Findings, Notifier, ReviewRequests, Triager } from './core/ports.ts';

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
 * comprobación que falla, con su contexto inventado.
 */
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
        ...failedChecks.map((name) => ({ source: 'check' as const, name, log: 'Error de ejemplo' })),
      ],
    });
  },
};

/** En lugar de preguntar al modelo, da 0,5 a cada hallazgo: todos exigen criterio. */
const triager: Triager = {
  triage(_context, asked) {
    return Promise.resolve({ probabilities: asked.map(() => 0.5), inputTokens: 0 });
  },
};

// El servidor de Studio cambia el checkpointer del grafo por el suyo en cada ejecución; este solo
// cumple la firma de `createTrackingGraph`.
export const graph = createTrackingGraph(
  { notifier, reviewRequests, findings, triager },
  new MemorySaver(),
  {
    timeoutMs: TIMEOUT_MS,
    log: (line) => console.error(line),
    triage: { threshold: 0.8, budget: { capUsd: 0.05, inputPricePerMTok: 0.24 } },
  },
);
