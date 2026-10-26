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
 * Qué toca después de cada espera lo deciden las reglas puras de `tracking.ts`; aquí solo se
 * traduce cada paso a su nodo. Las esperas devuelven un `Command`, porque a la vez guardan la foto
 * y eligen el nodo siguiente. Al avisar del estado final, el hilo termina; un push nuevo lo vuelve
 * a empezar (el driver), con el estado que ya tenía.
 */
import {
  type BaseCheckpointSaver,
  Command,
  END,
  type GraphNode,
  interrupt,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';
import * as z from 'zod';

import { checksFinishedNotice, finalNotice, trackingNotice } from './notice.ts';
import type { Notifier } from './ports.ts';
import { type PullRequestSnapshot, pullRequestSnapshotSchema } from './pull-request.ts';
import {
  afterChecksWait,
  afterReviewWait,
  type ChecksStep,
  finalState,
  type ReviewStep,
  type TrackedPush,
} from './tracking.ts';

const TrackingState = new StateSchema({
  /** La última foto de la PR que ha recibido el hilo. */
  snapshot: pullRequestSnapshotSchema,
  /** El push que se sigue, y desde cuándo cuenta la espera. Lo fija el aviso de seguimiento. */
  push: z.object({ sha: z.string(), seenAt: z.number() }).optional(),
});

type State = typeof TrackingState.State;

/** Lo que el hilo pide al driver cuando se para a esperar (lo devuelve `getState`). */
export interface TrackingWait {
  waitingFor: 'checks' | 'review';
}

export interface TrackingOptions {
  /** Cuánto se espera, desde que se ve un push, a comprobaciones y revisión (decisión 8). */
  timeoutMs: number;
}

/** La última foto que guarda un hilo, validada: `getState` da sus valores sin tipo. */
export function lastSnapshot(values: unknown): PullRequestSnapshot {
  return z.object({ snapshot: pullRequestSnapshotSchema }).parse(values).snapshot;
}

/** La configuración del hilo de una PR. */
export function threadConfig(pullRequestNumber: number) {
  return { configurable: { thread_id: String(pullRequestNumber) } };
}

const AFTER_CHECKS = {
  waiting: 'esperarComprobaciones',
  checksFinished: 'avisarComprobaciones',
  timedOut: 'avisarEstadoFinal',
} as const satisfies Record<ChecksStep, string>;

const AFTER_REVIEW = {
  waiting: 'esperarRevisor',
  finished: 'avisarEstadoFinal',
  timedOut: 'avisarEstadoFinal',
  newPush: 'esperarComprobaciones',
} as const satisfies Record<ReviewStep, string>;

type AfterChecks = (typeof AFTER_CHECKS)[ChecksStep];
type AfterReview = (typeof AFTER_REVIEW)[ReviewStep];

/** El push que se sigue; antes del primer aviso de seguimiento, el de la foto. */
function pushIn({ push, snapshot }: State): TrackedPush {
  return push ?? { sha: snapshot.headSha, seenAt: snapshot.observedAt };
}

/** Para a esperar al driver y valida la foto con la que reanuda. */
function waitFor(waitingFor: TrackingWait['waitingFor']) {
  const resumed: unknown = interrupt({ waitingFor } satisfies TrackingWait);
  return pullRequestSnapshotSchema.parse(resumed);
}

export function createTrackingGraph(
  notifier: Notifier,
  checkpointer: BaseCheckpointSaver,
  { timeoutMs }: TrackingOptions,
) {
  const avisarSeguimiento: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(trackingNotice(snapshot));
    return { push: { sha: snapshot.headSha, seenAt: snapshot.observedAt } };
  };

  const esperarComprobaciones: GraphNode<{
    InputSchema: typeof TrackingState;
    Nodes: AfterChecks;
  }> = (state) => {
    const snapshot = waitFor('checks');
    const { push, next } = afterChecksWait(pushIn(state), snapshot, timeoutMs);
    return new Command({ update: { snapshot, push }, goto: AFTER_CHECKS[next] });
  };

  const avisarComprobaciones: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(checksFinishedNotice(snapshot));
    return {};
  };

  const esperarRevisor: GraphNode<{ InputSchema: typeof TrackingState; Nodes: AfterReview }> = (
    state,
  ) => {
    const snapshot = waitFor('review');
    const { push, next } = afterReviewWait(pushIn(state), snapshot, timeoutMs);
    return new Command({ update: { snapshot, push }, goto: AFTER_REVIEW[next] });
  };

  const avisarEstadoFinal: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(finalNotice(snapshot, finalState(snapshot)));
    return {};
  };

  return new StateGraph(TrackingState)
    .addNode('avisarSeguimiento', avisarSeguimiento)
    .addNode('esperarComprobaciones', esperarComprobaciones, {
      ends: Object.values(AFTER_CHECKS),
    })
    .addNode('avisarComprobaciones', avisarComprobaciones)
    .addNode('esperarRevisor', esperarRevisor, { ends: Object.values(AFTER_REVIEW) })
    .addNode('avisarEstadoFinal', avisarEstadoFinal)
    .addEdge(START, 'avisarSeguimiento')
    .addEdge('avisarSeguimiento', 'esperarComprobaciones')
    // Siempre a esperar, aunque el revisor ya haya terminado: si el aviso se reintenta tras un
    // fallo del canal, su foto puede ser de un push anterior, y la siguiente lo dirá.
    .addEdge('avisarComprobaciones', 'esperarRevisor')
    .addEdge('avisarEstadoFinal', END)
    .compile({ checkpointer });
}

export type TrackingGraph = ReturnType<typeof createTrackingGraph>;
