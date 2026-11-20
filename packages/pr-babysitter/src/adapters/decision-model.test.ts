/**
 * Con la respuesta grabada de Clef en la nube de Ollama (`test/fixtures/decision-model/`, paso 1.4
 * del change pr-reviewer-scope, 20-nov): `systemone-88-p2-scope.json` contesta las dos preguntas
 * del alcance sobre un solo hallazgo de la #88, el P2 de `tracking.ts:109`, que va solo en su
 * petición. Las demás respuestas se derivan de la petición, en cada test.
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
  earlierPush: null,
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

/** Una incidencia de SonarQube con su código. */
const sonarIssue: Finding = {
  source: 'sonarIssue',
  rule: 'typescript:S9382',
  ruleName: 'Promises should not be awaited sequentially in a loop',
  severity: 'normal',
  file: 'tooling/ci/check-sonar-issues.ts',
  line: 58,
  message: 'Unexpected `await` inside a loop.',
  code: '   57 |     for (;;) {\n>>   58 |       await sleep(POLL_INTERVAL_MS);',
};

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

/** Responde 0,5 a cada pregunta de la petición, con 100 tokens de entrada. */
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
    const { decisionModel, calls } = model(async () =>
      json(await recorded('systemone-88-p2-scope.json')),
    );

    await decisionModel.ask(context, p2, 'scope');

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

    await decisionModel.ask(context, p1, 'scope');

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

    await decisionModel.ask(context, timedOut, 'cause');

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

  it('con scope, una sola petición con P1, la del spike sin tocar, y P2, cada una con sus criterios (change pr-reviewer-scope, decisiones 1 y 2)', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, p1, 'scope');

    expect(calls).toHaveLength(1);
    expect(sent(calls[0]).questions).toEqual({
      codex_p1_graph_ts_204_inside: {
        type: 'noul',
        instructions:
          "Is fixing the P1 reviewer comment on graph.ts:204, titled 'Prevent pending-notice recovery from requesting a stopped PR review', within the scope of this PR's task?",
        criteria: {
          true: "Fixing it belongs to what this PR's task asks for: it corrects or completes code, tests or docs that the task creates or changes, without work the task leaves to another task and without a design decision outside the task.",
          false:
            "Fixing it needs work this PR's task does not cover: it belongs to another task or story, changes behaviour outside the task's area, or needs a design decision the task does not take. It should be escalated to the maintainer instead of fixed in this PR.",
        },
      },
      codex_p1_graph_ts_204_outside: {
        type: 'noul',
        instructions:
          "Does fixing the P1 reviewer comment on graph.ts:204, titled 'Prevent pending-notice recovery from requesting a stopped PR review', belong to work outside this PR's task, such as another task or story?",
        criteria: {
          true: "Fixing it is work for another task, story or area: this PR's description does not cover the code or behaviour it would change, and it could be done in a separate PR without leaving this PR incomplete or wrong.",
          false:
            "Fixing it belongs to this PR: it corrects or completes what this PR's task creates or changes, even if it needs a design decision. A design decision about this PR's own code is not work for another task.",
        },
      },
    });
  });

  it('sin insignia, las preguntas nombran al revisor sin ella', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, { ...p2, badge: null }, 'scope');
    const questions = Object.values(sent(calls[0]).questions);

    expect(questions.map(({ instructions }) => instructions)).toEqual([
      "Is fixing the reviewer comment on tracking.ts:109, titled 'Route failed checks directly to the final notification', within the scope of this PR's task?",
      "Does fixing the reviewer comment on tracking.ts:109, titled 'Route failed checks directly to the final notification', belong to work outside this PR's task, such as another task or story?",
    ]);
  });

  it('con cause, la pregunta del spike nombra la comprobación, con sus propios criterios', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, check('e2e', 'Error'), 'cause');
    const question = sent(calls[0]).questions.check_e2e;

    expect(Object.keys(sent(calls[0]).questions)).toEqual(['check_e2e']);
    expect(question?.type).toBe('noul');
    expect(question?.instructions).toBe(
      "Is the failure of the required check 'e2e' caused by the changes in this PR?",
    );
    expect(question?.criteria.true).toMatch(/comes from what this PR changes/);
    expect(question?.criteria.true).toMatch(/required/);
    expect(question?.criteria.false).toMatch(/intermittent or timing-sensitive test/);
    expect(question?.criteria.false).toMatch(/timeout/);
    expect(question?.criteria.false).toMatch(/Re-running/);
    // El diff no llega al modelo (D114): los criterios no pueden pedir que se juzgue contra él.
    expect(JSON.stringify(question)).not.toContain('judge the finding against the diff');
  });

  it('una comprobación sigue con una pregunta, la de la causa', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, check('e2e', 'Error'), 'cause');

    expect(Object.keys(sent(calls[0]).questions)).toEqual(['check_e2e']);
  });

  it('las dos claves no pasan de 100 caracteres, también con un fichero de nombre largo', async () => {
    const { decisionModel, calls } = model(answer);
    const long: Finding = { ...p2, file: `src/${'nombre_largo_'.repeat(12)}.ts` };

    await decisionModel.ask(context, long, 'scope');
    const keys = Object.keys(sent(calls[0]).questions);

    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/_inside$/);
    expect(keys[1]).toMatch(/_outside$/);
    for (const key of keys) expect(key.length).toBeLessThanOrEqual(100);
  });

  it('cada hallazgo va en su petición, sin los demás: ya no hay peticiones partidas', async () => {
    const { decisionModel, calls } = model(answer);
    const big = check('e2e', 'x'.repeat(75_000));

    await decisionModel.ask(context, p1, 'scope');
    await decisionModel.ask(context, big, 'cause');

    expect(calls).toHaveLength(2);
    expect(Object.keys(sent(calls[0]).state)).toEqual(['pr_author_description', 'codex_p1_graph_ts_204']);
    expect(Object.keys(sent(calls[1]).state)).toEqual(['pr_author_description', 'check_e2e']);
  });
});

