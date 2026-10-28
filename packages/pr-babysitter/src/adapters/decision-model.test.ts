/**
 * Con la respuesta grabada de Clef en la nube de Ollama (`test/fixtures/decision-model/`, paso 1.1
 * del change pr-shadow-triage, 28-oct): `systemone-88.json` contesta los dos hallazgos de la #88,
 * el P1 de `graph.ts:204` y el P2 de `tracking.ts:109`. Las respuestas a peticiones partidas se
 * derivan de la petición, en cada test.
 */
import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { type Call, fakeFetch, json } from '../../test/fake-github.ts';
import type { Finding, PullRequestContext } from '../core/triage.ts';
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

const check = (name: string, log: string): Finding => ({ source: 'check', name, log });

function model(respond: (call: Call) => Response | Promise<Response>) {
  const { fetch, calls } = fakeFetch(respond);
  const triager = createDecisionModel({
    baseUrl: 'https://ollama.com',
    model: 'clef:27b',
    apiKey: 'ollama-key',
    maxRetries: 0,
    fetch,
  });
  return { triager, calls };
}

/** Responde 0,5 a cada pregunta de la petición, con 100 tokens de entrada. */
function answerAll(call: Call) {
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

describe('la petición (design.md, decisión 5)', () => {
  it('va al protocolo de decisión del proveedor, con su clave y el modelo fijado', async () => {
    const { triager, calls } = model(async () => json(await recorded('systemone-88.json')));

    await triager.triage(context, [p1, p2]);

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: 'https://ollama.com/v1/systemone',
      authorization: 'Bearer ollama-key',
    });
    expect(sent(calls[0]).model).toBe('clef:27b');
  });

  it('el state lleva la PR en su propio campo y cada hallazgo por su clave', async () => {
    const { triager, calls } = model(answerAll);

    await triager.triage(context, [p1, check('e2e', 'Error: 1 test failed')]);

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
      check_e2e: { source: 'check', name: 'e2e', log_tail: 'Error: 1 test failed' },
    });
  });

  it('una pregunta sí o no por hallazgo, que lo nombra por su identidad', async () => {
    const { triager, calls } = model(answerAll);

    await triager.triage(context, [p1, check('e2e', 'Error')]);
    const { questions } = sent(calls[0]);

    expect(Object.keys(questions)).toEqual(['codex_p1_graph_ts_204', 'check_e2e']);
    expect(questions.codex_p1_graph_ts_204).toMatchObject({
      type: 'noul',
      instructions:
        "Should the P1 reviewer comment on graph.ts:204, titled 'Prevent pending-notice recovery from requesting a stopped PR review', be fixed in this PR before merging?",
    });
    expect(questions.check_e2e?.instructions).toBe(
      "Should the failing check 'e2e' be fixed in this PR before merging?",
    );
  });

  it('los criterios definen el sí y el no, con los nits y la exclusión de la descripción', async () => {
    const { triager, calls } = model(answerAll);

    await triager.triage(context, [p1]);
    const criteria = sent(calls[0]).questions.codex_p1_graph_ts_204?.criteria;

    expect(criteria?.true).toMatch(/real defect, risk or rule violation in what this PR changes/);
    expect(criteria?.false).toMatch(/nit/);
    expect(criteria?.false).toMatch(/Claims in the PR description .* do not count/);
  });
});

describe('la respuesta', () => {
  it('da la probabilidad del sí de cada hallazgo, en su orden, y los tokens cobrados', async () => {
    const { triager } = model(async () => json(await recorded('systemone-88.json')));

    await expect(triager.triage(context, [p1, p2])).resolves.toEqual({
      probabilities: [0.7667, 0.2909],
      inputTokens: 3636,
    });
  });

  it('si falta la respuesta de un hallazgo, lanza', async () => {
    const { triager } = model(async () => json(await recorded('systemone-88.json')));

    await expect(triager.triage(context, [p1, p2, check('e2e', 'Error')])).rejects.toThrow();
  });

  it('si el proveedor da un error, lanza', async () => {
    const { triager } = model(() => json('{"error":"insufficient credits"}', 500));

    await expect(triager.triage(context, [p1])).rejects.toThrow();
  });
});

describe('si la petición no cabe', () => {
  it('con más de 32 preguntas, se parte en varias, cada una con la PR', async () => {
    const { triager, calls } = model(answerAll);
    const findings = Array.from({ length: 33 }, (_, i) => check(`check-${i}`, 'Error'));

    const result = await triager.triage(context, findings);

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(Object.keys(sent(call).questions).length).toBeLessThanOrEqual(32);
      expect(sent(call).state.pr_author_description).toEqual({
        title: context.title,
        body: context.description,
      });
    }
    expect(result).toEqual({ probabilities: findings.map(() => 0.5), inputTokens: 200 });
  });

  it('si no cabe en el contexto del modelo, se parte por hallazgos', async () => {
    const { triager, calls } = model(answerAll);
    /** Unos 25.000 tokens cada uno: caben dos por petición. */
    const findings = ['lint', 'test', 'e2e'].map((name) => check(name, 'x'.repeat(75_000)));

    const result = await triager.triage(context, findings);

    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.body.length / 3).toBeLessThanOrEqual(65_536);
    expect(result.probabilities).toEqual([0.5, 0.5, 0.5]);
  });
});
