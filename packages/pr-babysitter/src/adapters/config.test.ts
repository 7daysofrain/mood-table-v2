import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.ts';

const env = {
  GITHUB_TOKEN: 'github_pat_x',
  GITHUB_MAINTAINER: '7daysofrain',
  LINEAR_CLIENT_ID: 'client-id',
  LINEAR_CLIENT_SECRET: 'client-secret',
  LINEAR_MAINTAINER_PROFILE_URL: 'https://linear.app/7daysofrain/profiles/joseba',
  LINEAR_INBOX_ISSUE_ID: 'f2b9c3d4-0000-4000-8000-000000000086',
  DECISION_MODEL_API_KEY: 'ollama-key',
};

describe('la configuración del entorno', () => {
  it('con todas las variables, da la configuración y los valores por defecto', () => {
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
        trackingTimeoutMs: 30 * 60_000,
        trackingNotRunMarginMs: 120_000,
        decisionModelBaseUrl: 'https://ollama.com',
        decisionModel: 'clef:27b',
        decisionModelApiKey: 'ollama-key',
        decisionModelInputPricePerMTok: 0.24,
        triageThreshold: 0.8,
        triageBudgetUsd: 0.05,
        triageRuleChecks: ['lint', 'typecheck', 'SonarCloud Code Analysis'],
        triageSonarIssuesCheck: 'sonar-issues',
        rerunChecks: ['test', 'e2e'],
      },
    });
  });

  it('lee el nombre de la comprobación que lista las incidencias nuevas de SonarQube, sin espacios alrededor', () => {
    expect(loadConfig({ ...env, TRIAGE_SONAR_ISSUES_CHECK: ' sonar-nuevas ' })).toMatchObject({
      config: { triageSonarIssuesCheck: 'sonar-nuevas' },
    });
  });

  it('lee las comprobaciones relanzables; sin ningún nombre no relanza ninguna (change pr-check-rerun)', () => {
    expect(loadConfig({ ...env, RERUN_CHECKS: ' test , build ' })).toMatchObject({
      config: { rerunChecks: ['test', 'build'] },
    });
    expect(loadConfig({ ...env, RERUN_CHECKS: ',' })).toMatchObject({
      config: { rerunChecks: [] },
    });
    expect(loadConfig({ ...env, RERUN_CHECKS: '' })).toMatchObject({
      config: { rerunChecks: ['test', 'e2e'] },
    });
  });

  it('lee las comprobaciones que decide la regla, separadas por comas y sin los espacios de alrededor', () => {
    const result = loadConfig({ ...env, TRIAGE_RULE_CHECKS: ' lint , SonarCloud Code Analysis,build ' });

    expect(result).toMatchObject({
      config: { triageRuleChecks: ['lint', 'SonarCloud Code Analysis', 'build'] },
    });
  });

  it('una lista sin ningún nombre apaga la regla; la variable vacía es la lista por defecto', () => {
    expect(loadConfig({ ...env, TRIAGE_RULE_CHECKS: ',' })).toMatchObject({
      config: { triageRuleChecks: [] },
    });
    expect(loadConfig({ ...env, TRIAGE_RULE_CHECKS: '' })).toMatchObject({
      config: { triageRuleChecks: ['lint', 'typecheck', 'SonarCloud Code Analysis'] },
    });
  });

  it('lee la cuenta del revisor', () => {
    const result = loadConfig({ ...env, GITHUB_REVIEWER: 'otro-revisor[bot]' });
    expect(result.ok && result.config.githubReviewer).toBe('otro-revisor[bot]');
  });

  it('lee el tiempo de espera en minutos', () => {
    const result = loadConfig({ ...env, TRACKING_TIMEOUT_MINUTES: '5' });
    expect(result.ok && result.config.trackingTimeoutMs).toBe(5 * 60_000);
  });

  it('lee el margen de las comprobaciones que no van a ejecutarse en segundos (change pr-checks-not-run)', () => {
    const result = loadConfig({ ...env, TRACKING_NOT_RUN_MARGIN_SECONDS: '60' });
    expect(result.ok && result.config.trackingNotRunMarginMs).toBe(60_000);
  });

  it('lee la cadencia en segundos', () => {
    const result = loadConfig({ ...env, POLL_INTERVAL_SECONDS: '30' });
    expect(result.ok && result.config.pollIntervalMs).toBe(30_000);
  });

  it('lee el modelo de decisión, su precio, el umbral y el tope del triaje', () => {
    const result = loadConfig({
      ...env,
      DECISION_MODEL_BASE_URL: 'http://localhost:11434',
      DECISION_MODEL: 'clef',
      DECISION_MODEL_INPUT_PRICE_PER_MTOK: '0',
      TRIAGE_THRESHOLD: '0.9',
      TRIAGE_BUDGET_USD: '0.1',
    });

    expect(result.ok && result.config).toMatchObject({
      decisionModelBaseUrl: 'http://localhost:11434',
      decisionModel: 'clef',
      decisionModelInputPricePerMTok: 0,
      triageThreshold: 0.9,
      triageBudgetUsd: 0.1,
    });
  });

  it('sin la clave del modelo de decisión, no arranca', () => {
    const withoutKey = Object.fromEntries(
      Object.entries(env).filter(([name]) => name !== 'DECISION_MODEL_API_KEY'),
    );

    expect(loadConfig(withoutKey)).toEqual({
      ok: false,
      error: [
        'La configuración del PR Babysitter no vale (mira .env.example):',
        '- DECISION_MODEL_API_KEY: falta',
      ].join('\n'),
    });
  });

  it('un umbral que no pasa de 0,5 o pasa de 1 no vale', () => {
    const low = loadConfig({ ...env, TRIAGE_THRESHOLD: '0.5' });
    const high = loadConfig({ ...env, TRIAGE_THRESHOLD: '1.2' });

    expect(!low.ok && low.error.split('\n').slice(1)).toEqual([
      '- TRIAGE_THRESHOLD: tiene que ser mayor que 0,5',
    ]);
    expect(!high.ok && high.error.split('\n').slice(1)).toEqual([
      '- TRIAGE_THRESHOLD: no puede pasar de 1',
    ]);
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
        '- DECISION_MODEL_API_KEY: falta',
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
