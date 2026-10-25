import { describe, expect, it } from 'vitest';

import { githubUnauthorizedNotice, noticeSummary, trackingNotice } from './notice.ts';
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

describe('el aviso de que el sistema no puede leer GitHub', () => {
  it('no es de ninguna PR y dice que GitHub rechaza el token y que lo vuelve a intentar', () => {
    const notice = githubUnauthorizedNotice();
    expect(notice).toEqual({ type: 'githubUnauthorized' });
    expect(noticeSummary(notice)).toBe(
      'No puedo leer GitHub: rechaza el token. Lo vuelvo a intentar cada vuelta.',
    );
  });
});
