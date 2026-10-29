import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createDriver, runDriver } from './driver.ts';
import type { Notice } from './notice.ts';
import {
  GitHubUnauthorizedError,
  type GitHubReader,
  type Notifier,
  type ReviewReader,
  type ReviewRequests,
} from './ports.ts';
import type { Check, OpenPullRequest, Review } from './pull-request.ts';

const MAINTAINER = '7daysofrain';
const MINUTE = 60_000;

function pullRequest(number: number, overrides: Partial<OpenPullRequest> = {}): OpenPullRequest {
  return {
    number,
    title: `PR ${number}`,
    url: `https://github.com/7daysofrain/mood-table-v2/pull/${number}`,
    author: MAINTAINER,
    baseBranch: 'main',
    draft: false,
    headSha: `sha-${number}`,
    labels: [],
    ...overrides,
  };
}

/**
 * GitHub falso: devuelve lo que tenga en ese momento, o lanza el error que se le diga. Mientras no
 * se le den, las comprobaciones de cada SHA están a medias y no hay revisión.
 */
function fakeGitHub(pullRequests: OpenPullRequest[] = []) {
  const github = {
    pullRequests,
    /** Las comprobaciones de cada SHA. */
    checks: {} as Record<string, Check[]>,
    /** La revisión de cada PR. */
    reviews: {} as Record<number, Review>,
    /** Las peticiones de revisión del sistema, en orden: quedan en GitHub aunque se reinicie. */
    requests: [] as { number: number; sha: string }[],
    /** Las veces que se ha leído si el sistema ya ha pedido la revisión de un push. */
    requestedReads: [] as { number: number; sha: string }[],
    /** Si falla solo la petición de revisión. */
    requestFailure: undefined as Error | undefined,
    failure: undefined as Error | undefined,
    /** Si falla solo la lectura de las comprobaciones. */
    checksFailure: undefined as Error | undefined,
    reads: 0,
    checksReads: 0,
  };
  const read = <T>(value: T) =>
    github.failure ? Promise.reject(github.failure) : Promise.resolve(value);
  const reader: GitHubReader = {
    listOpenPullRequests() {
      github.reads += 1;
      return read(github.pullRequests);
    },
    requiredChecks: () => read(['lint']),
    checks(sha) {
      github.checksReads += 1;
      if (github.checksFailure) return Promise.reject(github.checksFailure);
      return read(github.checks[sha] ?? [{ name: 'lint', status: 'pending' }]);
    },
  };
  const reviewer: ReviewReader = { review: (number) => read(github.reviews[number] ?? null) };
  const reviewRequests: ReviewRequests = {
    requested(number, sha) {
      github.requestedReads.push({ number, sha });
      return read(github.requests.some((r) => r.number === number && r.sha === sha));
    },
    request(number, sha) {
      if (github.requestFailure) return Promise.reject(github.requestFailure);
      github.requests.push({ number, sha });
      return Promise.resolve();
    },
  };
  return { github, reader, reviewer, reviewRequests };
}

/** Notifier falso: guarda los avisos que publica, o falla mientras `failing` esté a true. */
function fakeNotifier() {
  const notifier = { notices: [] as Notice[], failing: false };
  const port: Notifier = {
    notify(notice) {
      if (notifier.failing) return Promise.reject(new Error('Linear no responde'));
      notifier.notices.push(notice);
      return Promise.resolve();
    },
  };
  return { notifier, port };
}

function setup(pullRequests: OpenPullRequest[] = []) {
  const { github, reader, reviewer, reviewRequests } = fakeGitHub(pullRequests);
  const { notifier, port } = fakeNotifier();
  const log: string[] = [];
  const newDriver = () =>
    createDriver({
      github: reader,
      reviewer,
      reviewRequests,
      notifier: port,
      // Sin hallazgos que triar: el triaje se prueba en el grafo.
      findings: { read: () => Promise.resolve({ context: { title: '', description: '' }, findings: [] }) },
      triager: { triage: () => Promise.reject(new Error('no hay hallazgos que triar')) },
      triage: { threshold: 0.8, budget: { capUsd: 0.05, inputPricePerMTok: 0.24 } },
      checkpointer: new MemorySaver(),
      policy: { maintainer: MAINTAINER, baseBranch: 'main' },
      timeoutMs: 30 * MINUTE,
      log: (line) => log.push(line),
    });
  let driver = newDriver();
  let now = 0;
  const tick = async () => {
    await driver.tick(now);
    now += MINUTE;
  };
  /** Un driver nuevo sobre el mismo GitHub, sin nada en memoria: como tras un reinicio. */
  const restart = () => {
    driver = newDriver();
  };
  return { github, notifier, log, tick, restart };
}