describe('la pregunta de una incidencia de SonarQube (change pr-sonar-issue-triage, decisión 3)', () => {
  const KEY = 'sonar_typescript_s9382_check_sonar_issues_ts_58';

  it('el state lleva la incidencia: su regla, su nombre, su fichero, su línea, su mensaje y su código', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, sonarIssue, 'rule');

    expect(Object.keys(sent(calls[0]).state)).toEqual(['pr_author_description', KEY]);
    expect(sent(calls[0]).state[KEY]).toEqual({
      source: 'sonarqube',
      rule: 'typescript:S9382',
      rule_name: 'Promises should not be awaited sequentially in a loop',
      file: 'tooling/ci/check-sonar-issues.ts',
      line: 58,
      message: 'Unexpected `await` inside a loop.',
      code: '   57 |     for (;;) {\n>>   58 |       await sleep(POLL_INTERVAL_MS);',
    });
  });

  it('una pregunta: si el código tiene el problema que describe la regla, con criterios genéricos', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, sonarIssue, 'rule');
    const { questions } = sent(calls[0]);

    expect(Object.keys(questions)).toEqual([KEY]);
    expect(questions[KEY]?.type).toBe('noul');
    expect(questions[KEY]?.instructions).toBe(
      "Does the code that SonarQube rule typescript:S9382 ('Promises should not be awaited sequentially in a loop') flags on check-sonar-issues.ts:58 actually have the problem the rule describes?",
    );
    expect(questions[KEY]?.criteria.true).toMatch(/does what the rule warns against/);
    expect(questions[KEY]?.criteria.true).toMatch(/even if the change takes work/);
    expect(questions[KEY]?.criteria.false).toMatch(/premise does not hold/);
    expect(questions[KEY]?.criteria.false).toMatch(/A comment saying it is intentional is not enough/);
    // Genéricos: no nombran ninguna regla.
    expect(JSON.stringify(questions[KEY]?.criteria)).not.toMatch(/await|S\d{4}/);
  });

  it('una incidencia de fichero se nombra sin línea', async () => {
    const { decisionModel, calls } = model(answer);

    await decisionModel.ask(context, { ...sonarIssue, line: null }, 'rule');

    expect(Object.values(sent(calls[0]).questions)[0]?.instructions).toContain(
      'flags on check-sonar-issues.ts actually',
    );
  });

  it('da la probabilidad del sí', async () => {
    const { decisionModel } = model(answer);

    await expect(decisionModel.ask(context, sonarIssue, 'rule')).resolves.toEqual({
      answer: { kind: 'answered', probability: 0.5 },
      inputTokens: 100,
    });
  });
});

