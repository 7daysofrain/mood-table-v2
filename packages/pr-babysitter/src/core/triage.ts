/**
 * Las reglas del triaje en modo sombra (change pr-shadow-triage, decisiones 2, 4 y 6): qué es un
 * hallazgo, su clave, cuánto cabe en el tope de gasto de la PR y su clase. Funciones puras: el
 * modelo de decisión solo da una probabilidad por hallazgo, y todo lo demás se decide aquí.
 *
 * Se valida con zod, porque el hallazgo y su veredicto van en el estado del grafo (D65).
 */
import * as z from 'zod';

/**
 * Un hallazgo del último push (glosario de PB): un comentario del revisor o una comprobación que
 * falla. Su contexto (el trozo de diff que comenta el revisor, el final del log del paso que falla)
 * es `null` si no se ha podido reunir.
 */
export const findingSchema = z.discriminatedUnion('source', [
  z.object({
    source: z.literal('reviewer'),
    /** El nombre del revisor, para nombrar el hallazgo: `Codex`. */
    reviewer: z.string(),
    /** Su insignia de severidad, tal como la pone el revisor: `P1`. */
    badge: z.string().nullable(),
    /** La severidad en el idioma del sistema: alta es la que no se descarta sin criterio. */
    severity: z.enum(['high', 'normal']),
    file: z.string(),
    /** `null` si el comentario es del fichero entero. */
    line: z.number().int().nullable(),
    title: z.string(),
    text: z.string(),
    diffHunk: z.string().nullable(),
  }),
  z.object({
    source: z.literal('check'),
    name: z.string(),
    log: z.string().nullable(),
  }),
]);

export type Finding = z.infer<typeof findingSchema>;

/** Lo común a todos los hallazgos de la PR: su título y su descripción (decisión 5). */
export interface PullRequestContext {
  title: string;
  description: string;
}

/** Las tres clases del triaje (glosario de PB): real, no aplica y exige criterio. */
export const triageClassSchema = z.enum(['valid', 'notApplicable', 'needsJudgment']);

export type TriageClass = z.infer<typeof triageClassSchema>;

/** Por qué no se ha preguntado por un hallazgo, o no ha habido respuesta (reglas 1 a 3). */
const unansweredSchema = z.enum(['noContext', 'overBudget', 'modelUnavailable']);

/** Lo que se sabe de un hallazgo antes de clasificarlo: la probabilidad del sí, o por qué no la hay. */
export type TriageAnswer =
  | { kind: z.infer<typeof unansweredSchema> }
  | { kind: 'answered'; probability: number };

/**
 * La clase de un hallazgo y por qué (BE4): una de las reglas, o la probabilidad del sí frente al
 * umbral. Con probabilidad, se guarda siempre, para que `MOO-76` elija el corte sobre ella.
 */
export const verdictSchema = z.union([
  z.object({ class: z.literal('needsJudgment'), reason: unansweredSchema }),
  z.object({
    class: triageClassSchema,
    reason: z.enum(['probability', 'highSeverity']),
    probability: z.number(),
  }),
]);

export type Verdict = z.infer<typeof verdictSchema>;

/**
 * La clase de un hallazgo (decisión 4), en el orden de la tabla: sin probabilidad, exige criterio
 * con su motivo; con ella, real si llega al umbral, no aplica si no pasa de su complemento (salvo
 * que sea de severidad alta) y exige criterio entre los dos. El umbral es mayor que 0,5, así que
 * los dos cortes no se cruzan (lo valida la configuración).
 */
export function classify(finding: Finding, answer: TriageAnswer, threshold: number): Verdict {
  if (answer.kind !== 'answered') return { class: 'needsJudgment', reason: answer.kind };
  const { probability } = answer;
  if (probability >= threshold) return { class: 'valid', reason: 'probability', probability };
  // `1 - p >= umbral` y no `p <= 1 - umbral`: con coma flotante, 1 - 0,80 no llega a 0,20.
  if (1 - probability >= threshold) {
    if (finding.source === 'reviewer' && finding.severity === 'high') {
      return { class: 'needsJudgment', reason: 'highSeverity', probability };
    }
    return { class: 'notApplicable', reason: 'probability', probability };
  }
  return { class: 'needsJudgment', reason: 'probability', probability };
}

/** El tope de gasto de la PR y el precio del modelo, en dólares (decisión 6). */
export interface TriageBudget {
  capUsd: number;
  inputPricePerMTok: number;
}

/** Bytes por token al estimar: conservador, porque los tokens reales son algo menos (paso 1.1). */
const BYTES_PER_TOKEN = 3;

function estimatedTokens(value: unknown): number {
  return Math.ceil(new TextEncoder().encode(JSON.stringify(value)).length / BYTES_PER_TOKEN);
}

/**
 * Qué hallazgos caben en lo que queda del tope de la PR (decisión 6). La salida es gratis, así que
 * el coste es solo de entrada, y se estima antes de llamar: el contexto de la PR una vez por
 * petición y cada hallazgo por su tamaño. Entran por orden los que caben; los demás se quedan
 * fuera (regla 2).
 */
export function withinBudget(
  context: PullRequestContext,
  findings: Finding[],
  spentUsd: number,
  budget: TriageBudget,
): { asked: Finding[]; overBudget: Finding[] } {
  const affordable = ((budget.capUsd - spentUsd) * 1_000_000) / budget.inputPricePerMTok;
  let tokens = estimatedTokens(context);
  const asked: Finding[] = [];
  const overBudget: Finding[] = [];
  for (const finding of findings) {
    const withIt = tokens + estimatedTokens(finding);
    if (withIt <= affordable) {
      asked.push(finding);
      tokens = withIt;
    } else {
      overBudget.push(finding);
    }
  }
  return { asked, overBudget };
}

/** El gasto de la PR tras una llamada: lo que llevaba más los tokens de entrada cobrados. */
export function spend(spentUsd: number, inputTokens: number, budget: TriageBudget): number {
  return spentUsd + (inputTokens * budget.inputPricePerMTok) / 1_000_000;
}

/** Límite de Ollama para la clave de una pregunta (decisión 2). */
const MAX_KEY_LENGTH = 100;

function slug(text: string): string {
  return text
    .normalize('NFKD')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .replaceAll(/^_+|_+$/g, '');
}

function identity(finding: Finding): string {
  if (finding.source === 'check') return slug(`check ${finding.name}`);
  const file = finding.file.split('/').at(-1) ?? finding.file;
  const parts = [finding.reviewer, finding.badge, file, finding.line];
  return slug(parts.filter((part) => part !== null).join(' '));
}

/**
 * La clave de cada hallazgo en la petición al modelo (decisiones 2 y 5): su identidad (fuente,
 * fichero y línea, o el nombre de la comprobación), solo ASCII y como mucho 100 caracteres. Si dos
 * coinciden, la segunda lleva `_2`, y así.
 */
export function findingKeys(findings: Finding[]): string[] {
  const used = new Set<string>();
  return findings.map((finding) => {
    const base = identity(finding).slice(0, MAX_KEY_LENGTH);
    let key = base;
    for (let n = 2; used.has(key); n++) {
      const suffix = `_${n}`;
      key = base.slice(0, MAX_KEY_LENGTH - suffix.length) + suffix;
    }
    used.add(key);
    return key;
  });
}
