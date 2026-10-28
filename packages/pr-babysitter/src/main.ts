/**
 * Raíz de composición del PR Babysitter (change pr-tracking, decisión 5): el único módulo que
 * conoce a la vez el núcleo y los adaptadores. Lee la configuración del entorno, monta GitHub,
 * Linear, el modelo de decisión del triaje y el driver, y da vueltas hasta que el contenedor lo pare. Si la configuración no vale,
 * dice qué variable falla y termina con código 1. Sin persistencia: al reiniciar, el estado se
 * reconstruye desde GitHub (`MemorySaver` hasta BE7, D73).
 */
import { setTimeout as sleep } from 'node:timers/promises';

import { MemorySaver } from '@langchain/langgraph';

import {
  createCodexReviewReader,
  createCodexReviewRequests,
  parseCodexFinding,
} from './adapters/codex-review.ts';
import { loadConfig } from './adapters/config.ts';
import { createDecisionModel } from './adapters/decision-model.ts';
import { createFindings } from './adapters/findings.ts';
import { createGitHubReader } from './adapters/github.ts';
import { createLinearNotifier } from './adapters/linear.ts';
import { createDriver, runDriver } from './core/driver.ts';

const OWNER = '7daysofrain';
const REPO = 'mood-table-v2';
const BASE_BRANCH = 'main';

const loaded = loadConfig(process.env);
if (!loaded.ok) {
  console.error(loaded.error);
  process.exit(1);
}
const { config } = loaded;
const log = (line: string) => console.error(line);

const github = createGitHubReader({
  owner: OWNER,
  repo: REPO,
  baseBranch: BASE_BRANCH,
  token: () => config.githubToken,
});

const driver = createDriver({
  github,
  reviewer: createCodexReviewReader({
    reviewer: config.githubReviewer,
    listComments: (number) => github.listComments(number),
  }),
  reviewRequests: createCodexReviewRequests({
    maintainer: config.githubMaintainer,
    listComments: (number) => github.listComments(number),
    createComment: (number, body) => github.createComment(number, body),
  }),
  notifier: createLinearNotifier({
    clientId: config.linearClientId,
    clientSecret: config.linearClientSecret,
    maintainerProfileUrl: config.linearMaintainerProfileUrl,
    inboxIssueId: config.linearInboxIssueId,
    log,
  }),
  findings: createFindings({
    reviewer: { login: config.githubReviewer, name: 'Codex', parse: parseCodexFinding },
    github,
  }),
  triager: createDecisionModel({
    baseUrl: config.decisionModelBaseUrl,
    model: config.decisionModel,
    apiKey: config.decisionModelApiKey,
  }),
  triage: {
    threshold: config.triageThreshold,
    budget: {
      capUsd: config.triageBudgetUsd,
      inputPricePerMTok: config.decisionModelInputPricePerMTok,
    },
  },
  checkpointer: new MemorySaver(),
  policy: { maintainer: config.githubMaintainer, baseBranch: BASE_BRANCH },
  timeoutMs: config.trackingTimeoutMs,
  log,
});

const running = runDriver(driver, {
  cadenceMs: config.pollIntervalMs,
  clock: Date.now,
  sleep: (ms) => sleep(ms),
});
console.log(
  `PR Babysitter en marcha: sigue las PR de ${config.githubMaintainer} contra ${BASE_BRANCH} en ` +
    `${OWNER}/${REPO}, cada ${config.pollIntervalMs / 1000} s.`,
);

// Docker para el contenedor con SIGTERM, y Node, como PID 1, no termina solo con esa señal.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.once(signal, () => {
    running.stop();
    process.exit(0);
  });
}