describe('la respuesta', () => {
  it('a scope, da la probabilidad de P1 (inside) y la de P2 (outside), y los tokens cobrados', async () => {
    const { decisionModel } = model(async () =>
      json(await recorded('systemone-88-p2-scope.json')),
    );

    await expect(decisionModel.ask(context, p2, 'scope')).resolves.toEqual({
      answer: { kind: 'scope', inside: 0.0988, outside: 0.8141 },
      inputTokens: 3179,
    });
  });

  it('a cause, da la probabilidad del sí', async () => {
    const { decisionModel } = model(answer);

    await expect(decisionModel.ask(context, check('e2e', 'Error'), 'cause')).resolves.toEqual({
      answer: { kind: 'answered', probability: 0.5 },
      inputTokens: 100,
    });
  });

  it('si el proveedor da un error, lanza sin tokens cobrados', async () => {
    const { decisionModel } = model(() => json('{"error":"insufficient credits"}', 500));

    const failure = decisionModel.ask(context, p1, 'scope');

    await expect(failure).rejects.toBeInstanceOf(DecisionModelError);
    await expect(failure).rejects.toMatchObject({ inputTokens: 0 });
  });

  it('si falta la respuesta del hallazgo, lanza con los tokens que ya ha cobrado', async () => {
    const { decisionModel } = model(async () =>
      json(await recorded('systemone-88-p2-scope.json')),
    );

    const failure = decisionModel.ask(context, p1, 'scope');

    await expect(failure).rejects.toBeInstanceOf(DecisionModelError);
    await expect(failure).rejects.toMatchObject({ inputTokens: 3179 });
  });

  it('si falta una de las dos respuestas, lanza: sin las dos no se puede clasificar', async () => {
    const { decisionModel } = model(() =>
      json(
        JSON.stringify({
          model: 'clef:27b',
          answers: { codex_p2_tracking_ts_109_inside: { type: 'noul', noul: 0.9 } },
          usage: { input_tokens: 3100, output_tokens: 0 },
        }),
      ),
    );

    const failure = decisionModel.ask(context, p2, 'scope');

    await expect(failure).rejects.toBeInstanceOf(DecisionModelError);
    await expect(failure).rejects.toMatchObject({ inputTokens: 3100 });
  });
});

describe('la estimación del coste (design.md, decisión 5)', () => {
  /** Los tokens de lo que se ha mandado: el `state` y la pregunta de la petición. */
  const sentTokens = (call: Call | undefined) => {
    const { state, questions } = sent(call);
    return Math.ceil(new TextEncoder().encode(JSON.stringify({ state, questions })).length / 3);
  };

  it('cuenta la petición entera de ese hallazgo: la PR, el hallazgo y las dos preguntas con sus criterios', async () => {
    const { decisionModel, calls } = model(answer);

    const estimate = decisionModel.estimate(context, p1, 'scope');
    await decisionModel.ask(context, p1, 'scope');

    expect(Object.keys(sent(calls[0]).questions)).toHaveLength(2);
    expect(estimate).toBe(sentTokens(calls[0]));
  });

  it('sin `usage` en la respuesta, lo cobrado es la estimación', async () => {
    const { decisionModel } = model(() =>
      json(JSON.stringify({ model: 'clef:27b', answers: { check_e2e: { type: 'noul', noul: 0.5 } } })),
    );
    const e2e = check('e2e', 'Error');

    await expect(decisionModel.ask(context, e2e, 'cause')).resolves.toEqual({
      answer: { kind: 'answered', probability: 0.5 },
      inputTokens: decisionModel.estimate(context, e2e, 'cause'),
    });
  });

  it('no llama al modelo', () => {
    const { decisionModel, calls } = model(answer);

    decisionModel.estimate(context, p1, 'scope');

    expect(calls).toEqual([]);
  });
});