/**
 * Los números de las PR de los avisos de seguimiento, ordenados: las PR se avanzan a la vez, así que
 * el orden entre ellas no está fijado.
 */
function trackedNumbers(notices: Notice[]) {
  return notices
    .flatMap((notice) => (notice.type === 'tracking' ? [notice.pullRequest.number] : []))
    .sort((a, b) => a - b);
}

describe('al arrancar', () => {
  it('avisa una vez de cada PR que ya estaba abierta', async () => {
    const { notifier, tick } = setup([pullRequest(74), pullRequest(75)]);

    await tick();
    await tick();

    expect(trackedNumbers(notifier.notices)).toEqual([74, 75]);
  });

  it('no avisa de las PR que no sigue', async () => {
    const { notifier, tick } = setup([
      pullRequest(74, { draft: true }),
      pullRequest(75, { author: 'otra-persona' }),
    ]);

    await tick();

    expect(notifier.notices).toEqual([]);
  });
});

describe('un borrador', () => {
  it('no avisa, y al pasar a lista para revisar, sí', async () => {
    const { github, notifier, tick } = setup([pullRequest(74, { draft: true })]);
    await tick();
    expect(notifier.notices).toEqual([]);

    github.pullRequests = [pullRequest(74)];
    await tick();

    expect(trackedNumbers(notifier.notices)).toEqual([74]);
  });
});

describe('una PR que deja de seguirse', () => {
  it('si se cierra o se integra, deja de seguirse sin aviso', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    github.pullRequests = [];
    await tick();
    await tick();

    expect(trackedNumbers(notifier.notices)).toEqual([74]);
  });

  it('si vuelve a borrador, deja de seguirse sin aviso y al volver a estar lista se trata como nueva', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    github.pullRequests = [pullRequest(74, { draft: true })];
    await tick();
    expect(trackedNumbers(notifier.notices)).toEqual([74]);

    github.pullRequests = [pullRequest(74)];
    await tick();
    expect(trackedNumbers(notifier.notices)).toEqual([74, 74]);
  });
});

describe('si falla una lectura de GitHub', () => {
  it('no cambia nada y vuelve a leer en la vuelta siguiente', async () => {
    const { github, notifier, log, tick } = setup([pullRequest(74)]);
    github.failure = new Error('ECONNRESET');

    await tick();
    expect(notifier.notices).toEqual([]);
    expect(log).toHaveLength(1);

    github.failure = undefined;
    await tick();
    expect(trackedNumbers(notifier.notices)).toEqual([74]);
    expect(github.reads).toBe(2);
  });

  it('no deja de seguir las PR que ya seguía', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    github.failure = new Error('502 Bad Gateway');
    await tick();
    github.failure = undefined;
    await tick();

    expect(trackedNumbers(notifier.notices)).toEqual([74]);
  });

  it('si GitHub rechaza el token, avisa una sola vez al buzón', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.failure = new GitHubUnauthorizedError('Bad credentials');

    await tick();
    await tick();
    await tick();

    expect(notifier.notices).toEqual([{ type: 'githubUnauthorized' }]);
  });

  it('si GitHub vuelve a rechazar el token tras haberlo aceptado, avisa otra vez', async () => {
    const { github, notifier, tick } = setup([]);
    github.failure = new GitHubUnauthorizedError('Bad credentials');
    await tick();
    github.failure = undefined;
    await tick();
    github.failure = new GitHubUnauthorizedError('Bad credentials');
    await tick();

    expect(notifier.notices).toEqual([{ type: 'githubUnauthorized' }, { type: 'githubUnauthorized' }]);
  });
});

