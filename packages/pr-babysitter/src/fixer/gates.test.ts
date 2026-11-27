import { describe, expect, it } from 'vitest';

import { type CommandRunner, pnpmGates, withoutSecrets } from './gates.ts';

function fakeRunner(failing: string[] = []) {
  const calls: { command: string; args: string[]; cwd: string; env: NodeJS.ProcessEnv }[] = [];
  const runner: CommandRunner = (command, args, options) => {
    calls.push({ command, args, ...options });
    return Promise.resolve(!failing.includes(args[0] ?? ''));
  };
  return { runner, calls };
}

describe('las comprobaciones antes del commit (design.md decisión 5)', () => {
  it('pasa lint, typecheck y test con pnpm, en el clon', async () => {
    const { runner, calls } = fakeRunner();

    const result = await pnpmGates(runner, { PATH: '/usr/bin' }).run('/work/pr-12');

    expect(result).toEqual({ passed: true });
    expect(calls.map(({ command, args, cwd }) => [command, ...args, cwd])).toEqual([
      ['pnpm', 'lint', '/work/pr-12'],
      ['pnpm', 'typecheck', '/work/pr-12'],
      ['pnpm', 'test', '/work/pr-12'],
    ]);
  });

  it('se para en la primera que falla y dice cuál', async () => {
    const { runner, calls } = fakeRunner(['typecheck']);

    const result = await pnpmGates(runner, {}).run('/work/pr-12');

    expect(result).toEqual({ passed: false, failed: 'typecheck' });
    expect(calls).toHaveLength(2);
  });

  it('no pasa e2e: lo pasa la CI', async () => {
    const { runner, calls } = fakeRunner();

    await pnpmGates(runner, {}).run('/work/pr-12');

    expect(calls.some(({ args }) => args.includes('test:e2e'))).toBe(false);
  });
});

describe('el entorno sin secretos (design.md decisión 4)', () => {
  it('quita la clave de Anthropic y los ajustes del fixer, y deja lo demás', () => {
    expect(
      withoutSecrets({
        PATH: '/usr/bin',
        HOME: '/home/node',
        ANTHROPIC_API_KEY: 'sk-ant',
        FIXER_APP_CLIENT_ID: 'Iv23',
        FIXER_APP_PRIVATE_KEY_FILE: '/run/secrets/key.pem',
      }),
    ).toEqual({ PATH: '/usr/bin', HOME: '/home/node' });
  });
});
