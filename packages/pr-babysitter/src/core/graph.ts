/**
 * El grafo del seguimiento de una PR (change pr-tracking, decisión 9, D65): un hilo por PR
 * (`thread_id` = su número) que el driver despierta en cada vuelta con `Command({ resume: foto })`.
 * El grafo no consulta GitHub: todo lo que sabe llega en la foto.
 *
 * Cada aviso va en su propio nodo, nunca en el que espera: al reanudar, LangGraph vuelve a ejecutar
 * desde el principio el nodo interrumpido, y un aviso antes del `interrupt()` se repetiría en cada
 * vuelta. Si el `Notifier` falla, el nodo del aviso queda pendiente en el último checkpoint y el
 * driver lo reintenta (decisión 4).
 *
 * MOO-83 monta el aviso de seguimiento y la espera de las comprobaciones, que de momento no sale
 * nunca; la salida de la espera, los demás avisos y el revisor llegan con MOO-84.
 */
import {
  type BaseCheckpointSaver,
  type GraphNode,
  interrupt,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';

import { trackingNotice } from './notice.ts';
import type { Notifier } from './ports.ts';
import { pullRequestSnapshotSchema } from './pull-request.ts';

const TrackingState = new StateSchema({
  /** La última foto de la PR que ha recibido el hilo. */
  snapshot: pullRequestSnapshotSchema,
});

/** Lo que el hilo pide al driver cuando se para a esperar (lo devuelve `getState`). */
export interface TrackingWait {
  waitingFor: 'checks';
}

/** La configuración del hilo de una PR. */
export function threadConfig(pullRequestNumber: number) {
  return { configurable: { thread_id: String(pullRequestNumber) } };
}

export function createTrackingGraph(notifier: Notifier, checkpointer: BaseCheckpointSaver) {
  const avisarSeguimiento: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(trackingNotice(snapshot));
    return {};
  };

  const esperarComprobaciones: GraphNode<typeof TrackingState> = () => {
    const resumed: unknown = interrupt({ waitingFor: 'checks' } satisfies TrackingWait);
    return { snapshot: pullRequestSnapshotSchema.parse(resumed) };
  };

  return new StateGraph(TrackingState)
    .addNode('avisarSeguimiento', avisarSeguimiento)
    .addNode('esperarComprobaciones', esperarComprobaciones)
    .addEdge(START, 'avisarSeguimiento')
    .addEdge('avisarSeguimiento', 'esperarComprobaciones')
    .addEdge('esperarComprobaciones', 'esperarComprobaciones')
    .compile({ checkpointer });
}

export type TrackingGraph = ReturnType<typeof createTrackingGraph>;