describe('si el canal no acepta un aviso', () => {
  it('lo reintenta en la vuelta siguiente hasta que llega', async () => {
    const { notifier, log, tick } = setup([pullRequest(74)]);
    notifier.failing = true;

    await tick();
    await tick();
    expect(notifier.notices).toEqual([]);
    expect(log).toHaveLength(2);

    notifier.failing = false;
    await tick();
    await tick();
    expect(trackedNumbers(notifier.notices)).toEqual([74]);
  });

  it('reintenta también el aviso de token rechazado', async () => {
    const { github, notifier, tick } = setup([]);
    github.failure = new GitHubUnauthorizedError('Bad credentials');
    notifier.failing = true;
    await tick();

    notifier.failing = false;
    await tick();
    await tick();

    expect(notifier.notices).toEqual([{ type: 'githubUnauthorized' }]);
  });

  it('un aviso que falla no impide los de las demás PR', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    notifier.failing = true;
    await tick();

    notifier.failing = false;
    github.pullRequests = [pullRequest(74), pullRequest(75)];
    await tick();

    expect(trackedNumbers(notifier.notices)).toEqual([74, 75]);
  });
});

/** Los avisos de las PR en corto: número, tipo y, el del estado final, su estado. */
function summary(notices: Notice[]) {
  return notices.flatMap((notice) => {
    if (!('pullRequest' in notice)) return [];
    const { number } = notice.pullRequest;
    return [notice.type === 'final' ? [number, notice.state.status] : [number, notice.type]];
  });
}

const PASSED: Check[] = [{ name: 'lint', status: 'passed' }];
const reviewed = (sha: string): Review => ({ reviewedSha: sha, completed: true, hasFindings: false });

describe('hasta el estado final', () => {
  it('sigue la PR por cada vuelta hasta avisar de su estado final', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    await tick();

    github.checks['sha-74'] = PASSED;
    await tick();
    github.reviews[74] = reviewed('sha-74');
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
    ]);
  });

  it('tras el estado final no avisa más ni vuelve a leer la PR mientras no haya push nuevo', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await tick();
    await tick();
    await tick();
    const reads = github.checksReads;

    await tick();
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
    ]);
    expect(github.checksReads).toBe(reads);
  });

  it('un push nuevo tras el estado final vuelve a avisar de que la sigue, y sigue ese push', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await tick();
    await tick();
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'nuevo' })];
    await tick();
    await tick();
    expect(summary(notifier.notices).slice(3)).toEqual([[74, 'tracking']]);

    github.checks['nuevo'] = PASSED;
    github.reviews[74] = reviewed('nuevo');
    await tick();
    await tick();
    expect(summary(notifier.notices).slice(3)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
    ]);
  });

  it('un push nuevo mientras la sigue no avisa', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'nuevo' })];
    await tick();
    await tick();

    expect(summary(notifier.notices)).toEqual([[74, 'tracking']]);
  });

  it('si nadie termina en 30 min desde que vio el push, avisa de que necesita intervención', async () => {
    const { notifier, tick } = setup([pullRequest(74)]);

    for (let minute = 0; minute <= 30; minute++) await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'needsIntervention'],
    ]);
  });

  it('un aviso reintentado tras un push nuevo no da el estado final del push anterior', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    // Las comprobaciones y la revisión terminan, pero Linear no acepta el aviso.
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    notifier.failing = true;
    await tick();

    // Llega un push nuevo antes de que Linear vuelva.
    github.pullRequests = [pullRequest(74, { headSha: 'nuevo' })];
    notifier.failing = false;
    await tick();
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
    ]);
  });

  it('si falla la lectura de sus comprobaciones, la PR no cambia y se vuelve a leer', async () => {
    const { github, notifier, log, tick } = setup([pullRequest(74)]);
    await tick();

    github.checks['sha-74'] = PASSED;
    github.checksFailure = new Error('502 Bad Gateway');
    await tick();
    expect(summary(notifier.notices)).toEqual([[74, 'tracking']]);
    expect(log).toHaveLength(1);

    github.checksFailure = undefined;
    await tick();
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
    ]);
  });
});

