/**
 * Con la respuesta grabada de Clef en la nube de Ollama (`test/fixtures/decision-model/`, paso 2.1
 * del change pr-check-triage, 14-nov): `systemone-88-p2.json` contesta un solo hallazgo de la #88,
 * el P2 de `tracking.ts:109`, que va solo en su petición. Las demás respuestas se derivan de la
 * petición, en cada test.
 */
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { type Call, fakeFetch, json } from '../../test/fake-github.ts';
import type { Finding, PullRequestContext } from '../core/triage.ts';
import { DecisionModelError } from '../core/ports.ts';
import { createDecisionModel } from './decision-model.ts';

async function recorded(name: string): Promise<string> {
  return readFile(new URL(`../../test/fixtures/decision-model/${name}`, import.meta.url), 'utf8');
}

const context: PullRequestContext = {
  title: 'Pedir la revisión firmada cuando las comprobaciones pasan',
  description: 'Fixes MOO-90',
};

const p1: Finding = {
  source: 'reviewer',
  reviewer: 'Codex',
  badge: 'P1',
  severity: 'high',
  file: 'packages/pr-babysitter/src/core/graph.ts',
  line: 204,
  title: 'Prevent pending-notice recovery from requesting a stopped PR review',
  text: 'If Linear rejects `avisarComprobaciones`…',
  diffHunk: '@@ -190,6 +190,20 @@',
};

const p2: Finding = {
  ...p1,
  badge: 'P2',
  severity: 'normal',
  file: 'packages/pr-babysitter/src/core/tracking.ts',
  line: 109,
  title: 'Route failed checks directly to the final notification',
};

/** Una comprobación que falla, con el paso que falla de su log por contexto. */
const check = (name: string, summary: string): Finding => ({
  source: 'check',
  name,
  conclusion: 'failure',
  context: { state: 'available', origin: 'log', summary, errors: [], truncated: false },
});

function model(respond: (call: Call) => Response | Promise<Response>) {
  const { fetch, calls } = fakeFetch(respond);
  const decisionModel = createDecisionModel({
    baseUrl: 'https://ollama.com',
    model: 'clef:27b',
    apiKey: 'ollama-key',
    maxRetries: 0,
    fetch,
  });
  return { decisionModel, calls };
}

/** Responde 0,5 a la pregunta de la petición, con 100 tokens de entrada. */
function answer(call: Call) {
  const { questions } = JSON.parse(call.body) as { questions: Record<string, unknown> };
  const answers = Object.fromEntries(
    Object.keys(questions).map((key) => [key, { type: 'noul', noul: 0.5 }]),
  );
  return json(JSON.stringify({ model: 'clef:27b', answers, usage: { input_tokens: 100, output_tokens: 0 } }));
}

interface SentRequest {
  model: string;
  state: Record<string, Record<string, unknown>>;
  questions: Record<string, { type: string; instructions: string; criteria: { true: string; false: string } }>;
}

const sent = (call: Call | undefined) => JSON.parse(call?.body ?? '{}') as SentRequest;

