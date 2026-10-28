/**
 * El grafo del seguimiento para LangGraph Studio (MOO-87): solo para depurarlo en local con
 * `pnpm studio`, sin GitHub ni Linear. Cada hilo de Studio hace de una PR, y la foto con la que se
 * reanuda tras cada `interrupt()` se escribe a mano.
 *
 * Importa solo del núcleo y `main.ts` no lo importa: no es una segunda raíz de composición. No lee
 * el `.env`.
 */
import { MemorySaver } from '@langchain/langgraph';

import { createTrackingGraph } from './core/graph.ts';
import type { Notifier, ReviewRequests } from './core/ports.ts';

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

// El servidor de Studio cambia el checkpointer del grafo por el suyo en cada ejecución; este solo
// cumple la firma de `createTrackingGraph`.
export const graph = createTrackingGraph({ notifier, reviewRequests }, new MemorySaver(), {
  timeoutMs: TIMEOUT_MS,
  log: (line) => console.error(line),
});