describe('la cadencia', () => {
  it('da una vuelta, espera la cadencia y da la siguiente, sin solaparlas', async () => {
    const events: string[] = [];
    let clock = 0;
    let ticks = 0;
    const { promise: twoTicks, resolve } = Promise.withResolvers<void>();

    const running = runDriver(
      {
        tick: async (now) => {
          events.push(`vuelta ${now}`);
          await Promise.resolve();
          events.push('fin');
          if (++ticks === 2) resolve();
        },
      },
      {
        cadenceMs: 60_000,
        clock: () => clock,
        sleep: (ms) => {
          events.push(`espera ${ms}`);
          clock += ms;
          return Promise.resolve();
        },
      },
    );
    await twoTicks;
    running.stop();

    expect(events.slice(0, 5)).toEqual(['vuelta 0', 'fin', 'espera 60000', 'vuelta 60000', 'fin']);
  });
});

/** Una PR del mantenedor con la etiqueta que detiene su seguimiento. */
function stoppedPullRequest(number: number, overrides: Partial<OpenPullRequest> = {}) {
  return pullRequest(number, { labels: ['babysitter:stop'], ...overrides });
}

/** Da `count` vueltas. */
async function ticks(tick: () => Promise<void>, count: number) {
  for (let index = 0; index < count; index++) await tick();
}

describe('la etiqueta babysitter:stop detiene el seguimiento de una PR', () => {
  it('mientras espera sus comprobaciones: avisa una vez y no avisa de nada más aunque terminen', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    await tick();
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await ticks(tick, 3);

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
    ]);
  });

  it('con un aviso pendiente: primero ese y después el de detenida', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    notifier.failing = true;
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    notifier.failing = false;
    await tick();
    github.reviews[74] = reviewed('sha-74');
    await ticks(tick, 2);

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'stopped'],
    ]);
  });

  it('con su estado final: avisa de que la detiene', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await ticks(tick, 3);

    github.pullRequests = [stoppedPullRequest(74)];
    await ticks(tick, 2);

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
      [74, 'stopped'],
    ]);
  });

  it('un push nuevo no la reanuda ni avisa', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();

    github.pullRequests = [stoppedPullRequest(74, { headSha: 'nuevo' })];
    github.checks['nuevo'] = PASSED;
    github.reviews[74] = reviewed('nuevo');
    await ticks(tick, 3);

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
    ]);
  });

  it('un borrador con la etiqueta que pasa a lista para revisar no avisa y queda detenido', async () => {
    const { github, notifier, tick } = setup([stoppedPullRequest(74, { draft: true })]);
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    await ticks(tick, 2);
    expect(notifier.notices).toEqual([]);

    github.pullRequests = [pullRequest(74)];
    await tick();
    expect(summary(notifier.notices)).toEqual([[74, 'resumed']]);
  });

  it('otra etiqueta no la detiene', async () => {
    const { github, notifier, tick } = setup([pullRequest(74, { labels: ['dependencies'] })]);
    await tick();

    github.checks['sha-74'] = PASSED;
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
    ]);
  });
});

describe('quitar la etiqueta reanuda el seguimiento desde el último push', () => {
  it('antes del estado final: avisa de que la reanuda, sin el de seguimiento, y sigue el último push', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();
    github.pullRequests = [stoppedPullRequest(74, { headSha: 'nuevo' })];
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'nuevo' })];
    await tick();
    github.checks['nuevo'] = PASSED;
    await tick();
    github.reviews[74] = reviewed('nuevo');
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
    ]);
  });

  it('tras más de 30 min detenida, el tiempo de espera cuenta desde que la reanuda', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await ticks(tick, 40);

    github.pullRequests = [pullRequest(74)];
    await tick();
    await ticks(tick, 29);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
    ]);

    await tick();
    expect(summary(notifier.notices).at(-1)).toEqual([74, 'needsIntervention']);
  });

  it('en estado final sin push nuevo: solo avisa de que la reanuda', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await ticks(tick, 3);
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();

    github.pullRequests = [pullRequest(74)];
    await ticks(tick, 3);

    expect(summary(notifier.notices).slice(3)).toEqual([
      [74, 'stopped'],
      [74, 'resumed'],
    ]);
  });

  it('en estado final con un push nuevo: avisa de que la reanuda y sigue ese push', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    github.reviews[74] = reviewed('sha-74');
    await ticks(tick, 3);
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();
    github.pullRequests = [stoppedPullRequest(74, { headSha: 'nuevo' })];
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'nuevo' })];
    await tick();
    github.checks['nuevo'] = PASSED;
    github.reviews[74] = reviewed('nuevo');
    await ticks(tick, 2);

    expect(summary(notifier.notices).slice(3)).toEqual([
      [74, 'stopped'],
      [74, 'resumed'],
      [74, 'checksFinished'],
      [74, 'readyToMerge'],
    ]);
  });
});

