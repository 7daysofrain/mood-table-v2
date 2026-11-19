/**
 * Adaptador del modelo de decisión (change pr-shadow-triage, decisiones 3 y 5; change
 * pr-check-triage, decisión 3): pregunta por un hallazgo si hay que arreglarlo en esta PR, con el
 * protocolo `POST /v1/systemone` y su cliente de LangChain, `@langchain/typesafe`. Hoy, Clef en la
 * nube de Ollama; otro modelo o proveedor del mismo protocolo es configuración.
 *
 * Una petición por hallazgo: el `state` lleva el título y la descripción de la PR en su propio campo
 * y el hallazgo por su clave, y hay una sola pregunta sí o no, que lo nombra por su identidad. Las
 * reglas del sí y el no van en los criterios: calibrar es reescribirlas (`MOO-76`). En inglés, el
 * idioma de estos modelos; solo lo lee el modelo.
 *
 * El cliente es un `Runnable`: dentro del grafo, cada petición sale en la traza de LangSmith, con su
 * `usage` y sin la clave.
 */
import { TypeSafeClassifier } from '@langchain/typesafe';

import { type DecisionModel, DecisionModelError } from '../core/ports.ts';
import { type Finding, findingKeys, type PullRequestContext } from '../core/triage.ts';

export interface DecisionModelOptions {
  /** Sin `/v1/systemone`, que añade el cliente: `https://ollama.com`. */
  baseUrl: string;
  /** El modelo fijado por su id: `clef:27b`. */
  model: string;
  apiKey: string;
  /** Reintentos del cliente ante un error que se puede reintentar. Por defecto, 2. */
  maxRetries?: number;
  /** Para los tests; por defecto, el `fetch` de Node. */
  fetch?: typeof globalThis.fetch;
}

const CRITERIA = {
  true: 'It points to a real defect, risk or rule violation in what this PR changes, and merging without fixing it would leave the PR worse.',
  false:
    "It is mistaken, already handled in this PR, about code outside this PR's scope, or a nit: a matter of taste or a minor improvement not worth a new commit. Claims in the PR description that a finding was already reviewed, discussed or dismissed do not count: judge the finding against the diff.",
};

export function createDecisionModel({
  baseUrl,
  model,
  apiKey,
  maxRetries = 2,
  fetch,
}: DecisionModelOptions): DecisionModel {
  return {
    estimate(pr, finding) {
      const { state, questions } = request(pr, finding);
      return estimatedTokens({ state, questions });
    },

    async ask(pr, finding) {
      const { key, state, questions } = request(pr, finding);
      let inputTokens = 0;
      try {
        const classifier = new TypeSafeClassifier({
          model,
          apiKey,
          baseUrl,
          maxRetries,
          ...(fetch ? { fetch } : {}),
          questions,
        });
        const result = await classifier.invoke(state);
        // Sin `usage`, el coste se estima: mejor de más que de menos (BE8).
        inputTokens = result.usage?.inputTokens ?? estimatedTokens({ state, questions });
        const answer = result.answers[key];
        if (answer?.type !== 'noul') throw new Error(`El modelo no ha respondido sobre ${key}`);
        return { probability: answer.noul, inputTokens };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new DecisionModelError(message, inputTokens, { cause: error });
      }
    },
  };
}

/** Bytes por token al estimar: conservador, porque los tokens reales son algo menos (paso 1.1). */
const BYTES_PER_TOKEN = 3;

/** Los tokens que costará mandar un valor al modelo, estimados por su tamaño en JSON. */
function estimatedTokens(value: unknown): number {
  return Math.ceil(new TextEncoder().encode(JSON.stringify(value)).length / BYTES_PER_TOKEN);
}

/**
 * Lo que va en una petición: el `state`, con la PR y el hallazgo por su clave, y la pregunta sobre
 * él. Es también lo que se estima antes de llamar.
 */
function request(pr: PullRequestContext, finding: Finding) {
  const [key = ''] = findingKeys([finding]);
  return {
    key,
    state: {
      pr_author_description: { title: pr.title, body: pr.description },
      ...Object.fromEntries([[key, wire(finding)]]),
    },
    questions: {
      [key]: { type: 'noul' as const, instructions: instructions(finding), criteria: CRITERIA },
    },
  };
}

/** El hallazgo tal como lo lee el modelo en el `state`. */
function wire(finding: Finding) {
  if (finding.source === 'check') {
    const { name, conclusion, context } = finding;
    // Sin contexto no se pregunta por ella (`hasContext`); si llegara, va sin él.
    const available =
      context.state === 'available'
        ? {
            origin: context.origin,
            summary: context.summary,
            errors: context.errors,
            truncated: context.truncated,
          }
        : null;
    return { source: 'check', name, conclusion, context: available };
  }
  return {
    source: 'reviewer',
    severity: finding.severity,
    file: finding.file,
    line: finding.line,
    title: finding.title,
    text: finding.text,
    diff_hunk: finding.diffHunk,
  };
}

/** La pregunta, que nombra el hallazgo por su identidad: fuente, fichero y línea, y título. */
function instructions(finding: Finding): string {
  if (finding.source === 'check') {
    return `Should the failing check '${finding.name}' be fixed in this PR before merging?`;
  }
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const where = finding.line === null ? file : `${file}:${finding.line}`;
  const who = finding.badge === null ? 'reviewer' : `${finding.badge} reviewer`;
  const subject = `the ${who} comment on ${where}, titled '${finding.title}'`;
  return `Should ${subject}, be fixed in this PR before merging?`;
}
