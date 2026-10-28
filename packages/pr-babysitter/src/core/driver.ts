/**
 * El driver (change pr-tracking, decisiones 3, 4 y 9): en cada vuelta lee GitHub y despierta el
 * hilo de cada PR que se sigue. Lo que no es del grafo lo decide aquí: qué hilos arrancan, cuáles
 * se olvidan, cuáles vuelven a empezar por un push nuevo tras el estado final, cuándo se reintenta
 * un aviso y cuándo se avisa de que GitHub rechaza el token.
 *
 * También detiene y reanuda cada PR según su etiqueta (change pr-stop, decisiones 2-4). La guarda
 * vive aquí, en un solo sitio: una PR con la etiqueta nunca se reanuda, así que ningún nodo del grafo
 * avanza en ella. Reanudar es empezar una ejecución nueva desde el último push, sin el aviso de
 * seguimiento; si terminó con el estado final de ese mismo push, solo se avisa.
 *
 * Una vuelta nunca lanza: un fallo de GitHub la salta entera (sin foto buena no se reanuda ningún
 * hilo), y un fallo de una PR, la de esa PR. Lo uno y lo otro va al log y se repite en la vuelta
 * siguiente. Los avisos llegan al menos una vez: uno que el canal no acepta queda pendiente, en el
 * checkpoint de su hilo o en la cola del sistema, hasta que se publica.
 */
import { type BaseCheckpointSaver, Command } from '@langchain/langgraph';

import {
  createTrackingGraph,
  lastSnapshot,
  REVIEW_REQUEST_NODE,
  threadConfig,
} from './graph.ts';
import {
  githubUnauthorizedNotice,
  type PullRequestNotice,
  resumedNotice,
  stoppedNotice,
  type SystemNotice,
} from './notice.ts';
import {
  GitHubUnauthorizedError,
  type GitHubReader,
  type Notifier,
  type ReviewReader,
  type ReviewRequests,
} from './ports.ts';
import {
  isStopped,
  isTracked,
  type OpenPullRequest,
  type PullRequestSnapshot,
  type TrackingPolicy,
} from './pull-request.ts';

export interface DriverOptions {
  github: GitHubReader;
  reviewer: ReviewReader;
  /** Las peticiones de revisión del sistema: si ya la ha pedido, para la foto, y pedirla. */
  reviewRequests: ReviewRequests;
  notifier: Notifier;
  /** Donde guarda cada hilo su estado. `MemorySaver` hasta BE7 (D73). */
  checkpointer: BaseCheckpointSaver;
  policy: TrackingPolicy;
  /**
   * Cuánto se espera a las comprobaciones, desde que se ve un push, y a la revisión, desde que
   * pasan (change pr-review-request, decisión 5).
   */
  timeoutMs: number;
  /** Una línea por fallo, para el log de errores. */
  log: (line: string) => void;
}

export interface Driver {
  /** Una vuelta, con la hora que lleva la foto (ms desde epoch). No lanza. */
  tick(now: number): Promise<void>;
}

