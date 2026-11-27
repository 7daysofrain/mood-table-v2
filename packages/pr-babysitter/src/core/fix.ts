/**
 * El arreglo visto desde el núcleo (change pr-fixer, decisiones 3, 10 y 11): qué se pide al puerto
 * `Fixer`, en qué estado está el trabajo y qué se le dice al mantenedor de lo que no se arregla.
 * Funciones puras; el estado del trabajo se valida con zod porque va en el estado del grafo (D65).
 */
import * as z from 'zod';

import { type Finding, findingSchema, type PullRequestContext } from './triage.ts';

/** Lo que se pide arreglar de un push: los hallazgos reales arreglables y lo que queda del tope. */
export interface FixJob {
  number: number;
  /** El push que se arregla: el *fixer* no sube nada si la cabeza de la PR ya no es esta. */
  sha: string;
  /** El título y la descripción de la PR: su alcance, para el agente. */
  pr: PullRequestContext;
  findings: Finding[];
  /** Lo que le queda a la PR del tope de gasto del arreglo (decisión 8). */
  budgetUsd: number;
}

/**
 * Por qué un hallazgo se queda sin arreglar: exige criterio, es una relanzable que la PR no causa,
 * su arreglo no pasa `lint`, `typecheck` y `test`, el agente no ha podido o se ha acabado el tope.
 */
export const notFixedReasonSchema = z.enum([
  'needsJudgment',
  'notCausedByPr',
  'checksFailed',
  'agentFailed',
  'budgetSpent',
]);

export type NotFixedReason = z.infer<typeof notFixedReasonSchema>;

/** Un hallazgo que el *fixer* no ha arreglado, con su motivo. */
export const unfixedSchema = z.object({ finding: findingSchema, reason: notFixedReasonSchema });

/** Por qué un trabajo de arreglo no ha subido nada, o no se ha podido pedir. */
export const fixFailureReasonSchema = z.enum([
  'fixerUnavailable',
  'nothingFixed',
  'budgetSpent',
  'interrupted',
  'error',
  'timedOut',
]);

export type FixFailureReason = z.infer<typeof fixFailureReasonSchema>;

/**
 * En qué está el trabajo de un push (decisión 3): en cola, en marcha, subido (con lo que no ha
 * arreglado), fallido sin subir nada, interrumpido dos veces, u obsoleto porque la PR ha cambiado.
 */
export const fixStatusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('none') }),
  z.object({ state: z.literal('queued') }),
  z.object({ state: z.literal('running') }),
  z.object({ state: z.literal('pushed'), sha: z.string(), unfixed: z.array(unfixedSchema) }),
  z.object({
    state: z.literal('failed'),
    reason: fixFailureReasonSchema,
    unfixed: z.array(unfixedSchema),
  }),
  z.object({ state: z.literal('interrupted') }),
  z.object({ state: z.literal('obsolete') }),
]);

export type FixStatus = z.infer<typeof fixStatusSchema>;

/**
 * Lo que el arreglo añade a los motivos de «necesita intervención» del aviso final (decisión 10):
 * relanzables que la PR no causa, el tope agotado o un trabajo que no ha subido nada, con lo que ha
 * quedado sin arreglar.
 */
export const fixReasonSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('notCausedByPr'), checks: z.array(z.string()) }),
  z.object({ kind: z.literal('fixBudgetSpent') }),
  z.object({
    kind: z.literal('fixFailed'),
    reason: fixFailureReasonSchema,
    unfixed: z.array(z.string()),
  }),
]);

export type FixReason = z.infer<typeof fixReasonSchema>;

/** Un hallazgo sin arreglar, como se le cuenta al mantenedor. */
export const notFixedItemSchema = z.object({ label: z.string(), reason: notFixedReasonSchema });

export type NotFixedItem = z.infer<typeof notFixedItemSchema>;

/** Cómo se nombra un hallazgo en un aviso: la comprobación, o el comentario o la incidencia y dónde. */
export function findingLabel(finding: Finding): string {
  switch (finding.source) {
    case 'check':
      return `\`${finding.name}\``;
    case 'reviewer':
      return `el comentario de ${finding.reviewer} en ${place(finding.file, finding.line)}`;
    case 'sonarIssue':
      return `la incidencia ${finding.rule} en ${place(finding.file, finding.line)}`;
  }
}

function place(file: string, line: number | null): string {
  return line === null ? `\`${file}\`` : `\`${file}:${line}\``;
}

/** Por qué no se arregla, en el idioma del mantenedor. */
export const NOT_FIXED_REASONS: Record<NotFixedReason, string> = {
  needsJudgment: 'exige criterio',
  notCausedByPr: 'falla y no la causa la PR',
  checksFailed: 'no pasa lint, typecheck y test',
  agentFailed: 'el agente no ha podido arreglarlo',
  budgetSpent: 'se ha agotado el tope de gasto',
};

/** Por qué un trabajo de arreglo no ha subido nada, en el idioma del mantenedor. */
export const FIX_FAILURES: Record<FixFailureReason, string> = {
  fixerUnavailable: 'no he podido pedir el arreglo',
  nothingFixed: 'ningún arreglo ha pasado lint, typecheck y test',
  budgetSpent: 'se ha agotado el tope de gasto del arreglo',
  interrupted: 'el arreglo se ha interrumpido dos veces',
  error: 'el arreglo ha fallado',
  timedOut: 'el arreglo no ha terminado a tiempo',
};

/** Un hallazgo sin arreglar en una línea: «`lint` (no pasa lint, typecheck y test)». */
export function notFixedLine({ label, reason }: NotFixedItem): string {
  return `${label} (${NOT_FIXED_REASONS[reason]})`;
}

/** Lo que el *fixer* devuelve sin arreglar, como se le cuenta al mantenedor. */
export function unfixedItems(unfixed: z.infer<typeof unfixedSchema>[]): NotFixedItem[] {
  return unfixed.map(({ finding, reason }) => ({ label: findingLabel(finding), reason }));
}
