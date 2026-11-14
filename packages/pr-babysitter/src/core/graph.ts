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
 * Pedir la revisión (change pr-review-request, decisión 2) es también un nodo propio, después del
 * aviso de comprobaciones terminadas, por lo mismo: en la espera, se pediría en cada vuelta.
 *
 * Antes del aviso final, si la PR necesita intervención con hallazgos, se trían en modo sombra
 * (change pr-shadow-triage, decisión 1): ya están todos los del push. `triar` es el único nodo que
 * lee GitHub, y solo para esas PR (decisión 2, que matiza D73). Reparte las preguntas con un
 * *fan-out* de `Send` (change pr-check-triage, decisión 4): una rama `preguntarModelo` por hallazgo,
 * todas a la vez, y `reunirTriaje` junta las respuestas y clasifica. El resultado se queda en el
 * estado del hilo, y en la traza, sin cambiar el aviso. Después, `publicarResumen` lo publica en la
 * PR, un comentario por push (decisión 7).
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
  ReducedValue,
  Send,
  START,
  StateGraph,
  StateSchema,
} from '@langchain/langgraph';
import * as z from 'zod';

import { checksFinishedNotice, finalNotice, trackingNotice } from './notice.ts';
import {
  type DecisionModel,
  DecisionModelError,
  type Findings,
  GitHubRequestRejectedError,
  type Notifier,
  type ReviewRequests,
  type TriageSummaries,
} from './ports.ts';
import { type PullRequestSnapshot, pullRequestSnapshotSchema } from './pull-request.ts';
import {
  afterChecksWait,
  afterReviewWait,
  type ChecksStep,
  finalState,
  needsReviewRequest,
  needsTriage,
  type ReviewStep,
  type TrackedPush,
} from './tracking.ts';
import {
  classify,
  type Finding,
  findingSchema,
  hasContext,
  latestRound,
  type PullRequestContext,
  type RoundAnswer,
  roundAnswerSchema,
  spend,
  type TriageBudget,
  verdictSchema,
  withinBudget,
} from './triage.ts';
import { triageSummary } from './triage-summary.ts';

const TrackingState = new StateSchema({
  /** La última foto de la PR que ha recibido el hilo. */
  snapshot: pullRequestSnapshotSchema,
  /**
   * El push que se sigue, y desde cuándo cuentan las esperas de comprobaciones y revisión. Lo fija
   * el aviso de seguimiento.
   */
  push: z
    .object({ sha: z.string(), seenAt: z.number(), reviewSince: z.number().optional() })
    .optional(),
  /**
   * Entrada opcional: la ejecución empieza sin el aviso de seguimiento, porque el driver ya ha
   * avisado de que la reanuda (change pr-stop, decisión 2). Vale solo para esa ejecución.
   */
  silent: z.boolean().optional(),
  /**
   * Lo gastado en el triaje de la PR, en dólares, entre todos sus pushes (change pr-shadow-triage,
   * decisión 6). Se pierde al reiniciar, como el resto del estado, hasta BE7.
   */
  spentUsd: z.number().optional(),
  /**
   * El triaje en curso (change pr-check-triage, decisión 4): su ronda, un número que crece con cada
   * triaje del hilo, la PR y los hallazgos del push. Lo deja `triar` para repartir las preguntas.
   */
  triageRound: z
    .object({
      number: z.number().int(),
      pr: z.object({ title: z.string(), description: z.string() }),
      findings: z.array(findingSchema),
    })
    .optional(),
  /**
   * Las respuestas de la ronda en curso: las que `triar` decide sin el modelo y la de cada rama
   * `preguntarModelo`. El reductor las junta y tira las de rondas anteriores.
   */
  triageAnswers: new ReducedValue(z.array(roundAnswerSchema).default(() => []), {
    reducer: latestRound,
  }),
  /**
   * El último triaje: de qué push, cada hallazgo con su clase y su porqué, y lo que costó (BE4,
   * BE8). Va en la salida del nodo `reunirTriaje`, que LangSmith guarda en la traza.
   */
  triage: z
    .object({
      sha: z.string(),
      findings: z.array(z.object({ finding: findingSchema, verdict: verdictSchema })),
      inputTokens: z.number(),
      costUsd: z.number(),
    })
    .optional(),
});

type State = typeof TrackingState.State;

/** Lo que el hilo pide al driver cuando se para a esperar (lo devuelve `getState`). */
export interface TrackingWait {
  waitingFor: 'checks' | 'review';
}

/** Lo que el grafo necesita de fuera. */
export interface TrackingPorts {
  notifier: Notifier;
  reviewRequests: ReviewRequests;
  findings: Findings;
  decisionModel: DecisionModel;
  summaries: TriageSummaries;
}

