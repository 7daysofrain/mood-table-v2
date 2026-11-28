/**
 * La configuración del *fixer* (change pr-fixer, decisiones 2, 4 y 5), de su propio `fixer.env`, aparte
 * del `.env` del babysitter: no ve el PAT, ni Linear, ni Ollama, ni LangSmith. Se valida con zod al
 * arrancar: si falta algo o no vale, no arranca y dice qué variable.
 */
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import * as z from 'zod';

const required = z.string().trim().min(1, 'falta');
const positiveInteger = z.coerce
  .number('no es un número')
  .int('no es un número entero')
  .positive('tiene que ser mayor que 0');

const envSchema = z.object({
  ANTHROPIC_API_KEY: required,
  FIXER_APP_CLIENT_ID: required,
  FIXER_APP_PRIVATE_KEY_FILE: required,
  FIXER_REPOSITORY: required.regex(/^[\w.-]+\/[\w.-]+$/, 'no es owner/name'),
  FIXER_PORT: positiveInteger.default(8080),
  FIXER_DB_PATH: required.default('/data/fixer.sqlite'),
  FIXER_WORK_DIR: required.default(join(tmpdir(), 'fixer')),
  FIXER_MODEL: required.default('claude-sonnet-5-5'),
  // Tope de turnos por hallazgo (design.md, preguntas abiertas): se fija con la prueba a mano.
  FIXER_MAX_TURNS: positiveInteger.default(40),
  // Lo más que puede tardar `pnpm install`, `lint`, `typecheck` o `test` en el clon.
  FIXER_COMMAND_TIMEOUT_MINUTES: positiveInteger.default(15),
  // Autor y committer de los commits: el usuario bot de la App en GitHub.
  FIXER_GIT_NAME: required.default('mood-table-pr-babysitter[bot]'),
  FIXER_GIT_EMAIL: required.default('361920848+mood-table-pr-babysitter[bot]@users.noreply.github.com'),
});

export interface FixerConfig {
  anthropicApiKey: string;
  appClientId: string;
  appPrivateKeyFile: string;
  /** El repo, como `owner/name`. */
  repository: string;
  port: number;
  dbPath: string;
  workDir: string;
  model: string;
  maxTurns: number;
  commandTimeoutMs: number;
  author: { name: string; email: string };
}

/** Lee la configuración del entorno. Lanza con cada variable que falta o no vale. */
export function loadFixerConfig(env: NodeJS.ProcessEnv): FixerConfig {
  // Una variable vacía del `fixer.env` cuenta como que no está: vale su valor por defecto.
  const present = Object.fromEntries(Object.entries(env).filter(([, value]) => value !== ''));
  const parsed = envSchema.safeParse(present);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => {
      const name = issue.path.join('.');
      return `${name}: ${name in present ? issue.message : 'falta'}`;
    });
    throw new Error(`La configuración del fixer no vale:\n${problems.join('\n')}`);
  }
  const e = parsed.data;
  return {
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    appClientId: e.FIXER_APP_CLIENT_ID,
    appPrivateKeyFile: e.FIXER_APP_PRIVATE_KEY_FILE,
    repository: e.FIXER_REPOSITORY,
    port: e.FIXER_PORT,
    dbPath: e.FIXER_DB_PATH,
    workDir: e.FIXER_WORK_DIR,
    model: e.FIXER_MODEL,
    maxTurns: e.FIXER_MAX_TURNS,
    commandTimeoutMs: e.FIXER_COMMAND_TIMEOUT_MINUTES * 60_000,
    author: { name: e.FIXER_GIT_NAME, email: e.FIXER_GIT_EMAIL },
  };
}
