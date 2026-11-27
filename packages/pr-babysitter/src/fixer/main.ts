/**
 * Raíz de composición del *fixer* (change pr-fixer, decisión 4): el servicio del compose que arregla
 * los hallazgos reales. Escucha en la red interna, guarda los trabajos en su SQLite y los hace de uno
 * en uno con el Claude Agent SDK, y sube los arreglos con la GitHub App.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';

import { query } from '@anthropic-ai/claude-agent-sdk';

import { claudeFixAgent } from './agent.ts';
import { loadFixerConfig } from './config.ts';
import { execRunner, pnpmGates, withoutSecrets } from './gates.ts';
import { gitWorkspace } from './git.ts';
import { installationToken, pullRequestBranch } from './github-app.ts';
import { runJob } from './job.ts';
import { authenticatedRemote, pushBranch } from './push.ts';
import { createFixerServer } from './server.ts';
import { JobStore } from './store.ts';
import { createWorker } from './worker.ts';

const log = (message: string) => {
  console.log(`[fixer] ${message}`);
};

const config = loadFixerConfig(process.env);
const app = { clientId: config.appClientId, privateKey: readFileSync(config.appPrivateKeyFile, 'utf8') };
mkdirSync(dirname(config.dbPath), { recursive: true });
mkdirSync(config.workDir, { recursive: true });

const store = new JobStore(config.dbPath);
// `pnpm install`, las comprobaciones y el agente corren sin la clave de la App ni los ajustes del fixer.
const cleanEnv = withoutSecrets(process.env);
const runner = execRunner(config.commandTimeoutMs, log);
const agent = claudeFixAgent({
  query,
  model: config.model,
  maxTurns: config.maxTurns,
  env: { ...cleanEnv, ANTHROPIC_API_KEY: config.anthropicApiKey },
});
const workspace = gitWorkspace({
  cloneUrl: `https://github.com/${config.repository}.git`,
  root: config.workDir,
  install: async (dir) => {
    if (!(await runner('pnpm', ['install', '--frozen-lockfile'], { cwd: dir, env: cleanEnv }))) {
      throw new Error('pnpm install ha fallado en el clon');
    }
  },
});
const gates = pnpmGates(runner, cleanEnv);
// Un arreglo que lleve en su diff la clave de Anthropic o un trozo de la de la App no se sube.
const keyLines = app.privateKey.split('\n').filter((line) => line.length >= 32 && !line.startsWith('-----'));

const worker = createWorker(
  store,
  async (job) => {
    log(`PR #${job.number} (${job.sha}): ${job.findings.length} hallazgos, quedan ${job.budgetUsd.toFixed(2)} $`);
    const { token } = await installationToken(fetch, app, config.repository, new Date());
    const status = await runJob(job, {
      branch: (number) => pullRequestBranch(fetch, token, config.repository, number),
      workspace,
      agent,
      gates,
      push: (dir, branch) => pushBranch(dir, authenticatedRemote(config.repository, token), branch),
      recordCost: (number, sha, usd) => {
        store.addCost(number, sha, usd);
      },
      author: config.author,
      secrets: [config.anthropicApiKey, token, ...keyLines],
      log,
    });
    log(`PR #${job.number} (${job.sha}): ${status.state}; la PR lleva ${store.spent(job.number).toFixed(4)} $`);
    return status;
  },
  log,
);

createFixerServer(store, () => {
  worker.wake();
}).listen(config.port, '0.0.0.0', () => {
  log(`Escuchando en el puerto ${config.port}, para ${config.repository}, con ${config.model}`);
});
// Los trabajos que quedaron en cola antes de un reinicio.
worker.wake();
