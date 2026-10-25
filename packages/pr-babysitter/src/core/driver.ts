/**
 * El driver (change pr-tracking, decisiones 3, 4 y 9): en cada vuelta lee GitHub y despierta el
 * hilo de cada PR que se sigue. Lo que no es del grafo lo decide aquí: qué hilos arrancan, cuáles se
 * olvidan, cuándo se reintenta un aviso y cuándo se avisa de que GitHub rechaza el token.
 *
 * Una vuelta nunca lanza: un fallo de GitHub la salta entera (sin foto buena no se reanuda ningún
 * hilo), y un fallo de una PR, la de esa PR. Lo uno y lo otro va al log y se repite en la vuelta
 * siguiente. Los avisos llegan al menos una vez: uno que el canal no acepta queda pendiente, en el
 * checkpoint de su hilo o en la cola del sistema, hasta que se publica.
 */
import { type BaseCheckpointSaver, Command } from '@langchain/langgraph';

import { createTrackingGraph, threadConfig } from './graph.ts';
import { githubUnauthorizedNotice, type SystemNotice } from './notice.ts';
import { GitHubUnauthorizedError, type GitHubReader, type Notifier } from './ports.ts';
import {
  isTracked,
  type OpenPullRequest,
  type PullRequestSnapshot,
  type TrackingPolicy,
} from './pull-request.ts';

export interface DriverOptions {
  github: GitHubReader;
  notifier: Notifier;
  /** Donde guarda cada hilo su estado. `MemorySaver` hasta BE7 (D73). */
  checkpointer: BaseCheckpointSaver;
  policy: TrackingPolicy;
  /** Una línea por fallo, para el log de errores. */
  log: (line: string) => void;
}

export interface Driver {
  /** Una vuelta, con la hora que lleva la foto (ms desde epoch). No lanza. */
  tick(now: number): Promise<void>;
}

export function createDriver({
  github,
  notifier,
  checkpointer,
  policy,
  log,
}: DriverOptions): Driver {
  const graph = createTrackingGraph(notifier, checkpointer);
  /** Las PR con un hilo arrancado. */
  const tracked = new Set<number>();
  /** Avisos del sistema que el canal aún no ha aceptado, en orden. */
  const pendingSystemNotices: SystemNotice[] = [];
  /** Si ya se ha avisado de que GitHub rechaza el token, desde la última lectura buena. */
  let unauthorizedNotified = false;

  async function flushSystemNotices() {
    for (const notice of [...pendingSystemNotices]) {
      try {
        await notifier.notify(notice);
      } catch (error) {
        log(`No se ha podido publicar un aviso del sistema; se reintenta: ${describe(error)}`);
        return;
      }
      pendingSystemNotices.shift();
    }
  }

  async function readGitHub(): Promise<OpenPullRequest[] | undefined> {
    try {
      const pullRequests = await github.listOpenPullRequests();
      unauthorizedNotified = false;
      return pullRequests;
    } catch (error) {
      if (error instanceof GitHubUnauthorizedError) {
        if (!unauthorizedNotified) pendingSystemNotices.push(githubUnauthorizedNotice());
        unauthorizedNotified = true;
      }
      log(`No se ha podido leer GitHub; se vuelve a intentar: ${describe(error)}`);
      return undefined;
    }
  }

  async function forget(number: number) {
    tracked.delete(number);
    await checkpointer.deleteThread(String(number));
  }

  /** Arranca el hilo de la PR, reintenta su aviso pendiente o lo reanuda con la foto. */
  async function advance(snapshot: PullRequestSnapshot) {
    const config = threadConfig(snapshot.number);
    if (!tracked.has(snapshot.number)) {
      tracked.add(snapshot.number);
      await graph.invoke({ snapshot }, config);
      return;
    }
    const state = await graph.getState(config);
    if (state.tasks.some((task) => task.interrupts.length > 0)) {
      await graph.invoke(new Command({ resume: snapshot }), config);
    } else if (state.next.length > 0) {
      // Un nodo que falló (un aviso que el canal no aceptó) sigue pendiente en el checkpoint.
      await graph.invoke(null, config);
    }
  }

  return {
    async tick(now) {
      const pullRequests = await readGitHub();
      await flushSystemNotices();
      if (!pullRequests) return;

      const toTrack = pullRequests.filter((pullRequest) => isTracked(pullRequest, policy));
      const stillTracked = new Set(toTrack.map((pullRequest) => pullRequest.number));
      for (const number of [...tracked]) {
        if (!stillTracked.has(number)) await forget(number);
      }

      for (const pullRequest of toTrack) {
        try {
          await advance({ ...pullRequest, observedAt: now });
        } catch (error) {
          log(`No se ha podido avanzar la PR #${pullRequest.number}; se reintenta: ${describe(error)}`);
        }
      }
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

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