export interface TrackingOptions {
  /**
   * Cuánto se espera a las comprobaciones, desde que se ve un push, y a la revisión, desde que
   * pasan (change pr-review-request, decisión 5).
   */
  timeoutMs: number;
  /**
   * Una línea por petición de revisión o resumen del triaje que GitHub rechaza, o por hallazgo sin
   * respuesta del modelo, para el log de errores.
   */
  log: (line: string) => void;
  /** El umbral de real y el tope de gasto de cada PR (change pr-shadow-triage, decisiones 4 y 6). */
  triage: { threshold: number; budget: TriageBudget };
}

/**
 * El nodo que pide la revisión. El driver lo nombra para no entrar en él al terminar la parada de
 * una PR (change pr-stop, decisión 3): pedirla no es terminar lo que estaba en curso.
 */
export const REVIEW_REQUEST_NODE = 'pedirRevision';

const TRIAGE_NODE = 'triar';

const ASK_NODE = 'preguntarModelo';

const GATHER_NODE = 'reunirTriaje';

/** Lo que recibe una rama `preguntarModelo` en su `Send`: un hallazgo de una ronda, y la PR. */
interface AskInput {
  round: number;
  index: number;
  pr: PullRequestContext;
  finding: Finding;
}

/** Las respuestas de una ronda entre las que guarda el hilo. */
function answersOf(round: number, answers: RoundAnswer[]): RoundAnswer[] {
  return answers.filter((answer) => answer.round === round);
}

/**
 * Tras `triar`, una rama `preguntarModelo` por cada hallazgo que aún no tiene respuesta, todas a la
 * vez. Sin ninguno (todo sin contexto o fuera del tope), directo a `reunirTriaje`: sin ningún
 * `Send`, el grafo no tendría nodo siguiente.
 */
function fanOut({ triageRound, triageAnswers }: State): Send[] | typeof GATHER_NODE {
  if (!triageRound) return GATHER_NODE;
  const { number: round, pr, findings } = triageRound;
  const decided = new Set(answersOf(round, triageAnswers).map(({ index }) => index));
  const sends = findings.flatMap((finding, index) =>
    decided.has(index)
      ? []
      : [new Send(ASK_NODE, { round, index, pr, finding } satisfies AskInput)],
  );
  return sends.length > 0 ? sends : GATHER_NODE;
}

const SUMMARY_NODE = 'publicarResumen';

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
  checksFailed: 'avisarEstadoFinal',
  timedOut: 'avisarEstadoFinal',
} as const satisfies Record<ChecksStep, string>;

const AFTER_REVIEW = {
  waiting: 'esperarRevisor',
  finished: 'avisarEstadoFinal',
  timedOut: 'avisarEstadoFinal',
  newPush: 'esperarComprobaciones',
} as const satisfies Record<ReviewStep, string>;

type AfterChecks = (typeof AFTER_CHECKS)[ChecksStep] | typeof TRIAGE_NODE;
type AfterReview = (typeof AFTER_REVIEW)[ReviewStep] | typeof TRIAGE_NODE;

/** El push que se sigue; antes del primer aviso de seguimiento, el de la foto. */
function pushIn({ push, snapshot }: State): TrackedPush {
  return push ?? { sha: snapshot.headSha, seenAt: snapshot.observedAt };
}

/** Camino del aviso final: antes, el triaje, si necesita intervención con hallazgos. */
function viaTriage<Node extends string>(
  node: Node,
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
): Node | typeof TRIAGE_NODE {
  if (node !== 'avisarEstadoFinal') return node;
  return needsTriage(finalState(snapshot, push)) ? TRIAGE_NODE : node;
}

/** Para a esperar al driver y valida la foto con la que reanuda. */
function waitFor(waitingFor: TrackingWait['waitingFor']) {
  const resumed: unknown = interrupt({ waitingFor } satisfies TrackingWait);
  return pullRequestSnapshotSchema.parse(resumed);
}

