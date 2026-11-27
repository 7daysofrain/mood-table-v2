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
 * aviso de comprobaciones terminadas, por lo mismo: en la espera, se pediría en cada vuelta. Y
 * relanzar una comprobación que falla en su primer intento (change pr-check-rerun, decisión 4):
 * `relanzar` lo pide y vuelve a la espera de las comprobaciones.
 *
 * El triaje dice qué pasa y `decidir` qué se hace (change pr-first-failure-triage, decisión 1;
 * D122): tras cada ronda de triaje, `decidir` elige la acción por reglas, sin el modelo, y la deja en
 * el estado. Hay dos rondas: la del primer fallo de una relanzable, en cuanto termina su run, que
 * tría solo esas comprobaciones y acaba en `relanzar` o, si la PR causa el fallo, de vuelta en la
 * espera, sin relanzar; y la final, antes del aviso. Lo que responde la primera se guarda en el push
 * (`firstTriage`): no se vuelve a preguntar, y el resumen lo cuenta.
 *
 * Antes del aviso final, si la PR necesita intervención con hallazgos, se trían en modo sombra
 * (change pr-shadow-triage, decisión 1): ya están todos los del push. Si no hay nada que triar pero
 * el sistema relanzó algo que pasó, el aviso final va igual por `publicarResumen`, que lo cuenta
 * (change pr-check-rerun, decisión 8). `triar` es el único nodo que
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

import { type Decision, decide, decisionSchema, isFixable } from './decision.ts';
import {
  findingLabel,
  type FixReason,
  fixReasonSchema,
  type FixStatus,
  fixStatusSchema,
  type NotFixedItem,
  notFixedItemSchema,
  notFixedLine,
  unfixedItems,
} from './fix.ts';
import { checksFinishedNotice, finalNotice, notFixedNotice, trackingNotice } from './notice.ts';
import {
  type CheckReruns,
  type DecisionModel,
  DecisionModelError,
  type Findings,
  type Fixer,
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
  checksToRerun,
  finalState,
  firstFailureChecks,
  needsReviewRequest,
  needsTriage,
  rerunPassed,
  type ReviewStep,
  type TrackedPush,
  unfinishedReruns,
} from './tracking.ts';
import {
  classify,
  type Finding,
  findingSchema,
  firstTriageSchema,
  latestRound,
  type PullRequestContext,
  type Question,
  questionFor,
  type RoundAnswer,
  roundAnswerSchema,
  sonarIssueCountSchema,
  spend,
  type TriageBudget,
  triageRoundKindSchema,
  verdictSchema,
  withoutModel,
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
    .object({
      sha: z.string(),
      seenAt: z.number(),
      reviewSince: z.number().optional(),
      /** Cuándo pidió el sistema relanzar sus comprobaciones (change pr-check-rerun, decisión 3). */
      rerunSince: z.number().optional(),
      /** Las que fallaban en el run que relanzó (change pr-check-rerun, decisión 8). */
      rerunNames: z.array(z.string()).optional(),
      /** Las relanzables que GitHub no ha dejado relanzar (change pr-check-rerun, decisión 5). */
      rerunRejected: z.array(z.string()).optional(),
      /**
       * Desde cuándo la ve quieta: una falla y nada en cola ni en curso (change pr-checks-not-run,
       * decisión 2).
       */
      quietSince: z.number().optional(),
      /**
       * Lo que respondió el triaje del primer fallo de cada relanzable (change
       * pr-first-failure-triage, decisión 4).
       */
      firstTriage: firstTriageSchema.optional(),
      /**
       * Las relanzables que `decidir` no ha relanzado porque la PR causa el fallo (change
       * pr-first-failure-triage, decisión 9).
       */
      rerunSkipped: z.array(z.string()).optional(),
    })
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
      /** La del primer fallo de una relanzable o la final (change pr-first-failure-triage). */
      kind: triageRoundKindSchema,
      pr: z.object({ title: z.string(), description: z.string() }),
      findings: z.array(findingSchema),
      sonarIssues: sonarIssueCountSchema,
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
   * El último triaje: de qué push, cada hallazgo con su clase y su porqué, cuántas incidencias de
   * SonarQube trae la comprobación que las lista y cuántas se han triado, y lo que costó (BE4,
   * BE8). Va en la salida del nodo `reunirTriaje`, que LangSmith guarda en la traza.
   */
  triage: z
    .object({
      sha: z.string(),
      findings: z.array(z.object({ finding: findingSchema, verdict: verdictSchema })),
      sonarIssues: sonarIssueCountSchema,
      inputTokens: z.number(),
      costUsd: z.number(),
    })
    .optional(),
  /**
   * Qué ronda hará el próximo `triar`: lo escribe, en el mismo paso, cada nodo que lleva a él
   * (change pr-first-failure-triage, decisión 1).
   */
  nextTriage: triageRoundKindSchema.optional(),
  /**
   * Lo último que ha decidido `decidir`: la acción y la regla que la toma (change
   * pr-first-failure-triage, decisión 1). Va en la salida del nodo, que LangSmith guarda en la traza
   * (BE4).
   */
  decision: decisionSchema.optional(),
  /**
   * El arreglo del push (change pr-fixer, decisión 3): de qué push es, lo que se pide arreglar, lo
   * que queda del tope, lo que no se arregla (para avisar al subir), cuándo se pidió y en qué está el
   * trabajo. Lo deja `decidir` y lo completan `pedirArreglo` y `esperarArreglo`.
   */
  fix: z
    .object({
      sha: z.string(),
      findings: z.array(findingSchema),
      budgetUsd: z.number(),
      notFixed: z.array(notFixedItemSchema),
      requestedAt: z.number().optional(),
      status: fixStatusSchema.optional(),
    })
    .optional(),
  /**
   * Lo que el arreglo añade a los motivos del aviso final de un push (decisión 10): solo cuenta si
   * es del push del aviso.
   */
  fixReasons: z.object({ sha: z.string(), reasons: z.array(fixReasonSchema) }).optional(),
});