describe('la petición (change pr-check-triage, design.md, decisión 3)', () => {
  it('va al protocolo de decisión del proveedor, con su clave y el modelo fijado', async () => {
    const { decisionModel, calls } = model(async () => json(await recorded('systemone-88-p2.json')));

    await decisionModel.ask(context, p2);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://ollama.com/v1/systemone',
      authorization: 'Bearer ollama-key',
    });
    expect(sent(calls[0]).model).toBe('clef:27b');
  });

  it('el state lleva la PR en su propio campo y un solo hallazgo, por su clave', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, p1);

    expect(sent(calls[0]).state).toEqual({
      pr_author_description: { title: context.title, body: context.description },
      codex_p1_graph_ts_204: {
        source: 'reviewer',
        severity: 'high',
        file: p1.file,
        line: 204,
        title: p1.title,
        text: p1.source === 'reviewer' ? p1.text : '',
        diff_hunk: '@@ -190,6 +190,20 @@',
      },
    });
  });

  it('una comprobación lleva cómo acabó y su contexto: el origen, el resumen, los errores y si se cortó', async () => {
    const { decisionModel, calls } = model(answer);
    const errors = [
      {
        file: 'e2e/playback.spec.ts',
        line: 189,
        title: '[chromium] › playback.spec.ts:177:1',
        message: 'Expected: 0\nReceived: 1',
      },
    ];
    const timedOut: Finding = {
      source: 'check',
      name: 'e2e',
      conclusion: 'timed_out',
      context: { state: 'available', origin: 'annotations', summary: '1 failed', errors, truncated: true },
    };

    await decisionModel.ask(context, timedOut);

    expect(sent(calls[0]).state).toEqual({
      pr_author_description: { title: context.title, body: context.description },
      check_e2e: {
        source: 'check',
        name: 'e2e',
        conclusion: 'timed_out',
        context: { origin: 'annotations', summary: '1 failed', errors, truncated: true },
      },
    });
    expect(JSON.stringify(sent(calls[0]).state)).not.toContain('log_tail');
  });

  it('una sola pregunta sí o no, la de hoy, que nombra el hallazgo por su identidad', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, p1);
    await decisionModel.ask(context, check('e2e', 'Error'));

    expect(sent(calls[0]).questions).toEqual({
      codex_p1_graph_ts_204: expect.objectContaining({
        type: 'noul',
        instructions:
          "Should the P1 reviewer comment on graph.ts:204, titled 'Prevent pending-notice recovery from requesting a stopped PR review', be fixed in this PR before merging?",
      }) as unknown,
    });
    expect(sent(calls[1]).questions).toEqual({
      check_e2e: expect.objectContaining({
        instructions: "Should the failing check 'e2e' be fixed in this PR before merging?",
      }) as unknown,
    });
  });

  it('los criterios definen el sí y el no, con los nits y la exclusión de la descripción', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, p1);
    const criteria = sent(calls[0]).questions.codex_p1_graph_ts_204?.criteria;

    expect(criteria?.true).toMatch(/real defect, risk or rule violation in what this PR changes/);
    expect(criteria?.false).toMatch(/nit/);
    expect(criteria?.false).toMatch(/Claims in the PR description .* do not count/);
  });

  it('cada hallazgo va en su petición, sin los demás: ya no hay peticiones partidas', async () => {
    const { decisionModel, calls } = model(answer);
    const big = check('e2e', 'x'.repeat(75_000));

    await decisionModel.ask(context, p1);
    await decisionModel.ask(context, big);

    expect(calls).toHaveLength(2);
    expect(Object.keys(sent(calls[0]).state)).toEqual(['pr_author_description', 'codex_p1_graph_ts_204']);
    expect(Object.keys(sent(calls[1]).state)).toEqual(['pr_author_description', 'check_e2e']);
  });
});

describe('la respuesta', () => {
  it('da la probabilidad del sí del hallazgo y los tokens cobrados', async () => {
    const { decisionModel } = model(async () => json(await recorded('systemone-88-p2.json')));

    await expect(decisionModel.ask(context, p2)).resolves.toEqual({
      probability: 0.3049,
      inputTokens: 2965,
    });
  });

  it('si el proveedor da un error, lanza sin tokens cobrados', async () => {
    const { decisionModel } = model(() => json('{"error":"insufficient credits"}', 500));

    const failure = decisionModel.ask(context, p1);

    await expect(failure).rejects.toBeInstanceOf(DecisionModelError);
    await expect(failure).rejects.toMatchObject({ inputTokens: 0 });
  });

  it('si falta la respuesta del hallazgo, lanza con los tokens que ya ha cobrado', async () => {
    const { decisionModel } = model(async () => json(await recorded('systemone-88-p2.json')));

    const failure = decisionModel.ask(context, p1);

    await expect(failure).rejects.toBeInstanceOf(DecisionModelError);
    await expect(failure).rejects.toMatchObject({ inputTokens: 2965 });
  });
});

describe('la estimación del coste (design.md, decisión 5)', () => {
  /** Los tokens de lo que se ha mandado: el `state` y la pregunta de la petición. */
  const sentTokens = (call: Call | undefined) => {
    const { state, questions } = sent(call);
    return Math.ceil(new TextEncoder().encode(JSON.stringify({ state, questions })).length / 3);
  };

  it('cuenta la petición entera de ese hallazgo: la PR, el hallazgo y la pregunta con sus criterios', async () => {
    const { decisionModel, calls } = model(answer);

    const estimate = decisionModel.estimate(context, p1);
    await decisionModel.ask(context, p1);

    expect(estimate).toBe(sentTokens(calls[0]));
  });

  it('sin `usage` en la respuesta, lo cobrado es la estimación', async () => {
    const { decisionModel } = model(() =>
      json(JSON.stringify({ model: 'clef:27b', answers: { check_e2e: { type: 'noul', noul: 0.5 } } })),
    );
    const e2e = check('e2e', 'Error');

    await expect(decisionModel.ask(context, e2e)).resolves.toEqual({
      probability: 0.5,
      inputTokens: decisionModel.estimate(context, e2e),
    });
  });

  it('no llama al modelo', () => {
    const { decisionModel, calls } = model(answer);

    decisionModel.estimate(context, p1);

    expect(calls).toEqual([]);
  });
});