export function createTrackingGraph(
  { notifier, reviewRequests, findings, decisionModel, summaries }: TrackingPorts,
  checkpointer: BaseCheckpointSaver,
  { timeoutMs, log, triage }: TrackingOptions,
) {
  const avisarSeguimiento: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(trackingNotice(snapshot));
    return { push: { sha: snapshot.headSha, seenAt: snapshot.observedAt } };
  };

  // Como `avisarSeguimiento`, pero sin aviso. Apaga `silent` para que no pase a la ejecución
  // siguiente del mismo hilo.
  const empezarSinAviso: GraphNode<typeof TrackingState> = ({ snapshot }) => ({
    push: { sha: snapshot.headSha, seenAt: snapshot.observedAt },
    silent: false,
  });

  const esperarComprobaciones: GraphNode<{
    InputSchema: typeof TrackingState;
    Nodes: AfterChecks;
  }> = (state) => {
    const snapshot = waitFor('checks');
    const { push, next } = afterChecksWait(pushIn(state), snapshot, timeoutMs);
    const goto = viaTriage(AFTER_CHECKS[next], snapshot, push);
    return new Command({ update: { snapshot, push }, goto });
  };

  const avisarComprobaciones: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    await notifier.notify(checksFinishedNotice(snapshot));
    return {};
  };

  // Si GitHub la rechaza (p. ej. el token no tiene permiso), reintentarla no la arregla, y la PR se
  // quedaría sin avisos: se sigue a la espera, y su tiempo avisa al mantenedor (decisión 6).
  // Cualquier otro fallo lanza, y el nodo queda pendiente para la vuelta siguiente.
  const pedirRevision: GraphNode<typeof TrackingState> = async ({ snapshot }) => {
    try {
      await reviewRequests.request(snapshot.number, snapshot.headSha);
    } catch (error) {
      if (!(error instanceof GitHubRequestRejectedError)) throw error;
      log(
        `GitHub rechaza la petición de revisión de la PR #${snapshot.number}; ` +
          `se espera al revisor: ${error.message}`,
      );
    }
    return {};
  };

  const esperarRevisor: GraphNode<{ InputSchema: typeof TrackingState; Nodes: AfterReview }> = (
    state,
  ) => {
    const snapshot = waitFor('review');
    const { push, next } = afterReviewWait(pushIn(state), snapshot, timeoutMs);
    const goto = viaTriage(AFTER_REVIEW[next], snapshot, push);
    return new Command({ update: { snapshot, push }, goto });
  };

  // Lee los hallazgos del push y reparte las preguntas (change pr-check-triage, decisiones 4 y 5).
  // Decide sin el modelo lo que puede: un hallazgo sin contexto, o que no cabe en lo que queda del
  // tope, que se reserva aquí, antes de repartir. Los demás salen cada uno por su rama. Si GitHub
  // falla al leerlos, lanza, y el nodo queda pendiente para la vuelta siguiente.
  const triar: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot } = state;
    const final = finalState(snapshot, pushIn(state));
    const failedChecks =
      final.status === 'needsIntervention'
        ? final.reasons.flatMap((reason) => (reason.kind === 'checksFailed' ? reason.checks : []))
        : [];
    const read = await findings.read(snapshot.number, snapshot.headSha, failedChecks);
    const { overBudget } = withinBudget(
      read.findings.filter(hasContext),
      state.spentUsd ?? 0,
      triage.budget,
      (finding) => decisionModel.estimate(read.context, finding),
    );
    const round = (state.triageRound?.number ?? 0) + 1;
    const decided = read.findings.flatMap((finding, index): RoundAnswer[] => {
      if (!hasContext(finding)) return [{ round, index, answer: { kind: 'noContext' }, inputTokens: 0 }];
      if (overBudget.includes(finding)) {
        return [{ round, index, answer: { kind: 'overBudget' }, inputTokens: 0 }];
      }
      return [];
    });
    return {
      triageRound: { number: round, pr: read.context, findings: read.findings },
      triageAnswers: decided,
    };
  };

  // Pregunta al modelo por un hallazgo (decisión 4). No lanza nunca: si lanzara, fallaría el paso
  // entero y con él las demás ramas. Si el modelo no responde, ese hallazgo exige criterio, y lo
  // que ya ha cobrado antes de fallar también es gasto de la PR.
  const preguntarModelo = async ({ round, index, pr, finding }: AskInput) => {
    try {
      const { probability, inputTokens } = await decisionModel.ask(pr, finding);
      const answered: RoundAnswer = {
        round,
        index,
        answer: { kind: 'answered', probability },
        inputTokens,
      };
      return { triageAnswers: [answered] };
    } catch (error) {
      log(
        `El modelo de decisión no ha respondido sobre un hallazgo; exige criterio: ` +
          (error instanceof Error ? error.message : String(error)),
      );
      const failed: RoundAnswer = {
        round,
        index,
        answer: { kind: 'modelUnavailable' },
        inputTokens: error instanceof DecisionModelError ? error.inputTokens : 0,
      };
      return { triageAnswers: [failed] };
    }
  };

  // Junta las respuestas de la ronda, clasifica cada hallazgo y suma el gasto (decisiones 4 y 5):
  // un proveedor caído no deja la PR sin aviso, porque el aviso final sale igual.
  const reunirTriaje: GraphNode<typeof TrackingState> = (state) => {
    const { snapshot, triageRound } = state;
    if (!triageRound) return {};
    const answers = answersOf(triageRound.number, state.triageAnswers);
    const inputTokens = answers.reduce((tokens, answer) => tokens + answer.inputTokens, 0);
    const spentBefore = state.spentUsd ?? 0;
    const spentUsd = spend(spentBefore, inputTokens, triage.budget);
    return {
      spentUsd,
      triage: {
        sha: snapshot.headSha,
        findings: triageRound.findings.map((finding, index) => ({
          finding,
          verdict: classify(
            finding,
            answers.find((answer) => answer.index === index)?.answer ?? { kind: 'modelUnavailable' },
            triage.threshold,
          ),
        })),
        inputTokens,
        costUsd: spentUsd - spentBefore,
      },
    };
  };

  // Publica en la PR el triaje del push (decisión 7), una vez: si ya está el de ese SHA (un
  // reintento tras una respuesta que no llegó), no lo repite. Si GitHub lo rechaza, queda en el log
  // y el aviso final sale igual (decisión 8); otro fallo deja el nodo pendiente, y el reintento no
  // vuelve a triar. Sin hallazgos no hay nada que contar.
  const publicarResumen: GraphNode<typeof TrackingState> = async ({ snapshot, triage: triaged }) => {
    if (!triaged || triaged.findings.length === 0) return {};
    if (await summaries.published(snapshot.number, triaged.sha)) return {};
    try {
      const text = triageSummary(triaged, triage.threshold);
      await summaries.publish(snapshot.number, triaged.sha, text);
    } catch (error) {
      if (!(error instanceof GitHubRequestRejectedError)) throw error;
      log(
        `GitHub rechaza el resumen del triaje de la PR #${snapshot.number}; ` +
          `se avisa igual: ${error.message}`,
      );
    }
    return {};
  };

  const avisarEstadoFinal: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot } = state;
    await notifier.notify(finalNotice(snapshot, finalState(snapshot, pushIn(state))));
    return {};
  };

  return new StateGraph(TrackingState)
    .addNode('avisarSeguimiento', avisarSeguimiento)
    .addNode('empezarSinAviso', empezarSinAviso)
    .addNode('esperarComprobaciones', esperarComprobaciones, {
      ends: [...Object.values(AFTER_CHECKS), TRIAGE_NODE],
    })
    .addNode('avisarComprobaciones', avisarComprobaciones)
    .addNode(REVIEW_REQUEST_NODE, pedirRevision)
    .addNode('esperarRevisor', esperarRevisor, {
      ends: [...Object.values(AFTER_REVIEW), TRIAGE_NODE],
    })
    .addNode(TRIAGE_NODE, triar)
    .addNode(ASK_NODE, preguntarModelo)
    .addNode(GATHER_NODE, reunirTriaje)
    .addNode(SUMMARY_NODE, publicarResumen)
    .addNode('avisarEstadoFinal', avisarEstadoFinal)
    .addConditionalEdges(
      START,
      ({ silent }) => (silent ? 'empezarSinAviso' : 'avisarSeguimiento'),
      ['avisarSeguimiento', 'empezarSinAviso'],
    )
    .addEdge('avisarSeguimiento', 'esperarComprobaciones')
    .addEdge('empezarSinAviso', 'esperarComprobaciones')
    // Siempre a esperar, aunque el revisor ya haya terminado: si el aviso se reintenta tras un
    // fallo del canal, su foto puede ser de un push anterior, y la siguiente lo dirá. Antes, se
    // pide la revisión si nadie la ha pedido ni empezado (decisión 3).
    .addConditionalEdges(
      'avisarComprobaciones',
      ({ snapshot }) => (needsReviewRequest(snapshot) ? REVIEW_REQUEST_NODE : 'esperarRevisor'),
      [REVIEW_REQUEST_NODE, 'esperarRevisor'],
    )
    .addEdge(REVIEW_REQUEST_NODE, 'esperarRevisor')
    .addConditionalEdges(TRIAGE_NODE, fanOut, [ASK_NODE, GATHER_NODE])
    .addEdge(ASK_NODE, GATHER_NODE)
    .addEdge(GATHER_NODE, SUMMARY_NODE)
    .addEdge(SUMMARY_NODE, 'avisarEstadoFinal')
    .addEdge('avisarEstadoFinal', END)
    .compile({ checkpointer });
}

export type TrackingGraph = ReturnType<typeof createTrackingGraph>;
