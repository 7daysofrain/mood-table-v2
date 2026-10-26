import { describe, expect, it } from 'vitest';

import {
  checksFinishedNotice,
  finalNotice,
  githubUnauthorizedNotice,
  noticeSummary,
  trackingNotice,
} from './notice.ts';
import type { OpenPullRequest } from './pull-request.ts';

const pullRequest: OpenPullRequest = {
  number: 74,
  title: 'Avisar de cada PR lista para revisar',
  url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
  author: '7daysofrain',
  baseBranch: 'main',
  draft: false,
  headSha: 'a1b2c3d',
};

describe('el aviso de que el sistema sigue una PR', () => {
  it('identifica la PR por su número, su título y su URL', () => {
    expect(trackingNotice(pullRequest)).toEqual({
      type: 'tracking',
      pullRequest: {
        number: 74,
        title: 'Avisar de cada PR lista para revisar',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
      },
    });
  });

  it('dice que el sistema la sigue y espera a que terminen sus comprobaciones', () => {
    expect(noticeSummary(trackingNotice(pullRequest))).toBe(
      'La sigo: espero a que terminen sus comprobaciones.',
    );
  });
});

describe('el aviso de que han terminado las comprobaciones', () => {
  it('identifica la PR y dice que espera a la revisión', () => {
    const notice = checksFinishedNotice(pullRequest);

    expect(notice).toEqual({
      type: 'checksFinished',
      pullRequest: {
        number: 74,
        title: 'Avisar de cada PR lista para revisar',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
      },
    });
    expect(noticeSummary(notice)).toBe('Han terminado sus comprobaciones: espero a la revisión.');
  });
});

describe('el aviso del estado final', () => {
  it('identifica la PR y lleva el estado', () => {
    expect(finalNotice(pullRequest, { status: 'readyToMerge' })).toEqual({
      type: 'final',
      pullRequest: {
        number: 74,
        title: 'Avisar de cada PR lista para revisar',
        url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
      },
      state: { status: 'readyToMerge' },
    });
  });

  it('lista para integrar: lo dice y deja de seguirla', () => {
    expect(noticeSummary(finalNotice(pullRequest, { status: 'readyToMerge' }))).toBe(
      'Lista para integrar. Dejo de seguirla.',
    );
  });

  it('necesita intervención: da cada motivo', () => {
    const notice = finalNotice(pullRequest, {
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['e2e'] },
        { kind: 'checksUnfinished', checks: ['test'] },
        { kind: 'reviewFindings' },
      ],
    });

    expect(noticeSummary(notice)).toBe(
      'Necesita intervención: falla e2e; no ha terminado test; el revisor tiene hallazgos. ' +
        'Dejo de seguirla.',
    );
  });

  it('necesita intervención: varias comprobaciones van en plural y en una lista', () => {
    const notice = finalNotice(pullRequest, {
      status: 'needsIntervention',
      reasons: [
        { kind: 'checksFailed', checks: ['lint', 'e2e'] },
        { kind: 'checksUnfinished', checks: ['test', 'SonarCloud Code Analysis', 'sonar-issues'] },
        { kind: 'reviewUnfinished' },
      ],
    });

    expect(noticeSummary(notice)).toBe(
      'Necesita intervención: fallan lint y e2e; no han terminado test, SonarCloud Code Analysis ' +
        'y sonar-issues; la revisión no ha terminado. Dejo de seguirla.',
    );
  });
});

describe('el aviso de que el sistema no puede leer GitHub', () => {
  it('no es de ninguna PR y dice que GitHub rechaza el token y que lo vuelve a intentar', () => {
    const notice = githubUnauthorizedNotice();
    expect(notice).toEqual({ type: 'githubUnauthorized' });
    expect(noticeSummary(notice)).toBe(
      'No puedo leer GitHub: rechaza el token. Lo vuelvo a intentar cada vuelta.',
    );
  });
});
