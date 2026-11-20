/**
 * Adaptador del modelo de decisión (change pr-shadow-triage, decisiones 3 y 5; change
 * pr-check-triage, decisión 3; change pr-reviewer-scope, decisiones 1 y 2): pregunta por un hallazgo
 * lo que toca a su fuente (si una comprobación que falla la causa esta PR, o si el arreglo de un
 * comentario del revisor cae dentro del alcance de la PR y si es trabajo de otra tarea), con el
 * protocolo `POST /v1/systemone` y su cliente de LangChain, `@langchain/typesafe`. Hoy, Clef en la
 * nube de Ollama; otro modelo o proveedor del mismo protocolo es configuración.
 *
 * Una petición por hallazgo: el `state` lleva el título y la descripción de la PR en su propio campo
 * y el hallazgo por su clave, y las preguntas sí o no, que lo nombran por su identidad: una por la
 * causa, o P1 y P2 por el alcance, sobre el mismo `state`. Las reglas del sí y el no van en los
 * criterios: calibrar es reescribirlas (`MOO-76`). En inglés, el idioma de estos modelos; solo lo lee
 * el modelo.
 *
 * El cliente es un `Runnable`: dentro del grafo, cada petición sale en la traza de LangSmith, con su
 * `usage` y sin la clave.
 */
import { type Answer, TypeSafeClassifier } from '@langchain/typesafe';

import { type DecisionModel, DecisionModelError } from '../core/ports.ts';
import {
  type Finding,
  findingKeys,
  type ModelAnswer,
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
 * Los criterios de cada pregunta sí o no. Los de la causa (change pr-check-triage, decisión 3) y los
 * de P1, la pregunta del alcance (`inside`), salen del *spike* `MOO-120`, sin tocar: cambiarlos
 * perdería la línea base medida. No piden juzgar contra el diff, porque el diff no llega al modelo
 * (D114). Los de P2 (`outside`) son nuevos (change pr-reviewer-scope, decisión 1): su *no* dice que
 * una decisión de diseño sobre el código de la PR no es de otra tarea, para que un hallazgo de diseño
 * no acabe capturado como trabajo aparte.
 */
const CRITERIA = {
  cause: {
    true: 'The failure comes from what this PR changes, or the rule the check enforces flags something this PR adds or modifies. The check is required: the PR cannot be merged until it passes.',
    false:
      'The failure is an intermittent or timing-sensitive test, a timeout, an infrastructure or CI problem, or it is in code and tests this PR does not touch. Re-running the check without changing the PR could be enough.',
  },
  inside: {
    true: "Fixing it belongs to what this PR's task asks for: it corrects or completes code, tests or docs that the task creates or changes, without work the task leaves to another task and without a design decision outside the task.",
    false:
      "Fixing it needs work this PR's task does not cover: it belongs to another task or story, changes behaviour outside the task's area, or needs a design decision the task does not take. It should be escalated to the maintainer instead of fixed in this PR.",
  },
  outside: {
    true: "Fixing it is work for another task, story or area: this PR's description does not cover the code or behaviour it would change, and it could be done in a separate PR without leaving this PR incomplete or wrong.",
    false:
      "Fixing it belongs to this PR: it corrects or completes what this PR's task creates or changes, even if it needs a design decision. A design decision about this PR's own code is not work for another task.",
  },
} as const;

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
      const { state, questions, answer } = request(pr, finding, question);
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
        return { answer: answer(result.answers), inputTokens };
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

/** Límite de Ollama para la clave de una pregunta (change pr-shadow-triage, decisión 2). */
const MAX_KEY_LENGTH = 100;

/**
 * Lo que va en una petición: el `state`, con la PR y el hallazgo por su clave, y las preguntas sobre
 * él (`state` y `questions` son también lo que se estima antes de llamar); y cómo se lee la
 * respuesta.
 *
 * Con `cause`, una pregunta con la clave del hallazgo. Con `scope`, dos sobre el mismo `state`, con
 * la clave del hallazgo y `_inside` (P1) o `_outside` (P2), cortada para que las dos quepan en el
 * límite (change pr-reviewer-scope, decisión 2).
 */
function request(pr: PullRequestContext, finding: Finding, question: Question) {
  const [key = ''] = findingKeys([finding]);
  const state = {
    pr_author_description: { title: pr.title, body: pr.description },
    ...Object.fromEntries([[key, wire(finding)]]),
  };
  if (question === 'cause') {
    return {
      state,
      questions: {
        [key]: noul(
          `Is the failure of ${subject(finding)} caused by the changes in this PR?`,
          CRITERIA.cause,
        ),
      },
      answer: (answers: Record<string, Answer>): ModelAnswer => ({
        kind: 'answered',
        probability: probability(answers, key),
      }),
    };
  }
  const base = key.slice(0, MAX_KEY_LENGTH - '_outside'.length);
  const inside = `${base}_inside`;
  const outside = `${base}_outside`;
  return {
    state,
    questions: {
      [inside]: noul(
        `Is fixing ${subject(finding)}, within the scope of this PR's task?`,
        CRITERIA.inside,
      ),
      [outside]: noul(
        `Does fixing ${subject(finding)}, belong to work outside this PR's task, such as another task or story?`,
        CRITERIA.outside,
      ),
    },
    answer: (answers: Record<string, Answer>): ModelAnswer => ({
      kind: 'scope',
      inside: probability(answers, inside),
      outside: probability(answers, outside),
    }),
  };
}

function noul(instructions: string, criteria: { true: string; false: string }) {
  return { type: 'noul' as const, instructions, criteria };
}

/** La probabilidad del sí a una pregunta; sin ella no se puede clasificar, así que lanza. */
function probability(answers: Record<string, Answer>, key: string): number {
  const answer = answers[key];
  if (answer?.type !== 'noul') throw new Error(`El modelo no ha respondido sobre ${key}`);
  return answer.noul;
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
 * El hallazgo por su identidad, como lo nombran las preguntas: el nombre de la comprobación, o la
 * insignia, el fichero y la línea, y el título del comentario.
 */
function subject(finding: Finding): string {
  if (finding.source === 'check') return `the required check '${finding.name}'`;
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const where = finding.line === null ? file : `${file}:${finding.line}`;
  const who = finding.badge === null ? 'reviewer' : `${finding.badge} reviewer`;
  return `the ${who} comment on ${where}, titled '${finding.title}'`;
}
