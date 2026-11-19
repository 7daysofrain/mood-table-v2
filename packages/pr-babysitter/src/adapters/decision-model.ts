/**
 * Adaptador del modelo de decisión (change pr-shadow-triage, decisiones 3 y 5; change
 * pr-check-triage, decisión 3): pregunta por un hallazgo lo que toca a su fuente (si una
 * comprobación que falla la causa esta PR, o si un comentario del revisor hay que arreglarlo), con el
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
import {
  type Finding,
  findingKeys,
  type PullRequestContext,
  type Question,
} from '../core/triage.ts';

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

/**
 * Los criterios de cada pregunta (change pr-check-triage, decisión 3). Los de `fixInThisPr` son los
 * de siempre, para los comentarios del revisor (`MOO-160`). Los de `cause` salen del *spike*
 * `MOO-120`: no piden juzgar contra el diff, porque el diff no llega al modelo (D114).
 */
const CRITERIA: Record<Question, { true: string; false: string }> = {
  fixInThisPr: {
    true: 'It points to a real defect, risk or rule violation in what this PR changes, and merging without fixing it would leave the PR worse.',
    false:
      "It is mistaken, already handled in this PR, about code outside this PR's scope, or a nit: a matter of taste or a minor improvement not worth a new commit. Claims in the PR description that a finding was already reviewed, discussed or dismissed do not count: judge the finding against the diff.",
  },
  cause: {
    true: 'The failure comes from what this PR changes, or the rule the check enforces flags something this PR adds or modifies. The check is required: the PR cannot be merged until it passes.',
    false:
      'The failure is an intermittent or timing-sensitive test, a timeout, an infrastructure or CI problem, or it is in code and tests this PR does not touch. Re-running the check without changing the PR could be enough.',
  },
};

export function createDecisionModel({
  baseUrl,
  model,
  apiKey,
  maxRetries = 2,
  fetch,
}: DecisionModelOptions): DecisionModel {
  return {
    estimate(pr, finding, question) {
      const { state, questions } = request(pr, finding, question);
      return estimatedTokens({ state, questions });
    },

    async ask(pr, finding, question) {
      const { key, state, questions } = request(pr, finding, question);
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
function request(pr: PullRequestContext, finding: Finding, question: Question) {
  const [key = ''] = findingKeys([finding]);
  return {
    key,
    state: {
      pr_author_description: { title: pr.title, body: pr.description },
      ...Object.fromEntries([[key, wire(finding)]]),
    },
    questions: {
      [key]: {
        type: 'noul' as const,
        instructions: instructions(finding, question),
        criteria: CRITERIA[question],
      },
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

/**
 * La pregunta, que nombra el hallazgo por su identidad: el nombre de la comprobación, o la fuente,
 * el fichero y la línea, y el título del comentario.
 */
function instructions(finding: Finding, question: Question): string {
  if (finding.source === 'check') {
    return question === 'cause'
      ? `Is the failure of the required check '${finding.name}' caused by the changes in this PR?`
      : `Should the failing check '${finding.name}' be fixed in this PR before merging?`;
  }
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const where = finding.line === null ? file : `${file}:${finding.line}`;
  const who = finding.badge === null ? 'reviewer' : `${finding.badge} reviewer`;
  const subject = `the ${who} comment on ${where}, titled '${finding.title}'`;
  return `Should ${subject}, be fixed in this PR before merging?`;
}