describe('al arrancar, una PR con la etiqueta queda detenida', () => {
  it('no avisa de ella, y al quitarle la etiqueta avisa de que la reanuda', async () => {
    const { github, notifier, tick } = setup([stoppedPullRequest(74), pullRequest(75)]);
    await ticks(tick, 2);
    expect(summary(notifier.notices)).toEqual([[75, 'tracking']]);

    github.pullRequests = [pullRequest(74), pullRequest(75)];
    await tick();
    github.checks['sha-74'] = PASSED;
    await tick();

    expect(summary(notifier.notices)).toEqual([
      [75, 'tracking'],
      [74, 'resumed'],
      [74, 'checksFinished'],
    ]);
  });
});

describe('si el canal no acepta el aviso de detenida o de reanudada', () => {
  it('reintenta el de detenida en la vuelta siguiente, y la PR no avanza mientras tanto', async () => {
    const { github, notifier, log, tick } = setup([pullRequest(74)]);
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    github.checks['sha-74'] = PASSED;
    notifier.failing = true;
    await ticks(tick, 2);
    expect(log).toHaveLength(2);

    notifier.failing = false;
    await ticks(tick, 2);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
    ]);
  });

  it('si le quitan la etiqueta antes de que salga el de detenida, avisa de los dos y la espera cuenta desde que la reanuda', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();

    // La detienen mientras Linear no acepta avisos, y le quitan la etiqueta antes de que vuelva.
    github.pullRequests = [stoppedPullRequest(74)];
    notifier.failing = true;
    await ticks(tick, 40);
    github.pullRequests = [pullRequest(74)];
    await tick();

    notifier.failing = false;
    await tick();
    await ticks(tick, 29);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
    ]);

    await tick();
    expect(summary(notifier.notices).at(-1)).toEqual([74, 'needsIntervention']);
  });

  it('con un aviso del grafo pendiente, si le quitan la etiqueta antes de que vuelva Linear, avisa de todo en orden y la espera cuenta desde que la reanuda', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    // El aviso de seguimiento no sale: queda pendiente en el hilo.
    notifier.failing = true;
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    await ticks(tick, 40);
    github.pullRequests = [pullRequest(74)];
    await tick();

    notifier.failing = false;
    await tick();
    await ticks(tick, 29);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
    ]);

    await tick();
    expect(summary(notifier.notices).at(-1)).toEqual([74, 'needsIntervention']);
  });

  it('si la vuelven a detener con el de reanudada pendiente, avisa de todo en orden y la espera cuenta desde que la reanuda', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();

    // La reanudan con Linear caído, la vuelven a detener y le quitan la etiqueta antes de que vuelva.
    notifier.failing = true;
    github.pullRequests = [pullRequest(74)];
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await ticks(tick, 40);
    github.pullRequests = [pullRequest(74)];
    await tick();

    notifier.failing = false;
    await tick();
    await ticks(tick, 29);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
      [74, 'stopped'],
      [74, 'resumed'],
    ]);

    await tick();
    expect(summary(notifier.notices).at(-1)).toEqual([74, 'needsIntervention']);
  });

  it('reintenta el de reanudada en la vuelta siguiente, antes que los del push', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();

    github.pullRequests = [pullRequest(74)];
    github.checks['sha-74'] = PASSED;
    notifier.failing = true;
    await tick();

    notifier.failing = false;
    await ticks(tick, 2);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
      [74, 'resumed'],
      [74, 'checksFinished'],
    ]);
  });
});

