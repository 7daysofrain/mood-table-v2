/**
 * Las comprobaciones antes de cada commit (change pr-fixer, decisión 5): `lint`, `typecheck` y `test`
 * con los scripts del repo, en el clon. `e2e` no: lo pasa la CI tras el push (matiza BE10).
 *
 * Los scripts ejecutan el código que ha escrito el agente, así que corren sin los secretos del
 * *fixer* en su entorno.
 */
import { execFile } from 'node:child_process';

/** Ejecuta un comando y dice si ha acabado bien. */
export type CommandRunner = (
  command: string,
  args: string[],
  options: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<boolean>;

export type GateResult = { passed: true } | { passed: false; failed: string };

export interface Gates {
  run(cwd: string): Promise<GateResult>;
}

const SCRIPTS = ['lint', 'typecheck', 'test'];

/** Los secretos del *fixer*: la clave de Anthropic y todo lo suyo (la App, el repo). */
const SECRET = /^(ANTHROPIC_API_KEY|FIXER_.*)$/;

/** El entorno sin los secretos del *fixer*. */
export function withoutSecrets(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return Object.fromEntries(Object.entries(env).filter(([name]) => !SECRET.test(name)));
}

export function pnpmGates(runner: CommandRunner, env: NodeJS.ProcessEnv): Gates {
  return {
    async run(cwd) {
      for (const script of SCRIPTS) {
        if (!(await runner('pnpm', [script], { cwd, env }))) return { passed: false, failed: script };
      }
      return { passed: true };
    },
  };
}

/** El `CommandRunner` de verdad, con un tiempo máximo por comando. */
export function execRunner(timeoutMs: number, log: (message: string) => void): CommandRunner {
  return (command, args, { cwd, env }) =>
    new Promise((resolve) => {
      execFile(command, args, { cwd, env, timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (error) => {
        if (error) log(`${command} ${args.join(' ')} ha fallado en ${cwd}: ${error.message.split('\n')[0] ?? ''}`);
        resolve(error === null);
      });
    });
}
