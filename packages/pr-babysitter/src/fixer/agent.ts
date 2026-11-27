/**
 * El agente que arregla un hallazgo (change pr-fixer, decisión 5): un `query()` del Claude Agent SDK
 * por hallazgo, en el clon de la PR. Este adaptador es fino a propósito: el `query()` del SDK se le
 * pasa desde `main.ts`, y los tests le pasan uno falso.
 *
 * El agente no hace commit ni push: lo hace el *fixer* (`job.ts`) cuando pasan `lint`, `typecheck` y
 * `test`. Sus herramientas: leer, buscar, editar y Bash solo para esos tres scripts.
 */
import type { Options } from '@anthropic-ai/claude-agent-sdk';

/** Lo que se le pide al agente: dónde trabaja, qué arregla y cuánto puede gastar como mucho. */
export interface FixRequest {
  cwd: string;
  prompt: string;
  budgetUsd: number;
}

/**
 * Cómo ha acabado: ha terminado (`done`), no ha terminado (turnos agotados, un error) o se ha pasado
 * del tope (`budgetSpent`). Con lo gastado, que cuenta también si no ha terminado.
 */
export interface AgentResult {
  outcome: 'done' | 'failed' | 'budgetSpent';
  costUsd: number;
}

export interface FixAgent {
  fix(request: FixRequest): Promise<AgentResult>;
}

/** Lo que se lee de los mensajes del SDK: solo el resultado final. */
export interface AgentMessage {
  type: string;
  subtype?: string;
  is_error?: boolean;
  total_cost_usd?: number;
}

/** La forma del `query()` del SDK que usa el adaptador. */
export type Query = (args: { prompt: string; options: Options }) => AsyncIterable<AgentMessage>;

/** Leer, buscar, editar y Bash solo para las comprobaciones: ni git, ni red, ni otros comandos. */
const ALLOWED_TOOLS = [
  'Read',
  'Grep',
  'Glob',
  'Edit',
  'Write',
  'Bash(pnpm lint)',
  'Bash(pnpm typecheck)',
  'Bash(pnpm test)',
];

export interface ClaudeFixAgentOptions {
  query: Query;
  /** Sonnet por defecto (`FIXER_MODEL`). */
  model: string;
  /** Tope de turnos por hallazgo (`FIXER_MAX_TURNS`). */
  maxTurns: number;
  /** El entorno del proceso del agente: sin la clave de la App ni los ajustes del *fixer*. */
  env: Record<string, string | undefined>;
}

function outcomeOf(result: AgentMessage): AgentResult['outcome'] {
  if (result.subtype === 'error_max_budget_usd') return 'budgetSpent';
  return result.subtype === 'success' && result.is_error !== true ? 'done' : 'failed';
}

export function claudeFixAgent({ query, model, maxTurns, env }: ClaudeFixAgentOptions): FixAgent {
  return {
    async fix({ cwd, prompt, budgetUsd }) {
      let result: AgentMessage | undefined;
      try {
        for await (const message of query({
          prompt,
          options: {
            cwd,
            settingSources: ['project'],
            allowedTools: ALLOWED_TOOLS,
            // Lo que no está en la lista se deniega en vez de preguntar: no hay nadie que conteste.
            permissionMode: 'dontAsk',
            model,
            maxTurns,
            maxBudgetUsd: budgetUsd,
            env,
          },
        })) {
          if (message.type === 'result') result = message;
        }
      } catch {
        // El SDK lanza después de dar un resultado de error: ese resultado ya dice cómo ha acabado.
      }
      if (!result) return { outcome: 'failed', costUsd: 0 };
      return { outcome: outcomeOf(result), costUsd: result.total_cost_usd ?? 0 };
    },
  };
}
