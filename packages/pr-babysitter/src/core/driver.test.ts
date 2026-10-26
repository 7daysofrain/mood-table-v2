import { MemorySaver } from '@langchain/langgraph';
import { describe, expect, it } from 'vitest';

import { createDriver, runDriver } from './driver.ts';
import type { Notice } from './notice.ts';
import { GitHubUnauthorizedError, type GitHubReader, type Notifier } from './ports.ts';
import type { OpenPullRequest } from './pull-request.ts';

const MAINTAINER = '7daysofrain';

function pullRequest(number: number, overrides: Partial<OpenPullRequest> = {}): OpenPullRequest {
  return {
    number,
    title: `PR ${number}`,
    url: `https://github.com/7daysofrain/mood-table-v2/pull/${number}`,
    author: MAINTAINER,
    baseBranch: 'main',
    draft: false,
    headSha: `sha-${number}`,
    ...overrides,
  };
}

/** GitHub falso: devuelve las PR que tenga en ese momento, o lanza el error que se le diga. */
function fakeGitHub(pullRequests: OpenPullRequest[] = []) {
  const github = {
    pullRequests,
    failure: undefined as Error | undefined,
    reads: 0,
  };
  const read = <T>(value: T) =>
    github.failure ? Promise.reject(github.failure) : Promise.resolve(value);
  const reader: GitHubReader = {
    listOpenPullRequests() {
      github.reads += 1;
      return read(github.pullRequests);
    },
    requiredChecks: () => read([]),
    checks: () => read([]),
  };
  return { github, reader };
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
  const { github, reader } = fakeGitHub(pullRequests);
  const { notifier, port } = fakeNotifier();
  const log: string[] = [];
  const driver = createDriver({
    github: reader,
    notifier: port,
    checkpointer: new MemorySaver(),
    policy: { maintainer: MAINTAINER, baseBranch: 'main' },
    log: (line) => log.push(line),
  });
  let now = 0;
  const tick = async () => {
    await driver.tick(now);
    now += 60_000;
  };
  return { github, notifier, log, tick };
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