type State = typeof TrackingState.State;

/** Lo que el hilo pide al driver cuando se para a esperar (lo devuelve `getState`). */
export interface TrackingWait {
  waitingFor: 'checks' | 'review' | 'fix';
}

/** Lo que el grafo necesita de fuera. */
export interface TrackingPorts {
  notifier: Notifier;
  reviewRequests: ReviewRequests;
  findings: Findings;
  decisionModel: DecisionModel;
  summaries: TriageSummaries;
  checkReruns: CheckReruns;
  /** El que arregla (change pr-fixer). Sin él, el sistema no arregla nada, como antes. */
  fixer?: Fixer;
}

export interface TrackingOptions {
  /**
   * Cuánto se espera a las comprobaciones, desde que se ve un push, y a la revisión, desde que
   * pasan (change pr-review-request, decisión 5).
   */
  timeoutMs: number;
  /**
   * Las comprobaciones relanzables, por su nombre en la rama base: si fallan en su primer intento,
   * se relanzan una vez antes del estado final (change pr-check-rerun, decisión 7). Sin ninguna, no
   * se relanza nada.
   */
  rerunChecks: string[];
  /**
   * Cuánto se espera, con una comprobación que falla y nada en cola ni en curso, a las que no tienen
   * *check run* antes de darlas por no ejecutadas (change pr-checks-not-run, decisión 3).
   */
  notRunMarginMs: number;
  /**
   * Una línea por petición de revisión, relanzamiento o resumen del triaje que GitHub rechaza, o por
   * hallazgo sin respuesta del modelo, para el log de errores.
   */
  log: (line: string) => void;
  /**
   * El umbral de real y el tope de gasto de cada PR (change pr-shadow-triage, decisiones 4 y 6),
   * las comprobaciones deterministas, que salen reales por regla (change pr-check-triage, decisión
   * 6), y la comprobación que lista las incidencias nuevas de SonarQube (change
   * pr-sonar-issue-triage, decisión 2).
   */
  triage: {
    threshold: number;
    budget: TriageBudget;
    ruleChecks: string[];
    sonarIssuesCheck: string;
  };
  /**
   * El arreglo (change pr-fixer, decisiones 8 y 11): si está encendido (`FIX_ENABLED`, la vuelta
   * atrás), el tope de gasto por PR y cuánto se espera a un trabajo desde que se pide. Sin él, no se
   * arregla.
   */
  fix?: { enabled: boolean; budgetUsd: number; timeoutMs: number };
}

/**
 * El nodo que pide la revisión. El driver lo nombra para no entrar en él al terminar la parada de
 * una PR (change pr-stop, decisión 3): pedirla no es terminar lo que estaba en curso.
 */
export const REVIEW_REQUEST_NODE = 'pedirRevision';

/** El nodo que relanza las comprobaciones (change pr-check-rerun, decisión 4). */
export const RERUN_NODE = 'relanzar';

/** El nodo que pide el arreglo de un push (change pr-fixer, decisión 3). */
export const FIX_REQUEST_NODE = 'pedirArreglo';

/**
 * Los nodos que actúan sobre la PR en GitHub. El driver no entra en ellos con la foto de un push
 * que ya no es el último, ni al terminar la parada de una PR: actuarían sobre lo que ya no toca.
 */
export const PR_ACTION_NODES = [REVIEW_REQUEST_NODE, RERUN_NODE, FIX_REQUEST_NODE] as const;

