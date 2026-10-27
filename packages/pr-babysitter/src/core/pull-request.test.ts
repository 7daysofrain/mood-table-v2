import { describe, expect, it } from 'vitest';

import {
  isStopped,
  isTracked,
  type OpenPullRequest,
  STOP_LABEL,
  type TrackingPolicy,
} from './pull-request.ts';

const policy: TrackingPolicy = { maintainer: '7daysofrain', baseBranch: 'main' };

function pullRequest(overrides: Partial<OpenPullRequest> = {}): OpenPullRequest {
  return {
    number: 74,
    title: 'Avisar de cada PR lista para revisar',
    url: 'https://github.com/7daysofrain/mood-table-v2/pull/74',
    author: '7daysofrain',
    baseBranch: 'main',
    draft: false,
    headSha: 'a1b2c3d',
    labels: [],
    ...overrides,
  };
}

describe('qué PR sigue el PR Babysitter', () => {
  it('sigue una PR del mantenedor contra main lista para revisar', () => {
    expect(isTracked(pullRequest(), policy)).toBe(true);
  });

  it('no sigue una PR en borrador', () => {
    expect(isTracked(pullRequest({ draft: true }), policy)).toBe(false);
  });

  it('no sigue una PR de otra persona', () => {
    expect(isTracked(pullRequest({ author: 'dependabot[bot]' }), policy)).toBe(false);
  });

  it('no sigue una PR contra otra rama', () => {
    expect(isTracked(pullRequest({ baseBranch: 'feature/entrega-2-JA' }), policy)).toBe(false);
  });
});

describe('qué PR están detenidas', () => {
  it('la etiqueta que detiene una PR es babysitter:stop', () => {
    expect(STOP_LABEL).toBe('babysitter:stop');
  });

  it('está detenida con la etiqueta babysitter:stop, junto a otras o sola', () => {
    expect(isStopped(pullRequest({ labels: ['babysitter:stop'] }))).toBe(true);
    expect(isStopped(pullRequest({ labels: ['dependencies', 'babysitter:stop'] }))).toBe(true);
  });

  it('no está detenida sin etiquetas', () => {
    expect(isStopped(pullRequest())).toBe(false);
  });

  it('no está detenida con otras etiquetas', () => {
    expect(isStopped(pullRequest({ labels: ['dependencies', 'babysitter'] }))).toBe(false);
  });
});