export function createDriver({
  github,
  reviewer,
  reviewRequests,
  notifier,
  checkpointer,
  policy,
  timeoutMs,
  log,
}: DriverOptions): Driver {
  const graph = createTrackingGraph({ notifier, reviewRequests }, checkpointer, { timeoutMs, log });
  /** Las PR con un hilo arrancado. */
  const tracked = new Set<number>();
  /**
   * Las PR detenidas, desde que se ve la etiqueta, aunque su aviso aún no haya salido. No se
   * persiste: al arrancar se reconstruye de las etiquetas (decisión 4).
   */
  const stopped = new Set<number>();
  /**
   * Las PR detenidas cuya parada aún no ha terminado: el hilo tiene un aviso que el canal no ha
   * aceptado, y la parada espera a que salga para encolar «Detenida» detrás.
   */
  const stopping = new Set<number>();
  /**
   * Los avisos de detenida y reanudada de cada PR que el canal aún no ha aceptado, en orden. La PR no
   * avanza mientras tenga alguno: así llegan antes que los del grafo.
   */
  const pendingTransitionNotices = new Map<number, PullRequestNotice[]>();
  /** Avisos del sistema que el canal aún no ha aceptado. */
  const pendingSystemNotices: SystemNotice[] = [];
  /** Si ya se ha avisado de que GitHub rechaza el token, desde la última vuelta que lo aceptó. */
  let unauthorizedNotified = false;

  /** Publica los avisos del sistema pendientes; los que el canal no acepta, siguen pendientes. */
  async function flushSystemNotices() {
    const sending = pendingSystemNotices.splice(0);
    const results = await Promise.allSettled(sending.map((notice) => notifier.notify(notice)));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') return;
      log(`No se ha podido publicar un aviso del sistema; se reintenta: ${describe(result.reason)}`);
      pendingSystemNotices.push(sending[index] as SystemNotice);
    });
  }

  /** Avisa una sola vez de que GitHub rechaza el token, hasta que lo vuelva a aceptar. */
  function noteUnauthorized(unauthorized: boolean) {
    if (unauthorized && !unauthorizedNotified) {
      pendingSystemNotices.push(githubUnauthorizedNotice());
    }
    unauthorizedNotified = unauthorized;
  }

  async function forget(number: number) {
    tracked.delete(number);
    await checkpointer.deleteThread(String(number));
  }

  /** Olvida la PR del todo: la que ya no se sigue sale también de las detenidas, sin aviso. */
  async function drop(number: number) {
    stopped.delete(number);
    stopping.delete(number);
    pendingTransitionNotices.delete(number);
    await forget(number);
  }

  function queueTransitionNotice(number: number, notice: PullRequestNotice) {
    pendingTransitionNotices.set(number, [...(pendingTransitionNotices.get(number) ?? []), notice]);
  }

  /**
   * Publica en orden los avisos de detenida y reanudada de la PR, uno detrás de otro; si uno falla,
   * lanza y quedan él y los siguientes.
   */
  async function flushTransitionNotices(number: number): Promise<void> {
    const [next, ...rest] = pendingTransitionNotices.get(number) ?? [];
    if (!next) return;
    await notifier.notify(next);
    if (rest.length > 0) pendingTransitionNotices.set(number, rest);
    else pendingTransitionNotices.delete(number);
    await flushTransitionNotices(number);
  }

  /**
   * Apunta la parada en cuanto ve la etiqueta, sin tocar GitHub, Linear ni el grafo: nada que falle
   * después puede hacer que se pierda. Sin hilo (al arrancar, o un borrador que pasa a lista) no
   * queda nada por terminar, y no se avisa.
   */
  function noteStop(pullRequest: OpenPullRequest) {
    const { number } = pullRequest;
    if (!isStopped(pullRequest) || stopped.has(number)) return;
    stopped.add(number);
    if (tracked.has(number)) stopping.add(number);
  }

  /**
   * Termina la parada de la PR, si le falta: lo que estaba en curso (un aviso pendiente del hilo),
   * después encola «Detenida» y olvida el hilo, salvo si terminó con el estado final, que se
   * conserva para comparar su SHA al reanudar. Si el aviso pendiente falla, lanza, y la parada se
   * termina en la vuelta siguiente, también si para entonces le han quitado la etiqueta.
   *
   * Solo termina el aviso: el hilo se para antes de pedir la revisión, y una petición pendiente no
   * se reintenta. Pedirla sería una acción nueva en una PR detenida (change pr-review-request).
   */
  async function finishStopping(pullRequest: OpenPullRequest) {
    const { number } = pullRequest;
    if (!stopping.has(number)) return;
    const config = threadConfig(number);
    let state = await graph.getState(config);
    if (state.next.length > 0 && !waiting(state) && !state.next.includes(REVIEW_REQUEST_NODE)) {
      await graph.invoke(null, { ...config, interruptBefore: [REVIEW_REQUEST_NODE] });
      state = await graph.getState(config);
    }
    stopping.delete(number);
    queueTransitionNotice(number, stoppedNotice(pullRequest));
    if (state.next.length > 0) await forget(number);
  }

  /**
   * Reanuda la PR, después de terminar su parada si le faltaba (así «Detenida» va antes que
   * «Reanudada»). Si su hilo terminó con el estado final del mismo push, solo encola el aviso; si
   * no, lee la foto, encola el aviso y empieza una ejecución nueva sin el aviso de seguimiento, con
   * el tiempo de espera contado desde esa foto. Si la lectura falla, sigue detenida y se repite en
   * la vuelta siguiente.
   */
  async function resume(
    pullRequest: OpenPullRequest,
    snapshotOf: (pullRequest: OpenPullRequest) => Promise<PullRequestSnapshot>,
  ) {
    await finishStopping(pullRequest);
    const { number } = pullRequest;
    const config = threadConfig(number);
    if (tracked.has(number)) {
      const state = await graph.getState(config);
      if (lastSnapshot(state.values).headSha === pullRequest.headSha) {
        stopped.delete(number);
        queueTransitionNotice(number, resumedNotice(pullRequest));
        return;
      }
    }
    const snapshot = await snapshotOf(pullRequest);
    stopped.delete(number);
    queueTransitionNotice(number, resumedNotice(pullRequest));
    tracked.add(number);
    await graph.invoke({ snapshot, silent: true }, config);
  }

  /**
   * Apunta primero si la han detenido; después publica los avisos de detenida y reanudada
   * pendientes de la PR, la detiene, la reanuda o la avanza, y publica los que eso encole.
   */
  async function advance(
    pullRequest: OpenPullRequest,
    snapshotOf: (pullRequest: OpenPullRequest) => Promise<PullRequestSnapshot>,
  ) {
    noteStop(pullRequest);
    await flushTransitionNotices(pullRequest.number);
    await step(pullRequest, snapshotOf);
    await flushTransitionNotices(pullRequest.number);
  }

  /**
   * Detiene o reanuda la PR según su etiqueta. Si no, arranca su hilo, reintenta su aviso
   * pendiente, lo reanuda con la foto o, si terminó y hay un push nuevo, lo vuelve a empezar. La
   * foto solo se lee de GitHub cuando hace falta: un aviso pendiente se reintenta con la que ya
   * tiene el hilo, y un hilo terminado sin push nuevo no se lee.
   */
  async function step(
    pullRequest: OpenPullRequest,
    snapshotOf: (pullRequest: OpenPullRequest) => Promise<PullRequestSnapshot>,
  ) {
    if (isStopped(pullRequest)) {
      await finishStopping(pullRequest);
      return;
    }
    if (stopped.has(pullRequest.number)) {
      await resume(pullRequest, snapshotOf);
      return;
    }
    const config = threadConfig(pullRequest.number);
    if (!tracked.has(pullRequest.number)) {
      const snapshot = await snapshotOf(pullRequest);
      tracked.add(pullRequest.number);
      await graph.invoke({ snapshot }, config);
      return;
    }
    const state = await graph.getState(config);
    if (waiting(state)) {
      await graph.invoke(new Command({ resume: await snapshotOf(pullRequest) }), config);
    } else if (state.next.length > 0) {
      // Un nodo que falló (un aviso que el canal no aceptó) sigue pendiente en el checkpoint.
      await graph.invoke(null, config);
    } else if (lastSnapshot(state.values).headSha !== pullRequest.headSha) {
      // Terminó con el estado final de otro push: una ejecución nueva en el mismo hilo.
      await graph.invoke({ snapshot: await snapshotOf(pullRequest) }, config);
    }
  }

  return {
    async tick(now) {
      let unauthorized = false;
      /** Anota si GitHub ha rechazado el token y lo deja en el log. */
      const readFailed = (error: unknown, line: string) => {
        if (error instanceof GitHubUnauthorizedError) unauthorized = true;
        log(`${line}: ${describe(error)}`);
      };

      let pullRequests: OpenPullRequest[] | undefined;
      try {
        pullRequests = await github.listOpenPullRequests();
      } catch (error) {
        readFailed(error, 'No se ha podido leer GitHub; se vuelve a intentar');
      }

      if (pullRequests) {
        const toTrack = pullRequests.filter((pullRequest) => isTracked(pullRequest, policy));
        const stillTracked = new Set(toTrack.map((pullRequest) => pullRequest.number));
        const known = new Set([...tracked, ...stopped]);
        const gone = [...known].filter((number) => !stillTracked.has(number));
        await Promise.all(gone.map(drop));

        // Las comprobaciones exigidas se leen una vez por vuelta, y solo si alguna PR las necesita.
        let required: Promise<string[]> | undefined;
        const snapshotOf = async (pullRequest: OpenPullRequest): Promise<PullRequestSnapshot> => {
          required ??= github.requiredChecks();
          const [checks, review, reviewRequested] = await Promise.all([
            required.then((names) => github.checks(pullRequest.headSha, names)),
            reviewer.review(pullRequest.number),
            reviewRequests.requested(pullRequest.number, pullRequest.headSha),
          ]);
          return { ...pullRequest, checks, review, reviewRequested, observedAt: now };
        };

        // Cada PR tiene su hilo: se avanzan a la vez, y el fallo de una no frena a las demás.
        await Promise.all(
          toTrack.map(async (pullRequest) => {
            try {
              await advance(pullRequest, snapshotOf);
            } catch (error) {
              const line = `No se ha podido avanzar la PR #${pullRequest.number}; se reintenta`;
              readFailed(error, line);
            }
          }),
        );
      }

      // Una vuelta sin respuesta de GitHub no dice nada del token: se queda como estaba.
      if (pullRequests || unauthorized) noteUnauthorized(unauthorized);
      await flushSystemNotices();
    },
  };
}

export interface RunOptions {
  /** Tiempo entre el final de una vuelta y el principio de la siguiente (ms). */
  cadenceMs: number;
  clock: () => number;
  sleep: (ms: number) => Promise<void>;
}

/**
 * Da vueltas hasta que se pare, una tras otra: la siguiente empieza `cadenceMs` después de que
 * termine la anterior, así que nunca se solapan aunque una tarde.
 */
export function runDriver(driver: Driver, { cadenceMs, clock, sleep }: RunOptions) {
  let running = true;
  void (async () => {
    while (running) {
      await driver.tick(clock());
      if (running) await sleep(cadenceMs);
    }
  })();
  return {
    stop() {
      running = false;
    },
  };
}

/** Si el hilo está parado en un `interrupt()`, esperando la foto siguiente. */
function waiting(state: { tasks: { interrupts: unknown[] }[] }): boolean {
  return state.tasks.some((task) => task.interrupts.length > 0);
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