type PrActionNode = (typeof PR_ACTION_NODES)[number];

/** Si un nodo del hilo actúa sobre la PR en GitHub. */
export function isPrActionNode(node: string): node is PrActionNode {
  return (PR_ACTION_NODES as readonly string[]).includes(node);
}

const TRIAGE_NODE = 'triar';

const ASK_NODE = 'preguntarModelo';

const GATHER_NODE = 'reunirTriaje';

const DECIDE_NODE = 'decidir';

const SUMMARY_NODE = 'publicarResumen';

/**
 * Lo que recibe una rama `preguntarModelo` en su `Send`: un hallazgo de una ronda, la PR y la
 * pregunta que toca a su fuente, que así queda en la traza, en la entrada de la rama.
 */
interface AskInput {
  round: number;
  index: number;
  pr: PullRequestContext;
  finding: Finding;
  question: Question;
}

/** Las respuestas de una ronda entre las que guarda el hilo. */
function answersOf(round: number, answers: RoundAnswer[]): RoundAnswer[] {
  return answers.filter((answer) => answer.round === round);
}

/**
 * Tras `triar`, una rama `preguntarModelo` por cada hallazgo que aún no tiene respuesta, todas a la
 * vez. Sin ninguno (todo por regla, sin contexto o fuera del tope), directo a `reunirTriaje`: sin ningún
 * `Send`, el grafo no tendría nodo siguiente.
 */
function fanOut({ triageRound, triageAnswers }: State): Send[] | typeof GATHER_NODE {
  if (!triageRound) return GATHER_NODE;
  const { number: round, pr, findings } = triageRound;
  const decided = new Set(answersOf(round, triageAnswers).map(({ index }) => index));
  const sends = findings.flatMap((finding, index) =>
    decided.has(index)
      ? []
      : [
          new Send(ASK_NODE, {
            round,
            index,
            pr,
            finding,
            question: questionFor(finding),
          } satisfies AskInput),
        ],
  );
  return sends.length > 0 ? sends : GATHER_NODE;
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
  checksFailed: 'avisarEstadoFinal',
  timedOut: 'avisarEstadoFinal',
  firstFailure: TRIAGE_NODE,
} as const satisfies Record<ChecksStep, string>;

/** Adónde va el hilo tras cada acción de `decidir` (change pr-first-failure-triage, decisión 1). */
const AFTER_DECISION = {
  rerun: RERUN_NODE,
  skipRerun: 'esperarComprobaciones',
  // Antes de pedir el arreglo se publica el resumen del triaje, para que la PR cuente qué se ha
  // visto y por qué (change pr-fixer, decisión 10).
  fix: SUMMARY_NODE,
  publish: SUMMARY_NODE,
} as const satisfies Record<Decision['action'], string>;

const AFTER_REVIEW = {
  waiting: 'esperarRevisor',
  finished: 'avisarEstadoFinal',
  timedOut: 'avisarEstadoFinal',
  newPush: 'esperarComprobaciones',
} as const satisfies Record<ReviewStep, string>;

type AfterChecks = (typeof AFTER_CHECKS)[ChecksStep] | typeof TRIAGE_NODE | typeof SUMMARY_NODE;
type AfterReview = (typeof AFTER_REVIEW)[ReviewStep] | typeof TRIAGE_NODE | typeof SUMMARY_NODE;

/** El push que se sigue; antes del primer aviso de seguimiento, el de la foto. */
function pushIn({ push, snapshot }: State): TrackedPush {
  return push ?? { sha: snapshot.headSha, seenAt: snapshot.observedAt };
}

/**
 * Camino del aviso final: antes, el triaje, si necesita intervención con hallazgos o con un
 * relanzamiento que no ha terminado; si no, el resumen, si el sistema relanzó algo que pasó (change
 * pr-check-rerun, decisión 8).
 */
function viaTriage<Node extends string>(
  node: Node,
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
  rerunChecks: string[],
): Node | typeof TRIAGE_NODE | typeof SUMMARY_NODE {
  if (node !== 'avisarEstadoFinal') return node;
  const unfinished = unfinishedReruns(snapshot, push, rerunChecks);
  if (needsTriage(finalState(snapshot, push), unfinished)) return TRIAGE_NODE;
  return rerunPassed(snapshot, push).length > 0 ? SUMMARY_NODE : node;
}

/**
 * Los hallazgos del push con lo que sabe el seguimiento de su relanzamiento (change pr-check-rerun,
 * decisión 1): el intento de cada comprobación, de la foto, y las relanzables que el sistema relanzó
 * y no han terminado, que GitHub no da como fallidas y no tienen contexto que leer.
 */
