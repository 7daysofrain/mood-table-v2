import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.ts';

const env = {
  GITHUB_TOKEN: 'github_pat_x',
  GITHUB_MAINTAINER: '7daysofrain',
  LINEAR_CLIENT_ID: 'client-id',
  LINEAR_CLIENT_SECRET: 'client-secret',
  LINEAR_MAINTAINER_PROFILE_URL: 'https://linear.app/7daysofrain/profiles/joseba',
  LINEAR_INBOX_ISSUE_ID: 'f2b9c3d4-0000-4000-8000-000000000086',
};

describe('la configuración del entorno', () => {
  it('con todas las variables, da la configuración, Codex de revisor y la cadencia de 60 s', () => {
    expect(loadConfig(env)).toEqual({
      ok: true,
      config: {
        githubToken: 'github_pat_x',
        githubMaintainer: '7daysofrain',
        githubReviewer: 'chatgpt-codex-connector[bot]',
        linearClientId: 'client-id',
        linearClientSecret: 'client-secret',
        linearMaintainerProfileUrl: 'https://linear.app/7daysofrain/profiles/joseba',
        linearInboxIssueId: 'f2b9c3d4-0000-4000-8000-000000000086',
        pollIntervalMs: 60_000,
      },
    });
  });

  it('lee la cuenta del revisor', () => {
    const result = loadConfig({ ...env, GITHUB_REVIEWER: 'otro-revisor[bot]' });
    expect(result.ok && result.config.githubReviewer).toBe('otro-revisor[bot]');
  });

  it('lee la cadencia en segundos', () => {
    const result = loadConfig({ ...env, POLL_INTERVAL_SECONDS: '30' });
    expect(result.ok && result.config.pollIntervalMs).toBe(30_000);
  });

  it('con las variables vacías, dice cuáles faltan', () => {
    const empty = Object.fromEntries(Object.keys(env).map((name) => [name, '']));
    const result = loadConfig({ ...empty, POLL_INTERVAL_SECONDS: '' });

    expect(result).toEqual({
      ok: false,
      error: [
        'La configuración del PR Babysitter no vale (mira .env.example):',
        '- GITHUB_TOKEN: falta',
        '- GITHUB_MAINTAINER: falta',
        '- LINEAR_CLIENT_ID: falta',
        '- LINEAR_CLIENT_SECRET: falta',
        '- LINEAR_MAINTAINER_PROFILE_URL: falta',
        '- LINEAR_INBOX_ISSUE_ID: falta',
      ].join('\n'),
    });
  });

  it('dice qué variable no vale y por qué', () => {
    const result = loadConfig({
      ...env,
      LINEAR_MAINTAINER_PROFILE_URL: 'joseba',
      POLL_INTERVAL_SECONDS: 'cada minuto',
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error.split('\n').slice(1)).toEqual([
      '- LINEAR_MAINTAINER_PROFILE_URL: no es una URL',
      '- POLL_INTERVAL_SECONDS: no es un número',
    ]);
  });
});
