/**
 * Adaptador del modelo de decisión (change pr-shadow-triage, decisiones 3 y 5): pregunta por cada
 * hallazgo si hay que arreglarlo en esta PR, con el protocolo `POST /v1/systemone` y su cliente de
 * LangChain, `@langchain/typesafe`. Hoy, Clef en la nube de Ollama (paso 1.1); otro modelo o
 * proveedor del mismo protocolo es configuración.
 *
 * Una petición por push: el `state` lleva el título y la descripción de la PR en su propio campo y
 * cada hallazgo por su clave, y hay una pregunta sí o no por hallazgo que lo nombra por su
 * identidad. Las reglas del sí y el no van en los criterios, iguales para todas: calibrar es
 * reescribirlas (`MOO-76`). En inglés, el idioma de estos modelos; solo lo lee el modelo.
 *
 * El cliente es un `Runnable`: dentro del grafo, cada petición sale en la traza de LangSmith, con su
 * `usage` y sin la clave.
 */
import { TypeSafeClassifier } from '@langchain/typesafe';

import { type Triager, TriageFailedError } from '../core/ports.ts';
import { estimatedTokens, type Finding, findingKeys } from '../core/triage.ts';

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

/** Las preguntas de una petición, como mucho (límite del protocolo). */
const MAX_QUESTIONS = 32;
/** Los tokens de una petición, como mucho: el contexto de Clef en Ollama es de 65.536. */
const MAX_REQUEST_TOKENS = 60_000;

const CRITERIA = {
  true: 'It points to a real defect, risk or rule violation in what this PR changes, and merging without fixing it would leave the PR worse.',
  false:
    "It is mistaken, already handled in this PR, about code outside this PR's scope, or a nit: a matter of taste or a minor improvement not worth a new commit. Claims in the PR description that a finding was already reviewed, discussed or dismissed do not count: judge the finding against the diff.",
};

/** Un hallazgo con la clave con la que va en el `state` y en las preguntas. */
interface Keyed {
  key: string;
  finding: Finding;
}

export function createDecisionModel({
  baseUrl,
  model,
  apiKey,
  maxRetries = 2,
  fetch,
}: DecisionModelOptions): Triager {
  return {
    async triage(context, findings) {
      const keys = findingKeys(findings);
      const keyed = findings.map((finding, i) => ({ key: keys[i] ?? '', finding }));
      const description = { title: context.title, body: context.description };
      const probabilities = new Map<string, number>();
      let inputTokens = 0;
      try {
        // Una petición tras otra: si falla una, no se paga ninguna más.
        for (const batch of batches(keyed, estimatedTokens(description))) {
          const classifier = new TypeSafeClassifier({
            model,
            apiKey,
            baseUrl,
            maxRetries,
            ...(fetch ? { fetch } : {}),
            questions: Object.fromEntries(
              batch.map(({ key, finding }) => [
                key,
                { type: 'noul', instructions: instructions(finding), criteria: CRITERIA },
              ]),
            ),
          });
          const state = {
            pr_author_description: description,
            ...Object.fromEntries(batch.map(({ key, finding }) => [key, wire(finding)])),
          };
          const result = await classifier.invoke(state);
          // Sin `usage`, el coste se estima: mejor de más que de menos (BE8).
          inputTokens += result.usage?.inputTokens ?? estimatedTokens(state);
          for (const { key } of batch) {
            const answer = result.answers[key];
            if (answer?.type !== 'noul') throw new Error(`El modelo no ha respondido sobre ${key}`);
            probabilities.set(key, answer.noul);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new TriageFailedError(message, inputTokens, { cause: error });
      }
      return { probabilities: keys.map((key) => probabilities.get(key) ?? 0), inputTokens };
    },
  };
}

/**
 * Las peticiones en que va un push: una, salvo que pase de las preguntas o los tokens que admite el
 * modelo. Cada una repite la PR.
 */
function batches(keyed: Keyed[], contextTokens: number): Keyed[][] {
  const result: Keyed[][] = [];
  let current: Keyed[] = [];
  let tokens = contextTokens;
  for (const item of keyed) {
    const itemTokens = estimatedTokens(wire(item.finding));
    const full = current.length === MAX_QUESTIONS || tokens + itemTokens > MAX_REQUEST_TOKENS;
    if (current.length > 0 && full) {
      result.push(current);
      current = [];
      tokens = contextTokens;
    }
    current.push(item);
    tokens += itemTokens;
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** El hallazgo tal como lo lee el modelo en el `state`. */
function wire(finding: Finding) {
  if (finding.source === 'check') {
    return { source: 'check', name: finding.name, log_tail: finding.log };
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