function withReruns(
  findings: Finding[],
  snapshot: PullRequestSnapshot,
  push: TrackedPush,
  rerunChecks: string[],
): Finding[] {
  const attempts = new Map(snapshot.checks.map(({ name, attempt }) => [name, attempt]));
  const withAttempt = findings.map((finding) => {
    const attempt = finding.source === 'check' ? attempts.get(finding.name) : undefined;
    return attempt === undefined ? finding : { ...finding, attempt };
  });
  const unfinished = unfinishedReruns(snapshot, push, rerunChecks).map(
    (name): Finding => ({
      source: 'check',
      name,
      conclusion: null,
      context: { state: 'notProvided' },
      unfinished: true,
    }),
  );
  return [...withAttempt, ...unfinished];
}

/** Para a esperar al driver y valida la foto con la que reanuda. */
function waitFor(waitingFor: TrackingWait['waitingFor']) {
  const resumed: unknown = interrupt({ waitingFor } satisfies TrackingWait);
  return pullRequestSnapshotSchema.parse(resumed);
}

type Triaged = NonNullable<State['triage']>['findings'];

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Lo que no se arregla de un triaje y por qué (change pr-fixer, decisión 10): los que exigen
 * criterio y las relanzables reales que la PR no causa.
 */
function notFixedOf(triaged: Triaged): NotFixedItem[] {
  return triaged.flatMap(({ finding, verdict }): NotFixedItem[] => {
    if (verdict.class === 'needsJudgment') return [{ label: findingLabel(finding), reason: 'needsJudgment' }];
    if (verdict.class === 'valid' && !isFixable({ finding, verdict })) {
      return [{ label: findingLabel(finding), reason: 'notCausedByPr' }];
    }
    return [];
  });
}

/** Lo que el arreglo añade a los motivos del aviso final cuando `decidir` no arregla. */
function skippedFixReasons(decision: Decision, triaged: Triaged): FixReason[] {
  if (decision.rule === 'fixBudgetSpent') return [{ kind: 'fixBudgetSpent' }];
  if (decision.rule !== 'notCausedByPr') return [];
  const checks = triaged.flatMap(({ finding, verdict }) =>
    finding.source === 'check' && verdict.class === 'valid' && !isFixable({ finding, verdict })
      ? [finding.name]
      : [],
  );
  return [{ kind: 'notCausedByPr', checks }];
}

/** Lo que un trabajo que no ha subido nada añade a los motivos del aviso final. */
function failedFixReason(status: FixStatus): FixReason[] {
  if (status.state === 'interrupted') return [{ kind: 'fixFailed', reason: 'interrupted', unfixed: [] }];
  if (status.state !== 'failed') return [];
  return [
    { kind: 'fixFailed', reason: status.reason, unfixed: unfixedItems(status.unfixed).map(notFixedLine) },
  ];
}

