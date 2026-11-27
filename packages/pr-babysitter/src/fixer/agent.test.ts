import { describe, expect, it } from 'vitest';

import { type AgentMessage, claudeFixAgent, type Query } from './agent.ts';

/** Un `query()` falso: devuelve esos mensajes y, si se le pide, lanza después, como el SDK. */
function fakeQuery(messages: AgentMessage[], thenThrow = false) {
  const calls: Parameters<Query>[0][] = [];
  const query: Query = (args) => {
    calls.push(args);
    return (async function* () {
      await Promise.resolve();
      yield* messages;
      if (thenThrow) throw new Error('Claude Code process exited with code 1');
    })();
  };
  return { query, calls };
}

const request = { cwd: '/work/pr-12', prompt: 'Arregla `lint`', budgetUsd: 1.5 };

describe('el agente con el Claude Agent SDK (design.md decisión 5)', () => {
  it('trabaja en el clon, con la configuración del proyecto, herramientas limitadas, tope de turnos y lo que queda del tope de gasto', async () => {
    const { query, calls } = fakeQuery([{ type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.2 }]);
    const agent = claudeFixAgent({ query, model: 'claude-sonnet-5-5', maxTurns: 30, env: { PATH: '/usr/bin' } });

    await agent.fix(request);

    expect(calls).toHaveLength(1);
    const { prompt, options } = calls[0]!;
    expect(prompt).toBe('Arregla `lint`');
    expect(options).toMatchObject({
      cwd: '/work/pr-12',
      settingSources: ['project'],
      permissionMode: 'dontAsk',
      model: 'claude-sonnet-5-5',
      maxTurns: 30,
      maxBudgetUsd: 1.5,
      env: { PATH: '/usr/bin' },
    });
    expect(options.allowedTools).toEqual([
      'Read',
      'Grep',
      'Glob',
      'Edit',
      'Write',
      'Bash(pnpm lint)',
      'Bash(pnpm typecheck)',
      'Bash(pnpm test)',
    ]);
  });

  it('un resultado correcto es un arreglo terminado, con su coste', async () => {
    const { query } = fakeQuery([
      { type: 'system', subtype: 'init' },
      { type: 'result', subtype: 'success', is_error: false, total_cost_usd: 0.2 },
    ]);

    const result = await claudeFixAgent({ query, model: 'm', maxTurns: 30, env: {} }).fix(request);

    expect(result).toEqual({ outcome: 'done', costUsd: 0.2 });
  });

  it('al pasar del tope de gasto, lo dice, con lo gastado', async () => {
    const { query } = fakeQuery(
      [{ type: 'result', subtype: 'error_max_budget_usd', is_error: true, total_cost_usd: 1.6 }],
      true,
    );

    const result = await claudeFixAgent({ query, model: 'm', maxTurns: 30, env: {} }).fix(request);

    expect(result).toEqual({ outcome: 'budgetSpent', costUsd: 1.6 });
  });

  it('al agotar los turnos o con un error, no ha terminado, y lo gastado cuenta', async () => {
    const turns = fakeQuery([{ type: 'result', subtype: 'error_max_turns', is_error: true, total_cost_usd: 0.7 }], true);
    const failed = fakeQuery([{ type: 'result', subtype: 'success', is_error: true, total_cost_usd: 0.1 }]);

    expect(await claudeFixAgent({ query: turns.query, model: 'm', maxTurns: 30, env: {} }).fix(request)).toEqual({
      outcome: 'failed',
      costUsd: 0.7,
    });
    expect(await claudeFixAgent({ query: failed.query, model: 'm', maxTurns: 30, env: {} }).fix(request)).toEqual({
      outcome: 'failed',
      costUsd: 0.1,
    });
  });

  it('si el SDK lanza sin dar resultado, no ha terminado y no consta gasto', async () => {
    const { query } = fakeQuery([], true);

    const result = await claudeFixAgent({ query, model: 'm', maxTurns: 30, env: {} }).fix(request);

    expect(result).toEqual({ outcome: 'failed', costUsd: 0 });
  });
});