describe('una PR detenida que se cierra', () => {
  it('se olvida sin aviso: si vuelve sin la etiqueta, es nueva', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.pullRequests = [stoppedPullRequest(74)];
    await tick();

    github.pullRequests = [];
    await tick();
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'stopped'],
    ]);

    github.pullRequests = [pullRequest(74)];
    await tick();
    expect(summary(notifier.notices).at(-1)).toEqual([74, 'tracking']);
  });
});

describe('el sistema pide la revisión cuando pasan las comprobaciones del último push', () => {
  it('lee en cada foto si el sistema ya ha pedido la revisión del último push', async () => {
    const { github, tick } = setup([pullRequest(74)]);

    await tick();

    expect(github.requestedReads).toEqual([{ number: 74, sha: 'sha-74' }]);
  });

  it('la pide una vez cuando pasan', async () => {
    const { github, tick } = setup([pullRequest(74)]);
    await tick();

    github.checks['sha-74'] = PASSED;
    await ticks(tick, 3);

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74' }]);
  });

  it('un borrador que pasa a lista para revisar con las comprobaciones en verde la pide', async () => {
    const { github, tick } = setup([pullRequest(74, { draft: true })]);
    github.checks['sha-74'] = PASSED;
    await tick();
    expect(github.requests).toEqual([]);

    // Como el aviso de comprobaciones terminadas, con la foto de la vuelta siguiente al arrancar.
    github.pullRequests = [pullRequest(74)];
    await ticks(tick, 2);

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74' }]);
  });

  it('una PR detenida no la pide', async () => {
    const { github, tick } = setup([stoppedPullRequest(74)]);
    github.checks['sha-74'] = PASSED;

    await ticks(tick, 3);

    expect(github.requests).toEqual([]);
  });

  it('una PR detenida con el aviso de comprobaciones pendiente lo publica, pero no la pide', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    notifier.failing = true;
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    notifier.failing = false;
    await ticks(tick, 2);

    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'stopped'],
    ]);
    expect(github.requests).toEqual([]);
  });

  it('una PR detenida con la petición pendiente por un fallo de red no la pide', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    github.requestFailure = new Error('fetch failed');
    await tick();

    github.pullRequests = [stoppedPullRequest(74)];
    github.requestFailure = undefined;
    await ticks(tick, 2);

    expect(github.requests).toEqual([]);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'stopped'],
    ]);
  });
});

describe('un nodo pendiente que se reintenta tras un push nuevo', () => {
  it('termina el aviso de comprobaciones, pero no pide la revisión del push anterior', async () => {
    const { github, notifier, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    notifier.failing = true;
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'sha-74b' })];
    notifier.failing = false;
    await ticks(tick, 3);
    expect(github.requests).toEqual([]);

    github.checks['sha-74b'] = PASSED;
    await ticks(tick, 2);

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74b' }]);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'checksFinished'],
    ]);
  });

  it('no reintenta la petición del push anterior que falló por la red', async () => {
    const { github, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    github.requestFailure = new Error('fetch failed');
    await tick();

    github.pullRequests = [pullRequest(74, { headSha: 'sha-74b' })];
    github.requestFailure = undefined;
    await ticks(tick, 3);
    expect(github.requests).toEqual([]);

    github.checks['sha-74b'] = PASSED;
    await ticks(tick, 2);

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74b' }]);
  });

  it('con el mismo push, reintenta la petición que falló por la red', async () => {
    const { github, tick } = setup([pullRequest(74)]);
    await tick();
    github.checks['sha-74'] = PASSED;
    github.requestFailure = new Error('fetch failed');
    await tick();

    github.requestFailure = undefined;
    await tick();

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74' }]);
  });
});

describe('el sistema no pide dos veces la revisión del mismo push', () => {
  it('tras un reinicio, con su petición del último push en GitHub, no la vuelve a pedir', async () => {
    const { github, notifier, tick, restart } = setup([pullRequest(74)]);
    github.checks['sha-74'] = PASSED;
    await ticks(tick, 2);
    expect(github.requests).toHaveLength(1);

    restart();
    await ticks(tick, 2);

    expect(github.requests).toEqual([{ number: 74, sha: 'sha-74' }]);
    expect(summary(notifier.notices)).toEqual([
      [74, 'tracking'],
      [74, 'checksFinished'],
      [74, 'tracking'],
      [74, 'checksFinished'],
    ]);
  });
});