export function createTrackingGraph(
  { notifier, reviewRequests, findings, decisionModel, summaries, checkReruns, fixer }: TrackingPorts,
  checkpointer: BaseCheckpointSaver,
  { timeoutMs, rerunChecks, notRunMarginMs, log, triage, fix: fixOptions }: TrackingOptions,
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
    const { push, next } = afterChecksWait(
      pushIn(state),
      snapshot,
      timeoutMs,
      rerunChecks,
      notRunMarginMs,
    );
    const goto = viaTriage(AFTER_CHECKS[next], snapshot, push, rerunChecks);
    const nextTriage = next === 'firstFailure' ? 'firstFailure' : 'final';
    return new Command({ update: { snapshot, push, nextTriage }, goto });
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

  // Relanza los *jobs* fallidos del run terminado de una relanzable que falla, con una llamada: GitHub
  // relanza con ellos los de las demás que fallan en el mismo run (change pr-check-rerun, decisión
  // 2). Si GitHub lo rechaza (p. ej. el token no tiene *Actions: write*), reintentarlo no lo arregla:
  // la PR va al estado final con ese motivo (decisión 5). Cualquier otro fallo lanza, y el nodo
  // queda pendiente para la vuelta siguiente, con el reloj aún desde el push.
  const relanzar: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot } = state;
    const push = pushIn(state);
    const toRerun = checksToRerun(snapshot, rerunChecks);
    const ready = toRerun.find((check) => check.runFinished);
    if (!ready) return {};
    try {
      await checkReruns.rerun(ready.runId);
      // Las que fallan en ese run: GitHub las relanza todas, relanzables o no (decisión 2).
      const rerunNames = snapshot.checks
        .filter((check) => check.status === 'failed' && check.runId === ready.runId)
        .map((check) => check.name);
      return { push: { ...push, rerunSince: snapshot.observedAt, rerunNames } };
    } catch (error) {
      if (!(error instanceof GitHubRequestRejectedError)) throw error;
      const rejected = toRerun.map(({ name }) => name);
      log(
        `GitHub rechaza relanzar ${rejected.join(', ')} en la PR #${snapshot.number}; ` +
          `necesita intervención: ${error.message}`,
      );
      return { push: { ...push, rerunRejected: rejected }, nextTriage: 'final' };
    }
  };

  const esperarRevisor: GraphNode<{ InputSchema: typeof TrackingState; Nodes: AfterReview }> = (
    state,
  ) => {
    const snapshot = waitFor('review');
    const { push, next } = afterReviewWait(pushIn(state), snapshot, timeoutMs);
    const goto = viaTriage(AFTER_REVIEW[next], snapshot, push, rerunChecks);
    return new Command({ update: { snapshot, push, nextTriage: 'final' }, goto });
  };

  // Lee los hallazgos del push y reparte las preguntas (change pr-check-triage, decisiones 4 a 6).
  // Decide sin el modelo lo que puede (`withoutModel`): una comprobación determinista, real por
  // regla; un comentario del revisor de una PR que no dice su alcance (change pr-reviewer-scope,
  // decisión 4); un hallazgo sin contexto; o uno que no cabe en lo que queda del tope, que se
  // reserva aquí, antes de repartir. Los demás salen cada uno por su rama, con la pregunta de su
  // fuente. Si GitHub falla al leerlos, lanza, y el nodo queda pendiente para la vuelta siguiente.
  const triar: GraphNode<typeof TrackingState> = async (state) => {
    if (state.nextTriage === 'firstFailure') return triarPrimerFallo(state);
    const { snapshot } = state;
    const push = pushIn(state);
    const final = finalState(snapshot, push);
    const failedChecks =
      final.status === 'needsIntervention'
        ? final.reasons.flatMap((reason) => (reason.kind === 'checksFailed' ? reason.checks : []))
        : [];
    const read = await findings.read(snapshot.number, snapshot.headSha, failedChecks);
    const found = withReruns(read.findings, snapshot, push, rerunChecks);
    const round = (state.triageRound?.number ?? 0) + 1;
    const decided = withoutModel(found, {
      ruleChecks: triage.ruleChecks,
      sonarIssuesCheck: triage.sonarIssuesCheck,
      rerunChecks,
      description: read.context.description,
      spentUsd: state.spentUsd ?? 0,
      budget: triage.budget,
      estimate: (finding) => decisionModel.estimate(read.context, finding, questionFor(finding)),
      // Las que no se relanzaron porque la PR causa el fallo salen con su primer triaje (decisión 4).
      firstTriage: push.rerunSkipped ? (push.firstTriage ?? []) : [],
    }).flatMap((answer, index): RoundAnswer[] =>
      answer ? [{ round, index, answer, inputTokens: 0 }] : [],
    );
    return {
      triageRound: {
        number: round,
        kind: 'final',
        pr: read.context,
        findings: found,
        sonarIssues: read.sonarIssues,
      },
      triageAnswers: decided,
    };
  };

  // La ronda del primer fallo (change pr-first-failure-triage, decisiones 2 y 3): solo las
  // relanzables que fallan en su primer intento y que el primer triaje del push aún no ha respondido.
  // Si ya las respondió todas (el driver se saltó `relanzar` tras un fallo pasajero), la ronda va
  // vacía, sin leer GitHub ni preguntar, y `decidir` vuelve a elegir con lo guardado.
  async function triarPrimerFallo(state: State) {
    const { snapshot } = state;
    const push = pushIn(state);
    const names = firstFailureChecks(snapshot, push, rerunChecks);
    const read =
      names.length === 0
        ? { context: { title: snapshot.title, description: '' }, findings: [] }
        : await findings.readChecks(snapshot.number, snapshot.headSha, names);
    const found = withReruns(read.findings, snapshot, push, rerunChecks);
    const round = (state.triageRound?.number ?? 0) + 1;
    const decided = withoutModel(found, {
      ruleChecks: triage.ruleChecks,
      sonarIssuesCheck: triage.sonarIssuesCheck,
      rerunChecks,
      description: read.context.description,
      spentUsd: state.spentUsd ?? 0,
      budget: triage.budget,
      estimate: (finding) => decisionModel.estimate(read.context, finding, questionFor(finding)),
      round: 'firstFailure',
    }).flatMap((answer, index): RoundAnswer[] =>
      answer ? [{ round, index, answer, inputTokens: 0 }] : [],
    );
    return {
      triageRound: {
        number: round,
        kind: 'firstFailure' as const,
        pr: read.context,
        findings: found,
        sonarIssues: null,
      },
      triageAnswers: decided,
    };
  }

  // Pregunta al modelo por un hallazgo (decisión 4). No lanza nunca: si lanzara, fallaría el paso
  // entero y con él las demás ramas. Si el modelo no responde, ese hallazgo exige criterio, y lo
  // que ya ha cobrado antes de fallar también es gasto de la PR.
  const preguntarModelo = async ({ round, index, pr, finding, question }: AskInput) => {
    try {
      const { answer, inputTokens } = await decisionModel.ask(pr, finding, question);
      const answered: RoundAnswer = { round, index, answer, inputTokens };
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
  //
  // En la ronda del primer fallo no escribe `triage`, que `publicarResumen` tomaría por el triaje del
  // push, sino el veredicto de cada relanzable en `push.firstTriage` (change pr-first-failure-triage,
  // decisión 4).
  const reunirTriaje: GraphNode<typeof TrackingState> = (state) => {
    const { snapshot, triageRound } = state;
    if (!triageRound) return {};
    const answers = answersOf(triageRound.number, state.triageAnswers);
    const inputTokens = answers.reduce((tokens, answer) => tokens + answer.inputTokens, 0);
    const spentBefore = state.spentUsd ?? 0;
    const spentUsd = spend(spentBefore, inputTokens, triage.budget);
    const classified = triageRound.findings.map((finding, index) => ({
      finding,
      verdict: classify(
        finding,
        answers.find((answer) => answer.index === index)?.answer ?? { kind: 'modelUnavailable' },
        triage.threshold,
      ),
    }));
    if (triageRound.kind === 'firstFailure') {
      const push = pushIn(state);
      const answered = classified.flatMap(({ finding, verdict }) =>
        finding.source === 'check' ? [{ name: finding.name, verdict }] : [],
      );
      return {
        spentUsd,
        push: { ...push, firstTriage: [...(push.firstTriage ?? []), ...answered] },
      };
    }
    return {
      spentUsd,
      triage: {
        sha: snapshot.headSha,
        findings: classified,
        sonarIssues: triageRound.sonarIssues,
        inputTokens,
        costUsd: spentUsd - spentBefore,
      },
    };
  };

  // Qué se hace con el triaje de la ronda (change pr-first-failure-triage, decisión 1): lo decide
  // `decide()`, sin el modelo, con lo que respondió el primer triaje del push, y queda en el estado
  // con su regla. La arista siguiente lo lee. Si no relanza porque la PR causa el fallo, apunta en el
  // push las que no relanza, y el hilo vuelve a esperar (decisión 9).
  //
  // En la ronda final decide también si se arregla (change pr-fixer, decisión 11), con lo que lleva
  // gastado la PR en arreglos. Si el *fixer* no contesta, se decide como si quedara tope, y pedir el
  // arreglo dirá que no se ha podido.
  const decidir: GraphNode<typeof TrackingState> = async (state) => {
    const push = pushIn(state);
    const { snapshot } = state;
    const round = state.triageRound?.kind ?? 'final';
    const triaged = state.triage?.sha === snapshot.headSha ? state.triage.findings : [];
    const spent = await fixSpent(round, triaged, snapshot.number);
    // Sin *fixer* configurado, la ronda final decide como antes del arreglo.
    const decision = decide(
      round,
      push.firstTriage,
      fixer && fixOptions
        ? { findings: triaged, enabled: fixOptions.enabled, budgetLeft: spent < fixOptions.budgetUsd }
        : undefined,
    );
    if (decision.action === 'skipRerun') {
      const rerunSkipped = checksToRerun(snapshot, rerunChecks).map(({ name }) => name);
      return { decision, push: { ...push, rerunSkipped } };
    }
    if (decision.action === 'fix') {
      return {
        decision,
        fix: {
          sha: snapshot.headSha,
          findings: triaged.filter(isFixable).map(({ finding }) => finding),
          budgetUsd: (fixOptions?.budgetUsd ?? 0) - spent,
          notFixed: notFixedOf(triaged),
        },
      };
    }
    return { decision, fixReasons: { sha: snapshot.headSha, reasons: skippedFixReasons(decision, triaged) } };
  };

  // Lo gastado en arreglos de la PR, solo si hay algo real que arreglar en la ronda final.
  async function fixSpent(round: string, triaged: Triaged, number: number): Promise<number> {
    if (!fixer || round !== 'final' || !triaged.some(isFixable)) return 0;
    try {
      return await fixer.spent(number);
    } catch (error) {
      log(`El fixer no dice lo gastado en la PR #${number}: ${describeError(error)}`);
      return 0;
    }
  }

  // Pide el arreglo (change pr-fixer, decisión 3) y no espera. Es un nodo de acción: el driver se lo
  // salta con un push viejo o una PR detenida. Si el *fixer* no contesta, avisa del estado final con
  // ese motivo en vez de dejar la PR sin aviso.
  const pedirArreglo: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot, fix, triageRound } = state;
    if (!fix || !fixer) return {};
    try {
      await fixer.request({
        number: snapshot.number,
        sha: fix.sha,
        pr: triageRound?.pr ?? { title: snapshot.title, description: '' },
        findings: fix.findings,
        budgetUsd: fix.budgetUsd,
      });
      return { fix: { ...fix, requestedAt: snapshot.observedAt } };
    } catch (error) {
      log(`No se ha podido pedir el arreglo de la PR #${snapshot.number}: ${describeError(error)}`);
      const reasons: FixReason[] = [{ kind: 'fixFailed', reason: 'fixerUnavailable', unfixed: [] }];
      return { fixReasons: { sha: fix.sha, reasons } };
    }
  };

  // Espera al arreglo como espera a la CI (decisión 3): cada vuelta pregunta en qué está. Un push
  // nuevo, del arreglo o del mantenedor, pasa a `avisarArreglo`; un trabajo que no ha subido nada o
  // que no termina a tiempo, al aviso final con su motivo.
  const esperarArreglo: GraphNode<{
    InputSchema: typeof TrackingState;
    Nodes: 'esperarArreglo' | 'avisarArreglo' | 'avisarEstadoFinal';
  }> = async (state) => {
    const snapshot = waitFor('fix');
    const push = pushIn(state);
    const fix = state.fix ?? { sha: push.sha, findings: [], budgetUsd: 0, notFixed: [] };
    let status: FixStatus = fix.status ?? { state: 'queued' };
    try {
      if (fixer) status = await fixer.status(snapshot.number, push.sha);
    } catch (error) {
      log(`El fixer no dice en qué está el arreglo de la PR #${snapshot.number}: ${describeError(error)}`);
    }
    const update = { snapshot, fix: { ...fix, status } };
    if (snapshot.headSha !== push.sha) return new Command({ update, goto: 'avisarArreglo' });
    const failure = failedFixReason(status);
    const late =
      fix.requestedAt !== undefined &&
      snapshot.observedAt - fix.requestedAt > (fixOptions?.timeoutMs ?? Number.POSITIVE_INFINITY);
    if (failure.length > 0 || late) {
      const reasons: FixReason[] =
        failure.length > 0 ? failure : [{ kind: 'fixFailed', reason: 'timedOut', unfixed: [] }];
      return new Command({
        update: { ...update, fixReasons: { sha: push.sha, reasons } },
        goto: 'avisarEstadoFinal',
      });
    }
    return new Command({ update, goto: 'esperarArreglo' });
  };

  // Un push nuevo tras pedir el arreglo (decisión 10). Si es el del arreglo, avisa de lo que no se
  // ha arreglado, si queda algo; si es del mantenedor, nada: su push tendrá su aviso. Después sigue
  // con el push nuevo, sin aviso de seguimiento: el sistema no ha dejado de seguir la PR.
  const avisarArreglo: GraphNode<typeof TrackingState> = async ({ snapshot, fix }) => {
    const status = fix?.status;
    if (status?.state === 'pushed' && status.sha === snapshot.headSha) {
      const items = [...(fix?.notFixed ?? []), ...unfixedItems(status.unfixed)];
      if (items.length > 0) await notifier.notify(notFixedNotice(snapshot, items));
    }
    return { push: { sha: snapshot.headSha, seenAt: snapshot.observedAt } };
  };

  // Publica en la PR el triaje del push (decisión 7) y lo que el sistema relanzó y pasó (change
  // pr-check-rerun, decisión 8), una vez: si ya está el de ese SHA (un reintento tras una respuesta
  // que no llegó), no lo repite. Si GitHub lo rechaza, queda en el log y el aviso final sale igual
  // (decisión 8); otro fallo deja el nodo pendiente, y el reintento no vuelve a triar. Sin
  // hallazgos ni nada relanzado que pasara, no hay nada que contar.
  const publicarResumen: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot } = state;
    // El triaje de este push, si lo ha habido: el hilo guarda también el de uno anterior.
    const triaged = state.triage?.sha === snapshot.headSha ? state.triage : undefined;
    const found = triaged?.findings ?? [];
    const passed = rerunPassed(snapshot, pushIn(state));
    if (found.length === 0 && passed.length === 0) return {};
    if (await summaries.published(snapshot.number, snapshot.headSha)) return {};
    try {
      const text = triageSummary(
        {
          sha: snapshot.headSha,
          findings: found,
          sonarIssues: triaged?.sonarIssues,
          rerunPassed: passed,
          firstTriage: pushIn(state).firstTriage,
          fixing: state.decision?.action === 'fix' && state.fix?.sha === snapshot.headSha,
        },
        triage.threshold,
      );
      await summaries.publish(snapshot.number, snapshot.headSha, text);
    } catch (error) {
      if (!(error instanceof GitHubRequestRejectedError)) throw error;
      log(
        `GitHub rechaza el resumen del triaje de la PR #${snapshot.number}; ` +
          `se avisa igual: ${error.message}`,
      );
    }
    return {};
  };

  // El estado final del push, con los motivos del arreglo si son de este push (change pr-fixer,
  // decisión 10).
  const avisarEstadoFinal: GraphNode<typeof TrackingState> = async (state) => {
    const { snapshot } = state;
    const base = finalState(snapshot, pushIn(state));
    const extra = state.fixReasons?.sha === snapshot.headSha ? state.fixReasons.reasons : [];
    const final =
      base.status === 'needsIntervention' && extra.length > 0
        ? { ...base, reasons: [...base.reasons, ...extra] }
        : base;
    await notifier.notify(finalNotice(snapshot, final));
    return {};
  };

  return new StateGraph(TrackingState)
    .addNode('avisarSeguimiento', avisarSeguimiento)
    .addNode('empezarSinAviso', empezarSinAviso)
    .addNode('esperarComprobaciones', esperarComprobaciones, {
      ends: [...new Set([...Object.values(AFTER_CHECKS), TRIAGE_NODE, SUMMARY_NODE])],
    })
    .addNode('avisarComprobaciones', avisarComprobaciones)
    .addNode(REVIEW_REQUEST_NODE, pedirRevision)
    .addNode(RERUN_NODE, relanzar)
    .addNode('esperarRevisor', esperarRevisor, {
      ends: [...Object.values(AFTER_REVIEW), TRIAGE_NODE, SUMMARY_NODE],
    })
    .addNode(TRIAGE_NODE, triar)
    .addNode(ASK_NODE, preguntarModelo)
    .addNode(GATHER_NODE, reunirTriaje)
    .addNode(DECIDE_NODE, decidir)
    .addNode(SUMMARY_NODE, publicarResumen)
    .addNode(FIX_REQUEST_NODE, pedirArreglo)
    .addNode('esperarArreglo', esperarArreglo, {
      ends: ['esperarArreglo', 'avisarArreglo', 'avisarEstadoFinal'],
    })
    .addNode('avisarArreglo', avisarArreglo)
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
    // Tras pedirlo, a esperar su resultado; si GitHub lo rechaza, al estado final por el triaje.
    // Una arista y no un `Command`: así el driver puede saltarse el nodo con `updateState` y el hilo
    // sigue a la espera (change pr-check-rerun, decisión 4).
    .addConditionalEdges(
      RERUN_NODE,
      (state) =>
        state.push?.rerunRejected
          ? viaTriage('avisarEstadoFinal', state.snapshot, pushIn(state), rerunChecks)
          : 'esperarComprobaciones',
      ['esperarComprobaciones', TRIAGE_NODE, SUMMARY_NODE, 'avisarEstadoFinal'],
    )
    .addConditionalEdges(TRIAGE_NODE, fanOut, [ASK_NODE, GATHER_NODE])
    .addEdge(ASK_NODE, GATHER_NODE)
    .addEdge(GATHER_NODE, DECIDE_NODE)
    // Una arista y no un `Command`, como la de `relanzar`: así el driver puede saltarse `relanzar`
    // con un push viejo o una PR detenida. Sin relanzar, a esperar: la PR llega al estado final por
    // el camino de cualquier fallo (change pr-first-failure-triage, decisión 9).
    .addConditionalEdges(DECIDE_NODE, ({ decision }) => AFTER_DECISION[decision?.action ?? 'publish'], [
      RERUN_NODE,
      'esperarComprobaciones',
      SUMMARY_NODE,
    ])
    // Tras el resumen, pedir el arreglo si `decidir` lo eligió para este push; si no, el aviso final.
    .addConditionalEdges(
      SUMMARY_NODE,
      ({ decision, fix, snapshot }) =>
        decision?.action === 'fix' && fix?.sha === snapshot.headSha ? FIX_REQUEST_NODE : 'avisarEstadoFinal',
      [FIX_REQUEST_NODE, 'avisarEstadoFinal'],
    )
    // Una arista y no un `Command`, como la de `relanzar`: así el driver puede saltarse el nodo.
    .addConditionalEdges(
      FIX_REQUEST_NODE,
      ({ fixReasons, fix }) =>
        fix && fixReasons?.sha === fix.sha && fix.requestedAt === undefined ? 'avisarEstadoFinal' : 'esperarArreglo',
      ['esperarArreglo', 'avisarEstadoFinal'],
    )
    .addEdge('avisarArreglo', 'esperarComprobaciones')
    .addEdge('avisarEstadoFinal', END)
    .compile({ checkpointer });
}

export type TrackingGraph = ReturnType<typeof createTrackingGraph>;
